import { getDocs, collection, query, getDoc, doc } from "firebase/firestore"; 
import { db } from "@/lib/firebase"
import { getCoords, getBuildingOutline, getLat, getLong } from "./map_utils";
import { API_ENDPOINT, OTHER_API_ENDPOINT } from "./consts";
import { getThingId } from "./common";
import { getCurrentTime } from "./time_utils";

export async function fetchMachines(gymId: string) {
  try {
      if (!gymId) {
          console.error("No gymId provided to fetchMachines");
          return [];
      }
      const machines = collection(db, "machines");
      const thing_ids = collection(db, "thing_ids");
      const querySnapshot = await getDocs(machines);

      // this is so we wait for each to load
      const machinePromises = querySnapshot.docs.map(async (docSnapshot) => {
          if (docSnapshot.data().gymId !== gymId) {
              return null;
          }
          const data = docSnapshot.data();
          
          const lat = await getLat(docSnapshot.id);
          const lng = await getLong(docSnapshot.id);
          let type = await fetchDeviceState(docSnapshot.id, 'Unknown', "type");
          const state = await fetchDeviceState(docSnapshot.id, 'Unknown', "state");
          const device_status = await fetchDeviceState(docSnapshot.id, 'OFFLINE', "device_status");
          
          if (!type || type === 'Unknown') {
              type = 'Fitness Equipment';
          }

          const thing_id_doc = await getDoc(doc(thing_ids, data.thingId));
          
          let floor;
          if (thing_id_doc.exists()) {
              floor = thing_id_doc.data()?.floor;
          } else {
              floor = undefined;
          }
          
          let last_used_time = await fetchLastUsedTime(docSnapshot.id);
          if (last_used_time === null) {
              last_used_time = "Never";
          }

          return {
              machine: docSnapshot.id,
              lat,
              lng,
              thing_id: data.thingId,
              state: state,
              device_status: device_status,
              machine_type: type,
              floor: floor,
              last_used_time: last_used_time
          }
      })

      const machineArray = await Promise.all(machinePromises);
      return machineArray.filter(machine => machine !== null);
  } catch (e) {
      console.error('error fetching machines: ', e);
      return [];
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

export async function fetchMachineTimeseries(machineId: string, startTime: string, variable: string) {
    try {
        if (!machineId) {
            console.error("No machineId provided to fetchMachineTimeseries");
            return [];
        }

        const params = new URLSearchParams({
            thing_id: machineId,
            start_time: startTime,
            variable: variable
        });
        
        const endpoint = `${API_ENDPOINT}/getStateTimeseries?${params.toString()}`;
        
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        
        let data = [];
        try {
            const responseText = await response.text();
            
            // Check if the response is valid JSON before parsing
            if (responseText && responseText.trim().startsWith('[')) {
                data = JSON.parse(responseText);
            } 
        } catch (parseError) {
          console.error("error parsing response: ", parseError);
        }
        
        return data || [];
        
    } catch (e) {
        return [];
    }
}

export async function fetchDeviceState(machine: string, oldState?: string, variable?: string) {
    try {
      // always default to loading state
      const machines = collection(db, "machines");
      const querySnapshot = await getDocs(machines);
      const thing_id = querySnapshot.docs.find((doc) => doc.id === machine)?.data().thingId;

      if (!thing_id) {
        console.error('Thing ID not found for machine:', machine);
        return oldState || 'Unknown';
      }
  
      const request = `${API_ENDPOINT}/getDeviceState?thing_id=${thing_id}&variable=${variable}`;
      const response = await fetch(request);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch device state:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          machine,
          thing_id,
          variable,
        });        
        return oldState || 'Unknown';
      }
  
      const data = await response.json();
      
      // make sure the variable exists in the response
      if (variable && data[0][variable] !== undefined) {
        return data[0][variable];
      }
      
      return oldState || 'Unknown';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return oldState || 'Unknown';
      } else {
        console.error('Failed to fetch device state:', {
          error: err,
          machine,
          variable
        });
        return oldState || 'Unknown';
      }
    }
}

export async function fetchLastUsedTime(machine: string) {
    const thing_id = await getThingId(machine);
    const request = `${API_ENDPOINT}/getLastUsedTime?thing_id=${thing_id}`;
    const response = await fetch(request);
    return await response.json();
}

export async function fetchMachineDetails(thingId: string) {
    try {
        if (!thingId) {
            console.error("No thingId provided to fetchMachineDetails");
            return null;
        }
        
        const machines = collection(db, "machines");
        const thing_ids = collection(db, "thing_ids");
        const querySnapshot = await getDocs(machines);
        
        // Find the machine document with the matching thingId
        const machineDoc = querySnapshot.docs.find(doc => doc.data().thingId === thingId);
        
        if (!machineDoc) {
            console.error(`No machine found with thingId: ${thingId}`);
            return null;
        }
        
        const machineId = machineDoc.id;
        const data = machineDoc.data();
        
        const lat = await getLat(machineId);
        const lng = await getLong(machineId);
        const type = await fetchDeviceState(machineId, 'Unknown', "type");
        const state = await fetchDeviceState(machineId, 'Unknown', "state");
        const device_status = await fetchDeviceState(machineId, 'OFFLINE', "device_status");
        
        const thing_id_doc = await getDoc(doc(thing_ids, data.thingId));
        
        let floor;
        if (thing_id_doc.exists()) {
            floor = thing_id_doc.data()?.floor;
        } else {
            floor = undefined;
        }
        
        let last_used_time = await fetchLastUsedTime(machineId);
        if (last_used_time === null) {
            last_used_time = "Never";
        }
        
        return {
            machine: machineId,
            lat,
            lng,
            thing_id: data.thingId,
            state: state,
            device_status: device_status,
            machine_type: type,
            floor: floor,
            last_used_time: last_used_time
        };
        
    } catch (e) {
        console.error('Error fetching machine details: ', e);
        return null;
    }
}

