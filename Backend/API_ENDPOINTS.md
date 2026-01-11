# API Endpoints Documentation

Complete list of all API endpoints with HTTP methods, paths, and descriptions.

## Base URL
```
http://localhost:3000/api
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "preferences": {
    "budget": "moderate",
    "travelStyle": "cultural"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

---

### 2. Login User
**POST** `/api/auth/login`

Authenticate and login user.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

---

### 3. Get Current User
**GET** `/api/auth/me`

Get authenticated user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": { ... }
  }
}
```

---

### 4. Update Current User
**PUT** `/api/auth/me`

Update authenticated user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Updated",
  "preferences": {
    "budget": "luxury",
    "travelStyle": "adventure"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "User updated successfully",
  "data": {
    "user": { ... }
  }
}
```

---

## Trip Endpoints

### 5. Plan Trip (Simple Flow - Destination + Days)
**POST** `/api/trips/plan-trip`

Generate a complete trip plan using AI orchestrator. For users who know their destination and dates.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "from": "Delhi",
  "to": "Manali",
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "budget": 30000,
  "currency": "INR",
  "travelers": 2,
  "interests": ["nature", "adventure", "food"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Trip planned successfully",
  "data": {
    "trip": { ... }
  }
}
```

---

### 6. Plan Trip with Preferences (Advanced Flow)
**POST** `/api/trips/plan-trip-with-preferences`

Generate a trip plan based on travel preferences. AI will suggest destinations if not provided. Perfect for users who know what they want but need destination suggestions.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "travelType": "leisure",
  "interests": ["history", "nightlife", "food"],
  "season": "winter",
  "duration": 7,
  "budgetRange": "luxury",
  "budgetRangeString": "$500-$1000",
  "origin": "New York",
  "destinationPreference": "Europe",
  "city": "New Delhi",
  "travelers": 2,
  "currency": "USD"
}
```

**Field Descriptions:**
- `travelType` (optional): `leisure`, `business`, `adventure`, `cultural` (default: `leisure`)
- `interests` (optional): Array of interests: `history`, `nightlife`, `food`, `nature`, `art`, `shopping`, `adventure`, `culture`, `beach`, `mountains`
- `season` (optional): `spring`, `summer`, `fall`, `winter` (auto-calculates dates)
- `duration` (required): Number of days (1-30)
- `budgetRange` (optional): `budget`, `moderate`, `luxury` (default: `moderate`)
- `budgetRangeString` (optional): Budget range like `"$500-$1000"` or `"₹5000-₹10000"`
- `origin` (optional): Starting location
- `destinationPreference` (optional): Preferred destination or region (e.g., "Europe", "India") - used when selecting country first
- `city` (optional): Specific city selected after country selection (e.g., "New Delhi", "Paris") - takes priority over destinationPreference
- `travelers` (optional): Number of travelers (default: 1)
- `currency` (optional): Currency code (default: `INR`)
- `startDate` (optional): Start date (auto-calculated from season if not provided)
- `endDate` (optional): End date (auto-calculated from startDate + duration if not provided)

**Note:** When both `city` and `destinationPreference` are provided, `city` takes priority. The itinerary will be generated for the specific city with:
- Cafes and restaurants along the route between activities
- Food and dining planned with proper timing
- All parameters (travelType, interests, season, budgetRange) considered when selecting places and activities

**Response:**
```json
{
  "status": "success",
  "message": "Trip planned successfully based on your preferences",
  "data": {
    "trip": { ... }
  }
}
```

**Note:** If `destinationPreference` is not provided, AI will suggest destinations based on your preferences, season, and interests.

---

### 7. Generate Trip (Legacy Endpoint)
**POST** `/api/trips/generate`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "from": "Delhi",
  "to": "Manali",
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "budget": 30000,
  "currency": "INR",
  "travelers": 2,
  "interests": ["nature", "adventure", "food"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Trip planned successfully",
  "data": {
    "trip": { ... }
  }
}
```

---

### 6. Generate Trip (Legacy)
**POST** `/api/trips/generate`

