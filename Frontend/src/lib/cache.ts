import type { TripPreferences } from "@/types/trip";

export interface CachedTripPlan {
  preferences: TripPreferences;
  plan: any;
  cachedAt: string;
  expiresAt: string;
}

const CACHE_KEY_PREFIX = "trip-plan-cache-";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a cache key from trip preferences
 */
function generateCacheKey(preferences: TripPreferences): string {
  // Sort interests to ensure consistent keys
  const sortedInterests = [...preferences.interests].sort();
  
  // Normalize budgetRangeString
  const normalizedBudgetRangeString = preferences.budgetRangeString?.trim() || '';
  
  // Normalize dates (remove milliseconds and timezone for consistent matching)
  const normalizeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('.')[0] + 'Z'; // Remove milliseconds, keep Z
    } catch {
      return dateStr.trim();
    }
  };
  
  const keyData = {
    origin: preferences.origin?.toLowerCase().trim(),
    state: preferences.state?.toLowerCase().trim(),
    // Legacy support
    destination: preferences.destination?.toLowerCase().trim(),
    city: preferences.city?.toLowerCase().trim(),
    travelType: preferences.travelType?.toLowerCase().trim(),
    interests: sortedInterests.map(i => i.toLowerCase().trim()).sort(),
    season: preferences.season?.toLowerCase().trim(),
    duration: Number(preferences.duration),
    budgetRangeString: normalizedBudgetRangeString,
    travelers: Number(preferences.travelers),
    currency: preferences.currency?.toUpperCase().trim(),
    startDateTime: normalizeDate(preferences.startDateTime),
    endDateTime: normalizeDate(preferences.endDateTime),
    // Legacy fields for backward compatibility
    budget: typeof preferences.budget === 'number' 
      ? Math.round(preferences.budget) 
      : preferences.budget,
    budgetRange: preferences.budgetRange?.toLowerCase().trim(),
  };
  
  // Create a hash-like key from the preferences
  const keyString = JSON.stringify(keyData);
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `${CACHE_KEY_PREFIX}${Math.abs(hash)}`;
}

/**
 * Get cached trip plan if available and not expired
 * Also tries to find a match with budget tolerance if exact match fails
 */
export function getCachedTripPlan(
  preferences: TripPreferences
): CachedTripPlan | null {
  if (typeof window === "undefined") return null;
  
  try {
    // First try exact match
    const cacheKey = generateCacheKey(preferences);
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const cachedPlan: CachedTripPlan = JSON.parse(cached);
      const now = new Date().getTime();
      const expiresAt = new Date(cachedPlan.expiresAt).getTime();
      
      // Check if cache is expired
      if (now > expiresAt) {
        console.log('[Cache] Cache expired, removing:', cacheKey);
        localStorage.removeItem(cacheKey);
      } else {
        console.log('[Cache] ✅ Cache hit! Using cached plan for:', cacheKey);
        return cachedPlan;
      }
    }
    
    // If exact match failed, try to find a match with budget tolerance
    console.log('[Cache] No exact cache match for key:', cacheKey);
    console.log('[Cache] Searching for similar cached entries...');
    
    const normalizedBudget = Math.round(preferences.budget || 0);
    const allCacheKeys = getAllCacheKeys();
    
    for (const key of allCacheKeys) {
      try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) continue;
        
        const cachedPlan: CachedTripPlan = JSON.parse(cachedData);
        const now = new Date().getTime();
        const expiresAt = new Date(cachedPlan.expiresAt).getTime();
        
        // Skip expired
        if (now > expiresAt) continue;
        
        // Check if preferences match (with budget tolerance)
        const cachedPrefs = cachedPlan.preferences;
        const cachedBudget = Math.round(cachedPrefs.budget || 0);
        
        // Compare all fields
        const normalizeDate = (dateStr?: string) => {
          if (!dateStr) return '';
          try {
            const date = new Date(dateStr);
            return date.toISOString().split('.')[0] + 'Z';
          } catch {
            return dateStr.trim();
          }
        };
        
        const matches = 
          // New fields
          (cachedPrefs.origin?.toLowerCase().trim() || cachedPrefs.destination?.toLowerCase().trim()) === 
          (preferences.origin?.toLowerCase().trim() || preferences.destination?.toLowerCase().trim()) &&
          (cachedPrefs.state?.toLowerCase().trim() || cachedPrefs.city?.toLowerCase().trim()) === 
          (preferences.state?.toLowerCase().trim() || preferences.city?.toLowerCase().trim()) &&
          cachedPrefs.travelType?.toLowerCase().trim() === preferences.travelType?.toLowerCase().trim() &&
          JSON.stringify([...cachedPrefs.interests].sort().map(i => i.toLowerCase().trim())) === 
          JSON.stringify([...preferences.interests].sort().map(i => i.toLowerCase().trim())) &&
          cachedPrefs.season?.toLowerCase().trim() === preferences.season?.toLowerCase().trim() &&
          Number(cachedPrefs.duration) === Number(preferences.duration) &&
          (cachedPrefs.budgetRangeString?.trim() || String(cachedBudget)) === 
          (preferences.budgetRangeString?.trim() || String(normalizedBudget)) &&
          Number(cachedPrefs.travelers) === Number(preferences.travelers) &&
          cachedPrefs.currency?.toUpperCase().trim() === preferences.currency?.toUpperCase().trim() &&
          normalizeDate(cachedPrefs.startDateTime || cachedPrefs.arrivalDateTime) === 
          normalizeDate(preferences.startDateTime || preferences.arrivalDateTime) &&
          normalizeDate(cachedPrefs.endDateTime || cachedPrefs.departureDateTime) === 
          normalizeDate(preferences.endDateTime || preferences.departureDateTime);
        
        if (matches) {
          console.log('[Cache] ✅ Found matching cache with budget tolerance:', key);
          return cachedPlan;
        }
      } catch (e) {
        // Skip invalid cache entries
        continue;
      }
    }
    
    console.log('[Cache] ❌ No matching cache found');
    return null;
  } catch (error) {
    console.error('[Cache] Error retrieving cache:', error);
    return null;
  }
}

