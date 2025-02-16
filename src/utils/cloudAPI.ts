export async function fetchDeviceState() {
  try {
    const response = await fetch('https://gymhawk-2ed7f.web.app/api/getDeviceStates');
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch data:', err);
    throw err;
  }
}

fetchDeviceState()