Legacy endpoint for trip generation (uses same logic as plan-trip).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** Same as `/api/trips/plan-trip`

---

### 8. Create Custom Trip
**POST** `/api/trips`

Create a trip manually without AI generation.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Summer Europe Trip",
  "destinations": [
    {
      "city": "Paris",
      "country": "France"
    }
  ],
  "startDate": "2024-06-01",
  "endDate": "2024-06-10",
  "preferences": {
    "budget": "moderate",
    "travelStyle": "cultural"
  }
}
```

---

### 9. Get All User Trips
**GET** `/api/trips`

Get all trips for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional) - Filter by status: `draft`, `planning`, `confirmed`, `completed`, `cancelled`
- `startDate` (optional) - Filter trips starting from this date
- `endDate` (optional) - Filter trips ending before this date
- `limit` (optional) - Number of results per page (default: 50)
- `skip` (optional) - Number of results to skip (default: 0)

**Example:**
```
GET /api/trips?status=confirmed&limit=10&skip=0
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "trips": [ ... ],
    "total": 25,
    "page": 1,
    "pages": 3
  }
}
```

---

### 10. Get Trip by ID
**GET** `/api/trips/:id`

Get a specific trip by its ID.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "trip": { ... }
  }
}
```

---

### 11. Update Trip
**PUT** `/api/trips/:id`

Update trip details.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Updated Trip Title",
  "description": "Updated description",
  "status": "confirmed"
}
```

---

### 12. Delete Trip
**DELETE** `/api/trips/:id`

Delete a trip.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Trip deleted successfully"
}
```

---

### 13. Tweak/Update Trip Plan
**PUT** `/api/trips/:id/tweak`

Update trip parameters and re-generate plan with AI.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "budget": 35000,
  "startDate": "2024-06-02",
  "endDate": "2024-06-06",
  "interests": ["nature", "adventure", "culture"],
  "travelers": 3
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Trip updated successfully",
  "data": {
    "trip": { ... }
  }
}
```

---

### 14. Get Trip Progress
**GET** `/api/trips/:id/progress`

Get the current progress of trip planning (for loading screen).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "progress": [
      {
        "step": "understanding",
        "status": "completed",
        "message": "Understanding your preferences"
      },
      {
        "step": "destinations",
        "status": "completed",
        "message": "Finding best destinations"
      },
      {
        "step": "itinerary",
        "status": "in_progress",
        "message": "Creating itinerary"
      },
      {
        "step": "budget",
        "status": "pending",
        "message": "Estimating budget"
      },
      {
        "step": "optimizing",
        "status": "pending",
        "message": "Optimizing plan"
      }
    ],
    "currentStep": "itinerary",
    "tripStatus": "planning"
  }
}
```

---

### 15. Get Trip Map Data
**GET** `/api/trips/:id/map`

Get trip data formatted for map display.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "trip": {
      "id": "trip_id",
      "title": "Delhi → Manali",
      "origin": "Delhi",
      "destination": "Manali"
    },
    "locations": [
      {
        "name": "Manali",
        "city": "Manali",
        "country": "India",
        "type": "destination",
        "coordinates": {
          "latitude": 32.2396,
          "longitude": 77.1887
        }
      }
    ],
    "route": {
      "origin": "Delhi",
      "destination": "Manali",
      "waypoints": []
    }
  }
}
```

---

### 16. Export Trip
**GET** `/api/trips/:id/export`

Get trip data formatted for PDF export.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "exportData": {
      "title": "Delhi → Manali",
      "duration": "5 Days",
      "estimatedCost": "INR 28500",
      "itinerary": [ ... ],
      "budget": { ... }
    },
    "format": "pdf",
    "downloadUrl": "/api/trips/:id/export/pdf"
  }
}
```

---

### 17. Share Trip
**POST** `/api/trips/:id/share`

