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
    return targetDate.toISOString();
}

export const convertTimeseriesToDate = (point: { timestamp: string }) => {
    // convert a timeseries point to a date object
    const date = new Date(point.timestamp);
    date.setTime(date.getTime() + date.getTimezoneOffset() * 60000);
    return date;
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