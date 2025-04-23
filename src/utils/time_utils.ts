export const formatDate = (date: Date) => {
    // format a date to central time
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago'});
  }
  
export const formatTime = (date: Date) => {
    // formats a date to central time 
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
  }

export const get12amOnDate = (date: Date) => {
    // get 12am on a given date (start of day) to use for fetching filtered timeseries data
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    // Format to ISO 8601 format that the API expects - "YYYY-MM-DDT00:00:00Z"
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    
    // Return formatted date with time component as specified in the README
    const dateStr = `${year}-${month}-${day}T00:00:00Z`;
    
    console.log('🕛 Date formatting for timeseries request:', {
        inputDate: date.toString(),
        targetDate: targetDate.toString(),
        formattedDate: dateStr,
        year, month, day
    });
    
    return dateStr;
}

export const convertTimeseriesToDate = (point: any) => {
    // Handle different timestamp formats
    let timestamp = null;
    
    if (typeof point === 'object') {
        // Try known field names that might contain the timestamp
        timestamp = point.timestamp || point.time || point.date;
    } else if (typeof point === 'string') {
        // If the point itself is a string, assume it's the timestamp
        timestamp = point;
    }
    
    if (!timestamp) {
        console.warn('Unable to extract timestamp from point:', point);
        return new Date(); // Return current time as fallback
    }
    
    try {
        // Try to parse the timestamp
        const date = new Date(timestamp);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date parsed from timestamp:', timestamp);
            return new Date();
        }
        
        return date;
    } catch (error) {
        console.error('Error parsing timestamp:', error, timestamp);
        return new Date();
    }
}

export const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};


export const formatLastUsedTime = (timestamp: string | null | undefined): string => {
  if (!timestamp || timestamp === "Never") {
    return "Never";
  }
  
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return timestamp; 
    }
    
    // conver to am/pm format
    const datePart = date.toISOString().split('T')[0];
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    return `${datePart} ${hours}:${minutes}${ampm}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return timestamp; 
  }
};