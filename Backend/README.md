# Trip Planner Backend - AI-Powered Travel Planning API

A production-ready Node.js backend API for an AI-powered trip planning application. Built with Express.js, MongoDB, and OpenRouter integration.

## 🚀 Features

- **AI-Powered Trip Generation** - Generate personalized trip itineraries using OpenRouter (supports GPT-4, Claude, and more)
- **RESTful API** - Clean, well-structured REST endpoints
- **Authentication & Authorization** - JWT-based authentication system
- **Database Integration** - MongoDB with Mongoose ODM
- **Input Validation** - Request validation using express-validator
- **Error Handling** - Comprehensive error handling middleware
- **Security** - Helmet.js, CORS, rate limiting
- **Logging** - Winston logger for structured logging
- **Code Quality** - Separation of concerns, service layer architecture

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── config.js        # App configuration
│   │   └── database.js      # Database connection
│   ├── controllers/         # Route controllers
│   │   ├── authController.js
│   │   └── tripController.js
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js         # Authentication middleware
│   │   ├── errorHandler.js # Error handling
│   │   ├── notFound.js     # 404 handler
│   │   └── validate.js     # Validation middleware
│   ├── models/              # Mongoose models
│   │   ├── User.js
│   │   └── Trip.js
│   ├── routes/              # API routes
│   │   ├── auth.routes.js
│   │   ├── trip.routes.js
│   │   └── index.js
│   ├── services/            # Business logic layer
│   │   ├── openRouterClient.js  # OpenRouter integration
│   │   ├── orchestratorService.js  # AI orchestrator
│   │   ├── tripService.js  # Trip operations
│   │   └── userService.js  # User operations
│   ├── utils/               # Utility functions
│   │   ├── jwt.js          # JWT helpers
│   │   └── logger.js       # Winston logger
│   ├── validators/          # Validation schemas
│   │   ├── tripValidator.js
│   │   └── userValidator.js
│   └── server.js            # Main server file
├── logs/                    # Log files (gitignored)
├── .env                     # Environment variables (gitignored)
├── .env.example             # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## 🛠️ Installation

1. **Clone the repository and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your configuration
```

3. **Start MongoDB:**
   - Make sure MongoDB is running locally, or
   - Update `MONGODB_URI` in `.env` with your MongoDB connection string

4. **Run the application:**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/trip-planner

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d

# OpenRouter (AI Model Provider)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-4  # Optional: Override default model selection
USE_PAID=true  # Set to 'true' to use paid model (openai/gpt-oss-20b), otherwise uses free model
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_NAME=Trip Planner

# Legacy OpenAI (optional, for backward compatibility)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=*
```

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/me` - Update current user (protected)

### Trips

- `POST /api/trips/plan-trip` - Plan trip (simple: destination + days) (protected)
- `POST /api/trips/plan-trip-with-preferences` - Plan trip with preferences (travel type, interests, season, etc.) (protected)
- `POST /api/trips/generate` - Generate trip using AI (legacy) (protected)
- `POST /api/trips` - Create a new trip (protected)
- `GET /api/trips` - Get all user trips (protected)
- `GET /api/trips/:id` - Get trip by ID (protected)
- `PUT /api/trips/:id` - Update trip (protected)
- `DELETE /api/trips/:id` - Delete trip (protected)
- `PUT /api/trips/:id/tweak` - Update and re-plan trip (protected)
- `GET /api/trips/:id/progress` - Get planning progress (protected)
- `GET /api/trips/:id/map` - Get map data (protected)
- `GET /api/trips/:id/export` - Export trip data (protected)
- `POST /api/trips/:id/share` - Share trip (protected)
- `POST /api/trips/:id/enhance` - Get AI suggestions for trip (protected)

### Itinerary Management

- `POST /api/trips/:id/days/:dayIndex/activities` - Add activity (protected)
- `PUT /api/trips/:id/days/:dayIndex/activities/:activityIndex` - Update activity (protected)
- `DELETE /api/trips/:id/days/:dayIndex/activities/:activityIndex` - Delete activity (protected)

### Utility

- `GET /` - Welcome message
- `GET /health` - Health check
- `GET /api` - API documentation

## 📝 API Usage Examples

### Register User
```bash
POST /api/auth/register
Content-Type: application/json

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

### Plan Trip (Simple Flow - Destination + Days)
```bash
POST /api/trips/plan-trip
Authorization: Bearer <token>
Content-Type: application/json

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

### Plan Trip with Preferences (Advanced Flow)
```bash
POST /api/trips/plan-trip-with-preferences
Authorization: Bearer <token>
Content-Type: application/json

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

**Note:** The preferences API will suggest destinations if `destinationPreference` is not provided, and automatically calculate dates based on the selected `season`.

### Create Custom Trip
```bash
POST /api/trips
Authorization: Bearer <token>
Content-Type: application/json

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

## 🏗️ Architecture

This project follows a **layered architecture** pattern:

1. **Routes Layer** - Define API endpoints and apply middleware
2. **Controllers Layer** - Handle HTTP requests/responses
3. **Services Layer** - Business logic and external API integration
4. **Models Layer** - Database schemas and data models
5. **Middleware** - Authentication, validation, error handling

### Key Design Principles

- **Separation of Concerns** - Each layer has a specific responsibility
- **Dependency Injection** - Services are injected into controllers
- **Error Handling** - Centralized error handling middleware
- **Validation** - Input validation at the route level
- **Security** - Authentication, rate limiting, helmet.js
- **Logging** - Structured logging with Winston

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization
- Error message sanitization in production

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests in watch mode
npm run test:watch
```

## 📊 Logging

Logs are stored in the `logs/` directory:
- `error.log` - Error level logs
- `combined.log` - All logs

Logs are also output to console in development mode.

## 🚀 Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a strong `JWT_SECRET`
3. Configure MongoDB connection string
4. Set up proper CORS origins
5. Configure rate limiting appropriately
6. Use a process manager like PM2

## 📚 Technologies Used

- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **OpenRouter** - AI model access (supports GPT-4, Claude, and more)
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **Winston** - Logging
- **Helmet** - Security
- **CORS** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting

## 🤝 Contributing

1. Follow the existing code structure
2. Maintain separation of concerns
3. Add validation for new endpoints
4. Write tests for new features
5. Update documentation

## 📄 License

ISC

