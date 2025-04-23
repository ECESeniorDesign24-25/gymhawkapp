export interface GeocodeResponse {
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