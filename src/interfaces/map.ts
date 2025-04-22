export interface CustomMap {
    center: { lat: number; lng: number };
    machines: any[];
    buildingOutline: any[] | null;
    onMapChange?: (center: { lat: number; lng: number }) => void;
    onMapLoaded?: (map: any, maps: any) => void;
    userZoomed?: boolean;
  }

export default CustomMap;