/**
 * Normalize preferences for consistent caching
 */
function normalizePreferences(preferences: TripPreferences): TripPreferences {
  const normalizeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('.')[0] + 'Z'; // Remove milliseconds
    } catch {
      return dateStr.trim();
    }
  };

  return {
    ...preferences,
    origin: preferences.origin?.toLowerCase().trim() || preferences.destination?.toLowerCase().trim() || '',
    state: preferences.state?.toLowerCase().trim() || preferences.city?.toLowerCase().trim() || '',
    // Legacy fields
    destination: preferences.destination?.toLowerCase().trim() || '',
    city: preferences.city?.toLowerCase().trim() || '',
    travelType: preferences.travelType?.toLowerCase().trim() || '',
    interests: [...preferences.interests].sort().map(i => i.toLowerCase().trim()),
    season: preferences.season?.toLowerCase().trim() || '',
    duration: Number(preferences.duration),
    budgetRangeString: preferences.budgetRangeString?.trim() || '',
    budget: Math.round(preferences.budget || 0), // Normalize budget to integer
    travelers: Number(preferences.travelers),
    currency: preferences.currency?.toUpperCase().trim() || '',
    startDateTime: normalizeDate(preferences.startDateTime || preferences.arrivalDateTime),
    endDateTime: normalizeDate(preferences.endDateTime || preferences.departureDateTime),
    // Legacy datetime fields
    arrivalDateTime: normalizeDate(preferences.arrivalDateTime),
    departureDateTime: normalizeDate(preferences.departureDateTime),
  };
}

/**
 * Cache a trip plan
 */
export function setCachedTripPlan(
  preferences: TripPreferences,
  plan: any
): void {
  if (typeof window === "undefined") return;
  
  try {
    // Normalize preferences before caching to ensure consistent keys
    const normalizedPrefs = normalizePreferences(preferences);
    const cacheKey = generateCacheKey(normalizedPrefs);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
    
    const cachedPlan: CachedTripPlan = {
      preferences: normalizedPrefs, // Store normalized preferences
      plan,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cachedPlan));
    console.log('[Cache] Plan cached successfully:', cacheKey, 'with normalized budget:', normalizedPrefs.budget);
  } catch (error) {
    // If storage is full, try to clear old cache entries
    console.warn('[Cache] Storage full, clearing expired cache...', error);
    clearExpiredCache();
    try {
      const normalizedPrefs = normalizePreferences(preferences);
      const cacheKey = generateCacheKey(normalizedPrefs);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
      
      const cachedPlan: CachedTripPlan = {
        preferences: normalizedPrefs,
        plan,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cachedPlan));
      console.log('[Cache] Plan cached after cleanup:', cacheKey);
    } catch (err) {
      // Still failing, skip caching
      console.error('[Cache] Failed to cache trip plan:', err);
    }
  }
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  if (typeof window === "undefined") return;
  
  const now = new Date().getTime();
  const keysToRemove: string[] = [];
  
  // Check all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const cachedPlan: CachedTripPlan = JSON.parse(cached);
          const expiresAt = new Date(cachedPlan.expiresAt).getTime();
          if (now > expiresAt) {
            keysToRemove.push(key);
          }
        }
      } catch {
        // Invalid cache entry, remove it
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Clear all cached trip plans
 */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Remove a specific cached trip plan
 */
export function removeCachedTripPlan(preferences: TripPreferences): void {
  if (typeof window === "undefined") return;
  
  const cacheKey = generateCacheKey(preferences);
  localStorage.removeItem(cacheKey);
}

/**
 * Get all cache keys (for debugging)
 */
export function getAllCacheKeys(): string[] {
  if (typeof window === "undefined") return [];
  
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Debug: Get cache info for a specific preference
 */
export function debugCache(preferences: TripPreferences): {
  cacheKey: string;
  exists: boolean;
  cachedData: CachedTripPlan | null;
  allCacheKeys: string[];
} {
  const cacheKey = generateCacheKey(preferences);
  const cached = localStorage.getItem(cacheKey);
  const cachedData = cached ? JSON.parse(cached) as CachedTripPlan : null;
  
  return {
    cacheKey,
    exists: !!cached,
    cachedData,
    allCacheKeys: getAllCacheKeys(),
  };
}

