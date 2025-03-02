import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

const MachineUsageChart = () => {
  // Store data points with a Date for x and a number (0 or 1) for y.
  const [usageData, setUsageData] = useState<{ time: Date; state: number }[]>([]);

  // Simulated fetch for machine state (0 for off, 1 for on)
  const fetchMachineState = async () => {
    return Math.random() < 0.5 ? 0 : 1;
  };

  // Update the chart data periodically (every minute)
  // useEffect(() => {
  //   const updateChart = async () => {
  //     const now = new Date();
  //     const state = await fetchMachineState();
  //     setUsageData((prevData) => [...prevData, { time: now, state }]);
  //   };

  //   // Get an initial data point
  //   updateChart();
  //   const intervalId = setInterval(updateChart, 60000);
  //   return () => clearInterval(intervalId);
  // }, []);
   // Create artificial data points for debugging
   useEffect(() => {
    const now = new Date();
    // Start at 6 AM
    let currentTime = new Date(now.setHours(6, 0, 0, 0));
    const debugData = [];
    
    // Start with machine off
    debugData.push({ time: currentTime, state: 0 });
    
    // Generate random on/off cycles throughout the day
    while (currentTime.getHours() < 16) { // Until 4 PM
      // Random duration between 30 mins to 2.5 hours for each state
      const durationMinutes = Math.floor(Math.random() * (150 - 30 + 1) + 30);
      currentTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
      
      // Add type annotation for prevState
      const prevState: number = debugData[debugData.length - 1].state;
      debugData.push({ time: currentTime, state: prevState === 0 ? 1 : 0 });
    }

    setUsageData(debugData);
  }, []);

  // Calculate dynamic x-axis boundaries
  const now = new Date();
  const minTime = new Date(new Date().setHours(5, 0, 0, 0)); // Today at 5:00 AM
  const maxTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

  // Prepare the chart data using data points with x and y properties
  const chartData = {
    datasets: [
      {
        label: 'Machine Usage',
        data: usageData.map((point) => ({ x: point.time, y: point.state })),
        fill: false,
        borderColor: 'rgb(0, 0, 0)',
        tension: 0.1,
        stepped: true,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time' as const,
        time: {
          // Adjust format here
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
        },
        min: minTime.getTime(),
        max: maxTime.getTime(),
        title: {
          display: true,
          text: 'Time of Day',
        },
      },
      y: {
        type: 'linear' as const,
        min: -0.1,
        max: 1.1,
        ticks: {
          stepSize: 1,
          callback: function(this: any, tickValue: number | string) {
            // Only show labels for 0 and 1
            if (Number(tickValue) === 0) return "Off";
            if (Number(tickValue) === 1) return "On";
            return ""; // Return empty string for boundary values (-0.1 and 1.1)
          }
        },
        title: {
          display: true,
          text: 'Usage (On/Off)',
        },
      },
    },
    plugins: {
      title: {
        display: true,
        text: 'Machine Usage Over the Day',
      },
      legend: {
        position: 'top' as const,
      },
    },
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1000px",
        height: "400px",
        margin: "0 auto",
      }}
    >
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MachineUsageChart;
