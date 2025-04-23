import React, { useState, useEffect, FC } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Define interfaces for our data points
interface UsageDataPoint {
    time: Date;
    state: number;
}

interface DailyUsage {
    date: string;
    percentage: number;
}

// Register necessary components for a Bar chart
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AdminUsageChart: FC = () => {
    // Raw machine usage data: an array of UsageDataPoint
    const [usageData, setUsageData] = useState<UsageDataPoint[]>([]);
    // Aggregated daily usage: an array of DailyUsage
    const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);

    // Simulate fetching/generating usage data over multiple days
    useEffect(() => {
        const simulatedData: UsageDataPoint[] = [];
        const daysToSimulate = 3; // For example, simulate data for 3 days

        for (let day = 0; day < daysToSimulate; day++) {
            // Set a base date: today minus 'day' days
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() - day);
            baseDate.setHours(6, 0, 0, 0); // Gym open at 6 AM

            let currentTime = new Date(baseDate);
            // Start with machine off
            simulatedData.push({ time: new Date(currentTime), state: 0 });

            // Simulate until, say, 10 PM
            while (currentTime.getHours() < 22) {
                // Random duration between 15 and 60 minutes
                const durationMinutes = Math.floor(Math.random() * (60 - 15 + 1)) + 15;
                currentTime = new Date(currentTime.getTime() + durationMinutes * 60000);
                // Toggle state: if off then on, if on then off
                const lastState = simulatedData[simulatedData.length - 1].state;
                simulatedData.push({ time: new Date(currentTime), state: lastState === 0 ? 1 : 0 });
            }
        }
        setUsageData(simulatedData);
    }, []);

    // Aggregate usageData to compute daily usage percentage
    useEffect(() => {
        const grouped: { [date: string]: { total: number; on: number } } = {};
        usageData.forEach((point: UsageDataPoint) => {
            // Group by date string (e.g., "2025-03-01")
            const dateStr = point.time.toISOString().split("T")[0];
            if (!grouped[dateStr]) {
                grouped[dateStr] = { total: 0, on: 0 };
            }
            grouped[dateStr].total += 1;
            if (point.state === 1) {
                grouped[dateStr].on += 1;
            }
        });

        // Compute percentage for each day
        const aggregated: DailyUsage[] = Object.keys(grouped).map((date) => ({
            date,
            percentage: (grouped[date].on / grouped[date].total) * 100,
        }));

        // Sort by date so the x-axis is in order
        aggregated.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setDailyUsage(aggregated);
    }, [usageData]);

    // Prepare the chart data for the Bar chart
    const chartData = {
        labels: dailyUsage.map((d) => d.date),
        datasets: [
            {
                label: "Usage Percentage",
                data: dailyUsage.map((d) => d.percentage),
                backgroundColor: "rgb(255,205,0)",
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: "Daily Machine Usage Percentage",
            },
            legend: {
                position: "top" as const,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: "Usage (%)",
                },
            },
            x: {
                title: {
                    display: true,
                    text: "Date",
                },
            },
        },
    };

    return (
        <div
            style={{
                width: "100%",
                maxWidth: "800px",
                height: "400px",
                margin: "0 auto",
            }}
        >
            <Bar data={chartData} options={options} />
        </div>
    );
};

export default AdminUsageChart;
