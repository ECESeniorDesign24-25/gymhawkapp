import axios from 'axios';
import { MAPS_ENDPOINT } from './consts';
import { getThingId } from './common';
import { API_ENDPOINT } from './consts';


interface GeocodeResponse {
  results: {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    buildings?: {
      building_outlines: any[];
      place_id: string;
    }[];
  }[];
  status: string;
}

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
    console.log("Fetched latitude: ", data);
    // Return the latitude value from the response
    if (data[0] && data[0].lat !== undefined) {
      return parseFloat(data[0].lat);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting latitude:', error);
    return null;
  }
}


export async function getLong(machine: string) {
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
    console.log("Fetched longitude: ", data);
    if (data[0] && data[0].long !== undefined) {
      return parseFloat(data[0].long);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting longitude:', error);
    return null;
  }
}


