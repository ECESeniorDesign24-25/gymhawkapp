import axios from 'axios';
import { MAPS_ENDPOINT } from './consts';
import { getThingId } from './common';
import { API_ENDPOINT } from './consts';
import { GeocodeResponse } from '../interfaces/geocode'; 

// cache coordinates to only poll every 15 min
const coordCache: Record<string, {value: number|null, timestamp: number}> = {};
const CACHE_EXPIRY = 15 * 60 * 1000;

export const getCoords = async (id: string) => {
    try {
        if (!process.env.NEXT_PUBLIC_MAPS_API_KEY) {
          console.error('NEXT_PUBLIC_MAPS_API_KEY environment variable is missing');
          return null;
        }

        const response = await axios.get<GeocodeResponse>(MAPS_ENDPOINT, {
          params: {
              place_id: id,
              key: process.env.NEXT_PUBLIC_MAPS_API_KEY,
          },
        });

        if (response.data.status !== 'OK' || !response.data.results[0]) {
          console.error('Geocoding error:', response.data.status);
          return null;
        }

        return response.data.results[0].geometry.location;
        
    } catch (error) {
        console.error('Geocoding failed:', error instanceof Error ? error.message : error);
        return null;
    }
};

export const getBuildingOutline = async (id: string) => {
    try {
        if (!process.env.NEXT_PUBLIC_MAPS_API_KEY) {
          console.error('NEXT_PUBLIC_MAPS_API_KEY environment variable is missing!');
          return null;
        }

        const response = await axios.get<GeocodeResponse>(MAPS_ENDPOINT + "?extra_computations=BUILDING_AND_ENTRANCES", {
        params: {
            place_id: id,
            key: process.env.NEXT_PUBLIC_MAPS_API_KEY
        },
        });

        if (response.data.status !== 'OK' || !response.data.results[0]) {
          console.error('Geocoding error:', response.data.status);
          return null;
        }

        return response.data.results[0]?.buildings?.[0]?.building_outlines?.[0]?.display_polygon?.coordinates ?? null;
        
    } catch (error) {
        console.error('Geocoding failed:', error instanceof Error ? error.message : error);
        return null;
    }
};


export async function getLat(machine: string) {
  // check cache first
  const cacheKey = `lat_${machine}`;
  const now = Date.now();
  
  if (coordCache[cacheKey] && (now - coordCache[cacheKey].timestamp) < CACHE_EXPIRY) {
    return coordCache[cacheKey].value;
  }
  
  try {
    const thing_id = await getThingId(machine);
    
    if (!thing_id) {
      console.error('No thing_id found for machine:', machine);
      return null;
    }
    
    const response = await fetch(`${API_ENDPOINT}/getLat?thing_id=${thing_id}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching latitude: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle various response formats
    let latValue = null;
    
    if (data && data.lat !== undefined) {
      latValue = parseFloat(data.lat);
    } else if (data && data[0] && data[0].lat !== undefined) {
      latValue = parseFloat(data[0].lat);
    }
    
    if (latValue !== null && !isNaN(latValue) && latValue !== 0) {

      // cache
      coordCache[cacheKey] = { value: latValue, timestamp: now };
      return latValue;
    } else {
      console.warn(`Invalid latitude for ${machine}: ${latValue}`);
      return null;
    }
  } catch (error) {
    console.error('Error getting latitude:', error);
    return null;
  }
}


export async function getLong(machine: string) {
  // check cache first
  const cacheKey = `lng_${machine}`;
  const now = Date.now();
  
  if (coordCache[cacheKey] && (now - coordCache[cacheKey].timestamp) < CACHE_EXPIRY) {
    return coordCache[cacheKey].value;
  }
  
  try {
    const thing_id = await getThingId(machine);
    
    if (!thing_id) {
      console.error('No thing_id found for machine:', machine);
      return null;
    }
    
    const response = await fetch(`${API_ENDPOINT}/getLong?thing_id=${thing_id}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching longitude: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle various response formats
    let lngValue = null;
    
    if (data && data.long !== undefined) {
      lngValue = parseFloat(data.long);
    } else if (data && data.lng !== undefined) {
      lngValue = parseFloat(data.lng);
    } else if (data && data[0] && data[0].long !== undefined) {
      lngValue = parseFloat(data[0].long);
    } else if (data && data[0] && data[0].lng !== undefined) {
      lngValue = parseFloat(data[0].lng);
    }
    
    if (lngValue !== null && !isNaN(lngValue) && lngValue !== 0) {

      // cache
      coordCache[cacheKey] = { value: lngValue, timestamp: now };
      return lngValue;
    } else {
      console.warn(`Invalid longitude for ${machine}: ${lngValue}`);
      return null;
    }
  } catch (error) {
    console.error('Error getting longitude:', error);
    return null;
  }
}


