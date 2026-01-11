const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createTripValidator,
  updateTripValidator,
  generateTripValidator
} = require('../validators/tripValidator');
const { planTripValidator } = require('../validators/planTripValidator');
const { preferencesTripValidator } = require('../validators/preferencesTripValidator');

// All trip routes require authentication
router.use(authenticate);

// Main trip planning endpoint (simple flow: destination + days)
router.post('/plan-trip', planTripValidator, validate, tripController.planTrip);

// Preferences-based trip planning endpoint (advanced flow: travel type, interests, season, etc.)
router.post('/plan-trip-with-preferences', preferencesTripValidator, validate, tripController.planTripWithPreferences);

// AI-powered trip generation (legacy endpoint)
router.post('/generate', generateTripValidator, validate, tripController.generateTrip);

// CRUD operations
router.post('/', createTripValidator, validate, tripController.createTrip);
router.get('/', tripController.getMyTrips);
router.get('/:id', tripController.getTrip);
router.put('/:id', updateTripValidator, validate, tripController.updateTrip);
router.delete('/:id', tripController.deleteTrip);

// Trip update/tweak
router.put('/:id/tweak', tripController.tweakTrip);

// Trip progress tracking
router.get('/:id/progress', tripController.getTripProgress);

// Trip views and exports
router.get('/:id/map', tripController.getTripMap);
router.get('/:id/export', tripController.exportTrip);
router.post('/:id/share', tripController.shareTrip);

// Trip enhancement
router.post('/:id/enhance', tripController.enhanceTrip);

// Itinerary management
router.post('/:id/days/:dayIndex/activities', tripController.addActivity);
router.put('/:id/days/:dayIndex/activities/:activityIndex', tripController.updateActivity);
router.delete('/:id/days/:dayIndex/activities/:activityIndex', tripController.deleteActivity);

module.exports = router;

