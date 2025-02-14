import { functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions";

const fetchArduinoProperties = httpsCallable(functions, 'fetchArduinoProperties');

export async function fetchProperties() {
  try {
    const result = await fetchArduinoProperties();
    const data = result.data;
    console.log('Properties Data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching properties:', { error });
    throw error;
  }
}
