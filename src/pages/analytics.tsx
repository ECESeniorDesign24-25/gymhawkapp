import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE, DARK_MAP_THEME, ZOOM_LEVEL } from '@/styles/customStyles';
import { fetchGyms, fetchMachines } from '@/utils/db';
import { fetchDeviceState } from '@/utils/cloudAPI';


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


  // selection
  const handleSelect = async (option: any) => {
    setSelectedOption(option);
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
      </div>
      <Footer />
    </div>
  );
}
