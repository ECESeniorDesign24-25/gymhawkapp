import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE, DARK_MAP_THEME, ZOOM_LEVEL } from '@/styles/customStyles';
import { fetchGyms, fetchMachines } from '@/utils/db';
import { fetchDeviceState } from '@/utils/cloudAPI';
import { useAuth } from '@/lib/auth';
import MachineUsageChart from '@/components/usage-chart';


export default function Home() {
  const [activeTab, setActiveTab] = useState('user');
  const [gyms, setGyms] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const { user, isAdmin } = useAuth();


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


  // poll machine states every 5s and update dict
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const updateMachineStates = async () => {
        const updatedMachines = await Promise.all(
          machines.map(async (machine) => {
            try {
              const state = await fetchDeviceState(machine.machine);
              return { ...machine, state };
            } catch (err) {
              console.error('Error fetching device state for', machine.machine, err);
              return machine;
            }
          })
        );
        setMachines(updatedMachines);
      };

      updateMachineStates();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [machines]);


  const handleAdminApplication = () => {
    // Create a mailto link with pre-filled subject and body
    const email = 'user@example.com';
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
      justifyContent: 'center' // vertically centers the content
    }}
  >
    <div className={styles.searchBarContainer} style={{ marginBottom: '20px' }}>
      <Select
        options={gyms}
        placeholder="Search gyms..."
        styles={HOME_STYLE}
      />
    </div>
    {activeTab === 'user' && (
      <div className={styles.userAnalytics}>
        <MachineUsageChart />
        <h2>Machine Status</h2>
        {machines.map(machine => (
          <div key={machine.id} className={styles.machineStatus}>
            <h3>{machine.name}</h3>
            <p>
              Current State:{" "}
              {machine.state instanceof Promise ? 'Loading...' : machine.state}
            </p>
            <p>
              Last Used:{" "}
              {machine.lastUsed instanceof Promise ? 'Loading...' : machine.lastUsed}
            </p>
          </div>
        ))}
      </div>
    )}
    {activeTab === 'admin' && isAdmin && (
      <div className={styles.adminAnalytics}>
        <h2>Daily Usage Statistics</h2>
        {machines.map(machine => (
          <div key={machine.id} className={styles.machineUsage}>
            <h3>{machine.name}</h3>
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
