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
import { RequireAuth } from '@/components/requireAuth';

const GoogleMapReact = dynamic(() => import('google-map-react'), { ssr: false });

export default function Home() {

  // states
  const [selectedOption, setSelectedOption] = useState(null);
  const [center, setCenter] = useState({ lat: 41.6611, lng: -91.5302 });
  const [buildingOutline, setBuildingOutline] = useState<any[] | null>(null);
  const [map, setMap] = useState<any>(null);
  const [maps, setMaps] = useState<any>(null);
  const [userZoomed, setUserZoomed] = useState(false);
  const [gyms, setGyms] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [selectPlacholder, setSelectPlaceholder] = useState<any>("Select a gym");

  const polygonRef = useRef<any>(null);

  // fetch gyms from database on first render
  useEffect(() => {
    async function loadGyms() {
      const gyms = await fetchGyms();
      setGyms(gyms || []);

      // check if we have a past gym saved in the browser 
      const lastGym = localStorage.getItem("lastGym");
      if (lastGym) {
        const gymData = JSON.parse(lastGym);
        setSelectedOption(gymData);
        const newCenter = { 
          lat: gymData.coords.lat, 
          lng: gymData.coords.lng 
        };
        setCenter(newCenter);
  
        if (map && maps) {
          map.panTo(newCenter);
        }
  
        let outline = gymData.building;
        setBuildingOutline(outline);
        setSelectPlaceholder(gymData.label);
      }
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

  // callback for user zoom
  useEffect(() => {
    if (map && maps) {
      const listener = maps.event.addListener(map, 'zoom_changed', () => {
        setUserZoomed(true);
      });
      return () => {
        maps.event.removeListener(listener);
      };
    }
  }, [map, maps]);

  // pan map
  const handleSelect = async (option: any) => {
    setSelectedOption(option);

    // save to browser
    localStorage.setItem("lastGym", JSON.stringify(option));
    if (option) {

      // reset zoom
      setUserZoomed(false);

      // update map center
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
      setSelectPlaceholder(option.label);
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
        convertedPath = buildingOutline[0].map((coord) => ({
          lat: coord[1],
          lng: coord[0]
        }));
      } else {
        convertedPath = buildingOutline.map((coord) => ({
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
        convertedPath.forEach(coord => bounds.extend(coord));
        bounds.extend(center);
        map.fitBounds(bounds);
      }

    } else {
      if (!map) console.log("Map instance not set");
      if (!maps) console.log("Maps API not set");
      if (!buildingOutline) console.log("Building outline is null or undefined");
    }
  }, [buildingOutline, map, maps, center, userZoomed]);

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
    <RequireAuth>
      <div className={styles.container}>
        <Banner />
        <div className="flex flex-col md:flex-row items-start justify-between">
          <div className={styles.headerSearchContainer}>
            <header className={styles.header}>GymHawk</header>
            <div className={styles.searchBarContainer}>
              <Select
                options={gyms}
                onChange={handleSelect}
                placeholder={selectPlacholder}
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
    </RequireAuth>
  );
}
