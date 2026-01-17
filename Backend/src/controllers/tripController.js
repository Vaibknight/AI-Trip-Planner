const tripService = require('../services/tripService');
const orchestratorService = require('../services/orchestratorService');
const logger = require('../utils/logger');

/**
 * Calculate trip start and end dates based on arrival time
 * Logic:
 * - If arrival is at night (after 8 PM / 20:00), trip starts next day
 * - If arrival is in afternoon (before 6 PM / 18:00), trip starts same day from evening (6 PM)
 * - If arrival is between 6 PM and 8 PM, trip starts next day
 * @param {string|Date} startDateTime - Arrival date and time (ISO 8601 string or Date object)
 * @param {number} duration - Trip duration in days
 * @returns {Object} - { startDate: Date, endDate: Date }
 */
const calculateTripDatesFromArrival = (startDateTime, duration) => {
  if (!startDateTime) {
    return { startDate: null, endDate: null };
  }

  const arrivalDate = new Date(startDateTime);
  const arrivalHour = arrivalDate.getHours();
  const arrivalMinute = arrivalDate.getMinutes();
  const arrivalTime = arrivalHour * 60 + arrivalMinute; // Convert to minutes for easier comparison
  
  const nightThreshold = 20 * 60; // 8 PM in minutes
  const afternoonThreshold = 18 * 60; // 6 PM in minutes
  
  let tripStartDate = new Date(arrivalDate);
  
  // If arrival is at night (after 8 PM), trip starts next day
  if (arrivalTime >= nightThreshold) {
    tripStartDate.setDate(tripStartDate.getDate() + 1);
    tripStartDate.setHours(9, 0, 0, 0); // Start at 9 AM next day
  } 
  // If arrival is in afternoon (before 6 PM), trip starts same day from evening
  else if (arrivalTime < afternoonThreshold) {
    tripStartDate.setHours(18, 0, 0, 0); // Start at 6 PM same day
  }
  // If arrival is between 6 PM and 8 PM, trip starts next day
  else {
    tripStartDate.setDate(tripStartDate.getDate() + 1);
    tripStartDate.setHours(9, 0, 0, 0); // Start at 9 AM next day
  }
  
  // Calculate end date based on duration
  const tripEndDate = new Date(tripStartDate);
  tripEndDate.setDate(tripEndDate.getDate() + parseInt(duration));
  tripEndDate.setHours(18, 0, 0, 0); // End at 6 PM on last day
  
  return {
    startDate: tripStartDate,
    endDate: tripEndDate
  };
};

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
  // Log incoming request body for debugging
  logger.info('📥 planTripWithPreferences - Request received', {
    body: req.body,
    hasBudgetRangeString: !!req.body.budgetRangeString,
    hasBudgetRange: !!req.body.budgetRange,
    hasAmount: !!req.body.amount,
    budgetRangeString: req.body.budgetRangeString,
    budgetRange: req.body.budgetRange,
    amount: req.body.amount
  });
  
  // Check if client wants SSE (via Accept header or query param)
  const useSSE = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
  
  if (useSSE) {
    logger.info('Using SSE version');
    return planTripWithPreferencesSSE(req, res, next);
  }
  
  // Original non-streaming version
  logger.info('Using sync version');
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
    // Log incoming request body for debugging
    logger.info('📥 SSE version - Raw req.body', {
      state: req.body.state,
      destination: req.body.destination,
      origin: req.body.origin,
      allKeys: Object.keys(req.body)
    });
    
    const {
      destination,
      state, // State/city destination
      origin,
      travelType = 'leisure',
      interests = [],
      season,
      duration,
      amount, // Legacy field
      budgetRange,
      budgetRangeString,
      travelers = 1,
      currency = 'USD',
      startDateTime, // New: arrival date and time
      endDateTime,   // New: departure date and time
      startDate,
      endDate
    } = req.body;
    
    // Log destination payload
    logger.info('📍 SSE Destination payload received', {
      state: state || 'undefined',
      origin: origin || 'undefined',
      destination: destination || 'undefined',
      stateType: typeof state
    });

    // Calculate dates based on arrival time if startDateTime is provided
    let calculatedStartDate = null;
    let calculatedEndDate = null;

    if (startDateTime) {
      // Use arrival time logic to calculate trip dates
      const tripDates = calculateTripDatesFromArrival(startDateTime, duration);
      calculatedStartDate = tripDates.startDate;
      calculatedEndDate = tripDates.endDate;
      
      // If endDateTime is provided, use it instead of calculated end date
      if (endDateTime) {
        calculatedEndDate = new Date(endDateTime);
      }
    } else if (startDate) {
      // Use provided startDate (backward compatibility)
      calculatedStartDate = new Date(startDate);
      if (endDate) {
        calculatedEndDate = new Date(endDate);
      } else if (duration) {
        calculatedEndDate = new Date(calculatedStartDate);
        calculatedEndDate.setDate(calculatedEndDate.getDate() + parseInt(duration));
      }
    } else if (season) {
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

    // Use the same budget parsing logic as sync version
    // Priority: budgetRangeString (if numeric) > budgetRangeString (if range) > amount (legacy) > budgetRange (if numeric) > budgetRange (if enum)
    let budgetAmount = null;
    
    logger.info('SSE Budget parsing started', { 
      budgetRange: budgetRange || 'undefined', 
      budgetRangeString: budgetRangeString || 'undefined',
      amount: amount || 'undefined'
    });
    
    // First priority: Check budgetRangeString
    if (budgetRangeString !== undefined && budgetRangeString !== null && String(budgetRangeString).trim() !== '') {
      const trimmedString = String(budgetRangeString).trim();
      const cleanedString = trimmedString.replace(/[₹$,\s]/g, '');
      const singleNumber = parseFloat(cleanedString);
      if (!isNaN(singleNumber) && singleNumber > 0) {
        budgetAmount = singleNumber;
        logger.info('✅ SSE Budget Range String parsed as single number', { budgetRangeString, budgetAmount });
      } else {
        const match = trimmedString.match(/(\d+)[-–](\d+)/);
        if (match) {
          budgetAmount = (parseInt(match[1]) + parseInt(match[2])) / 2;
          logger.info('✅ SSE Budget Range String parsed as range', { budgetRangeString, budgetAmount });
        }
      }
    }
    
    // Second priority: Check amount (legacy field)
    if (budgetAmount === null && amount !== undefined && amount !== null) {
      const parsedAmount = parseFloat(amount);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        budgetAmount = parsedAmount;
        logger.info('✅ SSE Amount (legacy) parsed', { amount, budgetAmount });
      }
    }
    
    // Third priority: Check budgetRange
    if (budgetAmount === null && budgetRange !== undefined && budgetRange !== null) {
      const trimmedRange = String(budgetRange).trim();
      const cleanedRange = trimmedRange.replace(/[₹$,\s]/g, '');
      const parsedBudget = parseFloat(cleanedRange);
      if (!isNaN(parsedBudget) && parsedBudget > 0) {
        budgetAmount = parsedBudget;
        logger.info('✅ SSE Budget Range parsed as number', { budgetRange, budgetAmount });
      } else {
        const budgetMap = {
          budget: 20000,
          moderate: 50000,
          luxury: 100000
        };
        budgetAmount = budgetMap[trimmedRange.toLowerCase()] || null;
        if (budgetAmount) {
          logger.info('✅ SSE Budget Range mapped from enum', { budgetRange, budgetAmount });
        }
      }
    }
    
    // Default fallback
    if (budgetAmount === null || budgetAmount <= 0) {
      budgetAmount = 30000;
      logger.warn('⚠️ SSE Using default budget amount', { budgetAmount });
    }
    
    logger.info('🎯 SSE Final budget amount calculated', { 
      budgetRange, 
      budgetRangeString, 
      amount,
      budgetAmount, 
      currency 
    });

    // Map travel type to travel style
    const travelStyleMap = {
      leisure: 'relaxation',
      business: 'business',
      adventure: 'adventure',
      cultural: 'cultural'
    };
    const travelStyle = travelStyleMap[travelType] || 'cultural';

    // Determine destination: use state field
    const finalDestination = state || destination || null;
    
    // Log final destination determination
    logger.info('🎯 SSE Final destination determined', {
      state: state,
      destination: destination,
      finalDestination: finalDestination
    });

    const tripData = {
      from: origin || 'Your Location',
      to: finalDestination,
      origin: origin || 'Your Location',
      destination: finalDestination,
      state: state, // Pass state separately for reference
      city: state, // Also set city for backward compatibility with agents
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
      startDateTime: startDateTime ? new Date(startDateTime) : null, // Arrival date and time
      endDateTime: endDateTime ? new Date(endDateTime) : null, // Departure date and time
      budget: budgetAmount,
      currency: currency || 'USD',
      travelers: parseInt(travelers) || 1,
      interests: Array.isArray(interests) ? interests : [],
      travelType,
      travelStyle,
      season,
      duration: parseInt(duration),
      budgetRange: budgetRange || (budgetAmount < 20000 ? 'budget' : budgetAmount < 50000 ? 'moderate' : budgetAmount < 100000 ? 'moderate' : 'luxury'),
      budgetRangeString,
      preferencesBased: true
    };
    
    // Log trip data being sent to orchestrator
    logger.info('🚀 SSE Trip data prepared for orchestrator', {
      destination: tripData.destination,
      state: tripData.state,
      city: tripData.city,
      to: tripData.to,
      origin: tripData.origin,
      budget: tripData.budget,
      currency: tripData.currency,
      duration: tripData.duration
    });

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
    // Log raw request body before destructuring
    logger.info('📥 Sync version - Raw req.body', {
      budgetRangeString: req.body.budgetRangeString,
      budgetRange: req.body.budgetRange,
      amount: req.body.amount,
      allKeys: Object.keys(req.body)
    });
    
    const {
      travelType = 'leisure',
      interests = [],
      season,
      duration,
      budgetRange,
      budgetRangeString,
      origin,
      state, // State/city destination
      startDate,
      endDate,
      startDateTime, // New: arrival date and time
      endDateTime,   // New: departure date and time
      travelers = 1,
      currency = 'INR'
    } = req.body;
    
    // Log destination payload
    logger.info('📍 Destination payload received', {
      state: state || 'undefined',
      origin: origin || 'undefined',
      stateType: typeof state,
      allDestinationFields: {
        state: req.body.state,
        destination: req.body.destination
      }
    });
    
    // Log after destructuring
    logger.info('📥 Sync version - After destructuring', {
      budgetRangeString: budgetRangeString,
      budgetRange: budgetRange,
      state: state,
      budgetRangeStringType: typeof budgetRangeString,
      budgetRangeType: typeof budgetRange
    });

    // Calculate dates based on arrival time if startDateTime is provided
    let calculatedStartDate = null;
    let calculatedEndDate = null;

    if (startDateTime) {
      // Use arrival time logic to calculate trip dates
      const tripDates = calculateTripDatesFromArrival(startDateTime, duration);
      calculatedStartDate = tripDates.startDate;
      calculatedEndDate = tripDates.endDate;
      
      // If endDateTime is provided, use it instead of calculated end date
      if (endDateTime) {
        calculatedEndDate = new Date(endDateTime);
      }
    } else if (startDate) {
      // Use provided startDate (backward compatibility)
      calculatedStartDate = new Date(startDate);
      if (endDate) {
        calculatedEndDate = new Date(endDate);
      } else if (duration) {
        calculatedEndDate = new Date(calculatedStartDate);
        calculatedEndDate.setDate(calculatedEndDate.getDate() + parseInt(duration));
      }
    } else if (season) {
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
      
      if (duration) {
        calculatedEndDate = new Date(calculatedStartDate);
        calculatedEndDate.setDate(calculatedEndDate.getDate() + parseInt(duration));
      }
    } else {
      // Default to today
      calculatedStartDate = new Date();
      if (duration) {
        calculatedEndDate = new Date(calculatedStartDate);
        calculatedEndDate.setDate(calculatedEndDate.getDate() + parseInt(duration));
      }
    }

    // Convert budget range to numeric value
    // Priority: budgetRangeString (if numeric) > budgetRangeString (if range) > budgetRange (if numeric) > budgetRange (if enum)
    let budgetAmount = null; // Use null to track if we've found a valid budget
    
    logger.info('Budget parsing started', { 
      budgetRange: budgetRange || 'undefined', 
      budgetRangeString: budgetRangeString || 'undefined',
      budgetRangeType: typeof budgetRange,
      budgetRangeStringType: typeof budgetRangeString
    });
    
    // First priority: Check budgetRangeString
    if (budgetRangeString !== undefined && budgetRangeString !== null && String(budgetRangeString).trim() !== '') {
      const trimmedString = String(budgetRangeString).trim();
      // First try to parse as a single number (e.g., "10000", "₹10000", "$10000")
      const cleanedString = trimmedString.replace(/[₹$,\s]/g, '');
      const singleNumber = parseFloat(cleanedString);
      logger.info('Attempting to parse budgetRangeString', { 
        original: budgetRangeString, 
        trimmed: trimmedString, 
        cleaned: cleanedString, 
        parsed: singleNumber,
        isValid: !isNaN(singleNumber) && singleNumber > 0
      });
      
      if (!isNaN(singleNumber) && singleNumber > 0) {
        budgetAmount = singleNumber;
        logger.info('✅ Budget Range String parsed as single number', { budgetRangeString, budgetAmount });
      } else {
        // Try to parse as range string like "$500-$1000" or "₹5000-₹10000"
        const match = trimmedString.match(/(\d+)[-–](\d+)/);
        if (match) {
          budgetAmount = (parseInt(match[1]) + parseInt(match[2])) / 2; // Average
          logger.info('✅ Budget Range String parsed as range', { budgetRangeString, budgetAmount });
        } else {
          logger.warn('❌ Budget Range String could not be parsed', { budgetRangeString });
        }
      }
    } else {
      logger.info('Budget Range String is empty or undefined', { budgetRangeString });
    }
    
    // Second priority: Check budgetRange if budgetRangeString didn't yield a valid amount
    if (budgetAmount === null && budgetRange !== undefined && budgetRange !== null) {
      const trimmedRange = String(budgetRange).trim();
      // Try to parse budgetRange as a number (for free-form input like "10000")
      const cleanedRange = trimmedRange.replace(/[₹$,\s]/g, '');
      const parsedBudget = parseFloat(cleanedRange);
      logger.info('Attempting to parse budgetRange', { 
        original: budgetRange, 
        trimmed: trimmedRange, 
        cleaned: cleanedRange, 
        parsed: parsedBudget,
        isValid: !isNaN(parsedBudget) && parsedBudget > 0
      });
      
      if (!isNaN(parsedBudget) && parsedBudget > 0) {
        budgetAmount = parsedBudget;
        logger.info('✅ Budget Range parsed as number', { budgetRange, budgetAmount });
      } else {
        // Fallback to enum mapping for backward compatibility
        const budgetMap = {
          budget: 20000,
          moderate: 50000,
          luxury: 100000
        };
        budgetAmount = budgetMap[trimmedRange.toLowerCase()] || null;
        if (budgetAmount) {
          logger.info('✅ Budget Range mapped from enum', { budgetRange, budgetAmount });
        } else {
          logger.warn('❌ Budget Range could not be parsed or mapped', { budgetRange });
        }
      }
    } else if (budgetAmount === null) {
      logger.info('Budget Range is empty or undefined', { budgetRange });
    }
    
    // Default fallback
    if (budgetAmount === null || budgetAmount <= 0) {
      budgetAmount = 30000;
      logger.warn('⚠️ Using default budget amount', { budgetAmount });
    }
    
    logger.info('🎯 Final budget amount calculated', { 
      budgetRange: budgetRange || 'undefined', 
      budgetRangeString: budgetRangeString || 'undefined', 
      budgetAmount, 
      currency 
    });

    // Map travel type to travel style
    const travelStyleMap = {
      leisure: 'relaxation',
      business: 'business',
      adventure: 'adventure',
      cultural: 'cultural'
    };
    const travelStyle = travelStyleMap[travelType] || 'cultural';

    // Determine destination: use state field
    const finalDestination = state || null;
    
    // Log final destination determination
    logger.info('🎯 Final destination determined', {
      state: state,
      finalDestination: finalDestination
    });

    // Prepare trip data for orchestrator
    const tripData = {
      from: origin || 'Your Location',
      to: finalDestination,
      origin: origin || 'Your Location',
      destination: finalDestination,
      state: state, // Pass state separately for reference
      city: state, // Also set city for backward compatibility with agents
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
      startDateTime: startDateTime ? new Date(startDateTime) : null, // Arrival date and time
      endDateTime: endDateTime ? new Date(endDateTime) : null, // Departure date and time
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
