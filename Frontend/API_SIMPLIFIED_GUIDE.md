# Simplified API Structure Guide

## 📁 Final Structure (All-in-One Files)

```
src/lib/api/
├── routes.ts          # ALL routes (trips + users + future APIs) in ONE file
├── service.ts         # ALL services (trips + users + future APIs) in ONE file
├── types.ts           # ALL types (trips + users + future APIs) in ONE file
├── shared-types.ts    # Shared API types (ApiResponse, RequestConfig, etc.)
├── core/
│   └── api.ts         # Reusable core (fetch, BaseRoutes, BaseService)
├── utils.ts           # Helper functions
└── index.ts           # Main exports
```

## 🎯 Key Benefits

✅ **Ultra Simplified** - Only 3 main files (routes.ts, service.ts, types.ts)  
✅ **Reusable** - Core `api.ts` can be reused for any new API  
✅ **Easy to Find** - Everything for one concern is in one file  
✅ **No File Proliferation** - Add new APIs to existing files, don't create new ones  

## 🚀 How to Use

### Using Existing APIs

```typescript
import { tripService, userService } from "@/lib/api";

// Trip API
const response = await tripService.generatePlan(preferences);

// User API
const response = await userService.getUserById("123");
```

## ➕ Adding a New API Module

### Step 1: Add Routes to `routes.ts`

Open `src/lib/api/routes.ts` and add:

```typescript
// ============================================================================
// Booking Routes
// ============================================================================
export class BookingRoutes extends BaseRoutes {
  constructor() {
    super("/bookings");
  }

  list = () => this.path("");
  byId = (id: string | number) => this.withId(id);
  create = () => this.path("");
  cancel = (id: string | number) => this.withId(id, "/cancel");
}

export const bookingRoutes = new BookingRoutes();
```

### Step 2: Add Types to `types.ts`

Open `src/lib/api/types.ts` and add:

```typescript
// ============================================================================
// Booking Types
// ============================================================================
export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
}

export interface CreateBookingRequest {
  tripId: string;
  userId: string;
}
```

### Step 3: Add Service to `service.ts`

Open `src/lib/api/service.ts` and add:

```typescript
// ============================================================================
// Booking Service
// ============================================================================
export class BookingService extends BaseService<typeof bookingRoutes> {
  constructor() {
    super(bookingRoutes);
  }

  async getAllBookings(): Promise<ApiResponse<Booking[]>> {
    return this.get<Booking[]>(this.routes.list());
  }

  async getBookingById(id: string): Promise<ApiResponse<Booking>> {
    return this.get<Booking>(this.routes.byId(id));
  }

  async createBooking(
    data: CreateBookingRequest
  ): Promise<ApiResponse<Booking>> {
    return this.post<Booking>(this.routes.create(), data);
  }

  async cancelBooking(id: string): Promise<ApiResponse<Booking>> {
    return this.post<Booking>(this.routes.cancel(id));
  }
}

export const bookingService = new BookingService();
```

### Step 4: Use It!

```typescript
import { bookingService } from "@/lib/api";

const response = await bookingService.createBooking({
  tripId: "123",
  userId: "456",
});
```

**That's it!** No new files needed - just add to the existing 3 files!

## 📝 File Structure Explained

### `routes.ts` - All Routes Together

Contains route definitions for:
- **Trips** - TripRoutes class
- **Users** - UserRoutes class
- **Future APIs** - Add more route classes here

**Pattern:**
```typescript
export class [Name]Routes extends BaseRoutes {
  constructor() {
    super("/[base-path]");
  }
  // Define routes here
}
export const [name]Routes = new [Name]Routes();
```

### `service.ts` - All Services Together

Contains service implementations for:
- **Trips** - TripService class
- **Users** - UserService class
- **Future APIs** - Add more service classes here

**Pattern:**
```typescript
export class [Name]Service extends BaseService<typeof [name]Routes> {
  constructor() {
    super([name]Routes);
  }
  // Define methods here
}
export const [name]Service = new [Name]Service();
```

### `types.ts` - All Types Together

Contains TypeScript types for:
- **Trips** - TripPlanResponse, DayItinerary, Activity, etc.
- **Users** - User, CreateUserRequest, UserProfile, etc.
- **Future APIs** - Add more interfaces/types here

**Pattern:**
```typescript
export interface [Name] {
  // Define properties
}
```

### `core/api.ts` - Reusable Core

Contains:
- **Fetch** - HTTP request handling (`apiFetch`, `fetchUtils`)
- **Routes** - Base route builder classes (`BaseRoutes`, `RouteBuilder`)
- **Service** - Base service class (`BaseService`)

**You don't need to modify this file** - it's reusable for all APIs!

## 🔄 Pattern to Follow

For any new API, follow this pattern in the 3 files:

### 1. Routes (`routes.ts`)
```typescript
export class MyRoutes extends BaseRoutes {
  constructor() {
    super("/my-api");
  }
  list = () => this.path("");
  byId = (id: string) => this.withId(id);
}
export const myRoutes = new MyRoutes();
```

### 2. Types (`types.ts`)
```typescript
export interface MyType {
  id: string;
  name: string;
}
```

### 3. Service (`service.ts`)
```typescript
export class MyService extends BaseService<typeof myRoutes> {
  constructor() {
    super(myRoutes);
  }
  async getItem(id: string) {
    return this.get(this.routes.byId(id));
  }
}
export const myService = new MyService();
```

## ✅ Summary

- **3 main files** - routes.ts, service.ts, types.ts
- **Core is reusable** - Just import `BaseRoutes` and `BaseService`
- **Easy to maintain** - Everything organized by concern
- **No file proliferation** - Add to existing files, don't create new ones
- **Same functionality** - Nothing lost, just simplified!

## 🎯 Quick Reference

```typescript
// Import
import { tripService, userService, bookingService } from "@/lib/api";

// Use
await tripService.generatePlan(preferences);
await userService.getUserById("123");
await bookingService.createBooking(data);
```

## 📚 File Organization

```
routes.ts    → All route definitions
service.ts   → All service implementations  
types.ts     → All TypeScript types
```

Everything is in one place per concern - simple and reusable! 🚀
