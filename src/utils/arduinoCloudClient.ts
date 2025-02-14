import { functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions";

const getArduinoProperties = httpsCallable(functions, 'getArduinoProperties');

export async function fetchArduinoProperties() {
  try {
    const result = await getArduinoProperties();
    const data = result.data;
    console.log('Properties Data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching properties:', { error });
    throw error;
  }
}
