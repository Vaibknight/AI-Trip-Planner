# API Flow Documentation

This document describes the API flow matching the UI requirements for the AI Trip Planner.

## User Flows

### Flow 1: Simple Trip Planning (Destination + Days)
1. **User opens site** → Frontend loads
2. **Enters destination and dates** → Frontend collects input
3. **Clicks "Generate"** → `POST /api/trips/plan-trip`
4. **AI agents collaborate** → Backend orchestrates agents
5. **User sees itinerary + budget + map** → Frontend displays results
6. **User tweaks (budget, days, interests)** → `PUT /api/trips/:id/tweak`
7. **AI updates plan** → Backend re-plans with updates

### Flow 2: Preferences-Based Trip Planning
1. **User opens site** → Frontend loads
2. **Selects preferences** (travel type, interests, season, duration, budget) → Frontend collects input
3. **Clicks "Generate Travel Plan"** → `POST /api/trips/plan-trip-with-preferences`
4. **AI suggests destinations** (if not provided) → Backend uses destination agent
5. **AI agents collaborate** → Backend orchestrates all agents
6. **User sees suggested destination + itinerary + budget** → Frontend displays results
7. **User tweaks preferences** → `PUT /api/trips/:id/tweak`
8. **AI updates plan** → Backend re-plans with updates

## System Flow

### Flow 1: Simple Trip Planning
```
Frontend (Destination + Dates)
  ↓
Backend API (/plan-trip)
  ↓
Orchestrator
  ├── Intent Agent (Understanding preferences)
  ├── Destination Agent (Finding best destinations)
  ├── Itinerary Agent (Creating itinerary)
  ├── Budget Agent (Estimating budget)
  └── Optimizer Agent (Optimizing plan)
  ↓
Travel APIs + DB
  ↓
Response → UI
```

### Flow 2: Preferences-Based Trip Planning
```
Frontend (Preferences UI)
  ↓
Backend API (/plan-trip-with-preferences)
  ↓
Orchestrator
  ├── Destination Suggestion (if destination not provided)
  ├── Intent Agent (Understanding preferences)
  ├── Destination Agent (Finding best destinations)
  ├── Itinerary Agent (Creating itinerary)
  ├── Budget Agent (Estimating budget)
  └── Optimizer Agent (Optimizing plan)
  ↓
Travel APIs + DB
  ↓
Response → UI (with suggested destination)
```

## API Endpoints

### 1. Plan Trip (Simple Flow)
**POST** `/api/trips/plan-trip`

For users who know their destination and dates.

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
    "trip": {
      "_id": "trip_id",
      "title": "Delhi → Manali",
      "origin": "Delhi",
      "destination": "Manali",
      "duration": 5,
      "budget": {
        "total": 28500,
        "currency": "INR",
        "breakdown": {
          "accommodation": 10000,
          "transportation": 8000,
          "food": 6000,
          "activities": 4000,
          "other": 500
        }
      },
      "itinerary": [
        {
          "day": 1,
          "date": "2024-06-01",
          "title": "Arrival & Mall Road",
          "activities": [
            {
              "name": "Check-in at hotel",
              "type": "hotel",
              "location": "Hotel address",
              "timeSlot": "morning",
              "startTime": "10:00",
              "endTime": "11:00"
            }
          ]
        }
      ],
      "highlights": ["Highlight 1", "Highlight 2"],
      "tips": ["Tip 1", "Tip 2"]
    }
  }
}
```

### 2. Get Trip Progress
**GET** `/api/trips/:id/progress`

Returns the current progress of trip planning (for loading screen).

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

### 4. Tweak/Update Trip
**PUT** `/api/trips/:id/tweak`

Allows users to update trip parameters and re-plan.

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
    "trip": { /* Updated trip object */ }
  }
}
```

### 5. Get Trip Map Data
**GET** `/api/trips/:id/map`

Returns trip data formatted for map display.

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
        "coordinates": { "latitude": 32.2396, "longitude": 77.1887 }
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

### 6. Export Trip
**GET** `/api/trips/:id/export`

Returns trip data formatted for PDF export.

**Response:**
```json
{
  "status": "success",
  "data": {
    "exportData": {
      "title": "Delhi → Manali",
      "duration": "5 Days",
      "estimatedCost": "INR 28500",
      "itinerary": [ /* Formatted itinerary */ ],
      "budget": { /* Budget breakdown */ }
    },
    "format": "pdf",
    "downloadUrl": "/api/trips/:id/export/pdf"
  }
}
```

### 7. Share Trip
**POST** `/api/trips/:id/share`

Generates a shareable link for the trip.

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

## Agent Flow Details

### Step 1: Intent Agent
- Analyzes user preferences
- Determines trip purpose (leisure, business, adventure, etc.)
- Categorizes budget (budget, moderate, luxury)
- Identifies priority interests

### Step 2: Destination Agent
- Finds best destinations and routes
- Recommends transportation options
- Identifies key attractions
- Suggests best time to visit

### Step 3: Itinerary Agent
- Creates day-by-day itinerary
- Schedules activities with time slots
- Suggests restaurants and accommodations
- Plans realistic timing

### Step 4: Budget Agent
- Estimates costs by category
- Calculates per-person and per-day costs
- Provides budget optimization suggestions
- Compares with target budget

### Step 5: Optimizer Agent
- Optimizes for time efficiency
- Suggests cost-saving alternatives
- Improves experience quality
- Provides final recommendations

## Error Handling

All endpoints return consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": [ /* Validation errors if any */ ]
}
```

## Authentication

All trip endpoints require authentication. Include JWT token in header:

```
Authorization: Bearer <token>
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

