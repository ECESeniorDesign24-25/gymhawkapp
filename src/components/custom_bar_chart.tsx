import e from "cors";
import { Bar } from "react-chartjs-2";

export const CustomBarChart = ({ barChartData, barChartOptions, machineName }: { barChartData: any, barChartOptions: any, machineName: string }) => {
    // custom bar chart component that is be used to display the hourly and daily usage patterns
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