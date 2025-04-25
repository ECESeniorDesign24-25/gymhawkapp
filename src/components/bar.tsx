import e from "cors";
import { Bar } from "react-chartjs-2";
import { Spinner } from "./spinner";

interface CustomBarChartProps {
    barChartData: any;
    barChartOptions: any;
    machineName: string;
    isLoading?: boolean;
}

export const CustomBarChart = ({ 
    barChartData, 
    barChartOptions, 
    machineName, 
    isLoading = false 
}: CustomBarChartProps) => {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner text="Loading chart data..." />
            </div>
        );
    }
    
    return (
        <Bar data={barChartData} options={{
          ...barChartOptions,
          scales: {
            ...barChartOptions.scales,
            x: {
              title: {
                display: true,
                text: 'Hour of Day'
              }
            }
          },
          plugins: {
            ...barChartOptions.plugins,
            title: {
              ...barChartOptions.plugins.title,
              text: `${machineName} - Hourly Usage Pattern`
            }
          }
        }} />
    );
}