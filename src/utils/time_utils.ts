import { CDT_TIMEZONE_OFFSET } from "./consts";

export const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago'});
  }
  
export const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
  }


export const getCurrentTime = () => {
  const currentTime = new Date();
  const currentTimeStr = currentTime.toISOString().split('T')[1].substring(0, 8);
  return currentTimeStr;
}

export const get12amOnDate = (date: Date): string => {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  const year = midnight.getFullYear();
  const month = (midnight.getMonth() + 1).toString().padStart(2, '0');
  const day = midnight.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00${CDT_TIMEZONE_OFFSET}`;
};

export function convertTimeseriesToDate(point: any): Date {
  // Extract timestamp from various possible formats
  const timestamp = point.timestamp || point.time || point.date || '';
  
  if (!timestamp) { 
    return new Date();
  }
  
  try {
    // get ISO without timezone
    const isoWithoutTZ = timestamp.replace(/Z|(\+|-)\d{2}:?\d{2}$/, '');
    const centralTimeString = `${isoWithoutTZ}${CDT_TIMEZONE_OFFSET}`;
    const centralDate = new Date(centralTimeString);
        
    return centralDate;
  } catch (error) {
    console.error(`[TIME] Error converting timestamp: ${timestamp}`, error);
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