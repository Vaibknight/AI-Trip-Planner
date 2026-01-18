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
    trip: TripData;
    itineraryHtml?: string;
  };
}

export interface TripData {
  userId?: string;
  title: string;
  description?: string;
  origin?: string;
  destination: string;
  travelers: number;
  destinations?: Destination[];
  startDate?: string;
  endDate?: string;
  duration: number;
  budget: Budget;
  transportation?: TransportationDetails;
  itinerary: DayItinerary[];
  itineraryHtml?: string;
  budgetHtml?: string;
  preferences?: {
    budget?: string;
    travelStyle?: string;
    interests?: string[];
    dietaryRestrictions?: string[];
    accessibility?: string[];
  };
  status?: string;
  aiGenerated?: boolean;
  highlights?: string[];
  tips?: string[];
  optimizations?: Optimization[];
  alternativeActivities?: any[];
  recommendations?: any[];
  recommendedAreas?: any;
  tags?: string[];
  createdAt?: string;
  _id?: string;
  updatedAt?: string;
  __v?: number;
}

export interface Destination {
  name: string;
  city: string;
  country: string;
  description: string;
}

export interface Budget {
  total: number;
  currency: string;
  breakdown: {
    accommodation: number;
    transportation: number;
    food: number;
    activities: number;
    other: number;
  };
  perPerson: number;
  perDay: number;
  status?: string;
  variance?: number;
  optimizations?: Optimization[];
}

export interface Optimization {
  category: string;
  suggestion: string;
  potentialSavings: number;
  _id?: string;
}

export interface TransportationDetails {
  recommended: string;
  options: string[];
  estimatedCost: number;
  localTransportation?: {
    metro?: string;
    autoRickshaw?: string;
    eRickshaw?: string;
    buses?: string;
    other?: string;
    tips?: string[];
  };
}

export interface DayItinerary {
  date: string;
  day: number;
  title: string;
  activities: Activity[];
  notes?: string;
  estimatedCost?: number;
  meals?: Meal[];
  accommodation?: Accommodation;
  transportation?: Transportation;
}

export interface Activity {
  name: string;
  description: string;
  type: string;
  location: string;
  timeSlot?: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  cost?: {
    amount: number;
    currency: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
  time?: string; // Legacy field
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

