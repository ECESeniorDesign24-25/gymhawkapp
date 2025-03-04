import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE } from '@/styles/customStyles';
import { fetchGyms, fetchMachines } from '@/utils/db';
import { fetchDeviceState } from '@/utils/cloudAPI';
import { useAuth } from '@/lib/auth';
import MachineUsageChart from '@/components/usage-chart';
import AdminUsageChart from "@/components/daily-usage-chart";


export default function Analytics() {
  const [selectedOption, setSelectedOption] = useState(null);
  const [activeTab, setActiveTab] = useState('user');
  const [gyms, setGyms] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const { user, isAdmin } = useAuth();
  const [selectPlaceholder, setSelectPlaceholder] = useState<any>("Select a gym");


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


 // poll machine states every 1s and update dict
 useEffect(() => {
  const controller = new AbortController();
  const intervalId = setInterval(() => {
    setMachines(prevMachines => {
      // return empty if no machines
      if (prevMachines.length === 0) {
        return prevMachines;
      }
      Promise.all(
        prevMachines.map(async (machine) => {
          try {
            const state = await fetchDeviceState(machine.machine, controller.signal);
            // return existing machine properties plus updated state
            return { ...machine, state };
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

  return () => clearInterval(intervalId);
}, []);

  const handleAdminApplication = () => {
    // Create a mailto link with pre-filled subject and body
    const email = 'eceseniordesign20242025@gmail.com';
    const subject = 'Admin Access Request';
    const body = `User Email: ${user?.email}\n\nI would like to request admin access to GymHawk.`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


  // render page
  return (
    <div className={styles.container}>
      <Banner />
      <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh' }}>
  <div
    className={styles.sidebar}
    style={{ width: '250px', flexShrink: 0, backgroundColor: '#f0f0f0' }}
  >
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
  <div
    className={styles.mainContent}
    style={{
      flexGrow: 1,
      backgroundColor: '#fff',
      padding: '0 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}
  >
    <div className={styles.searchBarContainer} style={{ marginBottom: '20px' }}>
      <Select
        options={gyms}
        placeholder={selectPlaceholder}
        styles={HOME_STYLE}
      />
    </div>
    {activeTab === 'user' && (
      <div className={styles.userAnalytics}>
        <MachineUsageChart />
        <h2>Machine Status</h2>
        &nbsp;
        {machines.map(machine => {
          const state = machine.state instanceof Promise ? 'loading' : machine.state;
          let bgColor;
          let statusText;
          let machineClass;

          if (state === 'off') {
            machineClass = styles.machineAvailable;
            statusText = 'Available';
          } else if (state === 'on') {
            machineClass = styles.machineInUse;
            statusText = 'In Use';
          } else {
            machineClass = styles.machineUnknown;
            statusText = state === 'loading' ? 'Loading...' : 'Unknown';
          }

          return (
            <div 
              key={machine.id} 
              className={`${styles.machineStatus} ${machineClass}`}
            >
              <h3 className="text-lg font-bold">{machine.machine}</h3>
              <p className="mt-2">
                Status: <span className="font-bold">{statusText}</span>
              </p>
              <p className="mt-1 font-bold">
                Last Used:{" "}
                {machine.lastUsed instanceof Promise ? 'Loading...' : machine.lastUsed}
              </p>
            </div>
          );
        })}

      </div>
    )}
    {activeTab === 'admin' && isAdmin && (
      <div className={styles.adminAnalytics}>
        <AdminUsageChart />
        <h2>Daily Usage Statistics</h2>
        &nbsp;
        {machines.map(machine => (
          <div key={machine.id} className={styles.machineUsage}>
            <h3>{machine.machine}</h3>
            <p>Usage Rate: {machine.usagePercentage}%</p>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
      <Footer />
    </div>
  );
}
