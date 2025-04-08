import { getDocs, collection, query } from "firebase/firestore"; 
import { db } from "@/lib/firebase"
import { getCoords, getBuildingOutline } from "./mapsAPI";
import { API_ENDPOINT } from "./consts";
// const cors = require('cors')({origin: true});

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

            return {
                machine: doc.id,
                lat: fetchDeviceState(doc.id, undefined, undefined, "lat"),
                lng: fetchDeviceState(doc.id, undefined, undefined, "lng"),
                thing_id: data.thingId,
                state: fetchDeviceState(doc.id, undefined, undefined, "state")
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
        // get state timeseries for given machine
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Fetched timeseries for machine: ", machineId, " after start time: ", startTime, " for variable: ", variable, " with data: ", data, " dev mode: ", devMode);
        return data;
    } catch (e) {
        console.error('Error fetching timeseries:', e);
        return [];
    }
}


export async function fetchDeviceState(machine: string, signal?: AbortSignal, oldState?: string, variable?: string) {
    try {
      // always default to loading state
      const machines = collection(db, "machines");
      const querySnapshot = await getDocs(machines);
      const thing_id = querySnapshot.docs.find((doc) => doc.id === machine)?.data().thingId;
    
      if (!thing_id) {
        console.error('Thing ID not found for machine:', machine);
        return oldState || "loading";
      }
  
      const response = await fetch(`${API_ENDPOINT}/getDeviceState?thing_id=${thing_id}&variable=${variable}`, { signal });
  
      if (!response.ok) {
        console.error('Failed to fetch device state:', response);
        return oldState || "loading";
      }
  
      const data = await response.json();
      
      // make sure the variable exists in the response
      if (variable && data[variable] !== undefined) {
        return data[variable];
      }
      
      console.error(`Variable ${variable} not found in response:`, data);
      return oldState || "loading";
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return oldState || "loading";
      } else {
        console.error('Failed to fetch device state:', err);
        return oldState || "loading";
      }
    }
}