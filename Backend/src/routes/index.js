const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const tripRoutes = require('./trip.routes');

// API information endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Trip Planner API',
    version: '1.0.0',
    documentation: 'See API_ENDPOINTS.md for complete documentation',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        getMe: 'GET /api/auth/me',
        updateMe: 'PUT /api/auth/me'
      },
      trips: {
        planTrip: 'POST /api/trips/plan-trip - Simple trip planning (destination + days)',
        planTripWithPreferences: 'POST /api/trips/plan-trip-with-preferences - Preferences-based planning (travel type, interests, season, etc.)',
        generate: 'POST /api/trips/generate - Legacy trip generation',
        create: 'POST /api/trips - Create custom trip',
        getAll: 'GET /api/trips - Get all user trips',
        getOne: 'GET /api/trips/:id - Get trip by ID',
        update: 'PUT /api/trips/:id - Update trip',
        delete: 'DELETE /api/trips/:id - Delete trip',
        tweak: 'PUT /api/trips/:id/tweak - Update and re-plan trip',
        progress: 'GET /api/trips/:id/progress - Get planning progress',
        map: 'GET /api/trips/:id/map - Get map data',
        export: 'GET /api/trips/:id/export - Export trip data',
        share: 'POST /api/trips/:id/share - Share trip',
        enhance: 'POST /api/trips/:id/enhance - Get AI suggestions',
        addActivity: 'POST /api/trips/:id/days/:dayIndex/activities - Add activity',
        updateActivity: 'PUT /api/trips/:id/days/:dayIndex/activities/:activityIndex - Update activity',
        deleteActivity: 'DELETE /api/trips/:id/days/:dayIndex/activities/:activityIndex - Delete activity'
      },
      utility: {
        apiInfo: 'GET /api - This endpoint',
        health: 'GET /health - Health check',
        root: 'GET / - Welcome message'
      }
    },
    quickReference: {
      'Authentication': [
        'POST /api/auth/register - Register new user',
        'POST /api/auth/login - Login user',
        'GET /api/auth/me - Get current user (Auth Required)',
        'PUT /api/auth/me - Update user (Auth Required)'
      ],
      'Trip Planning': [
        'POST /api/trips/plan-trip - Plan trip with AI (Auth Required)',
        'PUT /api/trips/:id/tweak - Update trip parameters (Auth Required)',
        'GET /api/trips/:id/progress - Get planning progress (Auth Required)'
      ],
      'Trip Management': [
        'GET /api/trips - Get all trips (Auth Required)',
        'GET /api/trips/:id - Get trip details (Auth Required)',
        'POST /api/trips - Create custom trip (Auth Required)',
        'PUT /api/trips/:id - Update trip (Auth Required)',
        'DELETE /api/trips/:id - Delete trip (Auth Required)'
      ],
      'Trip Views & Export': [
        'GET /api/trips/:id/map - Get map data (Auth Required)',
        'GET /api/trips/:id/export - Export trip (Auth Required)',
        'POST /api/trips/:id/share - Share trip (Auth Required)'
      ],
      'Itinerary Management': [
        'POST /api/trips/:id/days/:dayIndex/activities - Add activity (Auth Required)',
        'PUT /api/trips/:id/days/:dayIndex/activities/:activityIndex - Update activity (Auth Required)',
        'DELETE /api/trips/:id/days/:dayIndex/activities/:activityIndex - Delete activity (Auth Required)'
      ]
    }
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/trips', tripRoutes);

module.exports = router;
