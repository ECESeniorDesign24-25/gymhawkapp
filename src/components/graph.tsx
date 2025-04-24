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
import { 
  fetchMachineTimeseries, 
  fetchTotalUsage, 
  fetchDailyUsage,
  fetchDailyPercentages,
  fetchHourlyPercentages
} from '@/utils/db';
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
  const [totalThirtyDayUsage, setTotalThirtyDayUsage] = useState<{ hours: number; minutes: number }>({ hours: 0, minutes: 0 });
  const [todayUsage, setTodayUsage] = useState<{ hours: number; minutes: number }>({ hours: 0, minutes: 0 });
  const [isLoadingUsageStats, setIsLoadingUsageStats] = useState<boolean>(false);

  //===================================================================================
  // client-side useEffect to calculate hourly and daily usage patterns from usageData
  useEffect(() => {
    if (usageData.length === 0) return;
    
    const hourlyData: { [key: number]: { total: number; on: number } } = {};

    // calculate "on" counts per hour - ONLY FOR ONLINE STATUS
    usageData.forEach(point => {
      // Skip data points that aren't ONLINE
      if (point.device_status !== STATUS_ONLINE) return;
      
      // Get hour in local timezone
      const hour = new Date(point.time).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, on: 0 };
      }
      hourlyData[hour].total++;
      // If state is 0, it means the machine is in use (on)
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

    // calculate "on" counts per day - ONLY FOR ONLINE STATUS
    const dailyData: { [key: string]: { total: number; on: number } } = {};
    usageData.forEach(point => {
      // Skip data points that aren't ONLINE
      if (point.device_status !== STATUS_ONLINE) return;
      
      const day = point.time.toLocaleDateString('en-US', { weekday: 'long' });
      if (!dailyData[day]) {
        dailyData[day] = { total: 0, on: 0 };
      }
      dailyData[day].total++;
      // If state is 0, it means the machine is in use (on)
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
      // Fetch daily percentages directly from backend
      const dailyPercentagesData = await fetchDailyPercentages(machineId);
      setAggregatedDailyUsage(dailyPercentagesData);
      
      // Fetch hourly percentages directly from backend
      const hourlyPercentagesData = await fetchHourlyPercentages(machineId);
      setAggregatedHourlyUsage(hourlyPercentagesData);
      
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

      try {
        // This API call filters data by machineId (thing_id)
        // SQL equivalent: WHERE thing_id = machineId
        const timeseries = await fetchMachineTimeseries(machineId, startTime, "state");
        const formattedData = timeseries.map((point: any) => {
          // Handle different possible API response structures
          const timestamp = point.timestamp || point.time || '';
          const rawState = point.state || point.value || 'off';
          
          // API returns "status" not "device_status"
          const deviceStatus = point.status || point.device_status || STATUS_ONLINE;
          
          if (!timestamp) {
            console.warn('❌ Invalid data point missing timestamp:', point);
            return null;
          }
          
          const date = convertTimeseriesToDate(point);
          
          // IMPORTANT: For gym equipment, "on" means the machine is in use (someone is using it)
          // We convert this to: 0 = in use (on), 1 = not in use (off)
          const isInUse = rawState === "on";
          const normalizedState = isInUse ? 0 : 1;
          
          return {
            time: date,
            state: normalizedState,
            device_status: deviceStatus
          };
        }).filter(Boolean); // Remove any null values
        
        
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

  // Function to fetch usage statistics from the backend
  const fetchUsageStatistics = async () => {
    if (viewMode !== 'admin' || !machineId) return;
    
    setIsLoadingUsageStats(true);
    try {
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      
      // Fetch daily usage for the selected date 
      const dailyHours = await fetchDailyUsage(machineId, selectedDateStr);
      
      // Calculate hours and minutes
      const wholeHours = Math.floor(dailyHours);
      const minutes = Math.round((dailyHours - wholeHours) * 60);
      setTodayUsage({ hours: wholeHours, minutes });
      
      // Fetch total usage for all time
      const totalHours = await fetchTotalUsage(machineId);
      
      // Calculate hours and minutes
      const wholeTotalHours = Math.floor(totalHours);
      const totalMinutes = Math.round((totalHours - wholeTotalHours) * 60);
      setTotalThirtyDayUsage({ hours: wholeTotalHours, minutes: totalMinutes });
      
    } catch (error) {
      console.error("Error fetching usage statistics:", error);
    } finally {
      setIsLoadingUsageStats(false);
    }
  };
  
  // Fetch usage statistics when the machine or date changes
  useEffect(() => {
    if (viewMode === 'admin' && machineId) {
      fetchUsageStatistics();
    }
  }, [viewMode, machineId, selectedDate]);

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
          y: 1,
          device_status: 'NO_DATA' 
        },
        { 
          x: chartEndTime, 
          y: 1,
          device_status: 'NO_DATA'
        }
      ],
      backgroundColor: 'rgba(200, 200, 200, 0.5)',
      borderColor: 'rgba(200, 200, 200, 0.8)',
      fill: {
        target: 'origin',
        below: 'rgba(200, 200, 200, 0.3)'
      },
      tension: 0,
      stepped: 'before' as const,
      pointRadius: 0
    });
  } else {
    // Include all data points, not just online ones
    const sortedData = [...usageData].sort((a, b) => a.time.getTime() - b.time.getTime());
    
    // Create a combined dataset with proper transitions
    const combinedDataPoints = [];
    
    // Make sure we have a point at the start of the day
    if (sortedData.length > 0) {
      // Add start of day point if needed
      if (sortedData[0].time.getTime() > chartStartTime.getTime()) {
        // Add a default "available" state at midnight
        combinedDataPoints.push({
          time: chartStartTime,
          state: 1, // Default to available
          device_status: STATUS_ONLINE
        });
      }
      
      // Add all points with their state determining color
      combinedDataPoints.push(...sortedData);
      
      // Add end of day point if needed
      if (sortedData[sortedData.length - 1].time.getTime() < chartEndTime.getTime()) {
        // Use the last known state
        const lastState = sortedData[sortedData.length - 1].state;
        const lastStatus = sortedData[sortedData.length - 1].device_status || STATUS_ONLINE;
        combinedDataPoints.push({
          time: chartEndTime,
          state: lastState,
          device_status: lastStatus
        });
      }
    }
    
    // Create datasets with segments colored based on state and device status
    if (combinedDataPoints.length > 0) {
      // First, ensure we have proper transition points by creating an ordered timeline
      // with explicit transition points where the state changes
      let processedPoints: {time: Date, state: number, device_status: string}[] = [];
      
      for (let i = 0; i < combinedDataPoints.length; i++) {
        const currentPoint = combinedDataPoints[i];
        processedPoints.push({
          time: currentPoint.time,
          state: currentPoint.state,
          device_status: currentPoint.device_status || STATUS_ONLINE
        });
        
        // Add transition points between state or status changes
        if (i < combinedDataPoints.length - 1) {
          const nextPoint = combinedDataPoints[i + 1];
          
          // If the state changes or device status changes, add transition points
          if (currentPoint.state !== nextPoint.state || 
              currentPoint.device_status !== nextPoint.device_status) {
            // Create a point 1ms before the next point with the current state and status
            const transitionTime = new Date(nextPoint.time.getTime() - 1);
            processedPoints.push({
              time: transitionTime,
              state: currentPoint.state,
              device_status: currentPoint.device_status || STATUS_ONLINE
            });
          }
        }
      }
      
      // Now create non-overlapping datasets based on both state and device status
      let availableSegments: {start: Date, end: Date}[] = [];
      let inUseSegments: {start: Date, end: Date}[] = [];
      let offlineSegments: {start: Date, end: Date}[] = [];
      
      // Group into continuous segments
      let currentSegmentStart = processedPoints[0].time;
      let currentState = processedPoints[0].state;
      let currentStatus = processedPoints[0].device_status;
      
      for (let i = 1; i < processedPoints.length; i++) {
        const point = processedPoints[i];
        
        // If state or status changed, close the current segment and start a new one
        if (point.state !== currentState || point.device_status !== currentStatus) {
          // End the current segment at the previous point's time
          const segmentEnd = processedPoints[i-1].time;
          
          // Determine which segment list to add to based on status and state
          if (currentStatus === STATUS_ONLINE) {
            if (currentState === 1) {
              availableSegments.push({ start: currentSegmentStart, end: segmentEnd });
            } else {
              inUseSegments.push({ start: currentSegmentStart, end: segmentEnd });
            }
          } else {
            // For OFFLINE or UNKNOWN status, add to offline segments
            offlineSegments.push({ start: currentSegmentStart, end: segmentEnd });
          }
          
          // Start a new segment
          currentSegmentStart = point.time;
          currentState = point.state;
          currentStatus = point.device_status;
        }
      }
      
      // Add the final segment
      const lastPoint = processedPoints[processedPoints.length - 1];
      if (lastPoint.device_status === STATUS_ONLINE) {
        if (lastPoint.state === 1) {
          availableSegments.push({ start: currentSegmentStart, end: lastPoint.time });
        } else {
          inUseSegments.push({ start: currentSegmentStart, end: lastPoint.time });
        }
      } else {
        offlineSegments.push({ start: currentSegmentStart, end: lastPoint.time });
      }
      
      // Create dataset points from segments
      const availablePoints: {x: Date, y: number}[] = [];
      availableSegments.forEach(segment => {
        availablePoints.push({ x: segment.start, y: 1 });
        availablePoints.push({ x: segment.end, y: 1 });
        // Add a null point to break the line
        if (segment !== availableSegments[availableSegments.length - 1]) {
          availablePoints.push({ x: segment.end, y: null as any });
        }
      });
      
      const inUsePoints: {x: Date, y: number}[] = [];
      inUseSegments.forEach(segment => {
        inUsePoints.push({ x: segment.start, y: 1 });
        inUsePoints.push({ x: segment.end, y: 1 });
        // Add a null point to break the line
        if (segment !== inUseSegments[inUseSegments.length - 1]) {
          inUsePoints.push({ x: segment.end, y: null as any });
        }
      });
      
      const offlinePoints: {x: Date, y: number}[] = [];
      offlineSegments.forEach(segment => {
        offlinePoints.push({ x: segment.start, y: 1 });
        offlinePoints.push({ x: segment.end, y: 1 });
        // Add a null point to break the line
        if (segment !== offlineSegments[offlineSegments.length - 1]) {
          offlinePoints.push({ x: segment.end, y: null as any });
        }
      });
      
      // Add the datasets (only if they have points)
      if (availablePoints.length > 0) {
        datasets.push({
          label: `${machineName} - Available`,
          data: availablePoints,
          backgroundColor: 'rgba(0, 100, 0, 0.5)',
          borderColor: 'rgba(0, 100, 0, 0.8)',
          fill: {
            target: 'origin',
            below: 'rgba(0, 100, 0, 0.3)'
          },
          tension: 0,
          stepped: 'before' as const,
          pointRadius: 0
        });
      }
      
      if (inUsePoints.length > 0) {
        datasets.push({
          label: `${machineName} - In Use`,
          data: inUsePoints,
          backgroundColor: 'rgba(139, 0, 0, 0.5)',
          borderColor: 'rgba(139, 0, 0, 0.8)',
          fill: {
            target: 'origin',
            below: 'rgba(139, 0, 0, 0.3)'
          },
          tension: 0,
          stepped: 'before' as const,
          pointRadius: 0
        });
      }
      
      if (offlinePoints.length > 0) {
        datasets.push({
          label: `${machineName} - Offline/Unknown`,
          data: offlinePoints,
          backgroundColor: 'rgba(128, 128, 128, 0.5)',
          borderColor: 'rgba(128, 128, 128, 0.8)',
          fill: {
            target: 'origin',
            below: 'rgba(128, 128, 128, 0.3)'
          },
          tension: 0,
          stepped: 'before' as const,
          pointRadius: 0
        });
      }
    }
  }

  // Set up data for chart
  const chartData = {
    datasets: datasets
  };
  
  // Update lineChartOptions to format tooltip time correctly
  const modifiedLineChartOptions = {
    ...getLineChartOptions(machineName, chartStartTime, chartEndTime),
    plugins: {
      ...getLineChartOptions(machineName, chartStartTime, chartEndTime).plugins,
      tooltip: {
        callbacks: {
          title: (context: any) => {
            // Format time to match x-axis display
            const date = new Date(context[0].parsed.x);
            return date.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true
            });
          }
        }
      }
    }
  };
  

  // format the data for the charts
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
            onClick={() => {
              const today = new Date();
              // Normalize to midnight of the current day to avoid timezone issues
              today.setHours(0, 0, 0, 0);
              setSelectedDate(today);
            }}
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
            disabled={isLoading || isToday(selectedDate)}
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
            <Line data={chartData} options={modifiedLineChartOptions} />
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
            {/* Add total usage hours display */}
            <div style={{ textAlign: 'center', margin: '10px 0', backgroundColor: 'rgba(240, 249, 255, 0.8)', padding: '10px', borderRadius: '5px', border: '1px solid #e0e0e0' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>
                {isToday(selectedDate) ? "Today's" : `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}'s`} Total Usage Time
              </h4>
              {isLoadingUsageStats ? (
                <div className="flex items-center justify-center" style={{ height: "30px" }}>
                  <Spinner size="small" text="" />
                </div>
              ) : (
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {todayUsage.hours} hour{todayUsage.hours !== 1 ? 's' : ''} {todayUsage.minutes} minute{todayUsage.minutes !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            
            {/* Add 30-day total usage display */}
            <div style={{ textAlign: 'center', margin: '10px 0', backgroundColor: 'rgba(240, 249, 255, 0.8)', padding: '10px', borderRadius: '5px', border: '1px solid #e0e0e0' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>
                Total Usage Time (All Time)
              </h4>
              {isLoadingUsageStats ? (
                <div className="flex items-center justify-center" style={{ height: "30px" }}>
                  <Spinner size="small" text="" />
                </div>
              ) : (
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {totalThirtyDayUsage.hours} hour{totalThirtyDayUsage.hours !== 1 ? 's' : ''} {totalThirtyDayUsage.minutes} minute{totalThirtyDayUsage.minutes !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            
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
