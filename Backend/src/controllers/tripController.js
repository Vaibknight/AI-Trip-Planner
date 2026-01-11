const tripService = require('../services/tripService');
const orchestratorService = require('../services/orchestratorService');
const logger = require('../utils/logger');

/**
 * Plan trip using orchestrator (main endpoint following the flow)
 * POST /api/trips/plan-trip
 * Simple flow: destination + days
 */
const planTrip = async (req, res, next) => {
  try {
    const {
      from,
      to,
      origin,
      destination,
      startDate,
      endDate,
      budget,
      currency = 'INR',
      travelers = 1,
      interests = []
    } = req.body;

    // Normalize input (support both 'from/to' and 'origin/destination')
    const tripData = {
      from: from || origin,
      to: to || destination,
      origin: from || origin,
      destination: to || destination,
      startDate,
      endDate,
      budget: parseFloat(budget) || 30000,
      currency,
      travelers: parseInt(travelers) || 1,
      interests: Array.isArray(interests) ? interests : []
    };

    // Progress tracking callback (for SSE or WebSocket in future)
    const progressCallback = (progress) => {
      // In future, this can be sent via SSE or WebSocket
      logger.info('Trip Planning Progress:', progress);
    };

    // Generate trip plan using orchestrator
    const tripPlan = await orchestratorService.planTrip(tripData, progressCallback);

    // Create trip in database
    const trip = await tripService.createTrip(req.userId, tripPlan);

    res.status(201).json({
      status: 'success',
      message: 'Trip planned successfully',
      data: {
        trip,
        // Include HTML itinerary prominently for direct display
        itineraryHtml: trip.itineraryHtml || null
      }
    });
  } catch (error) {
    logger.error('Error planning trip:', error);
    next(error);
  }
};

/**
 * Plan trip with preferences (preferences-based flow) - SSE Streaming Version
 * POST /api/trips/plan-trip-with-preferences
 * Advanced flow: travel type, interests, season, duration, budget range
 * 
 * Usage:
 * - For SSE streaming: Set Accept: text/event-stream header OR add ?stream=true query param
 * - For regular JSON: Use default (no special headers)
 * 
 * SSE Events:
 * - 'connected': Initial connection established
 * - 'progress': Step progress updates (step, status, message)
 * - 'itinerary-day': Day-by-day itinerary content (if available)
 * - 'complete': Final trip data
 * - 'error': Error occurred
 */
const planTripWithPreferences = async (req, res, next) => {
  // Check if client wants SSE (via Accept header or query param)
  const useSSE = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
  
  if (useSSE) {
    return planTripWithPreferencesSSE(req, res, next);
  }
  
  // Original non-streaming version
  return planTripWithPreferencesSync(req, res, next);
};

/**
 * SSE Streaming version - sends real-time progress updates
 */
