# API Service Structure

This directory contains a simplified, scalable API service structure for making HTTP requests.

## Structure

```
src/lib/api/
├── routes.ts          # ALL routes (trips, users, future APIs)
├── service.ts          # ALL services (trips, users, future APIs)
├── types.ts            # ALL types (trips, users, future APIs)
├── shared-types.ts     # Shared API types (ApiResponse, RequestConfig)
├── core/
│   └── api.ts          # Reusable core (fetch, BaseRoutes, BaseService)
├── utils.ts            # Helper functions
└── index.ts            # Centralized exports
```

## Usage

### Basic Usage

```typescript
import { tripService, userService } from "@/lib/api";

// Generate trip plan
const response = await tripService.generatePlan(preferences);
if (response.success) {
  console.log(response.data);
} else {
  console.error(response.error);
}

// Get user
const userResponse = await userService.getUserById("123");
```

### Using the Hook

```typescript
import { useTripPlan } from "@/hooks/useTripPlan";

function MyComponent() {
  const { generatePlan, plan, isLoading, error } = useTripPlan();
  
  const handleSubmit = async (prefs) => {
    await generatePlan(prefs);
  };
  
  return (
    // Your component
  );
}
```

## Adding New API Endpoints

### Step 1: Add Routes to `routes.ts`

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
}

export const bookingRoutes = new BookingRoutes();
```

### Step 2: Add Types to `types.ts`

```typescript
// ============================================================================
// Booking Types
// ============================================================================
export interface Booking {
  id: string;
  tripId: string;
  userId: string;
}

export interface CreateBookingRequest {
  tripId: string;
  userId: string;
}
```

### Step 3: Add Service to `service.ts`

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
}

export const bookingService = new BookingService();
```

### Step 4: Use in Components

```typescript
import { bookingService } from "@/lib/api";

const response = await bookingService.createBooking({
  tripId: "123",
  userId: "456",
});
```

## Configuration

Set `NEXT_PUBLIC_API_URL` in your `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Features

- ✅ Type-safe API calls
- ✅ Automatic error handling
- ✅ Request timeout support
- ✅ Authentication token support
- ✅ Query parameter building
- ✅ Consistent response format
- ✅ Easy to extend - add to existing files
- ✅ No file proliferation - 3 main files for all APIs

## Error Handling

All API calls return a consistent `ApiResponse` format:

```typescript
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Authentication

The API client automatically includes auth tokens from localStorage:

```typescript
// Set token
localStorage.setItem("auth_token", "your-token");

// Token is automatically included in requests
```

## File Organization

- **routes.ts** - All route definitions in one place
- **service.ts** - All service implementations in one place
- **types.ts** - All TypeScript types in one place
- **core/api.ts** - Reusable core (don't modify unless needed)

## Best Practices

1. **Add to existing files** - Don't create new files for each API
2. **Use TypeScript types** - Always define types for requests/responses
3. **Follow the pattern** - Routes → Types → Service
4. **Keep it simple** - One responsibility per method
5. **Use consistent naming** - Follow existing patterns

## Summary

- ✅ **3 main files** - routes.ts, service.ts, types.ts
- ✅ **Core is reusable** - Just import `BaseRoutes` and `BaseService`
- ✅ **Easy to maintain** - Everything organized by concern
- ✅ **No file proliferation** - Add to existing files, don't create new ones
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Consistent** - All APIs follow the same pattern

No need to create new files for each API call - just add functions to existing files!
