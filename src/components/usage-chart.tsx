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
import { Line, Bar } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';
import { fetchMachineTimeseries } from "@/utils/db";

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
  TimeScale
);

const API_ENDPOINT = 'https://gymhawk-2ed7f.web.app/api';

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

const get5amOnDate = (date: Date) => {
  const targetDate = new Date(date);
  targetDate.setHours(5, 0, 0, 0);
  return targetDate.toISOString();
}

const MachineUsageChart: React.FC<MachineUsageChartProps> = ({ machineId, machineName }) => {
  const [usageData, setUsageData] = useState<{ time: Date; state: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [hourlyUsage, setHourlyUsage] = useState<{ hour: number; percentage: number }[]>([]);
  const [dailyUsage, setDailyUsage] = useState<{ day: string; percentage: number }[]>([]);

  // Calculate hourly and daily usage patterns
  useEffect(() => {
    if (usageData.length === 0) return;

    // Calculate hourly usage
    const hourlyData: { [key: number]: { total: number; on: number } } = {};
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

    const hourlyUsageData = Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      percentage: (data.on / data.total) * 100
    })).sort((a, b) => a.hour - b.hour);

    setHourlyUsage(hourlyUsageData);

    // Calculate daily usage
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
    const dailyUsageData = dayOrder.map(day => ({
      day,
      percentage: dailyData[day] ? (dailyData[day].on / dailyData[day].total) * 100 : 0
    }));

    setDailyUsage(dailyUsageData);
  }, [usageData]);

  // Fetch timeseries data for the machine
  useEffect(() => {
    const fetchData = async () => {
      // start at 5am on selected date
      const startTime = get5amOnDate(selectedDate);
      
      // Use appropriate endpoint based on dev mode
      const timeseries = await fetchMachineTimeseries(machineId, startTime, isDevMode, "state");
      
      // convert timeseries to plottable format and convert to Central Time
      const formattedData = timeseries.map((point: { [key: string]: string; timestamp: string }) => {
        const utcDate = new Date(point.timestamp);
        const centralDate = new Date(utcDate.getTime() - getOffset(utcDate));
        
        // Get the state value from the response
        const stateValue = point.state;
        
        return {
          time: centralDate,
          state: stateValue === "on" ? 0 : 1
        };
      });
      
      setUsageData(formattedData);
    };

    if (machineId) {
      fetchData();
    }
  }, [machineId, selectedDate, isDevMode]);

  // x axis boundaries (5am to 7pm)
  const minTime = new Date(selectedDate);
  minTime.setHours(5, 0, 0, 0);
  const maxTime = new Date(selectedDate);
  maxTime.setHours(19, 0, 0, 0); // 7pm

  const chartData = {
    datasets: [
      {
        label: machineName + ': ' + formatDate(selectedDate),
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
        text: machineName + ': ' + formatDate(selectedDate),
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

  const hourlyChartData = {
    labels: hourlyUsage.map(data => `${data.hour}:00`),
    datasets: [
      {
        label: 'Usage Percentage by Hour',
        data: hourlyUsage.map(data => data.percentage),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      }
    ]
  };

  const dailyChartData = {
    labels: dailyUsage.map(data => data.day),
    datasets: [
      {
        label: 'Usage Percentage by Day',
        data: dailyUsage.map(data => data.percentage),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Usage Percentage (%)'
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: machineName
      }
    }
  };

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
        <Line data={chartData} options={options} />
      </div>
      <div className="h-64">
        <Bar data={hourlyChartData} options={{
          ...chartOptions,
          scales: {
            ...chartOptions.scales,
            x: {
              title: {
                display: true,
                text: 'Hour of Day'
              }
            }
          },
          plugins: {
            ...chartOptions.plugins,
            title: {
              ...chartOptions.plugins.title,
              text: `${machineName} - Hourly Usage Pattern`
            }
          }
        }} />
      </div>
      <div className="h-64">
        <Bar data={dailyChartData} options={{
          ...chartOptions,
          scales: {
            ...chartOptions.scales,
            x: {
              title: {
                display: true,
                text: 'Day of Week'
              }
            }
          },
          plugins: {
            ...chartOptions.plugins,
            title: {
              ...chartOptions.plugins.title,
              text: `${machineName} - Daily Usage Pattern`
            }
          }
        }} />
      </div>
    </div>
  );
};

export default MachineUsageChart;
