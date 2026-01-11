# API Structure Guide - Simplified Version

## 📁 Project Structure

```
src/lib/api/
├── routes.ts          # ALL routes (trips, users, future APIs)
├── service.ts         # ALL services (trips, users, future APIs)
├── types.ts           # ALL types (trips, users, future APIs)
├── shared-types.ts    # Shared API types (ApiResponse, RequestConfig)
├── core/
│   └── api.ts         # Reusable core (fetch, BaseRoutes, BaseService)
├── utils.ts           # Helper functions
└── index.ts           # Main exports
```

## 🚀 Quick Start

### 1. Configure API URL

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 2. Using the API in Components

```typescript
import { tripService, userService } from "@/lib/api";

// Trip API
const response = await tripService.generatePlan(preferences);
if (response.success) {
  console.log(response.data);
}

// User API
const response = await userService.getUserById("123");
```

## ➕ Adding New API Endpoints

### Step 1: Add Routes to `routes.ts`

Open `src/lib/api/routes.ts` and add your route class:

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

Open `src/lib/api/types.ts` and add your types:

```typescript
// ============================================================================
// Booking Types
// ============================================================================
export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  status: "pending" | "confirmed" | "cancelled";
}

export interface CreateBookingRequest {
  tripId: string;
  userId: string;
}
```

### Step 3: Add Service to `service.ts`

Open `src/lib/api/service.ts` and add your service:

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

### Step 4: Use in Components

```typescript
import { bookingService } from "@/lib/api";

const response = await bookingService.createBooking({
  tripId: "123",
  userId: "456",
});
```

## 📝 File Responsibilities

### `routes.ts`
- ✅ All route path definitions
- ✅ Route classes for each API module
- ✅ Route instances exported

### `service.ts`
- ✅ All service implementations
- ✅ Business logic for each API module
- ✅ Service instances exported

### `types.ts`
- ✅ All TypeScript interfaces/types
- ✅ Request/Response types for each API module
- ✅ Shared data structures

### `core/api.ts`
- ✅ HTTP fetch implementation
- ✅ Base route builder classes
- ✅ Base service class
- ✅ Error handling

## 🔄 How It Works Together

```
Component
  ↓
Service (service.ts)
  ↓ uses routes from
Routes (routes.ts)
  ↓ uses fetch from
Core (core/api.ts)
  ↓ makes HTTP call
API Endpoint
```

## 💡 Benefits

1. **Reusability** - Core files are reused for all APIs
2. **Separation of Concerns** - Routes, service logic, and types are separated
3. **Type Safety** - Full TypeScript support throughout
4. **Maintainability** - Easy to find and update specific parts
5. **Scalability** - Add new APIs by adding to existing files
6. **Consistency** - All APIs follow the same pattern

## 📚 Examples

### Example 1: Simple GET Request

```typescript
// routes.ts
export class ProductRoutes extends BaseRoutes {
  constructor() {
    super("/products");
  }
  byId = (id: string) => this.withId(id);
}

// service.ts
export class ProductService extends BaseService<typeof productRoutes> {
  async getProduct(id: string) {
    return this.get(this.routes.byId(id));
  }
}
```

### Example 2: POST with Body

```typescript
// routes.ts
export class OrderRoutes extends BaseRoutes {
  constructor() {
    super("/orders");
  }
  create = () => this.path("");
}

// service.ts
export class OrderService extends BaseService<typeof orderRoutes> {
  async createOrder(data: CreateOrderRequest) {
    return this.post(this.routes.create(), data);
  }
}
```

### Example 3: Query Parameters

```typescript
// service.ts
async getProducts(page: number, limit: number) {
  return this.get(this.routes.list(), { page, limit });
}
```

## 🎯 Best Practices

1. **Always extend BaseRoutes** for route definitions
2. **Always extend BaseService** for service implementations
3. **Keep routes simple** - just path definitions
4. **Keep service methods focused** - one responsibility per method
5. **Use TypeScript types** for all requests/responses
6. **Export singleton instances** for easy usage
7. **Add to existing files** - don't create new files for each API

## 🚀 Summary

- ✅ **3 main files** - routes.ts, service.ts, types.ts
- ✅ **Core is reusable** - Just import `BaseRoutes` and `BaseService`
- ✅ **Easy to maintain** - Everything organized by concern
- ✅ **No file proliferation** - Add to existing files, don't create new ones
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Consistent** - All APIs follow the same pattern

No need to create new files for each API call - just add functions to existing files!
