import axios from 'axios';

export async function getMachineAInUseState() {
  try {
    const response = await axios.get('/api/arduinoProperty');
    console.log('Retrieved machineAInUse state:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error retrieving machineAInUse state:', error);
    throw error;
  }
}
