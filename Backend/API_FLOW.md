# API Flow Documentation

This document describes the API flow matching the UI requirements for the AI Trip Planner.

## User Flows

### Flow 1: Simple Trip Planning (Destination + Days)
1. **User opens site** → Frontend loads
2. **Enters destination and dates** → Frontend collects input
3. **Clicks "Generate"** → `POST /api/trips/plan-trip`
4. **Backend plans the trip (hybrid orchestration)** → See [Hybrid orchestration (default)](#hybrid-orchestration-default) — one main LLM call for the **itinerary**; intent and budget are derived in code; destination copy comes from **MongoDB `DestinationCatalog`** when available; **weather** runs in parallel with itinerary generation; optional **trip plan cache** for repeat requests
5. **User sees itinerary + budget (and optional map on demand)** → Frontend displays the plan immediately; the map loads only when the user clicks **Show map** (see [Response time and geocoding](#response-time-and-geocoding))
6. **User tweaks (budget, days, interests)** → `PUT /api/trips/:id/tweak`
7. **AI updates plan** → Backend re-plans with updates

### Flow 2: Preferences-Based Trip Planning
1. **User opens site** → Frontend loads
2. **Selects preferences** (travel type, interests, season, duration, budget) → Frontend collects input
3. **Clicks "Generate Travel Plan"** → `POST /api/trips/plan-trip-with-preferences`
4. **Destination resolved** → If the user did not set a destination, the backend suggests a city from the **`DestinationCatalog`** (tags/season) or a safe default — **no destination LLM** in the default path
5. **Backend plans the trip (hybrid orchestration)** → Same pipeline as the simple flow ([Hybrid orchestration (default)](#hybrid-orchestration-default))
6. **User sees suggested destination + itinerary + budget** → Frontend displays results (map on demand via **Show map**)
7. **User tweaks preferences** → `PUT /api/trips/:id/tweak`
8. **AI updates plan** → Backend re-plans with updates

## Response time and geocoding

### Why the trip flow used to feel like ~1 minute 30 seconds

A large part of the wait was **geocoding**: turning free-text place names from the itinerary into latitude/longitude using **OpenStreetMap Nominatim**. That service is meant to be used politely—typically about **one HTTP request per second** per client. When the app resolved **many stops one after another**, those seconds added up quickly (dozens of places could mean **well over a minute** of network wait) **on top of** the AI orchestration time. The user experience was “everything finishes together,” so the **full itinerary + full map coordinates** appeared only after that long tail completed.

### How we reduced the perceived wait to on the order of ~30 seconds

| Change | Effect |
|--------|--------|
| **Removed geocoding from the initial trip response path** | The backend returns structured itinerary + HTML + budget when the **AI agents** finish. Coordinate lookup no longer blocks that response. |
| **“Show map” button (on-demand geocoding)** | The frontend renders the trip **immediately**. Coordinates load only after the user chooses to open the map, via **`POST /api/maps/geocode/batch`**. Users who only read the plan are not delayed by Nominatim. |
| **Faster batch geocoding when the map is opened** | Duplicate place names are resolved once; **MongoDB cache** hits avoid repeat external calls; **controlled parallelism** (`p-limit`, capped concurrency) replaces purely sequential awaits while still respecting Nominatim rate limits; timeouts and retries handle flaky responses. |
| **Progressive map (two waves)** | **Landmarks and day anchors** geocode first so pins appear sooner; meals and lower-priority stops can load in a **second background wave**. |

Together, moving geocoding off the critical path accounts for most of the improvement from roughly **~1m 30s** “until something useful is on screen” down to roughly **~30s** for the **core trip payload** (exact numbers vary with model latency and itinerary size). Map loading time is **explicit and optional**, not bundled into the first response.

Further **orchestrator optimization** (fewer LLMs, parallel itinerary + weather, Mongo-backed destinations, in-memory trip cache) targets **much faster** plan generation — often on the order of **one main model round-trip** plus HTTP — see [Hybrid orchestration (default)](#hybrid-orchestration-default).

### Hybrid orchestration (default)

The optimized orchestrator (unless `USE_LEGACY_AI_ORCHESTRATOR=true`) works roughly as follows:

| Stage | Behavior |
|-------|----------|
| **Intent** | Derived from request fields (`travelType`, `budgetRange`, dates/duration, interests`) — **no intent LLM** |
| **Destination content** | Loaded from **`DestinationCatalog`** in MongoDB when `citySlug` matches the destination; otherwise a **synthetic** overview compatible with the rest of the pipeline |
| **Weather** | **Open-Meteo** via coordinates; catalog may store **lat/lng** to skip geocoding for weather |
| **Itinerary** | **Single LLM** call (compact prompt when POIs exist); optional **SSE `itinerary-chunk`** events while streaming |
| **Budget** | **Formula-based** split of the user’s target budget — **no budget LLM** |
| **Cache** | Identical requests may return a cached trip plan for ~1 hour (`TRIP_PLAN_CACHE_*` env vars) |

**Legacy mode:** set **`USE_LEGACY_AI_ORCHESTRATOR=true`** to restore the older sequential flow (Intent LLM → Destination LLM → Itinerary LLM → Budget LLM).

**Seed sample destinations:** `npm run seed:destinations` (populates example catalog rows).

### Mental model

1. **Generate** → AI-only path → user reads itinerary right away.  
2. **Show map** → batch geocoding + cache + parallel workers → pins appear progressively.

## System Flow

### Flow 1: Simple Trip Planning
```
Frontend (Destination + Dates)
  ↓
Backend API (/plan-trip)
  ↓
Orchestrator (hybrid default)
  ├── Intent (derived from request — no LLM)
  ├── Destination bundle (Mongo DestinationCatalog or synthetic HTML — no destination LLM)
  ├── Itinerary Agent (LLM — compact itinerary HTML)
  ├── Weather (Open-Meteo, parallel with itinerary; optional catalog lat/lng)
  └── Budget (formula from target budget — no LLM)
  ↓
Travel APIs + DB + optional trip plan cache
  ↓
Response → UI
```

### Flow 2: Preferences-Based Trip Planning
```
Frontend (Preferences UI)
  ↓
Backend API (/plan-trip-with-preferences)
  ↓
Orchestrator (hybrid default)
  ├── Destination suggestion (if missing — catalog / default city; no destination LLM)
  ├── Intent (derived — no LLM)
  ├── Destination bundle (Mongo or synthetic)
  ├── Itinerary Agent (LLM) ∥ Weather (parallel)
  └── Budget (formula — no LLM)
  ↓
Travel APIs + DB
  ↓
Response → UI (with suggested destination when applicable)
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

### Default (hybrid orchestrator)

| Step | Role |
|------|------|
| **Intent (derived)** | Maps `travelType`, budget fields, dates/duration, and interests into an intent object — **no LLM** |
| **Destination bundle** | **`DestinationCatalog`** in MongoDB supplies attractions/areas/HTML when the city matches; otherwise a **synthetic** bundle compatible with the itinerary step |
| **Itinerary Agent (LLM)** | Builds day-by-day HTML itinerary (compact prompt when POIs exist); only mandatory LLM in the fast path |
| **Weather** | **Open-Meteo**; runs **in parallel** with itinerary when possible; catalog **lat/lng** avoids geocode lookup |
| **Budget (formula)** | Splits the user’s **target** budget across categories — **no LLM** |
| **Optimizer** | Optional step remains **skipped** for latency |

### Legacy mode (`USE_LEGACY_AI_ORCHESTRATOR=true`)

Restores the older sequential pipeline using **Intent**, **Destination**, and **Budget** LLM agents (see agent classes under `src/services/agents/`).

### Step reference (unchanged module)

- **Itinerary Agent** (`src/services/agents/itineraryAgent.js`) — day-by-day HTML itinerary; supports streaming tokens for SSE **`itinerary-chunk`** events.
- **Optimizer Agent** — optional; still disabled in the default pipeline for speed.
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

