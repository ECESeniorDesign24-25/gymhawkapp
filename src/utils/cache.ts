import { CACHE_DURATION } from "./consts";

// get data from cache
export const getFromCache = (key: string) => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cacheItem = localStorage.getItem(key);
      if (!cacheItem) return null;
      
      const { timestamp, data } = JSON.parse(cacheItem);
      
      if (Date.now() - timestamp > CACHE_DURATION) {
        return null;
      }
      
      return data;
    } catch (error) {
      alert(`Error retrieving ${key} from cache: ${error}`);
      return null;
    }
};

// save data to cache
export const saveToCache = (key: string, data: any) => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheItem = {
        timestamp: Date.now(),
        data
      };
      
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      console.error(`Error saving ${key} to cache:`, error);
    }
  };