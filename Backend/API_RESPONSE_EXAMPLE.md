# API Response Example - Trip Plan

This document shows the structure of the trip plan response that matches your UI format.

## Two API Endpoints

### 1. Simple Flow: `POST /api/trips/plan-trip`
For users who know destination and dates.

### 2. Preferences Flow: `POST /api/trips/plan-trip-with-preferences`
For users who want AI to suggest destinations based on preferences.

Both endpoints return the same response structure.

## Example Response Structure

When you call either endpoint, the response includes day-wise activities like this:

```json
{
  "status": "success",
  "message": "Trip planned successfully",
  "data": {
    "trip": {
      "_id": "65f1234567890abcdef12345",
      "title": "Delhi → Manali",
      "origin": "Delhi",
      "destination": "Manali",
      "duration": 5,
      "startDate": "2024-06-01T00:00:00.000Z",
      "endDate": "2024-06-05T00:00:00.000Z",
      "travelers": 2,
      "budget": {
        "total": 28500,
        "currency": "INR",
        "breakdown": {
          "accommodation": 10000,
          "transportation": 8000,
          "food": 6000,
          "activities": 4000,
          "other": 500
        },
        "perPerson": 14250,
        "perDay": 5700
      },
      "itinerary": [
        {
          "day": 1,
          "date": "2024-06-01T00:00:00.000Z",
          "title": "Arrival & Mall Road",
          "activities": [
            {
              "name": "Check-in at hotel",
              "description": "Arrive and settle into your accommodation",
              "type": "hotel",
              "location": "Hotel address, Manali",
              "timeSlot": "morning",
              "startTime": "10:00",
              "endTime": "11:00",
              "duration": 60,
              "cost": {
                "amount": 0,
                "currency": "INR"
              },
              "notes": ""
            },
            {
              "name": "Visit Mall Road",
              "description": "Explore the famous shopping street of Manali",
              "type": "attraction",
              "location": "Mall Road, Manali",
              "timeSlot": "afternoon",
              "startTime": "14:00",
              "endTime": "17:00",
              "duration": 180,
              "cost": {
                "amount": 500,
                "currency": "INR"
              },
              "notes": "Great for shopping and local food"
            },
            {
              "name": "Dinner at Johnson Cafe",
              "description": "Enjoy local cuisine at a popular restaurant",
              "type": "restaurant",
              "location": "Johnson Cafe, Mall Road, Manali",
              "timeSlot": "evening",
              "startTime": "19:00",
              "endTime": "21:00",
              "duration": 120,
              "cost": {
                "amount": 800,
                "currency": "INR"
              },
              "notes": "Try the local Himachali dishes"
            }
          ],
          "notes": "First day - take it easy and acclimatize",
          "estimatedCost": 1300
        },
        {
          "day": 2,
          "date": "2024-06-02T00:00:00.000Z",
          "title": "Solang Valley",
          "activities": [
            {
              "name": "Paragliding",
              "description": "Experience paragliding over the beautiful valley",
              "type": "activity",
              "location": "Solang Valley, Manali",
              "timeSlot": "morning",
              "startTime": "09:00",
              "endTime": "11:00",
              "duration": 120,
              "cost": {
                "amount": 2500,
                "currency": "INR"
              },
              "notes": "Weather dependent activity"
            },
            {
              "name": "Ropeway ride",
              "description": "Cable car ride with scenic views",
              "type": "activity",
              "location": "Solang Valley Ropeway, Manali",
              "timeSlot": "afternoon",
              "startTime": "14:00",
              "endTime": "15:30",
              "duration": 90,
              "cost": {
                "amount": 600,
                "currency": "INR"
              },
              "notes": "Best views of the valley"
            }
          ],
          "notes": "Adventure day at Solang Valley",
          "estimatedCost": 3100
        },
        {
          "day": 3,
          "date": "2024-06-03T00:00:00.000Z",
          "title": "Rohtang Pass",
          "activities": [
            {
              "name": "Snow activities",
              "description": "Enjoy snow sports and activities",
              "type": "activity",
              "location": "Rohtang Pass, Manali",
              "timeSlot": "morning",
              "startTime": "08:00",
              "endTime": "13:00",
              "duration": 300,
              "cost": {
                "amount": 1500,
                "currency": "INR"
              },
              "notes": "Snow sliding, skiing, and photography"
            },
            {
              "name": "Photography",
              "description": "Capture stunning mountain landscapes",
              "type": "activity",
              "location": "Rohtang Pass viewpoints",
              "timeSlot": "afternoon",
              "startTime": "13:00",
              "endTime": "15:00",
              "duration": 120,
              "cost": {
                "amount": 0,
                "currency": "INR"
              },
              "notes": "Best lighting in the afternoon"
            }
          ],
          "notes": "High altitude day trip - carry warm clothes",
          "estimatedCost": 1500
        }
      ],
      "highlights": [
        "Scenic views of Himalayas",
        "Adventure activities at Solang Valley",
        "Snow experience at Rohtang Pass"
      ],
      "tips": [
        "Carry warm clothes",
        "Book activities in advance",
        "Stay hydrated at high altitudes"
      ],
      "transportation": {
        "recommended": "bus",
        "options": ["bus", "car"],
        "estimatedCost": 2000
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Response Structure Breakdown

### Trip Overview
- `title`: "Delhi → Manali"
- `duration`: 5 (days)
- `budget.total`: ₹28,500
- `origin` and `destination`

### Day-wise Itinerary
Each day in the `itinerary` array contains:
- `day`: Day number (1, 2, 3, etc.)
- `date`: Date of the day
- `title`: Day title (e.g., "Arrival & Mall Road")
- `activities`: Array of activities for that day
- `notes`: Day-specific notes
- `estimatedCost`: Total cost for the day

### Activities Structure
Each activity includes:
- `name`: Activity name (e.g., "Check-in at hotel")
- `description`: Detailed description
- `type`: Type of activity (hotel, restaurant, attraction, activity, transport)
- `location`: Location/address
- `timeSlot`: morning, afternoon, or evening
- `startTime` and `endTime`: Time in HH:MM format
- `duration`: Duration in minutes
- `cost`: Cost object with amount and currency
- `notes`: Additional notes

## Frontend Usage

Your frontend can easily map this structure to display:

```javascript
// Example: Display day-wise activities
trip.itinerary.forEach(day => {
  console.log(`Day ${day.day} - ${day.title}`);
  day.activities.forEach(activity => {
    console.log(`  - ${activity.name} (${activity.startTime} - ${activity.endTime})`);
  });
});
```

## Summary

✅ **Yes, activities are included day-wise** in the API response
✅ Each day has its own `activities` array
✅ Each activity has all details: name, time, location, cost, etc.
✅ The structure matches your UI requirements perfectly

The response is ready to be displayed in your UI exactly as shown in your design!

---

## API Endpoints

Both endpoints return the same response structure:

1. **Simple Flow**: `POST /api/trips/plan-trip`
   - For users who know destination and dates
   - Requires: `from`, `to`, `startDate`, `endDate`

2. **Preferences Flow**: `POST /api/trips/plan-trip-with-preferences`
   - For users who want AI to suggest destinations
   - Requires: `duration`
   - Optional: `travelType`, `interests`, `season`, `budgetRange`, `destinationPreference`
   - AI will suggest destination if not provided

See `API_COMPARISON.md` for detailed comparison and use cases.

