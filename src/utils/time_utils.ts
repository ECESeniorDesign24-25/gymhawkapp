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