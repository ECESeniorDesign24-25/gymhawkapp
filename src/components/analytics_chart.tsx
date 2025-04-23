import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
} from "chart.js";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';
import { fetchMachineTimeseries } from "@/utils/db";
import zoomPlugin from 'chartjs-plugin-zoom';
import dynamic from 'next/dynamic';
import { convertTimeseriesToDate, get12amOnDate, isToday } from "../utils/time_utils";
import { getBarChartOptions, getDailyChartData, getHourlyChartData, getLineChartOptions } from "../utils/chart_utils";
import { CustomBarChart } from "./custom_bar_chart";
import { MachineChart } from "@/interfaces/chart";
// set up chart js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
  zoomPlugin
);

// Constants for status values
const STATUS_OFFLINE = "OFFLINE";
const STATUS_UNKNOWN = "UNKNOWN";
const STATUS_ONLINE = "ONLINE";

// Define an interface for data points with device status
interface DataPoint {
  time: Date;
  state: number;
  device_status?: string;
}

//===================================================================================
// builds the usage chart
const MachineUsageChart: React.FC<MachineChart & { viewMode?: 'user' | 'admin' }> = ({ 
  machineId, 
  machineName, 
  viewMode = 'user' 
}) => {
  const [usageData, setUsageData] = useState<DataPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hourlyUsage, setHourlyUsage] = useState<{ hour: number; percentage: number }[]>([]);
  const [dailyUsage, setDailyUsage] = useState<{ day: string; percentage: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  //===================================================================================
  // client-side useEffect to calculate hourly and daily usage patterns from usageData
  useEffect(() => {
    if (usageData.length === 0) return;
    
    const hourlyData: { [key: number]: { total: number; on: number } } = {};

    // calculate "on" counts per hour
    usageData.forEach(point => {
      const hour = point.time.getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, on: 0 };
      }
      hourlyData[hour].total++;
      if (point.state === 0) { // 0 means in use
        hourlyData[hour].on++;
      }
    });

    // convert to percentage and sort by hour for plotting
    const hourlyUsageData = Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      percentage: (data.on / data.total) * 100
    })).sort((a, b) => a.hour - b.hour);

    setHourlyUsage(hourlyUsageData);

    // calculate "on" counts per day 
    const dailyData: { [key: string]: { total: number; on: number } } = {};
    usageData.forEach(point => {
      const day = point.time.toLocaleDateString('en-US', { weekday: 'long' });
      if (!dailyData[day]) {
        dailyData[day] = { total: 0, on: 0 };
      }
      dailyData[day].total++;
      if (point.state === 0) { // 0 means in use
        dailyData[day].on++;
      }
    });

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // convert to percentage and sort by day for plotting
    const dailyUsageData = dayOrder.map(day => ({
      day,
      percentage: dailyData[day] ? (dailyData[day].on / dailyData[day].total) * 100 : 0
    }));

    setDailyUsage(dailyUsageData);
  }, [usageData]);

  //===================================================================================
  // fetch timeseries for selected day
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setHasError(false);
      setUsageData([]);
      
      const startTime = get12amOnDate(selectedDate);

      try {
        const timeseries = await fetchMachineTimeseries(machineId, startTime, "state");
        
        if (!timeseries || timeseries.length === 0) {
          setIsLoading(false);
          return;   
        }

        
        const formattedData = timeseries.map((point: any) => {
          // Handle different possible API response structures
          const timestamp = point.timestamp || point.time || '';
          const state = point.state || point.value || 'off';
          const deviceStatus = point.device_status || STATUS_ONLINE;
          
          if (!timestamp) {
            console.warn('Invalid data point missing timestamp:', point);
            return null;
          }
          
          const date = convertTimeseriesToDate(point);
          return {
            time: date,
            state: state === "on" ? 0 : 1, // convert state to binary for plot purposes
            device_status: deviceStatus
          };
        }).filter(Boolean); // Remove any null values
        
        setUsageData(formattedData);
      } catch (error) {
        console.error(`Error fetching data for ${machineName}:`, error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };    

    if (machineId) {
      fetchData();
      
      // if we are viewing today there are live updates so set interval for 1 minute update
      if (isToday(selectedDate)) {
        const ONE_MINUTE = 60 * 1000;
        const intervalId = setInterval(fetchData, ONE_MINUTE);
        return () => clearInterval(intervalId);
      }
    }
  }, [machineId, selectedDate, machineName]);

  // Time bounds for the chart - use full day 
  const chartStartTime = new Date(selectedDate);
  chartStartTime.setHours(0, 0, 0, 0);
  const chartEndTime = new Date(selectedDate);
  chartEndTime.setHours(23, 59, 59, 999);

  // Separate data by device status
  const onlineData = usageData.filter(point => 
    point.device_status === STATUS_ONLINE
  );
  
  const offlineData = usageData.filter(point => 
    point.device_status === STATUS_OFFLINE || point.device_status === STATUS_UNKNOWN
  );

  // Create datasets for the chart
  const datasets = [];

  // Show a gray background for the entire day if we're still loading or if there's no data
  if (isLoading || (!isLoading && usageData.length === 0)) {
    // Create gray dataset for the entire day
    datasets.push({
      label: isLoading ? 'Loading...' : 'No Data Available',
      data: [
        { 
          x: chartStartTime, 
          y: 0.5,
          device_status: 'NO_DATA' 
        },
        { 
          x: chartEndTime, 
          y: 0.5,
          device_status: 'NO_DATA'
        }
      ],
      backgroundColor: 'rgba(200, 200, 200, 0.5)',
      borderColor: 'rgba(200, 200, 200, 0.8)',
      fill: {
        target: 'origin',
        above: 'rgba(200, 200, 200, 0.3)',
        below: 'rgba(200, 200, 200, 0.3)'
      },
      tension: 0,
      stepped: true,
      pointRadius: 0
    });
  } else {
    // Add datasets for online data (available in green, in use in red)
    if (onlineData.length > 0) {
      datasets.push(
        {
          label: `${machineName} - Available`,
          data: onlineData.map((point) => ({ 
            x: point.time, 
            y: point.state,
            device_status: point.device_status
          })),
          fill: {
            target: 'origin',
            above: 'rgba(0, 100, 0, 0.3)', // Green fill for "Available"
            below: 'rgba(0, 0, 0, 0)'
          },
          borderColor: 'rgba(0, 100, 0, 0.8)',
          tension: 0.1,
          stepped: true,
          pointRadius: 0
        },
        {
          label: `${machineName} - In Use`,
          data: onlineData.map((point) => ({ 
            x: point.time, 
            y: point.state,
            device_status: point.device_status
          })),
          fill: {
            target: {
              value: 1
            },
            above: 'rgba(0, 0, 0, 0)',
            below: 'rgba(139, 0, 0, 0.3)' // Red fill for "In Use"
          },
          borderWidth: 0,
          tension: 0.1,
          stepped: true,
          pointRadius: 0,
          showLine: false
        }
      );
    }
    
    // Add dataset for offline/unknown data (gray)
    if (offlineData.length > 0) {
      datasets.push({
        label: `${machineName} - Offline/Unknown`,
        data: offlineData.map((point) => ({ 
          x: point.time, 
          y: 0.5,
          device_status: point.device_status
        })), // Middle value to show gray
        backgroundColor: 'rgba(128, 128, 128, 0.5)',
        borderColor: 'rgba(128, 128, 128, 0.8)',
        fill: {
          target: 'origin',
          above: 'rgba(128, 128, 128, 0.3)', // Gray fill for offline/unknown
          below: 'rgba(128, 128, 128, 0.3)'
        },
        tension: 0.1,
        stepped: true,
        pointRadius: 0
      });
    }
  }

  // Set up data for chart
  const chartData = {
    datasets: datasets
  };

  // format the data for the charts
  const lineChartOptions = getLineChartOptions(machineName, chartStartTime, chartEndTime);
  const hourlyChartData = getHourlyChartData(hourlyUsage);
  const dailyChartData = getDailyChartData(dailyUsage);
  const barChartOptions = getBarChartOptions(machineName);

  // Render different views based on viewMode
  if (viewMode === 'user') {
    return (
      <div className="space-y-8">
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            disabled={isLoading}
          >
            Previous Day
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            disabled={isLoading}
          >
            Today
          </button>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            disabled={isLoading}
          />
          <button 
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            disabled={isLoading}
          >
            Next Day
          </button>
        </div>
        <div className="h-64">
          <Line data={chartData} options={lineChartOptions} />
          {hasError && (
            <div style={{ textAlign: 'center', color: 'red', marginTop: '8px' }}>
              Error loading data. Please try again.
            </div>
          )}
        </div>
      </div>
    );
  } else {
    // Admin view with hourly and daily charts only
    return (
      <div className="space-y-8">
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            disabled={isLoading}
          >
            Previous Day
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            disabled={isLoading}
          >
            Today
          </button>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            disabled={isLoading}
          />
          <button 
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            disabled={isLoading}
          >
            Next Day
          </button>
        </div>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading data...</div>
        ) : hasError ? (
          <div style={{ textAlign: 'center', color: 'red', padding: '20px' }}>
            Error loading data. Please try again.
          </div>
        ) : usageData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'gray', padding: '20px' }}>
            No data available for this date
          </div>
        ) : (
          <>
            <div className="h-64">
              <CustomBarChart barChartData={hourlyChartData} barChartOptions={barChartOptions} machineName={machineName} />
            </div>
            <div className="h-64">
              <CustomBarChart barChartData={dailyChartData} barChartOptions={barChartOptions} machineName={machineName} />
            </div>
          </>
        )}
      </div>
    );
  }
};

// note this needs ssr to be false so we render client side so the charts work
export default dynamic(() => Promise.resolve(MachineUsageChart), { ssr: false });
