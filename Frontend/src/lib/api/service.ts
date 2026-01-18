import { BaseService, streamFetch } from "./core/api";
import { tripRoutes, userRoutes } from "./routes";
import type { ApiResponse } from "./shared-types";
import type { TripPreferences } from "@/types/trip";
import type {
  TripPlanResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserProfile,
} from "./types";

// ============================================================================
// Trip Service
// ============================================================================
export class TripService extends BaseService<typeof tripRoutes> {
  constructor() {
    super(tripRoutes);
  }

  async generatePlan(
    preferences: TripPreferences,
    callbacks?: {
      onProgress?: (data: any) => void;
      onEvent?: (event: string, data: any) => void;
    }
  ): Promise<ApiResponse<any>> {
    // Transform preferences to API payload format
    const payload: any = {
      travelType: preferences.travelType,
      interests: preferences.interests,
      season: preferences.season,
      duration: preferences.duration,
      budgetRangeString: preferences.budgetRangeString,
      origin: preferences.origin,
      country: preferences.country,
      state: preferences.state,
      travelers: preferences.travelers,
      currency: preferences.currency,
    };

    // Add start and end datetime if available
    if (preferences.startDateTime) {
      payload.startDateTime = preferences.startDateTime;
    }
    if (preferences.endDateTime) {
      payload.endDateTime = preferences.endDateTime;
    }

    // Legacy support: if old fields exist, use them
    if (preferences.city && !preferences.state) {
      payload.state = preferences.city;
    }
    if (preferences.destination && !preferences.state) {
      payload.state = preferences.destination;
    }
    if (preferences.budget && !preferences.budgetRange) {
      // Map numeric budget to range if needed
      if (preferences.budget < 1000) {
        payload.budgetRange = "budget";
        payload.budgetRangeString = "$500-$1000";
      } else if (preferences.budget < 3000) {
        payload.budgetRange = "moderate";
        payload.budgetRangeString = "$1000-$3000";
      } else {
        payload.budgetRange = "luxury";
        payload.budgetRangeString = "$3000+";
      }
    }
    if (preferences.arrivalDateTime && !preferences.startDateTime) {
      payload.startDateTime = preferences.arrivalDateTime;
    }
    if (preferences.departureDateTime && !preferences.endDateTime) {
      payload.endDateTime = preferences.departureDateTime;
    }

    // Use streaming fetch for real-time updates
    return streamFetch(
      `${this.routes.planTripWithPreferences()}?stream=true`,
      {
        method: "POST",
        body: payload,
        timeout: 600000, // 10 minutes timeout
        onProgress: callbacks?.onProgress,
        onEvent: callbacks?.onEvent,
      }
    );
  }

  async getTripById(
    id: string
  ): Promise<ApiResponse<TripPlanResponse>> {
    return this.get<TripPlanResponse>(this.routes.byId(id));
  }

  async getTripHistory(): Promise<ApiResponse<TripPlanResponse[]>> {
    return this.get<TripPlanResponse[]>(this.routes.history());
  }

  async saveTrip(
    tripPlan: TripPlanResponse
  ): Promise<ApiResponse<TripPlanResponse>> {
    return this.post<TripPlanResponse>(
      this.routes.save(),
      tripPlan
    );
  }

  async updateTrip(
    id: string,
    updates: Partial<TripPlanResponse>
  ): Promise<ApiResponse<TripPlanResponse>> {
    return this.patch<TripPlanResponse>(
      this.routes.update(id),
      updates
    );
  }

  async deleteTrip(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(this.routes.delete(id));
  }

  async getAllTrips(
    page: number = 1,
    limit: number = 10
  ): Promise<ApiResponse<TripPlanResponse[]>> {
    return this.get<TripPlanResponse[]>(
      this.routes.list(),
      { page, limit }
    );
  }
}

export const tripService = new TripService();
export const tripApi = tripService; // Backward compatibility

// ============================================================================
// User Service
// ============================================================================
export class UserService extends BaseService<typeof userRoutes> {
  constructor() {
    super(userRoutes);
  }

  async getAllUsers(
    page: number = 1,
    limit: number = 10
  ): Promise<ApiResponse<User[]>> {
    return this.get<User[]>(this.routes.list(), { page, limit });
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return this.get<User>(this.routes.byId(id));
  }

  async createUser(
    data: CreateUserRequest
  ): Promise<ApiResponse<User>> {
    return this.post<User>(this.routes.create(), data);
  }

  async updateUser(
    id: string,
    data: UpdateUserRequest
  ): Promise<ApiResponse<User>> {
    return this.patch<User>(this.routes.update(id), data);
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(this.routes.delete(id));
  }

  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return this.get<UserProfile>(this.routes.profile());
  }

  async updateUserProfile(
    data: UpdateUserRequest
  ): Promise<ApiResponse<UserProfile>> {
    return this.patch<UserProfile>(this.routes.updateProfile(), data);
  }
}

export const userService = new UserService();

// ============================================================================
// Add more services here for future APIs
// ============================================================================
// Example:
// export class BookingService extends BaseService<BookingRoutes> {
//   constructor() {
//     super(bookingRoutes);
//   }
//   async getAllBookings() {
//     return this.get(this.routes.list());
//   }
// }
// export const bookingService = new BookingService();

