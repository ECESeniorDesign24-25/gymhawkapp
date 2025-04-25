import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE } from '@/styles/customStyles';
import { fetchGyms, fetchMachines, fetchDeviceState } from '@/utils/db';
import { RequireAuth } from '@/components/requireAuth';
import { Gym, GymOption } from '@/interfaces/gym';
import Map from '@/components/map';
import { STATUS_OFFLINE, STATUS_UNKNOWN } from '@/utils/consts';

export default function Home() {

  // states
  const [selectedOption, setSelectedOption] = useState<GymOption | null>(null);
  const [center, setCenter] = useState({ lat: 41.6611, lng: -91.5302 });
  const [buildingOutline, setBuildingOutline] = useState<any[] | null>(null);
  const [map, setMap] = useState<any>(null);
  const [maps, setMaps] = useState<any>(null);
  const [userZoomed, setUserZoomed] = useState(false);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [selectPlaceholder, setSelectPlaceholder] = useState<string>("Select a gym");

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
      if (!selectedOption) {
        return;
      }
      const machines = await fetchMachines(selectedOption.id);
      
      // Make sure the machines have a default device_status if not present
      const machinesWithDefaults = machines?.map(machine => ({
        ...machine,
        device_status: machine.device_status || STATUS_OFFLINE
      })) || [];
      
      setMachines(machinesWithDefaults);
    }
    loadMachines();
  }, [selectedOption]);

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

  // handle map and maps API references
  const handleMapLoaded = (mapInstance: any, mapsApi: any) => {
    setMap(mapInstance);
    setMaps(mapsApi);
  };

  // handle map center change
  const handleMapChange = (newCenter: { lat: number; lng: number }) => {
    setCenter(newCenter);
  };

  // poll machine states every 1s and update dict
  useEffect(() => {
    // Initialize an object to store previous states for comparison
    const oldStates: any = {};

    const intervalId = setInterval(() => {
      setMachines(prevMachines => {
        // return empty if no machines
        if (prevMachines.length === 0) {
          return prevMachines;
        }
        
        Promise.all(
          prevMachines.map(async (machine) => {
            try {
              // Store previous state to pass to fetchDeviceState
              let state = oldStates[machine.machine] || STATUS_UNKNOWN;
              let deviceStatus = machine.device_status || STATUS_OFFLINE;
              
              try {
                // Fetch both state and device_status in parallel
                const [newState, newDeviceStatus] = await Promise.all([
                  fetchDeviceState(machine.machine, state, "state"),
                  fetchDeviceState(machine.machine, deviceStatus, "device_status")
                ]);
                
                // Update states if fetch was successful
                state = newState;
                deviceStatus = newDeviceStatus;
              } catch (err) {
                console.error('Error fetching device state, using last known value:', err);
                // Keep using the last known values
              }
              
              // Store updated state for next comparison
              oldStates[machine.machine] = state;
              
              return { 
                ...machine, 
                state,
                device_status: deviceStatus
              };
            } catch (err) {
              console.error('Error fetching device state for', machine.machine, err);
              return machine;
            }
          })
        ).then(updatedMachines => setMachines(updatedMachines));
        
        // updates are async return old when processing
        return prevMachines;
      });
    }, 1000);

    // Cleanup function to clear the interval when component unmounts
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
                placeholder={selectPlaceholder}
                styles={HOME_STYLE}
              />
            </div>
          </div>
          <div className={styles.mapContainer}>
            <Map
              center={center}
              machines={machines}
              buildingOutline={buildingOutline}
              onMapChange={handleMapChange}
              onMapLoaded={handleMapLoaded}
              userZoomed={userZoomed}
            />
          </div>
        </div>
        <Footer />
      </div>
    </RequireAuth>
  );
}
