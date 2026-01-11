import { BaseRoutes } from "./core/api";

// ============================================================================
// Trip Routes
// ============================================================================
export class TripRoutes extends BaseRoutes {
  constructor() {
    super("/trips");
  }

  generate = () => this.path("/generate");
  planTripWithPreferences = () => this.path("/plan-trip-with-preferences");
  list = () => this.path("");
  byId = (id: string | number) => this.withId(id);
  history = () => this.path("/history");
  update = (id: string | number) => this.withId(id);
  delete = (id: string | number) => this.withId(id);
  save = () => this.path("");
}

export const tripRoutes = new TripRoutes();

// ============================================================================
// User Routes
// ============================================================================
export class UserRoutes extends BaseRoutes {
  constructor() {
    super("/users");
  }

  list = () => this.path("");
  byId = (id: string | number) => this.withId(id);
  create = () => this.path("");
  update = (id: string | number) => this.withId(id);
  delete = (id: string | number) => this.withId(id);
  profile = () => this.path("/profile");
  updateProfile = () => this.path("/profile");
}

export const userRoutes = new UserRoutes();

// ============================================================================
// Add more routes here for future APIs
// ============================================================================
// Example:
// export class BookingRoutes extends BaseRoutes {
//   constructor() {
//     super("/bookings");
//   }
//   list = () => this.path("");
//   byId = (id: string | number) => this.withId(id);
// }
// export const bookingRoutes = new BookingRoutes();

