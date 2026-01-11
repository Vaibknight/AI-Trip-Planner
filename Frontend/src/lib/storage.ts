import type { TripPreferences } from "@/types/trip";

export interface SavedTrip extends TripPreferences {
  id: string;
  createdAt: string;
  plan?: any;
}

const STORAGE_KEY = "trip-planner-history";

export function saveTripToHistory(trip: TripPreferences, plan?: any): SavedTrip {
  const savedTrip: SavedTrip = {
    ...trip,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    plan,
  };

  const history = getTripHistory();
  history.unshift(savedTrip); // Add to beginning
  // Keep only last 20 trips
  const limitedHistory = history.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));

  return savedTrip;
}

export function getTripHistory(): SavedTrip[] {
  if (typeof window === "undefined") return [];
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function deleteTripFromHistory(id: string): void {
  const history = getTripHistory();
  const filtered = history.filter((trip) => trip.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearTripHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}



