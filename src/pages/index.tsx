import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import dynamic from 'next/dynamic';
import styles from '@/styles/index.module.css';
import { HOME_STYLE, DARK_MAP_THEME, ZOOM_LEVEL } from '@/styles/customStyles';
import { fetchDeviceState } from '@/utils/cloudAPI';
import { fetchGyms } from '@/utils/db';

const GoogleMapReact = dynamic(() => import('google-map-react'), { ssr: false });

interface MachineMarkerProps {
  lat: number;
  lng: number;
  state: string;
  text: string;
}

// marker for device
const MachineMarker = ({ state, text }: MachineMarkerProps) => {
  let backgroundColor = 'grey';
  if (state == "off") {
    backgroundColor = 'red';
  }
  if (state == "on") {
    backgroundColor = 'green';
  }
  const markerStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    backgroundColor: backgroundColor,
    borderRadius: '50%',
    border: '2px solid white',
    textAlign: 'center',
    color: 'white',
    fontSize: '12px',
    lineHeight: '20px'
  };

  return <div style={markerStyle}>{text}</div>;
};

export default function Home() {
  const [selectedOption, setSelectedOption] = useState(null);
  const [center, setCenter] = useState({ lat: 41.6611, lng: -91.5302 });
  const [buildingOutline, setBuildingOutline] = useState<any[] | null>(null);
  const [map, setMap] = useState<any>(null);
  const [maps, setMaps] = useState<any>(null);
  const polygonRef = useRef<any>(null);
  const [machineAState, setMachineAState] = useState<any>(null);
  const [machineBState, setMachineBState] = useState<any>(null);
  const [gyms, setGyms] = useState<any[]>([]);

  // testing
  const machineACoordinates = { lat: 41.6572472, lng: -91.5389825 };
  const machineBCoordinates = { lat: 41.6576472, lng: -91.5381925 };

  // fetch gyms from database on first render
  useEffect(() => {
    async function loadGyms() {
      const gyms = await fetchGyms();
      setGyms(gyms || []);
    }
    loadGyms();
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

  // poll machine state every 5s 
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const state = await fetchDeviceState();

        setMachineAState(state["machineAInUse"]);
        setMachineBState(state["machineBInUse"]);
      } catch (error) {
        console.error("Error fetching device state:", error);
      }
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
            <MachineMarker
              lat={machineACoordinates.lat}
              lng={machineACoordinates.lng}
              state={machineAState ? machineAState : "na"}
              text="A"
            />
            <MachineMarker
              lat={machineBCoordinates.lat}
              lng={machineBCoordinates.lng}
              state={machineBState ? machineBState : "na"}
              text="B"
            />
          </GoogleMapReact>
        </div>
      </div>
      <Footer />
    </div>
  );
}
