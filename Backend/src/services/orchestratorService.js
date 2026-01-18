const openRouterClient = require('./openRouterClient');
const config = require('../config/config');
const logger = require('../utils/logger');
const IntentAgent = require('./agents/intentAgent');
const DestinationAgent = require('./agents/destinationAgent');
const ItineraryAgent = require('./agents/itineraryAgent');
const BudgetAgent = require('./agents/budgetAgent');
const OptimizerAgent = require('./agents/optimizerAgent');
const geocodingService = require('../utils/geocoding');

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
      // CRITICAL: Ensure state is preserved before calling findDestinations
      // ONLY use state - do not use city/to/destination as fallbacks
      if (tripData.state) {
        // Set other fields from state for backward compatibility, but state is the source of truth
        tripData.to = tripData.state;
        tripData.destination = tripData.state;
        tripData.city = tripData.state; // Set city for backward compatibility only
      } else {
        logger.warn('planTrip - No state provided - destination agent will search generically');
      }
      
      // Log tripData before calling findDestinations
      logger.info('planTrip - Before findDestinations', {
        state: tripData.state || 'UNDEFINED - ONLY THIS WILL BE USED',
        city: tripData.city || 'UNDEFINED (IGNORED)',
        to: tripData.to || 'UNDEFINED (IGNORED)',
        destination: tripData.destination || 'UNDEFINED (IGNORED)',
        note: 'Destination agent will ONLY use state field'
      });
      
      const destinations = await this.destinationAgent.findDestinations(tripData, intent);
      
      // Log destinations response
      logger.info('planTrip - After findDestinations', {
        mainDestinationCity: destinations.mainDestination?.city,
        mainDestinationName: destinations.mainDestination?.name,
        tripDataState: tripData.state,
        tripDataCity: tripData.city,
        tripDataTo: tripData.to
      });
      
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

      // Compile final trip plan (now async due to geocoding)
      const tripPlan = await this.compileTripPlan(tripData, intent, destinations, itinerary, budget, optimizations);

      logger.info('Orchestrator: Trip plan completed', { tripId: tripPlan.id });
      return tripPlan;
    } catch (error) {
      logger.error('Orchestrator Error:', error);
      throw new Error(`Trip planning failed: ${error.message}`);
    }
  }

  /**
   * Compile all agent outputs into a complete trip plan
   * @param {Object} tripData - Trip data
   * @param {Object} intent - Intent analysis
   * @param {Object} destinations - Destination information
   * @param {Object} itinerary - Itinerary data
   * @param {Object} budget - Budget information
   * @param {Object} optimizations - Optimization suggestions
   * @returns {Promise<Object>} Complete trip plan
   */
  async compileTripPlan(tripData, intent, destinations, itinerary, budget, optimizations) {
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

    // Enrich activities with coordinates using geocoding
    const destinationCity = destinations.mainDestination?.city || destinations.mainDestination?.name || tripData.state || tripData.city;
    logger.info('Orchestrator: Starting geocoding for activities', {
      destinationCity,
      totalDays: formattedItinerary.length,
      totalActivities: formattedItinerary.reduce((sum, day) => sum + (day.activities?.length || 0), 0)
    });

    try {
      // Enrich each day's activities with coordinates
      for (const day of formattedItinerary) {
        if (day.activities && Array.isArray(day.activities) && day.activities.length > 0) {
          day.activities = await geocodingService.enrichActivitiesWithCoordinates(
            day.activities,
            destinationCity
          );
        }
      }
      logger.info('Orchestrator: Geocoding completed successfully');
    } catch (geocodingError) {
      logger.warn('Orchestrator: Geocoding failed, continuing without coordinates', {
        error: geocodingError.message
      });
      // Continue without coordinates - activities will still be returned
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

    // Include recommended areas for 2-3 day trips
    const recommendedAreas = (duration >= 2 && duration <= 3 && destinations.mainDestination?.keyAreas?.length > 0)
      ? destinations.mainDestination.keyAreas.slice(0, 5) // Limit to top 5 areas
      : null;

    // Generate budget breakdown table HTML
    const budgetHtml = this.generateBudgetTableHtml(budget, duration, tripData.travelers || 1);
    
    // Generate local transportation HTML
    const localTransportHtml = this.generateLocalTransportHtml(destinations.transportation?.localTransportation);

    // Enrich itinerary HTML with coordinates
    let enrichedItineraryHtml = itinerary.html || '';
    if (enrichedItineraryHtml) {
      enrichedItineraryHtml = await this.enrichItineraryHtmlWithCoordinates(
        enrichedItineraryHtml,
        formattedItinerary,
        destinationCity
      );
    }

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
      transportationTips: destinations.transportation?.localTransportation || null,
      highlights: itinerary.highlights || [],
      tips: itinerary.tips || [],
      optimizations: optimizations.optimizations || [],
      alternativeActivities: optimizations.alternativeActivities || [],
      recommendations: optimizations.finalRecommendations || [],
      // Recommended areas for 2-3 day trips
      recommendedAreas: recommendedAreas,
      // HTML itinerary content (new format) - append local transportation and budget table if available
      itineraryHtml: enrichedItineraryHtml 
        ? (enrichedItineraryHtml + (localTransportHtml ? '\n\n' + localTransportHtml : '') + '\n\n' + budgetHtml)
        : (localTransportHtml ? localTransportHtml + '\n\n' : '') + budgetHtml,
      // Budget breakdown table HTML (also available separately)
      budgetHtml: budgetHtml,
      aiGenerated: true,
      status: 'confirmed',
      createdAt: new Date()
    };
  }

  /**
   * Enrich itinerary HTML with coordinates by geocoding activities directly from HTML
   * Adds data-lat and data-lon attributes to <li> tags
   */
  async enrichItineraryHtmlWithCoordinates(html, formattedItinerary, city) {
    if (!html) {
      return html;
    }

    try {
      // First, try to use coordinates from structured itinerary if available
      const activityCoordinatesMap = new Map();
      
      if (formattedItinerary && formattedItinerary.length > 0) {
        formattedItinerary.forEach(day => {
          if (day.activities && Array.isArray(day.activities)) {
            day.activities.forEach(activity => {
              if (activity.name && activity.coordinates) {
                const activityName = activity.name.toLowerCase().trim();
                activityCoordinatesMap.set(activityName, activity.coordinates);
                
                // Also try variations (without "Visit to", "Breakfast at", etc.)
                const cleanName = activityName
                  .replace(/^(visit to|visit|breakfast at|lunch at|dinner at|coffee at|explore|tour of|stroll through)\s+/i, '')
                  .trim();
                if (cleanName !== activityName && cleanName.length > 0) {
                  activityCoordinatesMap.set(cleanName, activity.coordinates);
                }
              }
            });
          }
        });
      }

      // Parse HTML and enrich <li> tags with coordinates
      // Match pattern: <li>HH:MM — Activity name</li>
      const liPattern = /<li(?:[^>]*)?>(\d{2}:\d{2})\s*—\s*([^<]+)<\/li>/gi;
      const matches = Array.from(html.matchAll(liPattern));
      
      // Build replacement map
      const replacements = new Map();
      
      // Process each match and geocode if needed
      for (const match of matches) {
        const [fullMatch, time, activityText] = match;
        const activityName = activityText.trim();
        const activityNameLower = activityName.toLowerCase();
        
        // Skip if already has coordinates
        if (fullMatch.includes('data-lat')) {
          continue;
        }
        
        // Try to find coordinates from structured itinerary first
        let coordinates = activityCoordinatesMap.get(activityNameLower);
        
        // If not found, try without common prefixes
        if (!coordinates) {
          const cleanName = activityNameLower
            .replace(/^(visit to|visit|breakfast at|lunch at|dinner at|coffee at|explore|tour of|stroll through|nightlife at)\s+/i, '')
            .trim();
          if (cleanName.length > 0) {
            coordinates = activityCoordinatesMap.get(cleanName);
          }
        }
        
        // If still not found, try partial matching
        if (!coordinates) {
          for (const [key, coords] of activityCoordinatesMap.entries()) {
            if (key.length > 3 && (activityNameLower.includes(key) || key.includes(activityNameLower))) {
              coordinates = coords;
              break;
            }
          }
        }
        
        // If still not found, geocode the activity directly from HTML
        if (!coordinates) {
          // Extract location name from activity text
          const locationName = activityNameLower
            .replace(/^(visit to|visit|breakfast at|lunch at|dinner at|coffee at|explore|tour of|stroll through|nightlife at)\s+/i, '')
            .trim();
          
          // Skip generic activities
          const genericPatterns = /^(check-in|check-out|explore|visit|stroll|nightlife)$/i;
          if (locationName.length > 0 && !genericPatterns.test(locationName)) {
            try {
              // Geocode the location
              coordinates = await geocodingService.geocode(locationName, city);
              
              if (coordinates) {
                // Cache it for potential future matches
                activityCoordinatesMap.set(activityNameLower, coordinates);
                activityCoordinatesMap.set(locationName, coordinates);
              }
            } catch (geocodeError) {
              logger.debug('Geocoding failed for activity', {
                activityName,
                locationName,
                error: geocodeError.message
              });
            }
          }
        }
        
        // Store replacement if coordinates found
        if (coordinates && coordinates.latitude && coordinates.longitude) {
          const enrichedLi = `<li data-lat="${coordinates.latitude}" data-lon="${coordinates.longitude}">${time} — ${activityText}</li>`;
          replacements.set(fullMatch, enrichedLi);
        }
      }
      
      // Apply all replacements
      for (const [original, replacement] of replacements.entries()) {
        html = html.replace(original, replacement);
      }

      logger.info('Orchestrator: Enriched itinerary HTML with coordinates', {
        totalMatches: matches.length,
        htmlLength: html.length,
        cachedCoordinates: activityCoordinatesMap.size
      });

      return html;
    } catch (error) {
      logger.warn('Orchestrator: Failed to enrich HTML with coordinates', {
        error: error.message
      });
      return html; // Return original HTML on error
    }
  }

  /**
   * Generate HTML for local transportation tips
   */
  generateLocalTransportHtml(localTransportation) {
    if (!localTransportation) {
      return '';
    }

    let html = '\n<h2>🚇 Local Transportation Tips</h2>\n';
    html += '<div style="margin: 20px 0;">\n';

    if (localTransportation.metro) {
      html += '<h3>🚇 Metro/Subway</h3>\n';
      html += `<p>${localTransportation.metro}</p>\n`;
    }

    if (localTransportation.autoRickshaw) {
      html += '<h3>🛺 Auto-Rickshaws</h3>\n';
      html += `<p>${localTransportation.autoRickshaw}</p>\n`;
    }

    if (localTransportation.eRickshaw) {
      html += '<h3>🛵 E-Rickshaws</h3>\n';
      html += `<p>${localTransportation.eRickshaw}</p>\n`;
    }

    if (localTransportation.buses) {
      html += '<h3>🚌 Buses</h3>\n';
      html += `<p>${localTransportation.buses}</p>\n`;
    }

    if (localTransportation.other) {
      html += '<h3>🚕 Other Transportation</h3>\n';
      html += `<p>${localTransportation.other}</p>\n`;
    }

    if (localTransportation.tips && Array.isArray(localTransportation.tips) && localTransportation.tips.length > 0) {
      html += '<h3>💡 Transportation Tips</h3>\n';
      html += '<ul style="margin: 10px 0; padding-left: 20px;">\n';
      localTransportation.tips.forEach(tip => {
        html += `<li style="margin: 5px 0;">${tip}</li>\n`;
      });
      html += '</ul>\n';
    }

    html += '</div>\n';
    return html;
  }

  /**
   * Generate HTML table for budget breakdown
   */
  generateBudgetTableHtml(budget, duration, travelers) {
    const currency = budget.currency || 'INR';
    const currencySymbol = this.getCurrencySymbol(currency);
    
    const formatAmount = (amount) => {
      return `${currencySymbol}${amount.toLocaleString('en-IN')}`;
    };

    const breakdown = budget.breakdown || {};
    const accommodation = breakdown.accommodation || 0;
    const transportation = breakdown.transportation || 0;
    const food = breakdown.food || 0;
    const activities = breakdown.activities || 0;
    const miscellaneous = breakdown.miscellaneous || breakdown.other || 0;
    const total = budget.total || 0;
    const perPerson = budget.perPerson || (total / travelers);
    const perDay = budget.perDay || (total / duration);

    // Calculate percentages
    const accommodationPct = total > 0 ? ((accommodation / total) * 100).toFixed(1) : 0;
    const transportationPct = total > 0 ? ((transportation / total) * 100).toFixed(1) : 0;
    const foodPct = total > 0 ? ((food / total) * 100).toFixed(1) : 0;
    const activitiesPct = total > 0 ? ((activities / total) * 100).toFixed(1) : 0;
    const miscellaneousPct = total > 0 ? ((miscellaneous / total) * 100).toFixed(1) : 0;

    return `
<h2>💰 Budget Breakdown</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #f5f5f5;">
      <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Category</th>
      <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Amount</th>
      <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Percentage</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🏨 Accommodation</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(accommodation)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${accommodationPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🚗 Transportation</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(transportation)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${transportationPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🍽️ Food & Dining</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(food)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${foodPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🎯 Activities & Attractions</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(activities)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${activitiesPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>📦 Miscellaneous</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(miscellaneous)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${miscellaneousPct}%</td>
    </tr>
    <tr style="background-color: #e8f5e9; font-weight: bold;">
      <td style="padding: 12px; border: 1px solid #ddd;"><strong>Total</strong></td>
      <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">${formatAmount(total)}</td>
      <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">100%</td>
    </tr>
  </tbody>
</table>
<p><strong>Per Person:</strong> ${formatAmount(perPerson)} | <strong>Per Day:</strong> ${formatAmount(perDay)}</p>
`;
  }

  /**
   * Get currency symbol for display
   */
  getCurrencySymbol(currency) {
    const symbols = {
      'INR': '₹',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'AUD': 'A$',
      'CAD': 'C$',
      'CNY': '¥',
      'SGD': 'S$'
    };
    return symbols[currency.toUpperCase()] || currency;
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
      // Log destination information for debugging
      logger.info('planTripWithPreferences - Destination check', {
        state: tripData.state,
        city: tripData.city,
        to: tripData.to,
        destination: tripData.destination,
        hasState: !!tripData.state,
        hasCity: !!tripData.city,
        hasTo: !!tripData.to,
        hasDestination: !!tripData.destination
      });

      // CRITICAL: ONLY check state - no fallbacks to city/to/destination
      const hasDestination = !!tripData.state;
      
      if (!hasDestination) {
        logger.info('No destination provided, suggesting based on preferences');
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
            to: tripData.state || 'Any destination',
            season: tripData.season,
            duration: tripData.duration
          },
          intent
        );

        // Use the suggested destination
        tripData.to = suggestedDestinations.mainDestination.city || suggestedDestinations.mainDestination.name;
        tripData.destination = tripData.to;
        tripData.city = tripData.to; // Also set city for consistency

        if (progressCallback) {
          progressCallback({
            step: 'suggesting',
            status: 'completed',
            message: 'Destinations suggested'
          });
        }
      } else {
        // CRITICAL: ONLY use state - do not fall back to city
        if (tripData.state) {
          // Set other fields from state for backward compatibility, but state is the source of truth
          tripData.to = tripData.state;
          tripData.destination = tripData.state;
          tripData.city = tripData.state; // Set city for backward compatibility only
        } else {
          logger.warn('No state provided - destination may be suggested by AI');
        }
        logger.info('Using provided destination - BEFORE planTrip', {
          state: tripData.state || 'UNDEFINED',
          city: tripData.city || 'UNDEFINED (set from state)',
          to: tripData.to || 'UNDEFINED (set from state)',
          destination: tripData.destination || 'UNDEFINED (set from state)',
          note: 'Only state field will be used for destination search'
        });
      }

      // Now use the regular planTrip flow with the destination
      // Log tripData right before calling planTrip
      logger.info('planTripWithPreferences - About to call planTrip', {
        state: tripData.state,
        city: tripData.city,
        to: tripData.to,
        destination: tripData.destination
      });
      
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

