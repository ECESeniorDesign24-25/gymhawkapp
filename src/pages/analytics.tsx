import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE } from '@/styles/customStyles';
import { fetchGyms, fetchMachines, fetchDeviceState, fetchLastUsedTime, fetchPeakHours } from '@/utils/db';
import { useAuth } from '@/lib/auth';
import { ONE_SECOND, EMAIL, STATUS_OFFLINE, STATUS_UNKNOWN, ONE_DAY } from '@/utils/consts';
import { RequireAuth } from '@/components/requireAuth';
import { Machine } from '@/interfaces/machine';
import { GymOption } from '@/interfaces/gym';
import { formatLastUsedTime } from '@/utils/time_utils';
import { Spinner } from '@/components/spinner';
import { getFromCache, saveToCache, clearCache } from '@/utils/cache';
import { StateColor, StateString } from '@/enums/state';
import { subscribeToMachine } from "@/utils/notify";

// dynamically import Select 
const DynamicSelect = dynamic(() => Promise.resolve(Select), { ssr: false });
const DynamicMachineUsageChart = dynamic(() => import('@/components/graph'), { ssr: false });


async function triggerEmailNotification(machine: Machine) {
  try {
    const response = await fetch("https://us-central1-gymhawk-2ed7f.cloudfunctions.net/email_on_available", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        machine_id: machine.thing_id,
        machine_name: machine.machine,
        previous_state: "on"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unknown error");
    }
    console.log("Email function triggered:", data);
  } catch (err) {
    console.error("Failed to trigger email function:", err);
  }
}


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
  const [machinePeakTimes, setMachinePeakTimes] = useState<{[key: string]: string[]}>({});
  const [machineIdealTimes, setMachineIdealTimes] = useState<{[key: string]: string[]}>({});
  const [isLoadingPredictions, setIsLoadingPredictions] = useState<boolean>(false);
  const [lastPredictionFetch, setLastPredictionFetch] = useState<number>(0);
  const [isRouterReady, setIsRouterReady] = useState(false);

  // check if charts are loaded
  useEffect(() => {
    const checkChartsLoaded = () => {
      const chartCanvases = document.querySelectorAll('canvas');
      const chartLoadingContainers = document.querySelectorAll('.chart-loading-container');
      
      // if loaded no spinner
      if (chartCanvases.length > 0) {
        setChartsLoading(false);
        chartLoadingContainers.forEach(container => {
          (container as HTMLElement).style.visibility = 'hidden';
        });
      } else {
        setChartsLoading(true);
        chartLoadingContainers.forEach(container => {
          (container as HTMLElement).style.visibility = 'visible';
        });
      }
    };
    
    const intervalId = setInterval(checkChartsLoaded, ONE_SECOND);
    return () => clearInterval(intervalId);
  }, [selectedGym, machines.length]);

  // init state from URL parameters once router is ready
  useEffect(() => {
    if (!router.isReady) return;
    setIsRouterReady(true);

    // set active tab from URL
    if (router.query.tab && (router.query.tab === 'user' || (router.query.tab === 'admin' && isAdmin))) {
      setActiveTab(router.query.tab as string);
    }
  }, [router.isReady, isAdmin, router.query.tab]);

  // fetch gyms from database on first render
  useEffect(() => {
    async function loadGyms() {
      setIsLoadingGyms(true);
      const gyms = await fetchGyms();
      setGyms(gyms || []);
      setIsLoadingGyms(false);

      if (router.isReady && router.query.gymId) {
        const gymId = router.query.gymId as string;
        const matchingGym = gyms?.find(gym => gym.id === gymId);

        if (matchingGym) {
          setSelectedGym({
            value: matchingGym.id,
            label: matchingGym.label,
            id: matchingGym.id,
            floors: matchingGym.floors,
            coords: matchingGym.coords,
            building: matchingGym.building
          });
          setSelectPlaceholder(matchingGym.label);
        }
      }
      // if no gym in URL, check localStorage as fallback
      else if (!router.query.gymId) {
        const lastGym = localStorage.getItem("lastGym");
        if (lastGym) {
          const gymData = JSON.parse(lastGym);
          setSelectedGym(gymData);
          setSelectPlaceholder(gymData.label);

          // update URL with the gym from localStorage
          if (router.isReady) {
            const query = { ...router.query, gymId: gymData.id };
            router.push({
              pathname: router.pathname,
              query
            }, undefined, { shallow: true });
          }
        }
      }
    }

    loadGyms();
  }, [router.isReady]);

  
  // fetch machines on first render or when gym changes
  useEffect(() => {
    async function loadMachines() {
      if (!selectedGym) {
        setMachines([]);
        setSelectedAdminMachine(null);
        return;
      }
      
      setIsLoadingMachines(true);

      // check if we have cached machines data
      const cacheKey = `machines_${selectedGym.id}`;
      const cachedMachines = getFromCache<Machine[]>(cacheKey);
      let machinesData: Machine[] = [];
      
      if (cachedMachines) {
        setMachines(cachedMachines);
        machinesData = cachedMachines;
      }

      try {
        // fetch fresh machines
        const freshMachines = await fetchMachines(selectedGym.id);

        if (freshMachines && freshMachines.length > 0) {
          saveToCache(cacheKey, freshMachines);
          setMachines(freshMachines);
          machinesData = freshMachines;
        } else {
          setMachines([]);
          setSelectedAdminMachine(null);
          setIsLoadingMachines(false);
          return;
        }
      } catch (error) {
        console.error('Error fetching machines:', error);
        if (!cachedMachines) {
          setMachines([]);
          setSelectedAdminMachine(null);
        }
      } finally {
        setIsLoadingMachines(false);
      }
      
      // try selecting machines
      if (router.isReady && router.query.machineId && machinesData.length > 0) {
        const machineId = router.query.machineId as string;
        const matchingMachine = machinesData.find(m => m.thing_id === machineId);
        
        if (matchingMachine) {
          setSelectedAdminMachine(matchingMachine);
          return;
        }
      }
      // if no machine in URL, check localStorage as fallback
      else if (machinesData.length > 0) {
        const lastMachine = localStorage.getItem("lastMachine");

        if (lastMachine) {
          const machineData = JSON.parse(lastMachine);
          const matchingMachine = machinesData.find(m => m.thing_id === machineData.thing_id);
          if (matchingMachine) {
            setSelectedAdminMachine(matchingMachine);

            // Update URL with the machine from localStorage
            if (router.isReady && activeTab === 'admin') {
              const query = { ...router.query, machineId: matchingMachine.thing_id };
              router.push({
                pathname: router.pathname,
                query
              }, undefined, { shallow: true });
            }
            return;
          }
        }
        
        // auto-select first machine for admin view if no machine is selected
        if (activeTab === 'admin') {
          setSelectedAdminMachine(machinesData[0]);

          // Update URL with the first machine
          if (router.isReady) {
            const query = { ...router.query, machineId: machinesData[0].thing_id };
            router.push({
              pathname: router.pathname,
              query
            }, undefined, { shallow: true });
          }
        }
      }
    }
    loadMachines();
  }, [selectedGym, activeTab, router.isReady, router.query.machineId]);


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
            let deviceStatus = machine.device_status || STATUS_OFFLINE;
            let lastUsedTime = machine.last_used_time || "Never";
            
            try {
              const [newState, newDeviceStatus] = await Promise.all([
                fetchDeviceState(machine.machine, oldStates[machine.machine], "state"),
                fetchDeviceState(machine.machine, oldStates[machine.machine], "device_status")
              ]);
              
              // update if fetch was successful
              state = newState;
              deviceStatus = newDeviceStatus;

              // fetch last used time
              lastUsedTime = await fetchLastUsedTime(machine.machine);
            } catch (err) {
              console.error('Error fetching device state, using last known value:', err);
            }

            if (
                machine.subscribed &&
                oldStates[machine.machine] === "on" &&
                state === "off"
            ) {
              console.log(`[${machine.machine}] transitioned from ON to OFF. Triggering notify.`);
              triggerEmailNotification(machine);
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
  }, ONE_SECOND);

  return () => clearInterval(intervalId);
}, [selectedGym, machines.length]);

  const handleAdminApplication = () => {
    // Create a mailto link with pre-filled subject and body
    const subject = 'Admin Access Request';
    const body = `User Email: ${user?.email}\n\nI would like to request admin access to GymHawk.`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


  // handle gym select - update URL with selected gym
  const handleGymSelect = (selectedOption: unknown) => {
    const gymOption = selectedOption as GymOption | null;
    
    // clear selected
    setSelectedAdminMachine(null);
    setMachines([]);

    // set selected gym and placeholder
    setSelectedGym(gymOption);
    setSelectPlaceholder(gymOption?.label || "Select a gym");

    // update URL with selected gym
    if (router.isReady && gymOption) {
      // keep existing tab parameter
      const query: any = { gymId: gymOption.id };
      if (router.query.tab) {
        query.tab = router.query.tab;
      }
      
      // clear machineId if switching gyms
      if (router.query.machineId) {
        delete query.machineId;
      }

      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    }

    // save to localStorage as backup
    if (gymOption) {
      localStorage.setItem("lastGym", JSON.stringify(gymOption));
    } else {
      localStorage.removeItem("lastGym");
    }
  }

  // handle admin machine select - update URL with selected machine
  const handleAdminMachineSelect = (machine: Machine) => {
    setIsLoadingMachineDetails(true);
    setSelectedAdminMachine(machine);

    // Update URL with the selected machine and current tab
    if (router.isReady) {
      const query = {
        ...router.query,
        machineId: machine.thing_id
      };

      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    }

    // Save machine to localStorage as backup
    localStorage.setItem("lastMachine", JSON.stringify(machine));

    setTimeout(() => setIsLoadingMachineDetails(false), ONE_SECOND / 2);
  };

  // handle tab change - update URL with selected tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Update URL with the selected tab
    if (router.isReady) {
      const query = { ...router.query, tab };

      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    }
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

    // determine color scheme based on state and status
    const isOffline = selectedAdminMachine.device_status === STATUS_OFFLINE || selectedAdminMachine.device_status === STATUS_UNKNOWN;
    const isInUse = selectedAdminMachine.state === StateString.IN_USE;
    const statusColor = isOffline ? StateColor.OFFLINE :
                        isInUse ? StateColor.IN_USE :
                        StateColor.AVAILABLE;
    const statusBorder = isOffline ? `5px solid ${StateColor.OFFLINE}` :
                        isInUse ? `5px solid ${StateColor.IN_USE}` :
                        `5px solid ${StateColor.AVAILABLE}`;

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
            <strong>Status:</strong> <span style={{ color: isOffline ? StateColor.OFFLINE : 'inherit' }}>{selectedAdminMachine.device_status || STATUS_UNKNOWN}</span>
          </div>
          <div className={styles.machineDetail}>
            <strong>Current State:</strong> <span style={{
              color: isOffline ? StateColor.OFFLINE : (isInUse ? StateColor.IN_USE : StateColor.AVAILABLE),
              fontWeight: 'bold'
            }}>
              {isInUse ? StateString.IN_USE : StateString.AVAILABLE}
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

  // fetch peak and ideal times for all machines
  const fetchAllMachinePredictions = async () => {
    if (!machines.length) return;
    
    // check cache first
    const today = new Date().toISOString().split('T')[0];
    const peakTimesCacheKey = `peak_times_${selectedGym?.id}_${today}`;
    const idealTimesCacheKey = `ideal_times_${selectedGym?.id}_${today}`;

    const cachedPeakTimes = getFromCache<{[key: string]: string[]}>(peakTimesCacheKey, ONE_DAY) || {};
    const cachedIdealTimes = getFromCache<{[key: string]: string[]}>(idealTimesCacheKey, ONE_DAY) || {};
    
    setIsLoadingPredictions(true);

    try {
      // Handle peak times
      const peakTimesMap = { ...cachedPeakTimes };
      const machinesNeedingPeakTimes = machines.filter(machine =>
        !peakTimesMap[machine.thing_id] || peakTimesMap[machine.thing_id].length === 0
      );
      
      // fetch peak times for machines that need them
      if (machinesNeedingPeakTimes.length > 0) {
        const peakTimesPromises = machinesNeedingPeakTimes.map(machine => {
          return fetchPeakHours(machine.thing_id, undefined, true);
        });

        const peakTimesResults = await Promise.all(peakTimesPromises);

        machinesNeedingPeakTimes.forEach((machine, index) => {
          const result = peakTimesResults[index];
          if (result && result.length > 0) {
            peakTimesMap[machine.thing_id] = result;
            // update cache incrementally for each machine
            saveToCache(peakTimesCacheKey, peakTimesMap);
          }
        });
      }

      // fetch ideal times for machines that need them
      const idealTimesMap = { ...cachedIdealTimes };
      const machinesNeedingIdealTimes = machines.filter(machine =>
        !idealTimesMap[machine.thing_id] || idealTimesMap[machine.thing_id].length === 0
      );

      // fetch ideal times for machines that need them
      if (machinesNeedingIdealTimes.length > 0) {
        const idealTimesPromises = machinesNeedingIdealTimes.map(machine => {
          return fetchPeakHours(machine.thing_id, undefined, false);
        });

        const idealTimesResults = await Promise.all(idealTimesPromises);

        machinesNeedingIdealTimes.forEach((machine, index) => {
          const result = idealTimesResults[index];
          if (result && result.length > 0) {
            idealTimesMap[machine.thing_id] = result;
            // update cache incrementally
            saveToCache(idealTimesCacheKey, idealTimesMap);
          }
        });
      }

      // update machine peak and ideal times
      setMachinePeakTimes(peakTimesMap);
      setMachineIdealTimes(idealTimesMap);
      setLastPredictionFetch(Date.now());

    } catch (error) {
      console.error('Error fetching peak and ideal times:', error);
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  // fetch peak and ideal hours when machines are loaded
  useEffect(() => {
    if (machines.length > 0) {
      fetchAllMachinePredictions();
    }
  }, [machines]);

  async function handleNotify(machine: Machine) {
    try {
      await subscribeToMachine(machine.thing_id);

      setMachines((prev) =>
        prev.map((m) =>
          m.thing_id === machine.thing_id ? { ...m, subscribed: true } : m
        )
      );
    } catch (err) {
      console.error(err);
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
            onClick={() => handleTabChange('user')}
          >
            User Analytics
          </button>
          {isAdmin ? (
            <button 
              className={`${styles.tabButton} ${activeTab === 'admin' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('admin')}
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
                value={selectedGym}
              />
            )}
          </div>
          
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
                          backgroundColor: machine.device_status === STATUS_OFFLINE || machine.device_status === STATUS_UNKNOWN 
                            ? StateColor.OFFLINE 
                            : machine.state === StateString.IN_USE 
                              ? StateColor.IN_USE 
                              : StateColor.AVAILABLE,
                          borderLeft: machine.state === StateString.IN_USE ? `5px solid ${StateColor.IN_USE}` : machine.state === StateString.AVAILABLE ? `5px solid ${StateColor.AVAILABLE}` : `5px solid ${StateColor.OFFLINE}`,
                          position: 'relative' 
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <strong>{machine.machine_type || 'Fitness Equipment'}</strong>
                          <button 
                            className={styles.notificationBell} 
                            aria-label="Enable notifications"
                            title="Get notified when this machine is available"
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              zIndex: 5
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              // TODO: implement notification logic
                              handleNotify(machine);
                              console.log(`Notification clicked for ${machine.machine}`);
                            }}
                          >
                            🔔
                          </button>
                        </div>
                        
                        <div className="mt-1">
                          <div className="flex flex-row items-center space-x-2">
                            <div className={`${styles.statusIndicator} ${
                              machine.device_status === STATUS_OFFLINE || machine.device_status === STATUS_UNKNOWN 
                                ? styles.statusOffline
                                : styles.statusOnline
                            }`}></div>
                            <span>Device: {machine.device_status || STATUS_UNKNOWN}</span>
                          </div>
                          <div className="flex flex-row items-center space-x-2">
                            <div className={`${styles.statusIndicator} ${
                              machine.state === StateString.IN_USE 
                                ? styles.statusInUse
                                : styles.statusAvailable
                            }`}></div>
                            <span>State: {machine.state === StateString.IN_USE ? 'In Use' : 'Available'}</span>
                          </div>
                          {machine.last_used_time && (
                            <div className="mt-1">
                              <span>Last Used: {formatLastUsedTime(machine.last_used_time)}</span>
                            </div>
                          )}
                          
                          <div className="mt-2">
                            <div className="text-sm mt-1" style={{ color: StateColor.IN_USE }}>
                              <strong>Busiest Times:</strong> {
                                machinePeakTimes[machine.thing_id]?.length > 0 
                                  ? machinePeakTimes[machine.thing_id].join(', ')
                                  : 'Not enough data'
                              }
                            </div>
                            <div className="text-sm mt-1" style={{ color: StateColor.AVAILABLE }}>
                              <strong>Best Times:</strong> {
                                machineIdealTimes[machine.thing_id]?.length > 0 
                                  ? machineIdealTimes[machine.thing_id].join(', ')
                                  : 'Not enough data'
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className={styles.machineChartContainer}>
                        <DynamicMachineUsageChart machineId={machine.thing_id} machineName={machine.machine} viewMode="user" />
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
                          <Spinner size="small" text="Loading data..." />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
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
                            <div className="flex justify-between items-center">
                              <strong>{machine.machine_type || 'Fitness Equipment'}</strong>
                            </div>
                          </div>
                          <div className={styles.machineCardStatus} style={{
                            backgroundColor: machine.device_status === STATUS_OFFLINE || machine.device_status === STATUS_UNKNOWN 
                              ? StateColor.OFFLINE 
                              : machine.state === StateString.IN_USE 
                                ? StateColor.IN_USE 
                                : StateColor.AVAILABLE,
                            borderLeft: machine.state === StateString.IN_USE ? `5px solid ${StateColor.IN_USE}` : machine.state === StateString.AVAILABLE ? `5px solid ${StateColor.AVAILABLE}` : `5px solid ${StateColor.OFFLINE}`
                          }}>
                            {machine.device_status === STATUS_OFFLINE || machine.device_status === STATUS_UNKNOWN
                              ? 'Offline'
                              : machine.state === StateString.IN_USE 
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
