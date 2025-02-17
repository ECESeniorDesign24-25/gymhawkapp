import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import dynamic from 'next/dynamic';
import styles from '@/styles/index.module.css';
import { HOME_STYLE, DARK_MAP_THEME, ZOOM_LEVEL } from '@/styles/customStyles';
import { fetchGyms, fetchMachines } from '@/utils/db';
import { fetchDeviceState } from '@/utils/cloudAPI';
import { MachineMarker } from '@/components/marker';

const GoogleMapReact = dynamic(() => import('google-map-react'), { ssr: false });


export default function Home() {
  const [selectedOption, setSelectedOption] = useState(null);
  const [center, setCenter] = useState({ lat: 41.6611, lng: -91.5302 });
  const [buildingOutline, setBuildingOutline] = useState<any[] | null>(null);
  const [map, setMap] = useState<any>(null);
  const [maps, setMaps] = useState<any>(null);
  const polygonRef = useRef<any>(null);
  const [gyms, setGyms] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);


  // fetch gyms from database on first render
  useEffect(() => {
    async function loadGyms() {
      const gyms = await fetchGyms();
      setGyms(gyms || []);
    }
    loadGyms();
  }, []);

  
  // fetch machines on first render also
  useEffect(() => {
    async function loadMachines() {
      const machines = await fetchMachines();
      setMachines(machines || []);
    }
    loadMachines();
  }, []);


  // pan map
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


  // draw building outline on map change
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


  // set initial map
  const handleApiLoaded = ({ map, maps }: {map: any, maps: any}) => {
    setMap(map);
    setMaps(maps);
  };

  // poll machine states every 5s and update dict
  useEffect(() => {
    const intervalId = setInterval(() => {
      setMachines(prevMachines => {
        if (prevMachines.length === 0) {
          return prevMachines;
        }
        Promise.all(
          prevMachines.map(async (machine) => {
            try {
              const state = await fetchDeviceState(machine.machine);
              return { ...machine, state };
            } catch (err) {
              console.error('Error fetching device state for', machine.machine, err);
              return machine;
            }
          })
        ).then(updatedMachines => setMachines(updatedMachines));
        return prevMachines;
      });
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);


  // render page
  return (
    <div className={styles.container}>
      <Banner />
      <div className="flex flex-col md:flex-row items-start justify-between">
        <div className={styles.headerSearchContainer}>
          <header className={styles.header}>GymHawk</header>
          <div className={styles.searchBarContainer}>
            <Select
              options={gyms}
              onChange={handleSelect}
              placeholder="Search gyms..."
              styles={HOME_STYLE}
            />
          </div>
        </div>
        <div className={styles.mapContainer}>
          <GoogleMapReact
            bootstrapURLKeys={{ key: process.env.NEXT_PUBLIC_MAPS_API_KEY! }}
            center={center}
            defaultZoom={ZOOM_LEVEL}
            yesIWantToUseGoogleMapApiInternals
            options={DARK_MAP_THEME}
            onGoogleApiLoaded={handleApiLoaded}
            resetBoundsOnResize={true}
            onChange={({ center }) => setCenter(center)}
          >
          {machines.map((machineObj) => (
              <MachineMarker
                key={machineObj.machine}
                lat={machineObj.lat}
                lng={machineObj.lng}
                state={machineObj.state ? machineObj.state : "na"}
                machine={machineObj.machine}
              />
            ))}
          </GoogleMapReact>
        </div>
      </div>
      <Footer />
    </div>
  );
}
