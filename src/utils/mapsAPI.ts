import axios from 'axios';
import { MAPS_ENDPOINT } from './consts';

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
