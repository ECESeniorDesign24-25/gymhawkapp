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
import { DataPoint } from "@/interfaces/dataPoint";
import { ONE_MINUTE, CENTRAL_TIMEZONE } from "@/utils/consts";
import { StateInt, StateString, StateColor, Status} from "@/enums/state";
import { getFromCache, saveToCache } from "@/utils/cache";
import { buttonStyle, buttonHoverStyles, todaySelectedStyle } from "@/styles/buttonStyle";

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

// machine usage chart
const MachineUsageChart: React.FC<MachineChart & { viewMode?: 'user' | 'admin' }> = ({ 
  machineId, 
  machineName, 
  viewMode = 'user' 
}) => {
  const [usageData, setUsageData] = useState<DataPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // state variables for machine usage chart
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
  const [dataRefreshing, setDataRefreshing] = useState<boolean>(false);


  // calculate on counts per hour
  useEffect(() => {
    if (usageData.length === 0)
    {
      return;
    }
    const hourlyData: { [key: number]: { total: number; on: number } } = {};

    usageData.forEach(point => {

      // only include ONLINE status
      if (point.device_status !== Status.ONLINE) {
        return;
      } 
      
      // get hour in local timezone
      const hour = new Date(point.time).getHours();

      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, on: 0 };
      }
      hourlyData[hour].total++;

      // include state when ON = in use
      if (point.state === StateInt.IN_USE) {
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

      // only include ONLINE status
      if (point.device_status !== Status.ONLINE) {
        return;
      }
      
      const day = point.time.toLocaleDateString('en-US', { weekday: 'long' });
      if (!dailyData[day]) {
        dailyData[day] = { total: 0, on: 0 };
      }
      dailyData[day].total++;
      if (point.state === StateInt.IN_USE) { 
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


  // fetch aggregate data for admin view
  const fetchAggregateData = async () => {
    if (viewMode !== 'admin' || !machineId) return;
    
    setIsAggregateLoading(true);
    
    // check cache first
    const cacheKeyDaily = `daily_percentages_${machineId}`;
    const cachedDailyData = getFromCache(cacheKeyDaily);
    
    if (cachedDailyData) {
      setAggregatedDailyUsage(cachedDailyData);
    }

    const cacheKeyHourly = `hourly_percentages_${machineId}`;
    const cachedHourlyData = getFromCache(cacheKeyHourly);
    
    if (cachedHourlyData) {
      setAggregatedHourlyUsage(cachedHourlyData);
    }

    // only show loading if we dont have cached data to use
    if (cachedDailyData && cachedHourlyData) {
      setIsAggregateLoading(false);
      setDataRefreshing(true);
    }
    
    try {

      // force fetch to update cache
      const dailyPercentagesData = await fetchDailyPercentages(machineId);
      setAggregatedDailyUsage(dailyPercentagesData);
      saveToCache(cacheKeyDaily, dailyPercentagesData);
      
      const hourlyPercentagesData = await fetchHourlyPercentages(machineId);
      setAggregatedHourlyUsage(hourlyPercentagesData);
      saveToCache(cacheKeyHourly, hourlyPercentagesData);
      
    } catch (error) {
      alert(`Error fetching aggregate data: ${error}`);
      if (!cachedDailyData || !cachedHourlyData) {
        setHasError(true);
      }
    } finally {
      setIsAggregateLoading(false);
      setDataRefreshing(false);
    }
  };

  // fetch time series for selected day
  useEffect(() => {

    // if we are in admin and already loaded just return
    if (viewMode === 'admin' && !isAggregateLoading) {
      return;
    }
    
    // fetch time series data
    const fetchData = async () => {
      setIsLoading(true);
      setHasError(false);
      setUsageData([]);
      
      const startTime = get12amOnDate(selectedDate);

      try {
        const timeseries = await fetchMachineTimeseries(machineId, startTime, "state");
        
        const formattedData = timeseries.map((point: any) => {
          const timestamp = point.timestamp || point.time || '';
          const rawState = point.state || point.value || 'off';
          const deviceStatus = point.status || point.device_status || Status.UNKNOWN;
          
          if (!timestamp) {
            return null;
          }
          
          const date = convertTimeseriesToDate(point);
          const isInUse = rawState === StateString.IN_USE || rawState === StateInt.IN_USE;
          const normalizedState = isInUse ? StateInt.IN_USE : StateInt.AVAILABLE;
          
          return {
            time: date,
            state: normalizedState,
            device_status: deviceStatus
          };
        }).filter(Boolean); // drop nulls
        
        
        setUsageData(formattedData);
      } catch (error) {
        alert(`Error fetching data for ${machineName}: ${error}`);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };    

    // fetch data if machine id is set
    if (machineId) {
      fetchData();
      
      // poll every minute
      const intervalId = setInterval(fetchData, ONE_MINUTE);
      return () => clearInterval(intervalId);
    }
  }, [machineId, selectedDate, machineName, viewMode, isAggregateLoading]);


  // fetch usage statistics for admin view
  const fetchUsageStatistics = async () => {
    if (viewMode !== 'admin' || !machineId) {
      return;
    }
    
    setIsLoadingUsageStats(true);
    
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    
    // check cache for usage statistics
    const cacheKeyDaily = `daily_usage_${machineId}_${selectedDateStr}`;
    const cachedDailyUsage = getFromCache(cacheKeyDaily);
    
    const cacheKeyTotal = `total_usage_${machineId}`;
    const cachedTotalUsage = getFromCache(cacheKeyTotal);
    
    // if we have cached data use it
    if (cachedDailyUsage) {
      const wholeHours = Math.floor(cachedDailyUsage);
      const minutes = Math.round((cachedDailyUsage - wholeHours) * 60);
      setTodayUsage({ hours: wholeHours, minutes });
    }
    
    if (cachedTotalUsage) {
      const wholeTotalHours = Math.floor(cachedTotalUsage);
      const totalMinutes = Math.round((cachedTotalUsage - wholeTotalHours) * 60);
      setTotalThirtyDayUsage({ hours: wholeTotalHours, minutes: totalMinutes });
    }
    
    if (cachedDailyUsage && cachedTotalUsage) {
      setIsLoadingUsageStats(false);
      const refreshInBackground = true;
      if (!refreshInBackground) {
        return;
      }
    }
    
    try {
      // fetch daily usage for selected date
      const dailyHours = await fetchDailyUsage(machineId, selectedDateStr);
      saveToCache(cacheKeyDaily, dailyHours);
      
      // calculate hours and minutes
      const wholeHours = Math.floor(dailyHours);
      const minutes = Math.round((dailyHours - wholeHours) * 60);
      setTodayUsage({ hours: wholeHours, minutes });
      
      // total usage
      const totalHours = await fetchTotalUsage(machineId);
      saveToCache(cacheKeyTotal, totalHours);
      
      // calculate hours and minutes
      const wholeTotalHours = Math.floor(totalHours);
      const totalMinutes = Math.round((totalHours - wholeTotalHours) * 60);
      setTotalThirtyDayUsage({ hours: wholeTotalHours, minutes: totalMinutes });
      
    } catch (error) {
      alert(`Error fetching usage statistics: ${error}`);
    } finally {
      setIsLoadingUsageStats(false);
    }
  };
  
  // fetch usage statistics when the machine or date changes
  useEffect(() => {
    if (viewMode === 'admin' && machineId) {
      fetchUsageStatistics();
    }
  }, [viewMode, machineId, selectedDate]);

  // fetch aggregate data for admin view on component mount
  useEffect(() => {
    if (viewMode === 'admin' && machineId) {
      fetchAggregateData();
      
      // set to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);
    }
  }, [viewMode, machineId]);

  // time bounds for chart
  const chartStartTime = new Date(selectedDate);
  chartStartTime.setHours(0, 0, 0, 0);
  const chartEndTime = new Date(selectedDate);
  chartEndTime.setHours(23, 59, 59, 999);

  const datasets = [];
  if (isLoading || (!isLoading && usageData.length === 0)) {

    // gray line
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
      backgroundColor: StateColor.OFFLINE,
      borderColor: StateColor.OFFLINE,
      fill: {
        target: 'origin',
        below: StateColor.OFFLINE
      },
      tension: 0,
      stepped: 'before' as const,
      pointRadius: 0
    });
  } else {
    const sortedData = [...usageData].sort((a, b) => a.time.getTime() - b.time.getTime());
    
    const combinedDataPoints = [];
    
    // add start of day point if needed
    if (sortedData.length > 0) {
      if (sortedData[0].time.getTime() > chartStartTime.getTime()) {
        combinedDataPoints.push({
          time: chartStartTime,
          state: StateInt.AVAILABLE,
          device_status: Status.UNKNOWN
        });
      }
      combinedDataPoints.push(...sortedData);
      
      // add end of day point if needed
      if (sortedData[sortedData.length - 1].time.getTime() < chartEndTime.getTime()) {
        const lastState = sortedData[sortedData.length - 1].state;
        const lastStatus = sortedData[sortedData.length - 1].device_status || Status.ONLINE;
        combinedDataPoints.push({
          time: chartEndTime,
          state: lastState,
          device_status: lastStatus
        });
      }
    }
    
    // process each point
    if (combinedDataPoints.length > 0) {
      let processedPoints: {time: Date, state: number, device_status: string}[] = [];
      
      for (let i = 0; i < combinedDataPoints.length; i++) {
        const currentPoint = combinedDataPoints[i];
        processedPoints.push({
          time: currentPoint.time,
          state: currentPoint.state,
          device_status: currentPoint.device_status || Status.UNKNOWN
        });
        
        // add transition points between state or status changes
        if (i < combinedDataPoints.length - 1) {
          const nextPoint = combinedDataPoints[i + 1];
          
          // add transition point
          if (currentPoint.state !== nextPoint.state || currentPoint.device_status !== nextPoint.device_status) {
            const transitionTime = new Date(nextPoint.time.getTime() - 1);
            processedPoints.push({
              time: transitionTime,
              state: currentPoint.state,
              device_status: currentPoint.device_status || Status.ONLINE
            });
          }
        }
      }
      
      let availableSegments: {start: Date, end: Date}[] = [];
      let inUseSegments: {start: Date, end: Date}[] = [];
      let offlineSegments: {start: Date, end: Date}[] = [];
      
      let currentSegmentStart = processedPoints[0].time;
      let currentState = processedPoints[0].state;
      let currentStatus = processedPoints[0].device_status;
      
      for (let i = 1; i < processedPoints.length; i++) {
        const point = processedPoints[i];
        
        // create new segment if state or status changes
        if (point.state !== currentState || point.device_status !== currentStatus) {
          // end the current segment at the previous point's time
          const segmentEnd = processedPoints[i-1].time;
          
          // determine which segment list to add to based on status and state
          if (currentStatus === Status.ONLINE) {
            if (currentState === StateInt.AVAILABLE) {
              availableSegments.push({ start: currentSegmentStart, end: segmentEnd });
            } else {
              inUseSegments.push({ start: currentSegmentStart, end: segmentEnd });
            }
          } else {
            offlineSegments.push({ start: currentSegmentStart, end: segmentEnd });
          }
          
          // start a new segment
          currentSegmentStart = point.time;
          currentState = point.state;
          currentStatus = point.device_status;
        }
      }
      
      // add the final segment
      const lastPoint = processedPoints[processedPoints.length - 1];
      if (lastPoint.device_status === Status.ONLINE) {
        if (lastPoint.state === StateInt.AVAILABLE) {
          availableSegments.push({ start: currentSegmentStart, end: lastPoint.time });
        } else {
          inUseSegments.push({ start: currentSegmentStart, end: lastPoint.time });
        }
      } else {
        offlineSegments.push({ start: currentSegmentStart, end: lastPoint.time });
      }
      
      // create dataset points from segments
      const availablePoints: {x: Date, y: number}[] = [];
      availableSegments.forEach(segment => {
        availablePoints.push({ x: segment.start, y: 1 });
        availablePoints.push({ x: segment.end, y: 1 });
        if (segment !== availableSegments[availableSegments.length - 1]) {
          availablePoints.push({ x: segment.end, y: null as any });
        }
      });
      
      const inUsePoints: {x: Date, y: number}[] = [];
      inUseSegments.forEach(segment => {
        inUsePoints.push({ x: segment.start, y: 1 });
        inUsePoints.push({ x: segment.end, y: 1 });
        if (segment !== inUseSegments[inUseSegments.length - 1]) {
          inUsePoints.push({ x: segment.end, y: null as any });
        }
      });
      
      const offlinePoints: {x: Date, y: number}[] = [];
      offlineSegments.forEach(segment => {
        offlinePoints.push({ x: segment.start, y: 1 });
        offlinePoints.push({ x: segment.end, y: 1 });
        if (segment !== offlineSegments[offlineSegments.length - 1]) {
          offlinePoints.push({ x: segment.end, y: null as any });
        }
      });
      
      // available line
      if (availablePoints.length > 0) {
        datasets.push({
          label: `${machineName} - Available`,
          data: availablePoints,
          backgroundColor: StateColor.AVAILABLE,
          borderColor: StateColor.AVAILABLE,
          fill: {
            target: 'origin',
            below: StateColor.AVAILABLE
          },
          tension: 0,
          stepped: 'before' as const,
          pointRadius: 0
        });
      }
      
      // in use line
      if (inUsePoints.length > 0) {
        datasets.push({
          label: `${machineName} - In Use`,
          data: inUsePoints,
          backgroundColor: StateColor.IN_USE,
          borderColor: StateColor.IN_USE,
          fill: {
            target: 'origin',
            below: StateColor.IN_USE
          },
          tension: 0,
          stepped: 'before' as const,
          pointRadius: 0
        });
      }
      
      // offline line
      if (offlinePoints.length > 0) {
        datasets.push({
          label: `${machineName} - Offline/Unknown`,
          data: offlinePoints,
          backgroundColor: StateColor.OFFLINE,
          borderColor: StateColor.OFFLINE,
          fill: {
            target: 'origin',
            below: StateColor.OFFLINE
          },
          tension: 0,
          stepped: 'before' as const,
          pointRadius: 0
        });
      }
    }
  }

  const chartData = {
    datasets: datasets
  };
  
  // tooltip time formatting with Central Time
  const modifiedLineChartOptions = getLineChartOptions(machineName, chartStartTime, chartEndTime);
  
  // Override only the tooltip title callback to ensure consistent timezone
  if (modifiedLineChartOptions.plugins && modifiedLineChartOptions.plugins.tooltip) {
    modifiedLineChartOptions.plugins.tooltip.callbacks = {
      title: (context: any) => {
        // Format time in Central timezone explicitly
        const date = new Date(context[0].parsed.x);
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: CENTRAL_TIMEZONE // Central Time
        });
      },
      label: (tooltipItem: any) => {
        // Preserve the existing label format
        return tooltipItem.dataset.label || '';
      }
    };
  }
  

  // scale the data for the charts
  const maxHourlyPercentage = aggregatedHourlyUsage.length > 0 
    ? Math.max(...aggregatedHourlyUsage.map(item => item.percentage)) 
    : 0;
  
  const maxDailyPercentage = aggregatedDailyUsage.length > 0 
    ? Math.max(...aggregatedDailyUsage.map(item => item.percentage)) 
    : 0;
    

  // pass max values to options
  const hourlyBarChartOptions = getBarChartOptions(machineName, maxHourlyPercentage);
  const dailyBarChartOptions = getBarChartOptions(machineName, maxDailyPercentage);
  
  // aggregated stats chart data
  const aggregatedHourlyChartData = getHourlyChartData(aggregatedHourlyUsage);
  const aggregatedDailyChartData = getDailyChartData(aggregatedDailyUsage);
  

  // check if a date is today
  const isCurrentlyToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  // user view
  if (viewMode === 'user') {
    return (
      <div className="space-y-8">
        <style>{buttonHoverStyles}</style>
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
          <button 
            className="date-button"
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            disabled={isLoading}
            style={buttonStyle}
          >
            Previous Day
          </button>
          <button
            className="date-button"
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              setSelectedDate(today);
            }}
            disabled={isLoading}
            style={isCurrentlyToday(selectedDate) ? todaySelectedStyle : buttonStyle}
          >
            Today
          </button>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            disabled={isLoading}
            style={{...buttonStyle, backgroundColor: '#6a6a6a'}}
          />
          <button 
            className="date-button"
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            disabled={isLoading || isToday(selectedDate)}
            style={buttonStyle}
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
    // admin view
    return (
      <div className="space-y-8">
        <style>{buttonHoverStyles}</style>
        <h3 style={{ textAlign: 'center', fontWeight: 'bold' }}>Aggregated Usage Patterns (Past 30 Days)</h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
          <button
            className="date-button"
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              setSelectedDate(today);
            }}
            disabled={isAggregateLoading}
            style={isCurrentlyToday(selectedDate) ? todaySelectedStyle : buttonStyle}
          >
            Today
          </button>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            disabled={isAggregateLoading}
            style={{...buttonStyle, backgroundColor: '#6a6a6a'}}
          />
        </div>
        
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
                <CustomBarChart barChartData={aggregatedHourlyChartData} barChartOptions={hourlyBarChartOptions} machineName={machineName} />
              </div>
            </div>
            <div>
              <h4 style={{ textAlign: 'center', margin: '10px 0' }}>Daily Usage Pattern</h4>
              <div className="h-64">
                <CustomBarChart barChartData={aggregatedDailyChartData} barChartOptions={dailyBarChartOptions} machineName={machineName} />
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
