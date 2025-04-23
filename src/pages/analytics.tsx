import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE } from '@/styles/customStyles';
import { fetchGyms, fetchMachines, fetchDeviceState } from '@/utils/db';
import { useAuth } from '@/lib/auth';
import { EMAIL } from '@/utils/consts';
import { RequireAuth } from '@/components/requireAuth';
import { Machine } from '@/interfaces/machine';
import { GymOption } from '@/interfaces/gym';
import { formatLastUsedTime } from '@/utils/time_utils';

// dynamically import Select 
const DynamicSelect = dynamic(() => Promise.resolve(Select), { ssr: false });
const DynamicMachineUsageChart = dynamic(() => import('@/components/analytics_chart'), { ssr: false });
const DynamicAdminUsageChart = dynamic(() => import('@/components/admin_analytics_chart'), { ssr: false });

function Analytics() {
  const [selectedGym, setSelectedGym] = useState<GymOption | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState('user');
  const [gyms, setGyms] = useState<any[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const { user, isAdmin } = useAuth();
  const [selectPlaceholder, setSelectPlaceholder] = useState<any>("Select a gym");
  const [oldStates, setOldStates] = useState<any>({});


  // fetch gyms from database on first render
  useEffect(() => {
    async function loadGyms() {
      const gyms = await fetchGyms();
      setGyms(gyms || []);

      // check if we have a past gym saved in the browser and set it as the selected gym
      const lastGym = localStorage.getItem("lastGym");
      if (lastGym) {
        const gymData = JSON.parse(lastGym);
        setSelectedGym(gymData);
        setSelectPlaceholder(gymData.label);
      }
    }
    loadGyms();
  }, []);

  
  // fetch machines on first render also 
  useEffect(() => {
    async function loadMachines() {
      if (!selectedGym) {
        setMachines([]);
        setSelectedMachine(null);
        return;
      }
      
      const machines = await fetchMachines(selectedGym.id);
      
      // Always set machines to empty array if no machines found
      if (!machines || machines.length === 0) {
        setMachines([]);
        setSelectedMachine(null);
        return;
      }
      
      // ignore this (not sure why but couldnt get it to work when fixing type issues)
      // @ts-ignore
      setMachines(machines);

      // Check if we have a machine from the index page
      const lastMachine = localStorage.getItem("lastMachine");
      if (lastMachine) {
        const machineData = JSON.parse(lastMachine);
        const matchingMachine = machines.find(m => m.thing_id === machineData.thing_id);
        if (matchingMachine) {
          // @ts-ignore
          setSelectedMachine(matchingMachine);
        }
      } else if (machines.length > 0) {
        // @ts-ignore
        setSelectedMachine(machines[0]);
      }
    }
    loadMachines();
  }, [selectedGym]);


 // poll machine states every 1s and update dict
 useEffect(() => {
  const oldStates: any = {};
  
  // do nothing if we havent selected a gym or no machines were found
  if (!selectedGym || machines.length === 0) {
    return () => {};
  }

  const intervalId = setInterval(() => {
    setMachines(prevMachines => {
      // return empty if no machines
      if (prevMachines.length === 0) {
        return prevMachines;
      }

      // poll each matching machine and update state
      Promise.all(
        prevMachines.map(async (machine) => {
          try {
            if (!machine) {
              return machine;
            }
            // fetch state and device state
            let state = oldStates[machine.machine] || "loading";
            let deviceStatus = machine.device_status || "OFFLINE";
            let lastUsedTime = machine.last_used_time || "Never";
            
            try {
              const [newState, newDeviceStatus] = await Promise.all([
                fetchDeviceState(machine.machine, oldStates[machine.machine], "state"),
                fetchDeviceState(machine.machine, oldStates[machine.machine], "device_status")
              ]);
              
              // Only update if fetch was successful
              state = newState;
              deviceStatus = newDeviceStatus;
              
              // We don't need to poll last_used_time frequently as it doesn't change often
              // We'll just use the value we got from the initial machine fetch
            } catch (err) {
              console.error('Error fetching device state, using last known value:', err);
              // Keep using the last known values
            }

            // return existing machine properties plus updated states
            const newStatus = { 
              ...machine, 
              state, 
              device_status: deviceStatus,
              oldState: oldStates[machine.machine],
              last_used_time: lastUsedTime
            };

            // store new state with old state
            oldStates[machine.machine] = state;
            setOldStates(oldStates);

            return newStatus;
          } catch (err) {
            console.error('Error in machine state update:', err);
            return machine;
          }
        })
      ).then(updatedMachines => setMachines(updatedMachines));
      
      // updates are async return old when processing
      return prevMachines;
    });
  }, 1000);

  return () => clearInterval(intervalId);
}, [selectedGym, machines.length]);

  const handleAdminApplication = () => {
    // Create a mailto link with pre-filled subject and body
    const subject = 'Admin Access Request';
    const body = `User Email: ${user?.email}\n\nI would like to request admin access to GymHawk.`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


  const handleGymSelect = (selectedOption: unknown) => { 
    const gymOption = selectedOption as GymOption | null;
    
    // clear selected
    setSelectedMachine(null);
    setMachines([]);

    // set selected gym and placeholder
    setSelectedGym(gymOption);
    setSelectPlaceholder(gymOption?.label || "Select a gym");
    
    // save
    if (gymOption) {
      localStorage.setItem("lastGym", JSON.stringify(gymOption));
    } else {
      localStorage.removeItem("lastGym");
    }
  }


  // render page
  return (
    <RequireAuth>
    <div className={styles.container}>
      <Banner />
      <div className={styles.analyticsContainer}>
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'user' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('user')}
          >
            User Analytics
          </button>
          {isAdmin ? (
            <button 
              className={`${styles.tabButton} ${activeTab === 'admin' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              Admin Analytics
            </button>
          ) : (
            <button 
              className={styles.adminRequestButton}
              onClick={handleAdminApplication}
            >
              Apply for Admin Access
            </button>
          )}
        </div>

        <div className={styles.mainContent}>
          <br />
          {/* search bar */}
          <div className={styles.searchBarContainer} style={{ marginBottom: '20px' }}>
            <DynamicSelect
              key="gym-select"
              options={gyms}
              placeholder={selectPlaceholder}
              styles={HOME_STYLE}
              onChange={handleGymSelect}
            />
          </div>
          {/* user analytics */}
          {activeTab === 'user' && (
            <div className={styles.userAnalytics}>
              {selectedMachine ? (
                <DynamicMachineUsageChart machineId={selectedMachine.thing_id} machineName={selectedMachine.machine} />
              ) : (
                null
              )}
              <h2>All Machines</h2>
              <p>Select a machine to view its usage chart</p>
              &nbsp;

              {machines.length === 0 ? (
                <div className={styles.machineStatus} style={{ backgroundColor: '#f8f9fa', textAlign: 'center', padding: '20px' }}>
                  <h3 className="text-lg font-bold">No machines found</h3>
                </div>
              ) : (
                <div className={styles.machineGrid}>
                  {machines.map((machine) => (
                    <div
                      key={machine.machine}
                      className={styles.machineStatus}
                      style={{
                        backgroundColor: machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN" 
                          ? 'rgba(128, 128, 128, 0.75)' // Gray for offline/unknown devices
                          : machine.state === 'on' 
                            ? 'rgba(139, 0, 0, 0.75)'  // Red for machines in use
                            : 'rgba(0, 100, 0, 0.75)', // Green for available machines
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedMachine(machine)}
                    >
                      <div><strong>{machine.machine_type || 'Unknown Type'}</strong></div>
                      {machine.device_status === "ONLINE" ? (
                        <div className="flex flex-row items-center space-x-4">
                          <div className="flex flex-row items-center space-x-2">
                            <div className="w-4 h-4" style={{ backgroundColor: 'rgba(0, 100, 0, 0.3)' }}></div>
                            <span>Available</span>
                          </div>
                          <div className="flex flex-row items-center space-x-2">
                            <div className="w-4 h-4" style={{ backgroundColor: 'rgba(139, 0, 0, 0.3)' }}></div>
                            <span>In Use</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span>Status: {machine.device_status || 'UNKNOWN'}</span>
                        </div>
                      )}
                      <div className="mt-2">
                        <span>Floor: {machine.floor}</span>
                      </div>
                      <div className="mt-2">
                        <span>Last Used: {formatLastUsedTime(machine.last_used_time)}</span>
                      </div>
                      <div className="mt-2">
                        <span>Device: {machine.machine}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* admin analytics */}
          {activeTab === 'admin' && isAdmin && (
            <div className={styles.adminAnalytics}>
              <DynamicAdminUsageChart />
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
    </RequireAuth>
  );
}

// Only keep one default export at the end
export default dynamic(() => Promise.resolve(Analytics), { ssr: false });
