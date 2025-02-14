import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import dynamic from 'next/dynamic';
import styles from '@/styles/index.module.css';
import { HOME_STYLE, DARK_MAP_THEME, ZOOM_LEVEL } from '@/styles/customStyles';
import { GYMS, MAPS_API_KEY } from '@/utils/consts';
import { fetchArduinoProperties } from '@/utils/arduinoCloudClient';

const GoogleMapReact = dynamic(() => import('google-map-react'), { ssr: false });

export default function Home() {
  const [selectedOption, setSelectedOption] = useState(null);
  const [center, setCenter] = useState({ lat: 41.6611, lng: -91.5302 });
  const [buildingOutline, setBuildingOutline] = useState<any[] | null>(null);
  const [map, setMap] = useState<any>(null);
  const [maps, setMaps] = useState<any>(null);
  const polygonRef = useRef<any>(null);
  const [machineAInUse, setMachineAInUse] = useState<any>(null);

  const handleSelect = async (option: any) => {
    setSelectedOption(option);
    if (option) {
      const newCenter = { 
        lat: option.coords.lat, 
        lng: option.coords.lng 
      };
      setCenter(newCenter);

      if (map && maps) {
        map.panTo(newCenter);
      }

      let outline = option.building;
      setBuildingOutline(outline);
    }
  };

  useEffect(() => {
    if (map && maps && buildingOutline) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }

      let convertedPath: { lat: number; lng: number }[];
      if (Array.isArray(buildingOutline[0])) {
        convertedPath = buildingOutline[0].map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        }));
      } else {
        convertedPath = buildingOutline.map((coord: number[]) => ({
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

      const bounds = new maps.LatLngBounds();
      convertedPath.forEach(coord => bounds.extend(coord));
      bounds.extend(center);
      map.fitBounds(bounds);
    } else {
      if (!map) console.log("Map instance not set");
      if (!maps) console.log("Maps API not set");
      if (!buildingOutline) console.log("Building outline is null or undefined");
    }
  }, [buildingOutline, map, maps, center]);

  const handleApiLoaded = ({ map, maps }: { map: any, maps: any }) => {
    setMap(map);
    setMaps(maps);
  };

  useEffect(() => {
    // Poll for the machineAInUse state every second
    const intervalId = setInterval(async () => {
      const data = await fetchArduinoProperties();
      // assuming that data contains the property "machineAInUse"
      setMachineAInUse(data ? true : null);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={styles.container}>
      <Banner />
      <div className="flex flex-col md:flex-row items-start justify-between">
        <div className={styles.headerSearchContainer}>
          <header className={styles.header}>GymHawk</header>
          <div className={styles.searchBarContainer}>
            <Select
              options={GYMS}
              onChange={handleSelect}
              placeholder="Search gyms..."
              styles={HOME_STYLE}
            />
          </div>
        </div>
        <div className={styles.mapContainer}>
          <GoogleMapReact
            bootstrapURLKeys={{ key: MAPS_API_KEY! }}
            center={center}
            defaultZoom={ZOOM_LEVEL}
            yesIWantToUseGoogleMapApiInternals
            options={DARK_MAP_THEME}
            onGoogleApiLoaded={handleApiLoaded}
            resetBoundsOnResize={true}
            onChange={({ center }) => setCenter(center)}
          />
        </div>
      </div>
      {/* Display machineAInUse state below the map */}
      <div>
        Machine A In Use: {machineAInUse == null ? 'Not found' : machineAInUse.toString()}
      </div>
      <Footer />
    </div>
  );
}
