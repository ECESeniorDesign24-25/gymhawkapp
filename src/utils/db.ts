import { getDocs, collection, query, getDoc, doc } from "firebase/firestore"; 
import { db } from "@/lib/firebase"
import { getCoords, getBuildingOutline, getLat, getLong } from "./map_utils";
import { API_ENDPOINT } from "./consts";
import { constants } from "buffer";
import { getThingId } from "./common";


export async function fetchMachines(gymId: string) {
    try {
        if (!gymId) {
            console.error("No gymId provided to fetchMachines");
            return [];
        }
        const machines = collection(db, "machines");
        const thing_ids = collection(db, "thing_ids");
        const querySnapshot = await getDocs(machines);

        // this is so we wait for each to load
        const machinePromises = querySnapshot.docs.map(async (docSnapshot) => {
            if (docSnapshot.data().gymId !== gymId) {
                return null;
            }
            const data = docSnapshot.data();
            
            const lat = await getLat(docSnapshot.id);
            const lng = await getLong(docSnapshot.id);
            const type = await fetchDeviceState(docSnapshot.id, 'Unknown', "type");
            const state = await fetchDeviceState(docSnapshot.id, 'Unknown', "state");
            const device_status = await fetchDeviceState(docSnapshot.id, 'OFFLINE', "device_status");

            const thing_id_doc = await getDoc(doc(thing_ids, data.thingId));
            
            let floor;
            if (thing_id_doc.exists()) {
                floor = thing_id_doc.data()?.floor;
            } else {
                floor = undefined;
            }
            
            let last_used_time = await fetchLastUsedTime(docSnapshot.id);
            if (last_used_time === null) {
                last_used_time = "Never";
            }

            return {
                machine: docSnapshot.id,
                lat,
                lng,
                thing_id: data.thingId,
                state: state,
                device_status: device_status,
                machine_type: type,
                floor: floor,
                last_used_time: last_used_time
            }
        })

        const machineArray = await Promise.all(machinePromises);
        return machineArray.filter(machine => machine !== null);
    } catch (e) {
        console.error('error fetching machines: ', e);
        return [];
    }
}

export async function fetchGyms(){
    try {
        const gyms = collection(db, "gyms");
        const querySnapshot = await getDocs(gyms);

        // this is so that it waits for each to load
        const gymPromises = querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            return {
                label: data.name,
                id: doc.id,
                floors: data.floors,
                coords: await getCoords(doc.id),
                building: await getBuildingOutline(doc.id)
            }
        })
        
        const gymArray = await Promise.all(gymPromises);
        return gymArray;
    } catch (e) {
        console.error("error fetching gyms: ", e);
    }
}

export async function fetchMachineTimeseries(machineId: string, startTime: string, variable: string) {
    try {
        if (!machineId) {
            console.error("No machineId provided to fetchMachineTimeseries");
            return [];
        }

        // Format query parameters according to the API requirements
        const params = new URLSearchParams({
            thing_id: machineId,
            start_time: startTime,
            variable: variable
        });
        
        const endpoint = `${API_ENDPOINT}/getStateTimeseries?${params.toString()}`;
        
        console.log("📊 TIMESERIES REQUEST:", {
            machineId, 
            startTime,
            variable,
            endpoint
        });
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        
        // Attempt to parse the response body regardless of HTTP status
        let data = [];
        try {
            const responseText = await response.text();
            
            // Check if the response is valid JSON before parsing
            if (responseText && responseText.trim().startsWith('[')) {
                data = JSON.parse(responseText);
                console.log(`📊 TIMESERIES RESPONSE for ${machineId}:`, {
                    status: response.status,
                    dataLength: data?.length || 0,
                    firstPoint: data?.length > 0 ? data[0] : null,
                    lastPoint: data?.length > 0 ? data[data.length - 1] : null
                });
            } else {
                console.error('❌ Invalid JSON response:', responseText);
            }
        } catch (parseError) {
            console.error('❌ Failed to parse response:', parseError);
        }
        
        // Log an error if the response status is not OK
        if (!response.ok) {
            console.warn(`⚠️ API returned status ${response.status}, but we're still processing the data if available`);
        }
        
        return data || [];
        
    } catch (e) {
        console.error('❌ Error in fetchMachineTimeseries:', e);
        return [];
    }
}

export async function fetchDeviceState(machine: string, oldState?: string, variable?: string) {
    try {
      // always default to loading state
      const machines = collection(db, "machines");
      const querySnapshot = await getDocs(machines);
      const thing_id = querySnapshot.docs.find((doc) => doc.id === machine)?.data().thingId;

      if (!thing_id) {
        console.error('Thing ID not found for machine:', machine);
        return oldState || 'Unknown';
      }
  
      const request = `${API_ENDPOINT}/getDeviceState?thing_id=${thing_id}&variable=${variable}`;
      const response = await fetch(request);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch device state:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          machine,
          thing_id,
          variable,
        });        
        return oldState || 'Unknown';
      }
  
      const data = await response.json();
      
      // make sure the variable exists in the response
      if (variable && data[0][variable] !== undefined) {
        return data[0][variable];
      }
      
      return oldState || 'Unknown';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return oldState || 'Unknown';
      } else {
        console.error('Failed to fetch device state:', {
          error: err,
          machine,
          variable
        });
        return oldState || 'Unknown';
      }
    }
}

export async function fetchLastUsedTime(machine: string) {
    const thing_id = await getThingId(machine);
    const request = `${API_ENDPOINT}/getLastUsedTime?thing_id=${thing_id}`;
    const response = await fetch(request);
    return await response.json();
}

export async function fetchMachineDetails(thingId: string) {
    try {
        if (!thingId) {
            console.error("No thingId provided to fetchMachineDetails");
            return null;
        }
        
        const machines = collection(db, "machines");
        const thing_ids = collection(db, "thing_ids");
        const querySnapshot = await getDocs(machines);
        
        // Find the machine document with the matching thingId
        const machineDoc = querySnapshot.docs.find(doc => doc.data().thingId === thingId);
        
        if (!machineDoc) {
            console.error(`No machine found with thingId: ${thingId}`);
            return null;
        }
        
        const machineId = machineDoc.id;
        const data = machineDoc.data();
        
        const lat = await getLat(machineId);
        const lng = await getLong(machineId);
        const type = await fetchDeviceState(machineId, 'Unknown', "type");
        const state = await fetchDeviceState(machineId, 'Unknown', "state");
        const device_status = await fetchDeviceState(machineId, 'OFFLINE', "device_status");
        
        const thing_id_doc = await getDoc(doc(thing_ids, data.thingId));
        
        let floor;
        if (thing_id_doc.exists()) {
            floor = thing_id_doc.data()?.floor;
        } else {
            floor = undefined;
        }
        
        let last_used_time = await fetchLastUsedTime(machineId);
        if (last_used_time === null) {
            last_used_time = "Never";
        }
        
        return {
            machine: machineId,
            lat,
            lng,
            thing_id: data.thingId,
            state: state,
            device_status: device_status,
            machine_type: type,
            floor: floor,
            last_used_time: last_used_time
        };
        
    } catch (e) {
        console.error('Error fetching machine details: ', e);
        return null;
    }
}