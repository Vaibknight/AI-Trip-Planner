const openRouterClient = require('./openRouterClient');
const config = require('../config/config');
const logger = require('../utils/logger');
const IntentAgent = require('./agents/intentAgent');
const DestinationAgent = require('./agents/destinationAgent');
const ItineraryAgent = require('./agents/itineraryAgent');
const BudgetAgent = require('./agents/budgetAgent');
const OptimizerAgent = require('./agents/optimizerAgent');

class OrchestratorService {
  constructor() {
    if (!config.openRouterApiKey) {
      logger.warn('OpenRouter API key not found. AI features will be disabled.');
      this.client = null;
    } else {
      this.client = openRouterClient;
    }

    // Initialize agents
    if (this.client) {
      this.intentAgent = new IntentAgent();
      this.destinationAgent = new DestinationAgent();
      this.itineraryAgent = new ItineraryAgent();
      this.budgetAgent = new BudgetAgent();
      this.optimizerAgent = new OptimizerAgent();
    }
  }

  /**
   * Orchestrate the complete trip planning process
   * @param {Object} tripData - User trip input
   * @param {Function} progressCallback - Callback to report progress
   * @returns {Promise<Object>} Complete trip plan
   */
  async planTrip(tripData, progressCallback = null) {
    if (!this.client) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // Step 1: Understanding preferences
      if (progressCallback) {
        progressCallback({
          step: 'understanding',
          status: 'in_progress',
          message: 'Understanding your preferences'
        });
      }
      const intent = await this.intentAgent.analyzeIntent(tripData);
      
      if (progressCallback) {
        progressCallback({
          step: 'understanding',
          status: 'completed',
          message: 'Understanding your preferences'
        });
      }

      // Step 2: Finding best destinations
      if (progressCallback) {
        progressCallback({
          step: 'destinations',
          status: 'in_progress',
          message: 'Finding best destinations'
        });
      }
      const destinations = await this.destinationAgent.findDestinations(tripData, intent);
      
      if (progressCallback) {
        progressCallback({
          step: 'destinations',
          status: 'completed',
          message: 'Finding best destinations'
        });
      }

      // Step 3: Creating itinerary
      if (progressCallback) {
        progressCallback({
          step: 'itinerary',
          status: 'in_progress',
          message: 'Creating itinerary'
        });
      }
      
      let itinerary;
      try {
        itinerary = await this.itineraryAgent.createItinerary(tripData, intent, destinations);
        
        // Validate we got a proper itinerary
        if (!itinerary || !itinerary.itinerary || !Array.isArray(itinerary.itinerary) || itinerary.itinerary.length === 0) {
          logger.error('Orchestrator: Itinerary agent returned empty/invalid itinerary', {
            itinerary: itinerary,
            tripData: { city: tripData.city, destination: tripData.to }
          });
          throw new Error('Itinerary agent returned empty or invalid response');
        }
        
        logger.info('Orchestrator: Itinerary created successfully', {
          days: itinerary.itinerary.length,
          totalActivities: itinerary.itinerary.reduce((sum, day) => sum + (day.activities?.length || 0), 0)
        });
      } catch (itineraryError) {
        logger.error('Orchestrator: Failed to create itinerary - WILL USE FALLBACK', {
          error: itineraryError.message,
          errorName: itineraryError.name,
          stack: itineraryError.stack,
          city: tripData.city || tripData.to,
          destination: tripData.to || tripData.destination,
          willUseFallback: true,
          NOTE: 'Check logs above for detailed error from Itinerary Agent'
        });
        // Set itinerary to empty so fallback will be used
        itinerary = { itinerary: [], highlights: [], tips: [] };
      }
      
      if (progressCallback) {
        progressCallback({
          step: 'itinerary',
          status: 'completed',
          message: 'Creating itinerary'
        });
      }

      // Step 4: Estimating budget
      if (progressCallback) {
        progressCallback({
          step: 'budget',
          status: 'in_progress',
          message: 'Estimating budget'
        });
      }
      const budget = await this.budgetAgent.estimateBudget(tripData, intent, destinations, itinerary);
      
      if (progressCallback) {
        progressCallback({
          step: 'budget',
          status: 'completed',
          message: 'Estimating budget'
        });
      }

      // Step 5: Optimizing plan (SKIPPED for speed - optional step)
      // Skipping optimizer to reduce response time - can be enabled if needed
      const optimizations = {
        optimizations: [],
        alternativeActivities: [],
        routeOptimization: { suggested: false, changes: [] },
        finalRecommendations: []
      };
      
      // Uncomment below to enable optimizer (adds ~5-10 seconds)
      /*
      if (progressCallback) {
        progressCallback({
          step: 'optimizing',
          status: 'in_progress',
          message: 'Optimizing plan'
        });
      }
      
      try {
        optimizations = await this.optimizerAgent.optimizePlan(tripData, intent, destinations, itinerary, budget);
        logger.info('Orchestrator: Optimization completed successfully');
      } catch (optimizerError) {
        logger.warn('Orchestrator: Optimization step failed, continuing without optimizations', {
          error: optimizerError.message
        });
      }
      
      if (progressCallback) {
        progressCallback({
          step: 'optimizing',
          status: 'completed',
          message: 'Optimizing plan'
        });
      }
      */

      // Compile final trip plan
      const tripPlan = this.compileTripPlan(tripData, intent, destinations, itinerary, budget, optimizations);

      logger.info('Orchestrator: Trip plan completed', { tripId: tripPlan.id });
      return tripPlan;
    } catch (error) {
      logger.error('Orchestrator Error:', error);
      throw new Error(`Trip planning failed: ${error.message}`);
    }
  }

  /**
   * Compile all agent outputs into a complete trip plan
   */
  compileTripPlan(tripData, intent, destinations, itinerary, budget, optimizations) {
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Format itinerary days with dates
    let formattedItinerary = [];
    
    if (itinerary && itinerary.itinerary && Array.isArray(itinerary.itinerary) && itinerary.itinerary.length > 0) {
      formattedItinerary = itinerary.itinerary.map((day, index) => {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + index);
        
        return {
          date: dayDate,
          day: day.day || index + 1,
          title: day.title || `Day ${index + 1}`,
          activities: Array.isArray(day.activities) ? day.activities : [],
          notes: day.notes || '',
          estimatedCost: day.estimatedCost || 0
        };
      });
    } else {
      // Fallback: Create basic itinerary structure if AI didn't generate one
      logger.warn('Itinerary is empty, creating fallback structure');
      formattedItinerary = this.createFallbackItinerary(tripData, intent, destinations, duration, startDate);
    }

    // Format destinations
    const formattedDestinations = destinations.route?.length > 0 
      ? destinations.route.map(route => ({
          name: route.name || route.city,
          city: route.city,
          country: route.country || '',
          order: route.order,
          stayDuration: route.stayDuration
        }))
      : [{
          name: destinations.mainDestination.name || destinations.mainDestination.city,
          city: destinations.mainDestination.city,
          country: destinations.mainDestination.country || '',
          description: destinations.mainDestination.description || ''
        }];

    return {
      title: `${tripData.from || tripData.origin} → ${destinations.mainDestination.name}`,
      description: `A ${duration}-day ${intent.travelStyle} trip to ${destinations.mainDestination.name}`,
      origin: tripData.from || tripData.origin,
      destination: destinations.mainDestination.name,
      destinations: formattedDestinations,
      startDate,
      endDate,
      duration,
      travelers: tripData.travelers || 1,
      budget: {
        total: budget.total,
        currency: budget.currency,
        breakdown: budget.breakdown,
        perPerson: budget.perPerson,
        perDay: budget.perDay,
        status: budget.budgetStatus,
        variance: budget.variance,
        optimizations: budget.optimizations
      },
      itinerary: formattedItinerary,
      preferences: {
        budget: intent.budgetCategory,
        travelStyle: intent.travelStyle,
        interests: intent.priorityInterests,
        purpose: intent.purpose
      },
      transportation: destinations.transportation,
      highlights: itinerary.highlights || [],
      tips: itinerary.tips || [],
      optimizations: optimizations.optimizations || [],
      alternativeActivities: optimizations.alternativeActivities || [],
      recommendations: optimizations.finalRecommendations || [],
      // HTML itinerary content (new format)
      itineraryHtml: itinerary.html || null,
      aiGenerated: true,
      status: 'confirmed',
      createdAt: new Date()
    };
  }

  /**
   * Create fallback itinerary when AI doesn't generate one
   */
  createFallbackItinerary(tripData, intent, destinations, duration, startDate) {
    const itinerary = [];
    const destinationName = destinations.mainDestination?.name || destinations.mainDestination?.city || tripData.to || 'Destination';
    
    for (let i = 0; i < duration; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);
      
      let title = '';
      let activities = [];
      
      if (i === 0) {
        title = `Arrival & Exploration`;
        activities = [
          {
            name: 'Check-in at hotel',
            description: 'Arrive and settle into your accommodation',
            type: 'hotel',
            location: destinationName,
            timeSlot: 'morning',
            startTime: '10:00',
            endTime: '11:00',
            duration: 60,
            cost: { amount: 0, currency: tripData.currency || 'INR' },
            notes: ''
          },
          {
            name: `Explore ${destinationName}`,
            description: 'Get familiar with the area',
            type: 'attraction',
            location: destinationName,
            timeSlot: 'afternoon',
            startTime: '14:00',
            endTime: '17:00',
            duration: 180,
            cost: { amount: 500, currency: tripData.currency || 'INR' },
            notes: ''
          }
        ];
      } else if (i === duration - 1) {
        title = 'Departure';
        activities = [
          {
            name: 'Check-out from hotel',
            description: 'Final day - prepare for departure',
            type: 'hotel',
            location: destinationName,
            timeSlot: 'morning',
            startTime: '10:00',
            endTime: '11:00',
            duration: 60,
            cost: { amount: 0, currency: tripData.currency || 'INR' },
            notes: ''
          }
        ];
      } else {
        title = `Day ${i + 1} Activities`;
        activities = [
          {
            name: `Explore ${destinationName}`,
            description: `Enjoy activities and attractions in ${destinationName}`,
            type: 'activity',
            location: destinationName,
            timeSlot: 'morning',
            startTime: '09:00',
            endTime: '17:00',
            duration: 480,
            cost: { amount: 1000, currency: tripData.currency || 'INR' },
            notes: `Day ${i + 1} of your trip`
          }
        ];
      }
      
      itinerary.push({
        date: dayDate,
        day: i + 1,
        title,
        activities,
        notes: '',
        estimatedCost: activities.reduce((sum, act) => sum + (act.cost?.amount || 0), 0)
      });
    }
    
    return itinerary;
  }

  /**
   * Plan trip with preferences (when destination might be suggested by AI)
   * @param {Object} tripData - Trip data
   * @param {Function} progressCallback - Optional callback for progress updates
   */
  async planTripWithPreferences(tripData, progressCallback = null) {
    if (!this.client) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // If no destination provided, use AI to suggest one
      if (!tripData.to && !tripData.destination) {
        if (progressCallback) {
          progressCallback({
            step: 'suggesting',
            status: 'in_progress',
            message: 'Suggesting destinations based on your preferences'
          });
        }

        // Use destination agent to suggest destinations based on preferences
        const intent = {
          travelStyle: tripData.travelStyle || 'cultural',
          priorityInterests: tripData.interests || [],
          budgetCategory: tripData.budgetRange || 'moderate',
          estimatedDays: tripData.duration || 5
        };

        const suggestedDestinations = await this.destinationAgent.findDestinations(
          { 
            from: tripData.origin || 'Anywhere',
            to: tripData.destinationPreference || 'Any destination',
            season: tripData.season,
            duration: tripData.duration
          },
          intent
        );

        // Use the suggested destination
        tripData.to = suggestedDestinations.mainDestination.city || suggestedDestinations.mainDestination.name;
        tripData.destination = tripData.to;

        if (progressCallback) {
          progressCallback({
            step: 'suggesting',
            status: 'completed',
            message: 'Destinations suggested'
          });
        }
      }

      // Now use the regular planTrip flow with the destination
      return await this.planTrip(tripData, progressCallback);
    } catch (error) {
      logger.error('Orchestrator Preferences Error:', error);
      throw error;
    }
  }

  /**
   * Update trip plan based on user tweaks
   */
  async updateTripPlan(existingTrip, updates) {
    if (!this.client) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // Re-analyze with updated parameters
      const updatedTripData = {
        ...existingTrip,
        ...updates
      };

      // Re-run planning with updates
      const newPlan = await this.planTrip(updatedTripData);
      
      // Merge with existing trip
      return {
        ...existingTrip,
        ...newPlan,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Orchestrator Update Error:', error);
      throw error;
    }
  }
}

module.exports = new OrchestratorService();

