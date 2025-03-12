import { getDocs, collection, query } from "firebase/firestore"; 
import { db } from "@/lib/firebase"
import { getCoords, getBuildingOutline } from "./mapsAPI";
import { fetchDeviceState } from "./cloudAPI";

export async function fetchMachines() {
    try {
        const machines = collection(db, "machines");
        const querySnapshot = await getDocs(machines);

        // this is so we wait for each to load
        const machinePromises = querySnapshot.docs.map(async (doc) => {
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
                state: fetchDeviceState(doc.id)
            }
        })

        const machineArray = await Promise.all(machinePromises);
        return machineArray;
    } catch (e) {
        console.error('error fetching machines: ', e);
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
        const response = await fetch(`/api/getStateTimeseries?thing_id=${machineId}&start_time=${startTime}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (e) {
        console.error('Error fetching timeseries:', e);
        return [];
    }
}