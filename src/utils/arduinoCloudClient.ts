
export async function fetchProperties() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_API_ENDPOINT) {
    const errorMsg = "NEXT_PUBLIC_FIREBASE_FUNCTIONS_API_ENDPOINT is not defined.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const response = await fetch(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_API_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} | ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Properties Data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw error;
  }
}
