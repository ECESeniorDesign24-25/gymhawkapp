import { getDocs, collection, query } from "firebase/firestore"; 
import { db } from "@/lib/firebase"
import { getCoords, getBuildingOutline } from "./mapsAPI";
import { API_ENDPOINT } from "./consts";

export async function fetchMachines(gymId: string) {
    try {
        if (!gymId) {
            console.error("No gymId provided to fetchMachines");
            return [];
        }
        const machines = collection(db, "machines");
        const querySnapshot = await getDocs(machines);

        // this is so we wait for each to load
        const machinePromises = querySnapshot.docs.map(async (doc) => {
            if (doc.data().gymId !== gymId) {
                return null;
            }
            const data = doc.data();

            // TODO: retreive lat/lng from cloud, add rate
            let lat: number;
            let lng: number;
            if (doc.id.includes("Blue")) {
                lat = 41.6572472
                lng = -91.5389825
            }
            else {
                lat = 41.6576472,
                lng = -91.5381925
            }

            return {
                machine: doc.id,
                lat: lat,
                lng: lng,
                thing_id: data.thingId,
                state: fetchDeviceState(doc.id)
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

export async function fetchMachineTimeseries(machineId: string, startTime: string) {
    try {
        // get state timeseries for given machine
        const response = await fetch(`${API_ENDPOINT}/getStateTimeseries?thing_id=${machineId}&startTime=${startTime}`);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (e) {
        console.error('Error fetching timeseries:', e);
        return [];
    }
}

export async function fetchDeviceState(machine: string, signal?: AbortSignal, oldState?: string) {
    try {
      // always default to loading state
      const machines = collection(db, "machines");
      const querySnapshot = await getDocs(machines);
      const thing_id = querySnapshot.docs.find((doc) => doc.id === machine)?.data().thingId;
    
      if (!thing_id) {
        console.error('Thing ID not found for machine:', machine);
        return oldState || "loading";
      }
  
      const response = await fetch(`${API_ENDPOINT}/getDeviceState?thing_id=${thing_id}`, { signal });
  
      if (!response.ok) {
        console.error('Failed to fetch device state:', response);
        return oldState || "loading";
      }
  
      // decode to utf8
      const buffer = await response.arrayBuffer();
      const utf8Text = new TextDecoder('utf-8').decode(buffer);
      const data = JSON.parse(utf8Text);
      return data.state;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return oldState || "loading";
      } else {
        console.error('Failed to fetch device state:', err);
        return oldState || "loading";
      }
    }
}