export async function fetchDeviceState(machine: string) {
  try {
    const response = await fetch(`https://gymhawk-2ed7f.web.app/api/getDeviceState?machine=${machine}`);

    // decode to utf8
    const buffer = await response.arrayBuffer();
    const utf8Text = new TextDecoder('utf-8').decode(buffer);
    const data = JSON.parse(utf8Text);

    return data.state;
  } catch (err) {
    console.error('Failed to fetch data:', err);
    throw err;
  }
}