import e from "cors";
import { Bar } from "react-chartjs-2";

export const CustomBarChart = ({ barChartData, barChartOptions, machineName }: { barChartData: any, barChartOptions: any, machineName: string }) => {
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