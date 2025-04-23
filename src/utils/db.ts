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

export async function fetchMachineTimeseries(machineId: string, startTime: string, devMode: boolean, variable: string) {
    try {
        let endpoint = "";
        if (devMode) {
            endpoint = `${API_ENDPOINT}/getStateTimeseriesDummy?thing_id=${machineId}&startTime=${startTime}&variable=${variable}`;
        }
        else {
            endpoint = `${API_ENDPOINT}/getStateTimeseries?thing_id=${machineId}&startTime=${startTime}&variable=${variable}`;
        }
        
        // Use no-cors mode to bypass CORS restrictions
        const response = await fetch(endpoint, {
            method: 'GET',
            mode: 'no-cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        
        return [];
        
    } catch (e) {
        console.error('Error in fetchMachineTimeseries:', e);
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