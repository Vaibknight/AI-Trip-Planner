# Testing Server-Sent Events (SSE) for Trip Planning

This guide shows you how to test the SSE streaming implementation for the trip planning endpoint.

## Prerequisites

1. **Get a JWT Token**: First, you need to authenticate and get a JWT token
   ```bash
   # Register/Login to get token
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
   
   # Or login
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   ```

2. **Start the server**: Make sure your backend server is running
   ```bash
   npm start
   # or
   node src/server.js
   ```

## Method 1: Using Node.js Test Script

```bash
# Set your JWT token
export JWT_TOKEN="your_jwt_token_here"

# Run the test script
node test-sse.js

# Or pass token as argument
node test-sse.js your_jwt_token_here
```

## Method 2: Using cURL

```bash
curl -N \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Accept: text/event-stream" \
  -X POST "http://localhost:3000/api/trips/plan-trip-with-preferences?stream=true" \
  -d '{
    "city": "New Delhi",
    "travelType": "leisure",
    "interests": ["history", "food", "nightlife"],
    "season": "winter",
    "duration": 7,
    "budgetRange": "moderate",
    "origin": "New York"
  }'
```

**Note**: The `-N` flag disables buffering so you see events in real-time.

## Method 3: Using JavaScript Fetch API

```javascript
const response = await fetch('/api/trips/plan-trip-with-preferences?stream=true', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${YOUR_JWT_TOKEN}`,
    'Accept': 'text/event-stream'
  },
  body: JSON.stringify({
    city: 'New Delhi',
    travelType: 'leisure',
    interests: ['history', 'food'],
    season: 'winter',
    duration: 7,
    budgetRange: 'moderate',
    origin: 'New York'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const eventType = line.substring(7);
      console.log('Event type:', eventType);
    } else if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6));
      console.log('Data:', data);
    }
  }
}
```

## Expected SSE Events

You should see events in this order:

1. **`connected`**: Initial connection
   ```json
   {"message": "Connected to trip planning stream"}
   ```

2. **`progress`**: Step updates
   ```json
   {"step": "understanding", "status": "in_progress", "message": "Understanding your preferences"}
   {"step": "understanding", "status": "completed", "message": "Understanding your preferences"}
   {"step": "destinations", "status": "in_progress", "message": "Finding best destinations"}
   {"step": "destinations", "status": "completed", "message": "Finding best destinations"}
   {"step": "itinerary", "status": "in_progress", "message": "Creating itinerary"}
   {"step": "itinerary", "status": "completed", "message": "Creating itinerary"}
   {"step": "budget", "status": "in_progress", "message": "Estimating budget"}
   {"step": "budget", "status": "completed", "message": "Estimating budget"}
   ```

3. **`complete`**: Final trip data
   ```json
   {
     "status": "success",
     "message": "Trip planned successfully",
     "data": {
       "trip": {
         "id": "...",
         "title": "...",
         "destination": "...",
         "duration": 7,
         "itineraryHtml": "..."
       }
     }
   }
   ```

4. **`error`**: If something goes wrong
   ```json
   {"status": "error", "message": "Error message here"}
   ```

## Troubleshooting

### No events received
- Check that your JWT token is valid
- Verify the server is running
- Check browser console for CORS errors
- Make sure you're using `?stream=true` or `Accept: text/event-stream` header

### Events not streaming in real-time
- Use `-N` flag with cURL (disables buffering)
- Check if your proxy/load balancer buffers responses
- Verify `X-Accel-Buffering: no` header is set

### CORS issues
- Make sure CORS is configured in your server
- For testing, you can temporarily allow all origins in development

## Testing Non-Streaming Mode

To test the original (non-streaming) mode, just don't include the `stream=true` parameter:

```bash
curl -X POST http://localhost:3000/api/trips/plan-trip-with-preferences \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "city": "New Delhi",
    "duration": 7,
    "season": "winter"
  }'
```

This will return a regular JSON response after ~45 seconds.

