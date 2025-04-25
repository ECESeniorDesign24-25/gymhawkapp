import { STATUS_UNKNOWN, STATUS_ONLINE   } from "./consts";
import { STATUS_OFFLINE } from "./consts";
import { formatDate, formatTime } from "./time_utils"
import { StateInt, StateString, StateColor } from "@/enums/state"
import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { enUS } from 'date-fns/locale';

// Set default timezone for Chart.js
Chart.defaults.locale = 'en-US';

const BLACK_FILL = 'rgba(0, 0, 0, 0)';
const LIGHT_GRAY_FILL = 'rgba(200, 200, 200, 0.75)';


export const getDatasetStyle = (machineName: string, selectedDate: Date, usageData: any[], type: string) => {
    // if the data is on, fill the area below the line with green
    // if the data is off, fill the area above the line with red
    if (type === StateString.IN_USE) {
        return {
            label: machineName,
            data: usageData.map((point) => ({ x: point.time, y: point.state })),
            fill: {
                target: 'origin',
                above: StateColor.AVAILABLE,
                below: BLACK_FILL
            },
            borderColor: 'black',
            tension: 0.1,
            stepped: true,
            pointRadius: 0
        }
    } else {
        return {
            data: usageData.map((point) => ({ x: point.time, y: point.state })),
            fill: {
                target: {
                    value: 1
                },
                above: BLACK_FILL,
                below: StateColor.IN_USE
            },
            borderWidth: 0,
            tension: 0.1,
            stepped: true,
            pointRadius: 0,
            showLine: false
        }
    }
}

export const getBarChartOptions = (machineName: string, maxPercentage?: number) => {
    const yAxisMax = maxPercentage ? Math.min(Math.ceil(maxPercentage * 2), 100) : 100;
    
    // basic chart style for machine 
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: yAxisMax,
            title: {
              display: true,
              text: 'Usage Percentage (%)'
            }
          }
        },
        plugins: {
          title: {
            display: false,
            text: machineName
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                return `${context.parsed.y.toFixed(1)}%`;
              }
            }
          }
        }
    };
}


export const getHourlyChartData = (hourlyUsage: any[]) => {
    // get the hourly usage data for the bar chart
    return {
        labels: hourlyUsage.map(data => {
            const hour = data.hour;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:00 ${ampm}`;
        }),
        datasets: [
            {
                label: 'Usage Percentage by Hour',
                data: hourlyUsage.map(data => data.percentage),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }
        ]
    };
}

export const getDailyChartData = (dailyUsage: any[]) => {
    // get the daily usage data for the bar chart
    return {
        labels: dailyUsage.map(data => data.day),
        datasets: [
            {
                label: 'Usage Percentage by Day',
                data: dailyUsage.map(data => data.percentage),
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
                time: {
                    displayFormats: { 
                      minute: 'h:mm a', 
                      hour: 'h:mm a',
                      second: 'h:mm:ss a'
                    },
                    unit: 'minute' as const,
                    stepSize: 15
                  },
            }
        ]
    };    
}

export const getLineChartOptions = (machineName: string, chartStartTime: Date, chartEndTime: Date) => {
    // basic line chart style
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      },
      scales: {
        x: {
          type: 'time' as const,
          time: {
            displayFormats: {
              minute: 'h:mm a', 
              hour: 'h:mm a',
              second: 'h:mm:ss a'
            },
            unit: 'minute' as const,
            stepSize: 15,
            // Add timezone for Central Time
            timezone: 'America/Chicago' 
          },
          min: chartStartTime.getTime(),
          max: chartEndTime.getTime(),
          title: {
            display: false,
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
              if (Number(tickValue) === StateInt.IN_USE) return "In Use";
              if (Number(tickValue) === StateInt.AVAILABLE) return "Available";
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
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x' as const,
          },
          pan: {
            enabled: true,
            mode: 'x' as const,
          }
        },
        title: {
          display: false,
          text: machineName,
        },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
          intersect: false,
          backgroundColor: function(context: any) {
            // Get the raw data point if available
            const dataPoint = context.tooltip.dataPoints[0].raw;
            
            if (dataPoint && dataPoint.device_status) {
              if (dataPoint.device_status === STATUS_OFFLINE || dataPoint.device_status === STATUS_UNKNOWN) {
                return StateColor.OFFLINE;
              }
              if (dataPoint.device_status === 'NO_DATA') {
                return LIGHT_GRAY_FILL; 
              }
            }
            
            // Use original coloring based on state if the device is online
            const value = context.tooltip.dataPoints[0].raw.y;
            return value === StateInt.AVAILABLE ? StateColor.AVAILABLE : StateColor.IN_USE;
          },
          titleColor: 'white',
          bodyColor: 'white', 
          padding: 10,
          callbacks: {
            title: function(tooltipItems: any[]) {
              if (tooltipItems.length > 0) {
                // Format using Central Time zone
                const date = new Date(tooltipItems[0].raw.x);
                return date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'America/Chicago' // Central Time
                });
              }
              return '';
            },
            label: function(tooltipItem: any) {
              if (tooltipItem.datasetIndex === 0 || tooltipItem.datasetIndex === 1) {
                const dataPoint = tooltipItem.raw;
                
                // Get device status if available in the raw data
                let deviceStatus = STATUS_ONLINE;
                if (dataPoint && dataPoint.device_status) {
                  deviceStatus = dataPoint.device_status;
                }
                
                // For NO_DATA status, show a specific message
                if (deviceStatus === 'NO_DATA') {
                  return 'No data available for this time';
                }
                
                const value = tooltipItem.raw.y;
                let stateText = value === 1 ? 'Available' : 'In Use';
                
                // If device is offline or unknown, override state display
                if (deviceStatus === STATUS_OFFLINE || deviceStatus === STATUS_UNKNOWN) {
                  stateText = deviceStatus;
                  return `Status: ${stateText}`;
                } else {
                  return `Status: ${deviceStatus}, State: ${stateText}`;
                }
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
}
