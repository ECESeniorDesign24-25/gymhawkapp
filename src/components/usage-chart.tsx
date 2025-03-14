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
  TimeScale
} from "chart.js";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';
import { fetchMachineTimeseries } from "@/utils/db";

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

interface MachineUsageChartProps {
  machineId: string;
  machineName: string;
}

const getOffset = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return offset * 60000;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago'});
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
}

const get5amToday = () => {
  const today = new Date();
  today.setHours(5, 0, 0, 0);
  return today.toISOString();
}

const MachineUsageChart: React.FC<MachineUsageChartProps> = ({ machineId, machineName }) => {
  const [usageData, setUsageData] = useState<{ time: Date; state: number }[]>([]);

  // Fetch timeseries data for the machine
  useEffect(() => {
    const fetchData = async () => {

      // start at 5am today
      const startTime = get5amToday();
      
      const timeseries = await fetchMachineTimeseries(machineId, startTime);
      
      // convert timeseries to plottable format and convert to Central Time
      const formattedData = timeseries.map((point: { state: string; timestamp: string }) => {
        const utcDate = new Date(point.timestamp);
        const centralDate = new Date(utcDate.getTime() - getOffset(utcDate));
        
        return {
          time: centralDate,

          // state mapping
          state: point.state === "on" ? 0 : 1
        };
      });
      
      setUsageData(formattedData);
    };

    if (machineId) {
      fetchData();
    }
  }, [machineId]);

  // x axis boundaries
  const now = new Date();
  const centralNow = new Date(now.getTime());
  const minTime = new Date(centralNow);
  minTime.setHours(5, 0, 0, 0);
  const maxTime = new Date(centralNow);

  const chartData = {
    datasets: [
      {
        label: machineName + ': ' + formatDate(now) + ' ' + formatTime(now),
        data: usageData.map((point) => ({ x: point.time, y: point.state })),
        fill: {
          target: 'origin',
          above: 'rgba(0, 100, 0, 0.1)',  // green fill from bottom when available
          below: 'rgba(0, 0, 0, 0)'
        },
        segment: {
          borderColor: 'black',
        },
        tension: 0.1,
        stepped: true,
        pointRadius: 0,
      },
      {
        data: usageData.map((point) => ({ x: point.time, y: point.state })),
        fill: {
          target: {
            value: 1  // fill down from y=1
          },
          above: 'rgba(0, 0, 0, 0)',
          below: 'rgba(139, 0, 0, 0.1)'  // red fill from top when in use
        },
        borderWidth: 0,
        tension: 0.1,
        stepped: true,
        pointRadius: 0,
        showLine: false
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: { 
            minute: 'h:mm a', 
            hour: 'h:mm a'
          },
        },
        min: minTime.getTime(),
        max: maxTime.getTime(),
        title: {
          display: true,
          text: 'Time of Day (Central Time)',
        },
      },
      y: {
        type: 'linear' as const,
        min: -0.1,
        max: 1.1,
        ticks: {
          stepSize: 1,
          callback: function(this: any, tickValue: number | string) {
            if (Number(tickValue) === 0) return "In Use";
            if (Number(tickValue) === 1) return "Available";
            return "";
          }
        },
        title: {
          display: true,
          text: 'Usage',
        },
      },
    },
    plugins: {
      title: {
        display: true,
        text: machineName + ': ' + formatDate(now) + ' ' + formatTime(now),
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: function(context: any) {
          const value = context.tooltip.dataPoints[0].raw.y;
          return value === 1 ? 'rgba(0, 100, 0, 0.75)' : 'rgba(139, 0, 0, 0.75)';
        },
        titleColor: 'white',
        bodyColor: 'white', 
        padding: 10,
        callbacks: {
          title: function(tooltipItems: any[]) {
            if (tooltipItems.length > 0) {
              const date = new Date(tooltipItems[0].raw.x);
              return `${formatDate(date)} at ${formatTime(date)} CT`;
            }
            return '';
          },
          label: function(tooltipItem: any) {
            if (tooltipItem.datasetIndex === 0) {
              const value = tooltipItem.raw.y;
              return value === 1 ? 'Status: Available' : 'Status: In Use';
            }
            return '';
          }
        }
      },
      legend: {
        display: false
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
