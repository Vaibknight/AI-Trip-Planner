import type { TripPreferences } from "@/types/trip";

// ============================================================================
// Trip Types
// ============================================================================
export interface TripPlanResponse {
  id: string;
  preferences: TripPreferences;
  itinerary: {
    days: DayItinerary[];
    summary: string;
    estimatedCost: {
      currency: string;
      min: number;
      max: number;
    };
    recommendations: string[];
  };
  generatedAt: string;
}

// API Response structure for trip planning
export interface TripApiResponse {
  status: "success" | "error";
  message: string;
  data: {
    trip: {
      id: string;
      title: string;
      destination: string;
      duration: number;
      itineraryHtml: string;
    };
  };
}

export interface DayItinerary {
  day: number;
  date?: string;
  activities: Activity[];
  meals: Meal[];
  accommodation?: Accommodation;
  transportation?: Transportation;
}

export interface Activity {
  name: string;
  description: string;
  duration: string;
  cost?: number;
  location: string;
  time: string;
  type: string;
}

export interface Meal {
  type: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  location: string;
  cost?: number;
  cuisine?: string;
}

export interface Accommodation {
  name: string;
  type: string;
  location: string;
  cost: number;
  rating?: number;
}

export interface Transportation {
  type: string;
  from: string;
  to: string;
  cost: number;
  duration: string;
}

// ============================================================================
// User Types
// ============================================================================
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  avatar?: string;
}

export interface UserProfile {
  user: User;
  stats: {
    totalTrips: number;
    favoriteDestinations: string[];
  };
}

// ============================================================================
// Add more types here for future APIs
// ============================================================================
// Example:
// export interface Booking {
//   id: string;
//   tripId: string;
//   userId: string;
//   status: "pending" | "confirmed" | "cancelled";
// }

