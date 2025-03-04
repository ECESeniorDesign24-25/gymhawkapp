import { getDocs, collection, query } from "firebase/firestore"; 
import { db } from "@/lib/firebase"

export async function fetchDeviceState(machine: string, signal?: AbortSignal) {
  try {
    // always default to loading state
    const machines = collection(db, "machines");
    const querySnapshot = await getDocs(machines);
    const thing_id = querySnapshot.docs.find((doc) => doc.id === machine)?.data().thingId;

    if (!thing_id) {
      return "loading";
    }

    const response = await fetch(`https://gymhawk-2ed7f.web.app/api/getDeviceState?thing_id=${thing_id}`, { signal });

    if (!response.ok) {
      return "loading";
    }

    // decode to utf8
    const buffer = await response.arrayBuffer();
    const utf8Text = new TextDecoder('utf-8').decode(buffer);
    const data = JSON.parse(utf8Text);
    return data.state;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('Fetch aborted for thing:', machine);
      return "loading";
    } else {
      console.error('Failed to fetch device state:', err);
      return "loading";
    }
  }
}