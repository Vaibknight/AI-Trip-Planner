# API Comparison Guide

This document helps you choose between the two trip planning APIs based on your use case.

## Two Trip Planning APIs

### 1. Simple API: Destination + Days
**Endpoint:** `POST /api/trips/plan-trip`

**Use this when:**
- ✅ User knows exactly where they want to go
- ✅ User has specific dates in mind
- ✅ User wants a quick trip plan for a known destination
- ✅ Building a simple trip planner UI

**Required Fields:**
- `from` / `origin` - Starting location
- `to` / `destination` - Destination
- `startDate` - Trip start date
- `endDate` - Trip end date

**Optional Fields:**
- `budget` - Numeric budget amount
- `currency` - Currency code (default: INR)
- `travelers` - Number of travelers (default: 1)
- `interests` - Array of interests

**Example Request:**
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

---

### 2. Preferences-Based API: AI Suggests Everything
**Endpoint:** `POST /api/trips/plan-trip-with-preferences`

**Use this when:**
- ✅ User doesn't know where to go
- ✅ User wants AI to suggest destinations
- ✅ User prefers to select by season rather than specific dates
- ✅ User wants to plan based on travel style and interests
- ✅ Building an advanced trip planner with preferences UI

**Required Fields:**
- `duration` - Number of days (1-30)

**Optional Fields:**
- `travelType` - `leisure`, `business`, `adventure`, `cultural` (default: `leisure`)
- `interests` - Array of interests
- `season` - `spring`, `summer`, `fall`, `winter` (auto-calculates dates)
- `budgetRange` - `budget`, `moderate`, `luxury` (default: `moderate`)
- `budgetRangeString` - Budget range like `"$500-$1000"`
- `origin` - Starting location (optional)
- `destinationPreference` - Preferred destination/region (optional - AI suggests if not provided)
- `travelers` - Number of travelers (default: 1)
- `currency` - Currency code (default: INR)
- `startDate` - Start date (optional - auto-calculated from season)
- `endDate` - End date (optional - auto-calculated from startDate + duration)

**Example Request:**
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
  "travelers": 2,
  "currency": "USD"
}
```

**Special Features:**
- 🎯 **AI Destination Suggestion**: If `destinationPreference` is not provided, AI will suggest destinations based on preferences
- 📅 **Auto Date Calculation**: Dates are automatically calculated from `season` and `duration`
- 💰 **Flexible Budget**: Accepts both enum (`budget`, `moderate`, `luxury`) and range strings (`"$500-$1000"`)

---

## Comparison Table

| Feature | Simple API | Preferences API |
|---------|-----------|-----------------|
| **Destination** | Required | Optional (AI suggests) |
| **Dates** | Required | Auto-calculated from season |
| **Travel Type** | Not used | Used for planning |
| **Season** | Not used | Used for date calculation |
| **Duration** | Calculated from dates | Required input |
| **Budget** | Numeric amount | Range (enum or string) |
| **Use Case** | Known destination | Need suggestions |
| **UI Complexity** | Simple form | Advanced preferences form |

---

## Response Structure

Both APIs return the **same response structure**:

```json
{
  "status": "success",
  "message": "Trip planned successfully",
  "data": {
    "trip": {
      "title": "Origin → Destination",
      "duration": 5,
      "budget": { ... },
      "itinerary": [
        {
          "day": 1,
          "title": "Day title",
          "activities": [ ... ]
        }
      ],
      "highlights": [ ... ],
      "tips": [ ... ]
    }
  }
}
```

---

## When to Use Which API

### Use Simple API (`/plan-trip`) when:
- User fills out: "I want to go from X to Y on these dates"
- Building a traditional trip planner
- User has destination and dates ready
- Quick trip planning workflow

### Use Preferences API (`/plan-trip-with-preferences`) when:
- User fills out: "I want a leisure trip in winter for 7 days, interested in history and food"
- Building an AI-powered trip discovery tool
- User needs destination suggestions
- Advanced preferences-based planning
- Matching the UI shown in your screenshots

---

## Migration Guide

If you're currently using `/plan-trip` and want to switch to preferences-based:

1. Update your UI to collect preferences instead of destination/dates
2. Change endpoint to `/plan-trip-with-preferences`
3. Map your UI fields:
   - Travel Type dropdown → `travelType`
   - Interests tags → `interests` array
   - Season dropdown → `season`
   - Duration slider → `duration`
   - Budget Range dropdown → `budgetRange` or `budgetRangeString`
4. Remove destination/date inputs (or make them optional)

---

## Code Examples

### Frontend: Simple API
```javascript
const response = await fetch('/api/trips/plan-trip', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: 'Delhi',
    to: 'Manali',
    startDate: '2024-06-01',
    endDate: '2024-06-05',
    budget: 30000,
    travelers: 2,
    interests: ['nature', 'adventure']
  })
});
```

### Frontend: Preferences API
```javascript
const response = await fetch('/api/trips/plan-trip-with-preferences', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    travelType: 'leisure',
    interests: ['history', 'nightlife', 'food'],
    season: 'winter',
    duration: 7,
    budgetRange: 'luxury',
    origin: 'New York',
    destinationPreference: 'Europe',
    travelers: 2
  })
});
```

---

## Summary

- **Simple API**: For users who know where and when
- **Preferences API**: For users who need AI suggestions based on preferences
- Both return the same response structure
- Choose based on your UI requirements and user workflow









