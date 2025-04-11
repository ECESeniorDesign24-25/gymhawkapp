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
import { getDatasetStyle, getBarChartOptions, getDailyChartData, getHourlyChartData, getLineChartOptions } from "../utils/chart_utils";
import { CustomBarChart } from "./custom_bar_chart";

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

// chart properties
interface MachineUsageChartProps {
  machineId: string;
  machineName: string;
}

//===================================================================================
// builds the usage chart
const MachineUsageChart: React.FC<MachineUsageChartProps> = ({ machineId, machineName }) => {
  const [usageData, setUsageData] = useState<{ time: Date; state: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [hourlyUsage, setHourlyUsage] = useState<{ hour: number; percentage: number }[]>([]);
  const [dailyUsage, setDailyUsage] = useState<{ day: string; percentage: number }[]>([]);

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
      setUsageData([]);
      
      const startTime = get12amOnDate(selectedDate);

      // TODO: remove dev mode
      const timeseries = await fetchMachineTimeseries(machineId, startTime, isDevMode, "state");
      if (timeseries.length === 0) {
        return;   
      }

      const formattedData = timeseries.map((point: { state: string; timestamp: string }) => {
        const date = convertTimeseriesToDate(point);
        return {
          time: date,
          state: point.state === "on" ? 0 : 1 // convert state to binary for plot purposes
        };
      });
      
      setUsageData(formattedData);
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
  }, [machineId, selectedDate, isDevMode]);

  // graph shows most recent 2 hours of data 
  let chartStartTime: Date;
  let chartEndTime: Date;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  
  // case where we have data
  if (usageData.length > 0) {
    chartEndTime = new Date(usageData[usageData.length - 1].time);
    chartStartTime = new Date(chartEndTime.getTime() - TWO_HOURS);
  } else {
    // case where we don't have data yet so just start at midnight and end at 11:59:59 PM
    chartStartTime = new Date(selectedDate);
    chartStartTime.setHours(0, 0, 0, 0);
    chartEndTime = new Date(selectedDate);
    chartEndTime.setHours(23, 59, 59, 999);
  }

  // set up data for chart
  const chartData = {

    // datasets is an array of the types of things we are plotting. so first one is the "on" state plot = green filled, 
    // second one is the "off" state plot = red filled
    datasets: [
      getDatasetStyle(machineName, selectedDate, usageData, "on"),
      getDatasetStyle(machineName, selectedDate, usageData, "off")
    ],
  };

  // format the data for the charts
  const lineChartOptions = getLineChartOptions(machineName, chartStartTime, chartEndTime);
  const hourlyChartData = getHourlyChartData(hourlyUsage);
  const dailyChartData = getDailyChartData(dailyUsage);
  const barChartOptions = getBarChartOptions(machineName);

  return (
    <div className="space-y-8">
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() - 1);
            setSelectedDate(newDate);
          }}
        >
          Previous Day
        </button>
        <button
          onClick={() => setSelectedDate(new Date())}
        >
          Today
        </button>
        <input
          type="date"
          value={selectedDate.toISOString().split('T')[0]}
          onChange={(e) => setSelectedDate(new Date(e.target.value))}
        />
        <button 
          onClick={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            setSelectedDate(newDate);
          }}
        >
          Next Day
        </button>
        <button
          onClick={() => setIsDevMode(!isDevMode)}
          style={{ 
            backgroundColor: isDevMode ? '#ff4444' : '#44ff44',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {isDevMode ? 'Dev Mode: ON' : 'Dev Mode: OFF'}
        </button>
      </div>
      <div className="h-64">
        <Line data={chartData} options={lineChartOptions} />
      </div>
      <div className="h-64">
        <CustomBarChart barChartData={hourlyChartData} barChartOptions={barChartOptions} machineName={machineName} />
      </div>
      <div className="h-64">
        <CustomBarChart barChartData={dailyChartData} barChartOptions={barChartOptions} machineName={machineName} />
      </div>
    </div>
  );
};

// note this needs ssr to be false so we render client side so the charts work
export default dynamic(() => Promise.resolve(MachineUsageChart), { ssr: false });
