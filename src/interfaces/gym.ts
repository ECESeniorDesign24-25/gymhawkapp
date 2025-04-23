export interface Gym {
  id: string;
  label: string;
  floors: any[];
  coords: {
    lat: number;
    lng: number;
  } | null;
  building: any;
}

export interface GymOption {
  value: string;
  label: string;
  id: string;
  coords: {
    lat: number;
    lng: number;
  };
  building: any[];
}