const planTripWithPreferencesSSE = async (req, res, next) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Helper function to send SSE events
  const sendEvent = (event, data) => {
    // If data is a string, send it directly; otherwise stringify
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\n`);
    res.write(`data: ${dataStr}\n\n`);
  };

  try {
    const {
      destination,
      travelType = 'leisure',
      interests = [],
      season,
      duration,
      amount,
      travelers = 1,
      currency = 'USD'
    } = req.body;

    // Calculate dates based on season if provided
    let calculatedStartDate = null;
    let calculatedEndDate = null;

    if (season) {
      const currentYear = new Date().getFullYear();
      const seasonMonths = {
        spring: { month: 2, day: 21 },
        summer: { month: 5, day: 21 },
        fall: { month: 8, day: 23 },
        winter: { month: 11, day: 21 }
      };
      const seasonDate = seasonMonths[season.toLowerCase()];
      if (seasonDate) {
        calculatedStartDate = new Date(currentYear, seasonDate.month, seasonDate.day);
        calculatedEndDate = new Date(calculatedStartDate);
        calculatedEndDate.setDate(calculatedEndDate.getDate() + parseInt(duration));
      }
    }

    // Use provided amount or default to 50000
    const budgetAmount = amount ? parseFloat(amount) : 50000;

    // Map travel type to travel style
    const travelStyleMap = {
      leisure: 'relaxation',
      business: 'business',
      adventure: 'adventure',
      cultural: 'cultural'
    };
    const travelStyle = travelStyleMap[travelType] || 'cultural';

    const tripData = {
      from: null, // Origin not required for preferences-based planning
      to: destination,
      origin: null, // Origin not required for preferences-based planning
      destination: destination,
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
      budget: budgetAmount,
      currency: currency || 'USD',
      travelers: parseInt(travelers) || 1,
      interests: Array.isArray(interests) ? interests : [],
      travelType,
      travelStyle,
      season,
      duration: parseInt(duration),
      budgetRange: amount ? (amount < 30000 ? 'budget' : amount < 80000 ? 'moderate' : 'luxury') : 'moderate',
      preferencesBased: true
    };

    // Enhanced progress callback that sends SSE events
    const progressCallback = (progress) => {
      logger.info('Preferences Trip Planning Progress:', progress);
      
      // Send progress update via SSE
      sendEvent('progress', {
        step: progress.step,
        status: progress.status,
        message: progress.message
      });

      // If itinerary is being built, send day-by-day updates
      if (progress.step === 'itinerary' && progress.day) {
        sendEvent('itinerary-day', {
          day: progress.day,
          content: progress.content
        });
      }
    };

    // Send initial connection event
    sendEvent('connected', { message: 'Connected to trip planning stream' });

    // Generate trip plan with streaming updates
    const tripPlan = await orchestratorService.planTripWithPreferences(tripData, progressCallback);

    // Create trip in database
    const trip = await tripService.createTrip(req.userId, tripPlan);

    // Send final trip data
    sendEvent('complete', {
      status: 'success',
      message: 'Trip planned successfully',
      data: {
        trip: {
          id: trip._id,
          title: trip.title,
          destination: trip.destination,
          duration: trip.duration,
          itineraryHtml: trip.itineraryHtml
        }
      }
    });

    // Close the connection
    res.end();
  } catch (error) {
    logger.error('Error planning trip with preferences (SSE):', error);
    
    // Send error event
    sendEvent('error', {
      status: 'error',
      message: error.message || 'An error occurred while planning your trip'
    });
    
    res.end();
  }
};

/**
 * Synchronous version (original implementation)
 */
const planTripWithPreferencesSync = async (req, res, next) => {
  try {
    const {
      travelType = 'leisure',
      interests = [],
      season,
      duration,
      budgetRange = 'moderate',
      budgetRangeString,
      origin,
      destinationPreference,
      city, // City selected after country selection
      startDate,
      endDate,
      travelers = 1,
      currency = 'INR'
    } = req.body;

    // Calculate dates based on season and duration if not provided
    let calculatedStartDate = startDate;
    let calculatedEndDate = endDate;

    if (!calculatedStartDate && season) {
      // Calculate start date based on season
      const currentYear = new Date().getFullYear();
      const seasonMonths = {
        spring: { month: 2, day: 21 }, // March 21
        summer: { month: 5, day: 21 }, // June 21
        fall: { month: 8, day: 23 },   // September 23
        winter: { month: 11, day: 21 }  // December 21
      };
      
      const seasonDate = seasonMonths[season.toLowerCase()];
      if (seasonDate) {
        calculatedStartDate = new Date(currentYear, seasonDate.month, seasonDate.day);
      } else {
        calculatedStartDate = new Date(); // Default to today
      }
    } else if (!calculatedStartDate) {
      calculatedStartDate = new Date(); // Default to today
    } else {
      calculatedStartDate = new Date(calculatedStartDate);
    }

    if (!calculatedEndDate && duration) {
      calculatedEndDate = new Date(calculatedStartDate);
      calculatedEndDate.setDate(calculatedEndDate.getDate() + parseInt(duration));
    } else if (calculatedEndDate) {
      calculatedEndDate = new Date(calculatedEndDate);
    }

    // Convert budget range to numeric value
    let budgetAmount = 30000; // Default
    if (budgetRangeString) {
      // Parse budget range string like "$500-$1000" or "₹5000-₹10000"
      const match = budgetRangeString.match(/(\d+)[-–](\d+)/);
      if (match) {
        budgetAmount = (parseInt(match[1]) + parseInt(match[2])) / 2; // Average
      }
    } else {
      // Map budget range to approximate values
      const budgetMap = {
        budget: 20000,
        moderate: 50000,
        luxury: 100000
      };
      budgetAmount = budgetMap[budgetRange] || 30000;
    }

    // Map travel type to travel style
    const travelStyleMap = {
      leisure: 'relaxation',
      business: 'business',
      adventure: 'adventure',
      cultural: 'cultural'
    };
    const travelStyle = travelStyleMap[travelType] || 'cultural';

    // Determine destination: city takes priority, then destinationPreference
    const finalDestination = city || destinationPreference || null;

    // Prepare trip data for orchestrator
    const tripData = {
      from: origin || 'Your Location',
      to: finalDestination, // Use city if provided, otherwise destinationPreference
      origin: origin || 'Your Location',
      destination: finalDestination,
      city: city, // Pass city separately for reference
      destinationPreference: destinationPreference, // Keep original preference for context
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
      budget: budgetAmount,
      currency,
      travelers: parseInt(travelers) || 1,
      interests: Array.isArray(interests) ? interests : [],
      travelType,
      travelStyle,
      season,
      duration: parseInt(duration),
      budgetRange,
      budgetRangeString,
      preferencesBased: true // Flag to indicate this is preferences-based
    };

    // Progress tracking callback
    const progressCallback = (progress) => {
      logger.info('Preferences Trip Planning Progress:', progress);
    };

    // Generate trip plan using orchestrator with preferences
    const tripPlan = await orchestratorService.planTripWithPreferences(tripData, progressCallback);

    // Create trip in database
    const trip = await tripService.createTrip(req.userId, tripPlan);

    res.status(201).json({
      status: 'success',
      message: 'Trip planned successfully based on your preferences',
      data: {
        trip,
        // Include HTML itinerary prominently for direct display
        itineraryHtml: trip.itineraryHtml || null
      }
    });
  } catch (error) {
    logger.error('Error planning trip with preferences:', error);
    next(error);
  }
};

/**
 * Generate trip using AI (legacy endpoint - kept for backward compatibility)
 * Supports both old format (destinations) and new format (from/to)
 */
const generateTrip = async (req, res, next) => {
  try {
    // Normalize input - convert old format to new format if needed
    if (req.body.destinations && !req.body.from && !req.body.to) {
      // Old format: destinations as string or array
      const destinations = Array.isArray(req.body.destinations) 
        ? req.body.destinations 
        : [req.body.destinations];
      
      // Convert to new format
      req.body.from = destinations[0] || '';
      req.body.to = destinations[destinations.length - 1] || destinations[0] || '';
      req.body.origin = req.body.from;
      req.body.destination = req.body.to;
    }
    
    // Convert enum budget to numeric if needed
    if (req.body.budget && ['budget', 'moderate', 'luxury'].includes(req.body.budget)) {
      // Map enum to approximate numeric values (can be adjusted)
      const budgetMap = {
        'budget': 20000,
        'moderate': 50000,
        'luxury': 100000
      };
      req.body.budget = budgetMap[req.body.budget];
    }
    
    // Use the new plan-trip endpoint logic
    return planTrip(req, res, next);
  } catch (error) {
    logger.error('Error generating trip:', error);
    next(error);
  }
};

/**
 * Create a new trip
 */
const createTrip = async (req, res, next) => {
  try {
    const trip = await tripService.createTrip(req.userId, req.body);

    res.status(201).json({
      status: 'success',
      message: 'Trip created successfully',
      data: {
        trip
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all trips for current user
 */
const getMyTrips = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 50,
      skip: parseInt(req.query.skip) || 0
    };

    const result = await tripService.getUserTrips(req.userId, filters);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get trip by ID
 */
const getTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTripById(req.params.id, req.userId);

    res.json({
      status: 'success',
      data: {
        trip
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update trip
 */
const updateTrip = async (req, res, next) => {
  try {
    const trip = await tripService.updateTrip(
      req.params.id,
      req.userId,
      req.body
    );

    res.json({
      status: 'success',
      message: 'Trip updated successfully',
      data: {
        trip
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete trip
 */
const deleteTrip = async (req, res, next) => {
  try {
    await tripService.deleteTrip(req.params.id, req.userId);

    res.json({
      status: 'success',
      message: 'Trip deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update/tweak trip plan
 */
const tweakTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingTrip = await tripService.getTripById(id, req.userId);
    
    const tripData = {
      from: existingTrip.origin || existingTrip.destinations[0]?.city,
      to: existingTrip.destination || existingTrip.destinations[existingTrip.destinations.length - 1]?.city,
      startDate: updates.startDate || existingTrip.startDate,
      endDate: updates.endDate || existingTrip.endDate,
      budget: updates.budget || existingTrip.budget?.total || 30000,
      currency: existingTrip.budget?.currency || 'INR',
      travelers: updates.travelers || existingTrip.travelers || 1,
      interests: updates.interests || existingTrip.preferences?.interests || []
    };

    const progressCallback = (progress) => {
      logger.info('Trip Update Progress:', progress);
    };

    const updatedPlan = await orchestratorService.updateTripPlan(existingTrip.toObject(), tripData);

    const trip = await tripService.updateTrip(id, req.userId, updatedPlan);

    res.json({
      status: 'success',
      message: 'Trip updated successfully',
      data: {
        trip
      }
    });
  } catch (error) {
    logger.error('Error tweaking trip:', error);
    next(error);
  }
};

/**
 * Get trip progress
 */
const getTripProgress = async (req, res, next) => {
  try {
    const trip = await tripService.getTripById(req.params.id, req.userId);

    const progressSteps = [
      { step: 'understanding', status: 'completed', message: 'Understanding your preferences' },
      { step: 'destinations', status: 'completed', message: 'Finding best destinations' },
      { step: 'itinerary', status: trip.itinerary?.length > 0 ? 'completed' : 'pending', message: 'Creating itinerary' },
      { step: 'budget', status: trip.budget ? 'completed' : 'pending', message: 'Estimating budget' },
      { step: 'optimizing', status: trip.status === 'confirmed' ? 'completed' : 'pending', message: 'Optimizing plan' }
    ];

    res.json({
      status: 'success',
      data: {
        progress: progressSteps,
        currentStep: trip.status === 'confirmed' ? 'completed' : 'in_progress',
        tripStatus: trip.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get trip map data
 */
const getTripMap = async (req, res, next) => {
  try {
    const trip = await tripService.getTripById(req.params.id, req.userId);

    const locations = [];
    
    trip.destinations?.forEach(dest => {
      if (dest.city) {
        locations.push({
          name: dest.name || dest.city,
          city: dest.city,
          country: dest.country,
          type: 'destination',
          coordinates: dest.coordinates || null
        });
      }
    });

    trip.itinerary?.forEach(day => {
      day.activities?.forEach(activity => {
        if (activity.location) {
          locations.push({
            name: activity.name,
            location: activity.location,
            type: activity.type,
            day: day.day,
            date: day.date,
            coordinates: activity.coordinates || null
          });
        }
      });
    });

    res.json({
      status: 'success',
      data: {
        trip: {
          id: trip._id,
          title: trip.title,
          origin: trip.origin || trip.destinations[0]?.city,
          destination: trip.destination || trip.destinations[trip.destinations.length - 1]?.city,
          startDate: trip.startDate,
          endDate: trip.endDate
        },
        locations,
        route: {
          origin: trip.origin || trip.destinations[0]?.city,
          destination: trip.destination || trip.destinations[trip.destinations.length - 1]?.city,
          waypoints: trip.destinations?.slice(1, -1).map(d => d.city) || []
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export trip
 */
const exportTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTripById(req.params.id, req.userId);

    const exportData = {
      title: trip.title,
      origin: trip.origin || trip.destinations[0]?.city,
      destination: trip.destination || trip.destinations[trip.destinations.length - 1]?.city,
      duration: `${trip.duration} Days`,
      estimatedCost: `${trip.budget?.currency || 'INR'} ${trip.budget?.total || 0}`,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelers: trip.travelers,
      itinerary: trip.itinerary?.map(day => ({
        day: day.day,
        date: day.date,
        title: day.title,
        activities: day.activities?.map(activity => ({
          name: activity.name,
          description: activity.description,
          location: activity.location,
          time: `${activity.startTime} - ${activity.endTime}`,
          cost: `${activity.cost?.currency || 'INR'} ${activity.cost?.amount || 0}`
        })) || [],
        notes: day.notes
      })) || [],
      budget: {
        total: trip.budget?.total || 0,
        currency: trip.budget?.currency || 'INR',
        breakdown: trip.budget?.breakdown || {}
      },
      highlights: trip.highlights || [],
      tips: trip.tips || [],
      generatedAt: trip.createdAt
    };

    res.json({
      status: 'success',
      data: {
        exportData,
        format: 'pdf',
        downloadUrl: `/api/trips/${trip._id}/export/pdf`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Share trip
 */
const shareTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTripById(req.params.id, req.userId);
    const { shareType = 'link', email, message } = req.body;

    const shareToken = require('crypto').randomBytes(32).toString('hex');
    const shareLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/trip/${trip._id}?share=${shareToken}`;

    const shareData = {
      tripId: trip._id,
      title: trip.title,
      shareLink,
      shareToken,
      shareType,
      sharedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    if (shareType === 'email' && email) {
      logger.info('Trip share email would be sent to:', email);
    }

    res.json({
      status: 'success',
      message: 'Trip shared successfully',
      data: {
        share: shareData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enhance trip
 */
const enhanceTrip = async (req, res, next) => {
  try {
    const trip = await tripService.getTripById(req.params.id, req.userId);
    
    const tripData = {
      from: trip.origin || trip.destinations[0]?.city,
      to: trip.destination || trip.destinations[trip.destinations.length - 1]?.city,
      startDate: trip.startDate,
      endDate: trip.endDate,
      budget: trip.budget?.total || 30000,
      currency: trip.budget?.currency || 'INR',
      travelers: trip.travelers || 1,
      interests: trip.preferences?.interests || []
    };

    const intent = await orchestratorService.intentAgent.analyzeIntent(tripData);
    const destinations = await orchestratorService.destinationAgent.findDestinations(tripData, intent);
    const itinerary = { itinerary: trip.itinerary };
    const budget = trip.budget;
    
    const optimizations = await orchestratorService.optimizerAgent.optimizePlan(
      tripData,
      intent,
      destinations,
      itinerary,
      budget
    );

    res.json({
      status: 'success',
      data: {
        suggestions: optimizations
      }
    });
  } catch (error) {
    logger.error('Error enhancing trip:', error);
    next(error);
  }
};

/**
 * Add activity
 */
const addActivity = async (req, res, next) => {
  try {
    const { dayIndex } = req.params;
    const trip = await tripService.addActivity(
      req.params.id,
      req.userId,
      parseInt(dayIndex),
      req.body
    );

    res.json({
      status: 'success',
      message: 'Activity added successfully',
      data: {
        trip
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update activity
 */
const updateActivity = async (req, res, next) => {
  try {
    const { dayIndex, activityIndex } = req.params;
    const trip = await tripService.updateActivity(
      req.params.id,
      req.userId,
      parseInt(dayIndex),
      parseInt(activityIndex),
      req.body
    );

    res.json({
      status: 'success',
      message: 'Activity updated successfully',
      data: {
        trip
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete activity
 */
const deleteActivity = async (req, res, next) => {
  try {
    const { dayIndex, activityIndex } = req.params;
    const trip = await tripService.deleteActivity(
      req.params.id,
      req.userId,
      parseInt(dayIndex),
      parseInt(activityIndex)
    );

    res.json({
      status: 'success',
      message: 'Activity deleted successfully',
      data: {
        trip
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  planTrip,
  planTripWithPreferences,
  generateTrip,
  createTrip,
  getMyTrips,
  getTrip,
  updateTrip,
  deleteTrip,
  tweakTrip,
  getTripProgress,
  getTripMap,
  exportTrip,
  shareTrip,
  enhanceTrip,
  addActivity,
  updateActivity,
  deleteActivity
};
