export async function fetchDeviceState(machine: string, signal?: AbortSignal) {
  try {
    const response = await fetch(`https://gymhawk-2ed7f.web.app/api/getDeviceState?machine=${machine}`, { signal });

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
      console.log('Fetch aborted for machine:', machine);
    } else {
      console.error('Failed to fetch device state:', err);
      return "loading";
    }
  }
}