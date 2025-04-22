import { getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { collection } from "firebase/firestore";

export async function getThingId(machine: string) {
    const machines = collection(db, "machines");
    const querySnapshot = await getDocs(machines);
    const machineDoc = querySnapshot.docs.find((doc) => doc.id === machine);
    const thing_id = machineDoc?.data().thingId;
    return thing_id;
}


export async function formatState(state: string) {
    if (state === "on") {
        return "In Use"
    } else if (state === "off") {
        return "Available"
    } else {
        return "Unknown"
    }
}