// Fetch total usage hours for a machine
export async function fetchTotalUsage(machineId: string): Promise<number> {
  try {
    const url = `${OTHER_API_ENDPOINT}/getTotalUsage?thing_id=${machineId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error fetching total usage:', response.statusText);
      return 0;
    }
    
    const textResponse = await response.text();
    
    // parse as a number directly
    const parsedNumber = parseFloat(textResponse);
    if (!isNaN(parsedNumber)) {
      return parsedNumber;
    }
    
    // try json
    try {
      const jsonData = JSON.parse(textResponse);
      if (typeof jsonData === 'number') {
        return jsonData;
      }
      return 0;
    } catch (error) {
      console.error('Error parsing total usage response:', error);
      return 0;
    }
  } catch (error) {
    console.error('Error fetching total usage:', error);
    return 0;
  }
}

export async function fetchDailyUsage(machineId: string, date: string): Promise<number> {
  try {
    const url = `${OTHER_API_ENDPOINT}/getDailyUsage?thing_id=${machineId}&date=${date}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error fetching daily usage:', response.statusText);
      return 0;
    }
    
    const textResponse = await response.text();
    
    // parse as a number directly
    const parsedNumber = parseFloat(textResponse);
    if (!isNaN(parsedNumber)) {
      return parsedNumber;
    }
    
    // try json
    try {
      const jsonData = JSON.parse(textResponse);
      if (typeof jsonData === 'number') {
        return jsonData;
      }
      return 0;
    } catch (error) {
      console.error('Error parsing daily usage response:', error);
      return 0;
    }
  } catch (error) {
    console.error('Error fetching daily usage:', error);
    return 0;
  }
}

export async function fetchDailyPercentages(machineId: string): Promise<{ day: string; percentage: number }[]> {
  try {
    const url = `${OTHER_API_ENDPOINT}/getDailyPercentages?thing_id=${machineId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error fetching daily percentages:', response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    // Backend returns an array of arrays: [thing_id, day_number, day_name, percent_in_use]
    // Each row is [string, number, string, number]
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Create a map of day to percentage from the nested array data
    const dayMap = new Map<string, number>();
    if (Array.isArray(data)) {
      data.forEach((item: any[]) => {
        if (Array.isArray(item) && item.length >= 4) {
          // item[2] is day_name, item[3] is percent_in_use
          const dayName = item[2];
          const percentage = item[3];
          if (typeof dayName === 'string' && !isNaN(Number(percentage))) {
            dayMap.set(dayName, Number(percentage));
          }
        }
      });
    }
    
    // Map to proper format ensuring all days are included
    return dayOrder.map(day => ({
      day,
      percentage: dayMap.has(day) ? dayMap.get(day)! : 0
    }));
  } catch (error) {
    console.error('Error fetching daily percentages:', error);
    return [];
  }
}

// Fetch hourly usage percentages
export async function fetchHourlyPercentages(machineId: string): Promise<{ hour: number; percentage: number }[]> {
  try {
    const url = `${OTHER_API_ENDPOINT}/getHourlyPercentages?thing_id=${machineId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Error fetching hourly percentages:', response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    // Backend returns an array of arrays: [thing_id, hour_number, percent_in_use]
    // Each row is [string, number, number]
    const hourMap = new Map<number, number>();
    if (Array.isArray(data)) {
      data.forEach((item: any[]) => {
        if (Array.isArray(item) && item.length >= 3) {
          // item[1] is hour_number, item[2] is percent_in_use
          const hourNumber = item[1];
          const percentage = item[2];
          if (!isNaN(Number(hourNumber)) && !isNaN(Number(percentage))) {
            hourMap.set(Number(hourNumber), Number(percentage));
          }
        }
      });
    }
    
    // Create a complete set of hours (0-23)
    const result: { hour: number; percentage: number }[] = [];
    for (let hour = 0; hour < 24; hour++) {
      result.push({
        hour,
        percentage: hourMap.has(hour) ? hourMap.get(hour)! : 0
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching hourly percentages:', error);
    return [];
  }
}

// get peak hours prediction
export async function fetchPeakHours(
  machineId: string, 
  date: string = new Date().toISOString().split('T')[0], 
  isPeak: boolean = true
): Promise<string[]> {
  try {
    const startTime = `${date}T06:00:00.000Z`;
    const endTime = `${date}T19:00:00.000Z`;
    
    const url = `${API_ENDPOINT}/getPeakHours?thing_id=${machineId}&date=${date}&start_time=${startTime}&end_time=${endTime}&peak=${isPeak}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[API] Error fetching ${isPeak ? 'peak' : 'ideal'} hours:`, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    // format the times to be more readable
    const formattedTimes = data.map((timestamp: string) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    });
    
    return formattedTimes;
  } catch (error) {
    console.error(`[API] Error fetching ${isPeak ? 'peak' : 'ideal'} hours for machine ${machineId}:`, error);
    return [];
  }
}