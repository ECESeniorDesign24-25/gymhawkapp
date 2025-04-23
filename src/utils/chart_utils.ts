import { formatDate, formatTime } from "./time_utils"

const GREEN_FILL = 'rgba(0, 100, 0, 0.3)';
const BLACK_FILL = 'rgba(0, 0, 0, 0)';
const RED_FILL = 'rgba(139, 0, 0, 0.3)';

export const getDatasetStyle = (machineName: string, selectedDate: Date, usageData: any[], type: string) => {
    // if the data is on, fill the area below the line with green
    // if the data is off, fill the area above the line with red
    if (type === 'on') {
        return {
            label: machineName,
            data: usageData.map((point) => ({ x: point.time, y: point.state })),
            fill: {
                target: 'origin',
                above: GREEN_FILL,
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
                below: RED_FILL
            },
            borderWidth: 0,
            tension: 0.1,
            stepped: true,
            pointRadius: 0,
            showLine: false
        }
    }
}

export const getBarChartOptions = (machineName: string, hourly: boolean) => {
    // basic chart style for machine 
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
                display: true,
                text: hourly ? 'Hour of the Day' : 'Day of the Week',
            },
          },
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
              stepSize: 15
            },
            min: chartStartTime.getTime(),
            max: chartEndTime.getTime(),
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
            display: true,
            text: machineName,
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
}
