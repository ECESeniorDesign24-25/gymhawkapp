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
import { CustomBarChart } from "./bar";
import { MachineChart } from "@/interfaces/chart";
import { Spinner } from "./spinner";

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
  const [aggregatedHourlyUsage, setAggregatedHourlyUsage] = useState<{ hour: number; percentage: number }[]>([]);
  const [aggregatedDailyUsage, setAggregatedDailyUsage] = useState<{ day: string; percentage: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isAggregateLoading, setIsAggregateLoading] = useState<boolean>(true);

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
  // New function to fetch and process aggregate data for admin view
  const fetchAggregateData = async () => {
    if (viewMode !== 'admin' || !machineId) return;
    
    setIsAggregateLoading(true);
    
    try {
      console.log(`📊 Fetching aggregate data for machine ${machineId}`);
      
      // Get data for the past 30 days as a reasonable sample
      const dates = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date);
      }
      
      // Fetch data for each day
      const allDataPoints: DataPoint[] = [];
      
      await Promise.all(
        dates.map(async (date) => {
          const startTime = get12amOnDate(date);
          try {
            const timeseries = await fetchMachineTimeseries(machineId, startTime, "state");
            
            if (!timeseries || timeseries.length === 0) {
              return;
            }
            
            const formattedData = timeseries.map((point: any) => {
              const timestamp = point.timestamp || point.time || '';
              const state = point.state || point.value || 'off';
              const deviceStatus = point.status || point.device_status || STATUS_ONLINE;
              
              if (!timestamp) {
                return null;
              }
              
              const date = convertTimeseriesToDate(point);
              return {
                time: date,
                state: state === "on" ? 0 : 1,
                device_status: deviceStatus
              };
            }).filter(Boolean);
            
            allDataPoints.push(...formattedData);
          } catch (error) {
            console.error(`Error fetching data for ${date.toISOString().split('T')[0]}:`, error);
          }
        })
      );
      
      console.log(`📊 Collected ${allDataPoints.length} total data points for aggregation`);
      
      // Only process online data points for the aggregate view
      const onlinePoints = allDataPoints.filter(point => 
        point.device_status === STATUS_ONLINE
      );
      
      // Aggregate by hour
      const hourlyData: { [key: number]: { total: number; on: number } } = {};
      onlinePoints.forEach(point => {
        const hour = point.time.getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { total: 0, on: 0 };
        }
        hourlyData[hour].total++;
        if (point.state === 0) { // 0 means in use
          hourlyData[hour].on++;
        }
      });
      
      const hourlyUsageData = Object.entries(hourlyData).map(([hour, data]) => ({
        hour: parseInt(hour),
        percentage: (data.on / data.total) * 100
      })).sort((a, b) => a.hour - b.hour);
      
      setAggregatedHourlyUsage(hourlyUsageData);
      
      // Aggregate by day of week
      const dailyData: { [key: string]: { total: number; on: number } } = {};
      onlinePoints.forEach(point => {
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
      const dailyUsageData = dayOrder.map(day => ({
        day,
        percentage: dailyData[day] ? (dailyData[day].on / dailyData[day].total) * 100 : 0
      }));
      
      setAggregatedDailyUsage(dailyUsageData);
      
    } catch (error) {
      console.error(`Error fetching aggregate data: `, error);
      setHasError(true);
    } finally {
      setIsAggregateLoading(false);
    }
  };

  //===================================================================================
  // fetch timeseries for selected day (for user view)
  useEffect(() => {
    // Only fetch single day data for user view or when in admin view and we haven't loaded yet
    if (viewMode === 'admin' && !isAggregateLoading) {
      return;
    }
    
    const fetchData = async () => {
      setIsLoading(true);
      setHasError(false);
      setUsageData([]);
      
      const startTime = get12amOnDate(selectedDate);
      console.log(`📈 Fetching timeseries data for machine ${machineId}, date: ${startTime}`);

      try {
        const timeseries = await fetchMachineTimeseries(machineId, startTime, "state");
        
        console.log(`📈 Received timeseries data:`, {
          machineId,
          date: startTime,
          dataPoints: timeseries?.length || 0,
          hasData: Boolean(timeseries && timeseries.length > 0)
        });
        
        if (!timeseries || timeseries.length === 0) {
          console.log(`📈 No timeseries data found for ${machineId} on ${startTime}`);
          setIsLoading(false);
          return;   
        }

        
        const formattedData = timeseries.map((point: any) => {
          // Handle different possible API response structures
          const timestamp = point.timestamp || point.time || '';
          const state = point.state || point.value || 'off';
          
          // API returns "status" not "device_status"
          const deviceStatus = point.status || point.device_status || STATUS_ONLINE;
          
          if (!timestamp) {
            console.warn('❌ Invalid data point missing timestamp:', point);
            return null;
          }
          
          const date = convertTimeseriesToDate(point);
          return {
            time: date,
            state: state === "on" ? 0 : 1, // convert state to binary for plot purposes
            device_status: deviceStatus
          };
        }).filter(Boolean); // Remove any null values
        
        console.log(`📈 Processed timeseries data:`, {
          machineId,
          originalPoints: timeseries.length,
          processedPoints: formattedData.length,
          startTime: formattedData.length > 0 ? formattedData[0].time : null,
          endTime: formattedData.length > 0 ? formattedData[formattedData.length - 1].time : null,
          samplePoint: formattedData.length > 0 ? formattedData[0] : null,
          statusCounts: formattedData.reduce((acc: any, point: any) => {
            acc[point.device_status] = (acc[point.device_status] || 0) + 1;
            return acc;
          }, {}),
          // Sample some raw points to see their structure
          rawSamples: timeseries.slice(0, 3)
        });
        
        setUsageData(formattedData);
      } catch (error) {
        console.error(`❌ Error fetching data for ${machineName}:`, error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };    

    if (machineId) {
      fetchData();
      
      // Poll every minute regardless of whether it's today or a past date
      const ONE_MINUTE = 60 * 1000;
      const intervalId = setInterval(fetchData, ONE_MINUTE);
      return () => clearInterval(intervalId);
    }
  }, [machineId, selectedDate, machineName, viewMode, isAggregateLoading]);

  // Fetch aggregate data for admin view on component mount
  useEffect(() => {
    if (viewMode === 'admin' && machineId) {
      fetchAggregateData();
    }
  }, [viewMode, machineId]);

  // Time bounds for the chart - use full day 
  const chartStartTime = new Date(selectedDate);
  chartStartTime.setHours(0, 0, 0, 0);
  const chartEndTime = new Date(selectedDate);
  chartEndTime.setHours(23, 59, 59, 999);

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
    // Simplified approach - use just two datasets
    
    // Dataset 1: Machine state (available - green)
    const availableData = usageData.filter(point => 
      point.device_status === STATUS_ONLINE && point.state === 1
    );
    
    // Dataset 2: Machine state (in use - red)
    const inUseData = usageData.filter(point => 
      point.device_status === STATUS_ONLINE && point.state === 0
    );
    
    // Dataset 3: Offline status (gray)
    const offlineData = usageData.filter(point => 
      point.device_status === STATUS_OFFLINE || point.device_status === STATUS_UNKNOWN
    );
    
    // Add available dataset (green)
    if (availableData.length > 0) {
      datasets.push({
        label: `${machineName} - Available`,
        data: availableData.map((point) => ({ 
          x: point.time, 
          y: point.state,
          device_status: point.device_status
        })),
        backgroundColor: 'rgba(0, 100, 0, 0.5)',
        borderColor: 'rgba(0, 100, 0, 0.8)',
        fill: {
          target: 'origin',
          above: 'rgba(0, 100, 0, 0.3)', // Green fill for "Available"
          below: 'rgba(0, 0, 0, 0)'
        },
        tension: 0,
        stepped: true,
        pointRadius: 0
      });
    }
    
    // Add in-use dataset (red)
    if (inUseData.length > 0) {
      datasets.push({
        label: `${machineName} - In Use`,
        data: inUseData.map((point) => ({ 
          x: point.time, 
          y: point.state,
          device_status: point.device_status
        })),
        backgroundColor: 'rgba(139, 0, 0, 0.5)',
        borderColor: 'rgba(139, 0, 0, 0.8)',
        fill: {
          target: 'origin',
          above: 'rgba(0, 0, 0, 0)',
          below: 'rgba(139, 0, 0, 0.3)' // Red fill for "In Use"
        },
        tension: 0,
        stepped: true,
        pointRadius: 0
      });
    }
    
    // Add offline dataset (gray)
    if (offlineData.length > 0) {
      datasets.push({
        label: `${machineName} - Offline/Unknown`,
        data: offlineData.map((point) => ({ 
          x: point.time, 
          y: 0.5, // Fixed y value for offline points
          device_status: point.device_status
        })),
        backgroundColor: 'rgba(128, 128, 128, 0.5)',
        borderColor: 'rgba(128, 128, 128, 0.8)',
        fill: {
          target: 'origin',
          above: 'rgba(128, 128, 128, 0.3)', // Gray fill for offline/unknown
          below: 'rgba(128, 128, 128, 0.3)'
        },
        tension: 0,
        stepped: true,
        pointRadius: 0
      });
    }
  }

  // Set up data for chart
  const chartData = {
    datasets: datasets
  };
  
  console.log(`📊 Chart data created:`, {
    machineId,
    datasetCount: datasets.length,
    chartStartTime,
    chartEndTime
  });

  // format the data for the charts
  const lineChartOptions = getLineChartOptions(machineName, chartStartTime, chartEndTime);
  const hourlyChartData = getHourlyChartData(hourlyUsage);
  const dailyChartData = getDailyChartData(dailyUsage);
  const barChartOptions = getBarChartOptions(machineName);
  
  // Create chart data for aggregated stats for admin view
  const aggregatedHourlyChartData = getHourlyChartData(aggregatedHourlyUsage);
  const aggregatedDailyChartData = getDailyChartData(aggregatedDailyUsage);

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
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner text="Loading data..." />
            </div>
          ) : hasError ? (
            <div style={{ textAlign: 'center', color: 'red', marginTop: '8px' }}>
              Error loading data. Please try again.
            </div>
          ) : (
            <Line data={chartData} options={lineChartOptions} />
          )}
        </div>
      </div>
    );
  } else {
    // Admin view with aggregated hourly and daily charts
    return (
      <div className="space-y-8">
        <h3 style={{ textAlign: 'center', fontWeight: 'bold' }}>Aggregated Usage Patterns (Past 30 Days)</h3>
        {isAggregateLoading ? (
          <div className="flex items-center justify-center h-full" style={{ height: "200px" }}>
            <Spinner size="large" text="Aggregating data from past 30 days..." />
          </div>
        ) : hasError ? (
          <div style={{ textAlign: 'center', color: 'red', padding: '20px' }}>
            Error loading data. Please try again.
          </div>
        ) : aggregatedHourlyUsage.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'gray', padding: '20px' }}>
            No aggregated data available
          </div>
        ) : (
          <>
            <div>
              <h4 style={{ textAlign: 'center', margin: '10px 0' }}>Hourly Usage Pattern</h4>
              <div className="h-64">
                <CustomBarChart barChartData={aggregatedHourlyChartData} barChartOptions={barChartOptions} machineName={machineName} />
              </div>
            </div>
            <div>
              <h4 style={{ textAlign: 'center', margin: '10px 0' }}>Daily Usage Pattern</h4>
              <div className="h-64">
                <CustomBarChart barChartData={aggregatedDailyChartData} barChartOptions={barChartOptions} machineName={machineName} />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
};

// note this needs ssr to be false so we render client side so the charts work
export default dynamic(() => Promise.resolve(MachineUsageChart), { ssr: false });
