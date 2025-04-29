import { CACHE_DURATION, CACHE_PREFIX } from "./consts";
import { CacheItem } from "../interfaces/cacheItem";

// get data from cache
export function getFromCache<T>(key: string, duration: number = CACHE_DURATION): T | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const cachedItem = localStorage.getItem(CACHE_PREFIX + key);
      if (!cachedItem) return null;
      
      const { data, timestamp }: CacheItem<T> = JSON.parse(cachedItem);
      
      // check if cache expred
      if (Date.now() - timestamp > duration) {
        // if expired, clear
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      
      // return data
      return data;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
};

// save data to cache
export function saveToCache<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;
    
    try {
      // create cache item
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now()
      };
      
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

export function clearCache(): void {
  try {
    // clear cache
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}