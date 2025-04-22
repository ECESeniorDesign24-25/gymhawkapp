import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DARK_MAP_THEME, ZOOM_LEVEL } from '@/styles/customStyles';
import { Marker } from '@/components/marker';
import { CustomMap } from '@/interfaces/map';
const GoogleMapReact = dynamic(() => import('google-map-react'), { ssr: false });


export default function Map({
  center,
  machines,
  buildingOutline,
  onMapChange,
  onMapLoaded,
  userZoomed = false
}: CustomMap) {
  const [map, setMap] = useState<any>(null);
  const [maps, setMaps] = useState<any>(null);
  const polygonRef = useRef<any>(null);

  // handle API loaded
  const handleApiLoaded = ({ map, maps }: { map: any; maps: any }) => {
    setMap(map);
    setMaps(maps);
    if (onMapLoaded) {
      onMapLoaded(map, maps);
    }
  };

  // draw building outline on map change
  useEffect(() => {
    if (map && maps && buildingOutline) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
  
      let convertedPath;
      if (Array.isArray(buildingOutline[0])) {
        convertedPath = buildingOutline[0].map((coord: any) => ({
          lat: coord[1],
          lng: coord[0]
        }));
      } else {
        convertedPath = buildingOutline.map((coord: any) => ({
          lat: coord[1],
          lng: coord[0]
        }));
      }
  
      polygonRef.current = new maps.Polygon({
        paths: convertedPath,
        strokeColor: "#0000FF",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map
      });
  
      // fit bounds if not zoomed
      if (!userZoomed) {
        const bounds = new maps.LatLngBounds();
        convertedPath.forEach((coord: any) => bounds.extend(coord));
        bounds.extend(center);
        map.fitBounds(bounds);
      }
    }
  }, [buildingOutline, map, maps, center, userZoomed]);

  return (
    <GoogleMapReact
      bootstrapURLKeys={{ key: process.env.NEXT_PUBLIC_MAPS_API_KEY! }}
      center={center}
      defaultZoom={ZOOM_LEVEL}
      yesIWantToUseGoogleMapApiInternals
      options={DARK_MAP_THEME}
      onGoogleApiLoaded={handleApiLoaded}
      resetBoundsOnResize={true}
      onChange={({ center }) => onMapChange?.(center)}
    >
      {machines.map((machineObj: any) => (
        <Marker
          key={machineObj.machine}
          lat={machineObj.lat}
          lng={machineObj.long}
          state={machineObj.state ? machineObj.state : "na"}
          machine={machineObj.machine}
          thing_id={machineObj.thing_id}
        />
      ))}
    </GoogleMapReact>
  );
}
