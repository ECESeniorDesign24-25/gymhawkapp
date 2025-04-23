import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE } from '@/styles/customStyles';
import { fetchGyms, fetchMachines, fetchDeviceState, fetchLastUsedTime } from '@/utils/db';
import { useAuth } from '@/lib/auth';
import { EMAIL } from '@/utils/consts';
import { RequireAuth } from '@/components/requireAuth';
import { Machine } from '@/interfaces/machine';
import { GymOption } from '@/interfaces/gym';
import { formatLastUsedTime } from '@/utils/time_utils';
import { Spinner } from '@/components/spinner';

// dynamically import Select 
const DynamicSelect = dynamic(() => Promise.resolve(Select), { ssr: false });
const DynamicMachineUsageChart = dynamic(() => import('@/components/graph'), { ssr: false });

function Analytics() {
  const router = useRouter();
  const [selectedGym, setSelectedGym] = useState<GymOption | null>(null);
  const [selectedAdminMachine, setSelectedAdminMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState('user');
  const [gyms, setGyms] = useState<any[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const { user, isAdmin } = useAuth();
  const [selectPlaceholder, setSelectPlaceholder] = useState<any>("Select a gym");
  const [oldStates, setOldStates] = useState<any>({});
  const [isLoadingGyms, setIsLoadingGyms] = useState<boolean>(true);
  const [isLoadingMachines, setIsLoadingMachines] = useState<boolean>(false);
  const [chartsLoading, setChartsLoading] = useState<boolean>(true);
  const [isLoadingMachineDetails, setIsLoadingMachineDetails] = useState<boolean>(false);

  // Add effect to control chart loading indicators
  useEffect(() => {
    // Function to check if charts are loaded
    const checkChartsLoaded = () => {
      // Charts are considered loaded when canvas elements are present
      const chartCanvases = document.querySelectorAll('canvas');
      const chartLoadingContainers = document.querySelectorAll('.chart-loading-container');
      
      if (chartCanvases.length > 0) {
        // Charts are loaded, hide spinners
        setChartsLoading(false);
        chartLoadingContainers.forEach(container => {
          (container as HTMLElement).style.visibility = 'hidden';
        });
      } else {
        // Charts are loading, show spinners
        setChartsLoading(true);
        chartLoadingContainers.forEach(container => {
          (container as HTMLElement).style.visibility = 'visible';
        });
      }
    };
    
    // Check initially and then every second until charts are loaded
    const intervalId = setInterval(checkChartsLoaded, 1000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [selectedGym, machines.length]);

  // fetch gyms from database on first render
  useEffect(() => {
    async function loadGyms() {
      setIsLoadingGyms(true);
      const gyms = await fetchGyms();
      setGyms(gyms || []);
      setIsLoadingGyms(false);

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
        setSelectedAdminMachine(null);
        return;
      }
      
      setIsLoadingMachines(true);
      const machines = await fetchMachines(selectedGym.id);
      setIsLoadingMachines(false);
      
      // Always set machines to empty array if no machines found
      if (!machines || machines.length === 0) {
        setMachines([]);
        setSelectedAdminMachine(null);
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
          setSelectedAdminMachine(matchingMachine);
        }
      } else if (machines.length > 0 && activeTab === 'admin') {
        // Only auto-select the first machine in admin view
        // @ts-ignore
        setSelectedAdminMachine(machines[0]);
      }
    }
    loadMachines();
  }, [selectedGym, activeTab]);


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
              
              // Use the getLastUsedTime API for the last used time
              lastUsedTime = await fetchLastUsedTime(machine.machine);
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
    setSelectedAdminMachine(null);
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

  const handleAdminMachineSelect = (machine: Machine) => {
    setIsLoadingMachineDetails(true);
    setSelectedAdminMachine(machine);
    // Reset loading after a brief delay to allow chart components to load
    setTimeout(() => setIsLoadingMachineDetails(false), 500);
  };

  const renderAdminMachineDetails = () => {
    if (!selectedAdminMachine) {
      return (
        <div className={styles.machineSelectionPrompt}>
          <p>Select a machine from the list to view detailed analytics</p>
        </div>
      );
    }

    if (isLoadingMachineDetails) {
      return (
        <div className="flex items-center justify-center h-full" style={{ height: "300px" }}>
          <Spinner text="Loading machine details..." />
        </div>
      );
    }

    // Determine color scheme based on state and status
    const isOffline = selectedAdminMachine.device_status === "OFFLINE" || selectedAdminMachine.device_status === "UNKNOWN";
    const isInUse = selectedAdminMachine.state === 'on';
    const statusColor = isOffline ? 'rgba(128, 128, 128, 0.75)' : // Gray for offline
                        isInUse ? 'rgba(139, 0, 0, 0.75)' :       // Red for in use
                        'rgba(0, 100, 0, 0.75)';                 // Green for available
    const statusBorder = isOffline ? '5px solid rgba(128, 128, 128, 1)' :
                        isInUse ? '5px solid rgba(139, 0, 0, 1)' :
                        '5px solid rgba(0, 100, 0, 1)';

    return (
      <div className={styles.machineAnalyticsContent}>
        <h1 className={styles.machineTitle} style={{ borderLeft: statusBorder, paddingLeft: '10px' }}>
          {selectedAdminMachine.machine_type || 'Machine'}
        </h1>
        
        <div className={styles.machineDetailsCard} style={{ borderLeft: statusBorder }}>
          <div className={styles.machineDetail}>
            <strong>Device Name:</strong> {selectedAdminMachine.machine}
          </div>
          <div className={styles.machineDetail}>
            <strong>Thing ID:</strong> {selectedAdminMachine.thing_id}
          </div>
          <div className={styles.machineDetail}>
            <strong>Floor:</strong> {selectedAdminMachine.floor}
          </div>
          <div className={styles.machineDetail}>
            <strong>Status:</strong> <span style={{ color: isOffline ? 'gray' : 'inherit' }}>{selectedAdminMachine.device_status || 'UNKNOWN'}</span>
          </div>
          <div className={styles.machineDetail}>
            <strong>Current State:</strong> <span style={{ 
              color: isOffline ? 'gray' : (isInUse ? 'darkred' : 'darkgreen'),
              fontWeight: 'bold'
            }}>
              {isInUse ? 'In Use' : 'Available'}
            </span>
          </div>
          <div className={styles.machineDetail}>
            <strong>Last Used:</strong> {formatLastUsedTime(selectedAdminMachine.last_used_time)}
          </div>
        </div>

        <div className={styles.usageChartContainer}>
          <h2>Usage Analytics</h2>
          {isLoadingMachines ? (
            <div className="flex items-center justify-center h-full" style={{ height: "200px" }}>
              <Spinner text="Loading analytics..." />
            </div>
          ) : (
            <DynamicMachineUsageChart 
              machineId={selectedAdminMachine.thing_id} 
              machineName={selectedAdminMachine.machine} 
              viewMode="admin" 
            />
          )}
        </div>
      </div>
    );
  };

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
            {isLoadingGyms ? (
              <div className="flex items-center justify-center p-2">
                <Spinner size="small" text="Loading gyms..." />
              </div>
            ) : (
              <DynamicSelect
                key="gym-select"
                options={gyms}
                placeholder={selectPlaceholder}
                styles={HOME_STYLE}
                onChange={handleGymSelect}
              />
            )}
          </div>
          
          {/* user analytics */}
          {activeTab === 'user' && (
            <div className={styles.userAnalytics}>
              <h2>All Machines</h2>
              
              {isLoadingGyms ? (
                <div className="flex items-center justify-center h-full" style={{ height: "200px" }}>
                  <Spinner text="Loading gyms..." />
                </div>
              ) : isLoadingMachines ? (
                <div className="flex items-center justify-center h-full" style={{ height: "200px" }}>
                  <Spinner text="Loading machines..." />
                </div>
              ) : machines.length === 0 ? (
                <div className={styles.machineStatus} style={{ backgroundColor: '#f8f9fa', textAlign: 'center', padding: '20px' }}>
                  <h3 className="text-lg font-bold">No machines found</h3>
                </div>
              ) : (
                <div className={styles.machinesWithCharts}>
                  {machines.map((machine) => (
                    <div key={machine.machine} className={styles.machineWithChart}>
                      <div
                        className={styles.machineStatus}
                        style={{
                          backgroundColor: machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN" 
                            ? 'rgba(128, 128, 128, 0.75)' // Gray for offline/unknown devices
                            : machine.state === 'on' 
                              ? 'rgba(139, 0, 0, 0.75)'  // Red for machines in use
                              : 'rgba(0, 100, 0, 0.75)', // Green for available machines
                          borderLeft: machine.state === 'on' ? '5px solid rgba(139, 0, 0, 1)' : machine.state === 'off' ? '5px solid rgba(0, 100, 0, 1)' : '5px solid rgba(128, 128, 128, 1)'
                        }}
                      >
                        <div><strong>{machine.machine_type || 'Unknown Type'}</strong></div>
                        <div className="mt-2">
                          <div className="flex flex-row items-center space-x-2">
                            <div className={`${styles.statusIndicator} ${
                              machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN" 
                                ? styles.statusOffline
                                : styles.statusOnline
                            }`}></div>
                            <span>Device: {machine.device_status || 'UNKNOWN'}</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex flex-row items-center space-x-2">
                            <div className={`${styles.statusIndicator} ${
                              machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN"
                                ? styles.statusOffline
                                : machine.state === 'on' 
                                  ? styles.statusInUse
                                  : styles.statusAvailable
                            }`}></div>
                            <span>
                              {machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN"
                                ? 'Unavailable'
                                : machine.state === 'on' 
                                  ? 'In Use' 
                                  : 'Available'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span>Floor: {machine.floor}</span>
                        </div>
                        <div className="mt-2">
                          <span>Last Used: {formatLastUsedTime(machine.last_used_time)}</span>
                        </div>
                      </div>
                      
                      <div className={styles.machineChartContainer}>
                        <DynamicMachineUsageChart machineId={machine.thing_id} machineName={machine.machine} viewMode="user" />
                        {/* Loading indicator for charts - displayed before the chart loads */}
                        <div className="chart-loading-container" style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: 'rgba(255, 255, 255, 0.7)',
                          zIndex: 10,
                          visibility: 'hidden'
                        }}>
                          <Spinner size="small" text="Loading chart..." />
                        </div>
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
              <div className={styles.adminPanels}>
                <div className={styles.adminMachineList}>
                  <h2>Machines</h2>
                  {isLoadingGyms ? (
                    <div className="flex items-center justify-center h-full" style={{ height: "200px" }}>
                      <Spinner text="Loading gyms..." />
                    </div>
                  ) : isLoadingMachines ? (
                    <div className="flex items-center justify-center h-full" style={{ height: "200px" }}>
                      <Spinner text="Loading machines..." />
                    </div>
                  ) : machines.length === 0 ? (
                    <div className={styles.noMachines}>No machines found</div>
                  ) : (
                    <div className={styles.machineGrid}>
                      {machines.map((machine) => (
                        <div
                          key={machine.machine}
                          className={`${styles.machineCard} ${selectedAdminMachine?.machine === machine.machine ? styles.selectedMachine : ''}`}
                          onClick={() => handleAdminMachineSelect(machine)}
                        >
                          <div className={styles.machineCardHeader}>
                            <strong>{machine.machine_type || 'Unknown Type'}</strong>
                          </div>
                          <div className={styles.machineCardStatus} style={{
                            backgroundColor: machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN" 
                              ? 'rgba(128, 128, 128, 0.75)' // Gray for offline/unknown devices
                              : machine.state === 'on' 
                                ? 'rgba(139, 0, 0, 0.75)'  // Red for machines in use
                                : 'rgba(0, 100, 0, 0.75)', // Green for available machines
                            borderLeft: machine.state === 'on' ? '5px solid rgba(139, 0, 0, 1)' : machine.state === 'off' ? '5px solid rgba(0, 100, 0, 1)' : '5px solid rgba(128, 128, 128, 1)'
                          }}>
                            {machine.device_status === "OFFLINE" || machine.device_status === "UNKNOWN"
                              ? 'Offline'
                              : machine.state === 'on' 
                                ? 'In Use' 
                                : 'Available'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className={styles.adminMachineDetails}>
                  {renderAdminMachineDetails()}
                </div>
              </div>
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
