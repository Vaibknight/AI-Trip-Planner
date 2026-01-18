export interface TripPreferences {
  origin: string;
  country: string;
  state: string;
  travelType: string;
  interests: string[];
  season: string;
  duration: number;
  budgetRangeString: string;
  travelers: number;
  currency: string;
  startDateTime?: string;
  endDateTime?: string;
  // Legacy fields for backward compatibility
  destinationPreference?: string;
  city?: string;
  budgetRange?: string;
  destination?: string;
  budget?: number;
  arrivalDateTime?: string;
  departureDateTime?: string;
}

export interface TripPlan {
  preferences: TripPreferences;
  itinerary?: any;
  generatedAt?: string;
}

