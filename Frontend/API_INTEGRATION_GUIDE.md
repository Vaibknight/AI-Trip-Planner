# API Integration Guide - Simplified Structure

This guide explains how to integrate APIs into the Trip Planner application using the simplified API structure.

## 📁 Project Structure

```
src/
├── lib/
│   └── api/
│       ├── routes.ts          # ALL routes (trips, users, etc.)
│       ├── service.ts         # ALL services (trips, users, etc.)
│       ├── types.ts           # ALL types (trips, users, etc.)
│       ├── shared-types.ts    # Shared API types
│       ├── core/
│       │   └── api.ts         # Reusable core
│       ├── utils.ts           # Helper functions
│       └── index.ts           # Main exports
├── hooks/
│   └── useTripPlan.ts         # Custom hook for trip plans
└── app/
    └── api/
        └── trips/
            └── generate/
                └── route.ts   # Next.js API route example
```

## 🚀 Quick Start

### 1. Configure API URL

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

For production, update this to your actual API URL:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 2. Using the API in Components

#### Option A: Using the Hook (Recommended)

```typescript
import { useTripPlan } from "@/hooks/useTripPlan";

function MyComponent() {
  const { generatePlan, plan, isLoading, error } = useTripPlan();
  
  const handleSubmit = async (preferences) => {
    await generatePlan(preferences);
  };
  
  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {plan && <pre>{JSON.stringify(plan, null, 2)}</pre>}
    </div>
  );
}
```

#### Option B: Direct API Call

```typescript
import { tripService } from "@/lib/api";

const response = await tripService.generatePlan(preferences);
if (response.success) {
  console.log(response.data);
} else {
  console.error(response.error);
}
```

## ➕ Adding New API Endpoints

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

### Step 4: Use in Components

```typescript
import { bookingService } from "@/lib/api";

const response = await bookingService.createBooking({
  tripId: "123",
  userId: "456",
});
```

**That's it!** No new files needed - just add to the existing 3 files!

## 🎣 Creating Custom Hooks

Create a hook in `src/hooks/` (e.g., `useBooking.ts`):

```typescript
import { useState, useCallback } from "react";
import { bookingService } from "@/lib/api";
import type { Booking } from "@/lib/api/types";
import type { ApiResponse } from "@/lib/api/shared-types";

export function useBooking() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response: ApiResponse<Booking> = await bookingService.getBookingById(id);
      if (response.success && response.data) {
        setBooking(response.data);
      } else {
        setError(response.error?.message || "Failed to fetch booking");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { booking, fetchBooking, isLoading, error };
}
```

## 🔐 Authentication

The API client automatically includes auth tokens from localStorage:

```typescript
// Set token after login
localStorage.setItem("auth_token", "your-jwt-token");

// Token is automatically included in all requests
// Format: Authorization: Bearer your-jwt-token
```

## 🛠️ Custom Configuration

### Custom Headers

The core API handles headers automatically. If you need custom headers, you can modify `core/api.ts`:

```typescript
function getHeaders(customHeaders?: Record<string, string>): HeadersInit {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    // Add your custom headers here
    "X-Custom-Header": "value",
  };
  // ...
}
```

## 📝 Next.js API Routes

If you're using Next.js API routes, create routes in `src/app/api/`:

```typescript
// src/app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Your logic here
  return NextResponse.json({
    success: true,
    data: { /* your data */ },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Your logic here
  return NextResponse.json({
    success: true,
    data: { /* your data */ },
  });
}
```

## 🐛 Error Handling

All API responses follow this format:

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

### Using Error Helpers

```typescript
import { handleApiResponse, getErrorMessage, isNetworkError } from "@/lib/api/utils";

try {
  const response = await tripService.generatePlan(preferences);
  const plan = handleApiResponse(response); // Throws if error
} catch (error) {
  if (isNetworkError(error)) {
    console.error("Network error:", error);
  } else {
    console.error("Other error:", error);
  }
}
```

## 📦 Example: Complete Integration

```typescript
"use client";

import { useState } from "react";
import { useTripPlan } from "@/hooks/useTripPlan";
import TripForm from "@/components/TripForm";

export default function TripPage() {
  const { generatePlan, plan, isLoading, error, clearError } = useTripPlan();

  const handleSubmit = async (preferences) => {
    await generatePlan(preferences);
  };

  return (
    <div>
      {error && (
        <div className="error">
          {error}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      
      <TripForm 
        onSubmit={handleSubmit} 
        isLoading={isLoading} 
      />
      
      {plan && (
        <div>
          <h2>Trip Plan</h2>
          {/* Display plan */}
        </div>
      )}
    </div>
  );
}
```

## 🔄 Migrating Existing Code

If you have existing API calls, migrate them like this:

**Before:**
```typescript
const response = await fetch("/api/trips", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
const result = await response.json();
```

**After:**
```typescript
import { tripService } from "@/lib/api";

const response = await tripService.generatePlan(data);
if (response.success) {
  const result = response.data;
}
```

## 📚 Best Practices

1. **Always use TypeScript types** for requests and responses
2. **Use hooks** for component-level state management
3. **Handle errors gracefully** with user-friendly messages
4. **Use loading states** to improve UX
5. **Keep API logic separate** from component logic
6. **Use consistent naming** (e.g., `tripService`, `userService`)
7. **Add to existing files** - don't create new files for each API
8. **Document your API endpoints** in service files

## 🎯 Summary

- ✅ **3 main files** - routes.ts, service.ts, types.ts
- ✅ **Centralized API client** with error handling
- ✅ **Type-safe API calls**
- ✅ **Easy to add new endpoints** - just add to existing files
- ✅ **Reusable hooks pattern**
- ✅ **Consistent response format**
- ✅ **Authentication support**
- ✅ **Request timeout handling**

No need to create new files for each API call - just add functions to existing files!
