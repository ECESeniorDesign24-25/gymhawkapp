export const formatDate = (date: Date) => {
    // format a date to central time
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago'});
  }
  
export const formatTime = (date: Date) => {
    // formats a date to central time 
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' });
  }

// Constant for CDT timezone offset
export const CDT_TIMEZONE_OFFSET = '-05:00';
export const CENTRAL_TIMEZONE = 'America/Chicago';

/**
 * Gets the ISO string for midnight on the given date in Central Daylight Time
 */
export const get12amOnDate = (date: Date): string => {
  // Create a new date at midnight on the provided date
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  
  // Format the date manually to ensure it's in Central Daylight Time (-05:00)
  const year = midnight.getFullYear();
  const month = (midnight.getMonth() + 1).toString().padStart(2, '0');
  const day = midnight.getDate().toString().padStart(2, '0');
  
  // Return ISO string format with Central Daylight Time zone
  // This ensures 12am is correctly interpreted as Central Time
  return `${year}-${month}-${day}T00:00:00${CDT_TIMEZONE_OFFSET}`;
};

export function convertTimeseriesToDate(point: any): Date {
  // Extract timestamp from various possible formats
  const timestamp = point.timestamp || point.time || point.date || '';
  
  if (!timestamp) {
    return new Date(); // Return current time if no timestamp found
  }
  
  try {
    // Get the ISO string but without the timezone (remove Z and timezone offset if present)
    const isoWithoutTZ = timestamp.replace(/Z|(\+|-)\d{2}:?\d{2}$/, '');
    
    // Force interpretation as Central Daylight Time by appending the timezone
    const centralTimeString = `${isoWithoutTZ}${CDT_TIMEZONE_OFFSET}`; // -05:00 is Central Daylight Time
    
    // Use this string to create a date that's properly anchored to Central Time
    const centralDate = new Date(centralTimeString);
    
    console.log(`[TIME] Converting timestamp: ${timestamp} → Central time: ${centralDate.toLocaleString('en-US', {timeZone: CENTRAL_TIMEZONE})}`);
    
    return centralDate;
  } catch (error) {
    console.error(`[TIME] Error converting timestamp: ${timestamp}`, error);
    return new Date(); // Return current time if conversion fails
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