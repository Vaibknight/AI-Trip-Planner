export interface TripPreferences {
  destination: string;
  travelType: string;
  interests: string[];
  season: string;
  duration: number;
  budget: number;
  travelers: number;
  currency: string;
}

export interface TripPlan {
  preferences: TripPreferences;
  itinerary?: any;
  generatedAt?: string;
}

