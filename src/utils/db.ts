import { getDocs, collection, query } from "firebase/firestore"; 
import { db } from "@/lib/firebase"
import { getCoords, getBuildingOutline } from "./mapsAPI";

export async function fetchMachines() {
    try {
        const machines = collection(db, "machines");
        const querySnapshot = await getDocs(machines);

        // this is so we wait for each to load
        const machinePromises = querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            return {
                
            }
        })
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