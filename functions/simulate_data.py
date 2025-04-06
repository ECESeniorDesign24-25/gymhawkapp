from dotenv import load_dotenv
import os

# Load environment variables at the start
load_dotenv(".env.gymhawk-2ed7f")

from datetime import datetime, timezone, time, timedelta
import random
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
import numpy as np
from utils import *
from consts import *

def plot_data(dfs, thing_ids):
    fig, axes = plt.subplots(3, 1, figsize=(15, 15))
    fig.suptitle('Simulated Gym Equipment States (Jan-Mar 2025)', fontsize=16)
    
    colors = ['#1f77b4', '#ff7f0e'] 
    
    # 1. Plot the raw state data for one week to see the daily pattern
    ax1 = axes[0]
    
    # Choose a representative week (e.g., second week of January)
    start_week = datetime(2025, 1, 8, tzinfo=timezone.utc)
    end_week = datetime(2025, 1, 15, tzinfo=timezone.utc)
    
    for i, thing_id in enumerate(thing_ids):
        df_week = dfs[thing_id][(dfs[thing_id]['timestamp'] >= start_week) & 
                                (dfs[thing_id]['timestamp'] <= end_week)]
        
        # Plot the data with small markers and a thin line
        ax1.plot(df_week['timestamp'], df_week['state_numeric'], 
                marker='.', markersize=3, linestyle='-', linewidth=0.5,
                color=colors[i], label=f'Device {i+1}')
    
    ax1.set_ylabel('State (1=on, 0=off)')
    ax1.set_title('One Week of Raw State Data')
    ax1.legend()
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H:%M'))
    ax1.xaxis.set_major_locator(mdates.DayLocator())
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45)
    
    # 2. Plot hourly usage patterns (percentage of 'on' states by hour)
    ax2 = axes[1]
    
    for i, thing_id in enumerate(thing_ids):
        df = dfs[thing_id].copy()
        df['hour'] = df['timestamp'].apply(lambda x: x.hour)
        
        # Calculate percentage of 'on' states for each hour
        hourly_usage = df.groupby('hour')['state_numeric'].mean() * 100
        
        ax2.plot(hourly_usage.index, hourly_usage.values, 
                marker='o', markersize=8, linestyle='-', linewidth=2,
                color=colors[i], label=f'Device {i+1}')
    
    ax2.set_xlabel('Hour of Day')
    ax2.set_ylabel('% Time in ON state')
    ax2.set_title('Hourly Usage Pattern')
    ax2.set_xticks(range(5, 20))
    ax2.set_xlim(5, 19)
    ax2.set_ylim(0, 100)
    ax2.grid(True, linestyle='--', alpha=0.7)
    ax2.legend()
    
    # 3. Plot daily usage patterns (percentage of 'on' states by day of week)
    ax3 = axes[2]
    
    for i, thing_id in enumerate(thing_ids):
        df = dfs[thing_id].copy()
        df['day_of_week'] = df['timestamp'].apply(lambda x: x.strftime('%A'))  # Full day name
        
        # Calculate percentage of 'on' states for each day
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        daily_usage = df.groupby('day_of_week')['state_numeric'].mean() * 100
        daily_usage = daily_usage.reindex(day_order)  # Ensure days are in order
        
        ax3.bar(np.arange(len(day_order)) + (i * 0.4 - 0.2), daily_usage.values, 
                width=0.4, color=colors[i], alpha=0.7, label=f'Device {i+1}')
    
    ax3.set_xlabel('Day of Week')
    ax3.set_ylabel('% Time in ON state')
    ax3.set_title('Day of Week Usage Pattern')
    ax3.set_xticks(range(7))
    ax3.set_xticklabels(day_order)
    ax3.set_ylim(0, 100)
    ax3.grid(True, axis='y', linestyle='--', alpha=0.7)
    ax3.legend()
    
    plt.tight_layout()
    plt.subplots_adjust(top=0.95)
    
    # Save the figure
    plt.savefig('simulated_gym_equipment_data.png', dpi=300, bbox_inches='tight')
    print("Plot saved as 'simulated_gym_equipment_data.png'")
    
    # Show the figure
    plt.show()

def determine_state(hour, variance=0.3):
    peak_hour = 14 # 2pm
    hour_percentage = 1 - abs(hour - peak_hour) / 14.0
    
    # noise
    random_factor = random.gauss(-1, 1) * variance
    probability = hour_percentage + random_factor
    
    return "on" if probability > 0.5 else "off"

def simulate_data():
    try:
        print("Initializing database connection...")
        init_db_connection()
        
        thing_ids = [
            "6ad4d9f7-8444-4595-bf0b-5fb62c36430c",
            "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
        ]
        
        # feb 1 to march 1
        start_date = datetime(2025, 2, 1, 5, 0, 0, tzinfo=timezone.utc)
        end_date = datetime(2025, 3, 1, 5, 0, 0, tzinfo=timezone.utc)
        current_date = start_date
        
        open_time = time(5, 0)
        close_time = time(19, 0)
        
        print(f"Generating data from {start_date} to {end_date}")
        total_records = 0
        
        data = {thing_id: {'timestamp': [], 'state': [], 'state_numeric': []} for thing_id in thing_ids}

        while current_date < end_date:
            if is_time_between(open_time, close_time, current_date):
                for thing_id in thing_ids:
                    hour = current_date.hour
                    state = determine_state(hour)
                    timestamp = current_date.isoformat()
                    
                    data[thing_id]['timestamp'].append(current_date)
                    data[thing_id]['state'].append(state)
                    data[thing_id]['state_numeric'].append(1 if state == "on" else 0)

                    write_state_to_db(
                        thing_id=thing_id,
                        state=state,
                        timestamp=timestamp,
                        n_on=50,
                        n_off=10,
                        current=400,
                        table_name="machine_states_dummy"
                    )
                    
                    total_records += 1
                    if total_records % 1000 == 0:
                        print(f"Generated {total_records} records. Current date: {current_date}")
            
            current_date += timedelta(minutes=2)
        

        dfs = {}
        for thing_id in thing_ids:
            dfs[thing_id] = pd.DataFrame({
                'timestamp': data[thing_id]['timestamp'],
                'state': data[thing_id]['state'],
                'state_numeric': data[thing_id]['state_numeric']
            })
            
        print(f"Generated {len(dfs[thing_ids[0]])} records per device.")
        
        # Plot the data
        plot_data(dfs, thing_ids)
        print(f"Complete! Generated {total_records} records.")
        
    except Exception as e:
        print(f"Error generating fake data: {str(e)}")
        raise


if __name__ == "__main__":
    # Execute the data generation function
    simulate_data()