Generate a shareable link for the trip.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "shareType": "link",
  "email": "user@example.com",
  "message": "Check out my trip!"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Trip shared successfully",
  "data": {
    "share": {
      "tripId": "trip_id",
      "shareLink": "http://localhost:3000/trip/trip_id?share=token",
      "shareToken": "random_token",
      "expiresAt": "2024-07-01T00:00:00.000Z"
    }
  }
}
```

---

### 18. Enhance Trip
**POST** `/api/trips/:id/enhance`

Get AI suggestions to enhance existing trip.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "suggestions": {
      "optimizations": [ ... ],
      "alternativeActivities": [ ... ],
      "finalRecommendations": [ ... ]
    }
  }
}
```

---

## Itinerary Management Endpoints

### 18. Add Activity to Itinerary
**POST** `/api/trips/:id/days/:dayIndex/activities`

Add a new activity to a specific day in the itinerary.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Visit Local Market",
  "description": "Explore local handicrafts",
  "type": "attraction",
  "location": "Market Street",
  "timeSlot": "afternoon",
  "startTime": "14:00",
  "endTime": "16:00",
  "duration": 120,
  "cost": {
    "amount": 500,
    "currency": "INR"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Activity added successfully",
  "data": {
    "trip": { ... }
  }
}
```

---

### 19. Update Activity
**PUT** `/api/trips/:id/days/:dayIndex/activities/:activityIndex`

Update an existing activity in the itinerary.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** Same structure as Add Activity

**Response:**
```json
{
  "status": "success",
  "message": "Activity updated successfully",
  "data": {
    "trip": { ... }
  }
}
```

---

### 20. Delete Activity
**DELETE** `/api/trips/:id/days/:dayIndex/activities/:activityIndex`

Delete an activity from the itinerary.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Activity deleted successfully",
  "data": {
    "trip": { ... }
  }
}
```

---

## Utility Endpoints

### 21. API Information
**GET** `/api`

Get API information and available endpoints.

**Response:**
```json
{
  "status": "success",
  "message": "Trip Planner API",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

---

### 22. Health Check
**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "environment": "development"
}
```

---

### 23. Root Endpoint
**GET** `/`

Welcome message.

**Response:**
```json
{
  "status": "success",
  "message": "Welcome to Trip Planner API",
  "version": "1.0.0",
  "documentation": "/api"
}
```

---

## Authentication

Most endpoints require authentication. Include the JWT token in the request header:

```
Authorization: Bearer <your_jwt_token>
```

**Public Endpoints (No Auth Required):**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /health`
- `GET /`
- `GET /api`

**Protected Endpoints (Auth Required):**
- All other endpoints require authentication

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `500` - Internal Server Error

---

## Quick Reference

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register user | No |
| POST | `/api/auth/login` | Login user | No |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/auth/me` | Update user | Yes |
| POST | `/api/trips/plan-trip` | Plan trip (simple: destination + days) | Yes |
| POST | `/api/trips/plan-trip-with-preferences` | Plan trip (preferences-based) | Yes |
| POST | `/api/trips/generate` | Generate trip (legacy) | Yes |
| POST | `/api/trips` | Create trip | Yes |
| GET | `/api/trips` | Get all trips | Yes |
| GET | `/api/trips/:id` | Get trip | Yes |
| PUT | `/api/trips/:id` | Update trip | Yes |
| DELETE | `/api/trips/:id` | Delete trip | Yes |
| PUT | `/api/trips/:id/tweak` | Tweak trip | Yes |
| GET | `/api/trips/:id/progress` | Get progress | Yes |
| GET | `/api/trips/:id/map` | Get map data | Yes |
| GET | `/api/trips/:id/export` | Export trip | Yes |
| POST | `/api/trips/:id/share` | Share trip | Yes |
| POST | `/api/trips/:id/enhance` | Enhance trip | Yes |
| POST | `/api/trips/:id/days/:dayIndex/activities` | Add activity | Yes |
| PUT | `/api/trips/:id/days/:dayIndex/activities/:activityIndex` | Update activity | Yes |
| DELETE | `/api/trips/:id/days/:dayIndex/activities/:activityIndex` | Delete activity | Yes |
| GET | `/api` | API info | No |
| GET | `/health` | Health check | No |
| GET | `/` | Welcome | No |

