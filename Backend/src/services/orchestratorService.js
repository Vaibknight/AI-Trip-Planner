const openRouterClient = require('./openRouterClient');
const config = require('../config/config');
const logger = require('../utils/logger');
const IntentAgent = require('./agents/intentAgent');
const DestinationAgent = require('./agents/destinationAgent');
const ItineraryAgent = require('./agents/itineraryAgent');
const BudgetAgent = require('./agents/budgetAgent');
const OptimizerAgent = require('./agents/optimizerAgent');
const weatherService = require('./weatherService');
const { getLocalizedPlanSummary } = require('../utils/planSummaryI18n');
const { buildBestTimeToVisit } = require('../utils/bestTimeToVisitI18n');
const { normalizePreferredLanguage, resolvePreferredLanguage } = require('../utils/preferredLanguage');
const { deriveIntentFromTripData } = require('../utils/intentDeriver');
const { calculateBudgetFromTripData } = require('./budgetCalculator');
const destinationDataService = require('./destinationDataService');
const tripPlanCacheService = require('./tripPlanCacheService');

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
   * Orchestrate the complete trip planning process.
   * Default: hybrid Mongo destination data + derived intent + formula budget + parallel (itinerary AI ∥ weather).
   * Set USE_LEGACY_AI_ORCHESTRATOR=true for sequential Intent → Destination AI → Budget AI (slower).
   */
  async planTrip(tripData, progressCallback = null, options = {}) {
    if (!this.client) {
      throw new Error('OpenRouter API key not configured');
    }

    if (process.env.USE_LEGACY_AI_ORCHESTRATOR === 'true') {
      return this._planTripLegacySequential(tripData, progressCallback);
    }

    try {
      const skipCache = !!options.skipCache;
      const cacheKey = tripPlanCacheService.buildKey(tripData);
      if (!skipCache) {
        const cached = tripPlanCacheService.get(cacheKey);
        if (cached) {
          logger.info('Orchestrator: returning cached trip plan');
          if (progressCallback) {
            ['understanding', 'destinations', 'itinerary', 'budget'].forEach((step) => {
              progressCallback({ step, status: 'completed', message: 'Loaded from cache' });
            });
          }
          return cached;
        }
      }

      if (progressCallback) {
        progressCallback({
          step: 'understanding',
          status: 'in_progress',
          message: 'Understanding your preferences'
        });
      }
      const intent = deriveIntentFromTripData(tripData);
      if (progressCallback) {
        progressCallback({
          step: 'understanding',
          status: 'completed',
          message: 'Understanding your preferences'
        });
      }

      if (!tripData.state && (tripData.to || tripData.destination)) {
        tripData.state = tripData.to || tripData.destination;
      }

      if (tripData.state) {
        tripData.to = tripData.state;
        tripData.destination = tripData.state;
        tripData.city = tripData.state;
      } else {
        logger.warn('planTrip - No state — using synthetic destination bundle');
      }

      if (progressCallback) {
        progressCallback({
          step: 'destinations',
          status: 'in_progress',
          message: 'Loading destination insights'
        });
      }
      const destinations = await destinationDataService.resolveDestinations(tripData, intent);
      logger.info('planTrip - destination bundle ready', {
        source: destinations.source,
        city: destinations.mainDestination?.city
      });
      if (progressCallback) {
        progressCallback({
          step: 'destinations',
          status: 'completed',
          message: 'Destination ready'
        });
      }

      const weatherCity =
        destinations.mainDestination?.city ||
        destinations.mainDestination?.name ||
        tripData.state ||
        tripData.city;
      const weatherCountry = destinations.mainDestination?.country || tripData.country || '';

      const weatherPayload = {
        city: weatherCity,
        country: weatherCountry
      };
      if (destinations.catalogCoords) {
        weatherPayload.latitude = destinations.catalogCoords.latitude;
        weatherPayload.longitude = destinations.catalogCoords.longitude;
      }

      if (progressCallback) {
        progressCallback({
          step: 'itinerary',
          status: 'in_progress',
          message: 'Creating itinerary'
        });
      }

      const tokenCb =
        options.onItineraryToken && typeof options.onItineraryToken === 'function'
          ? options.onItineraryToken
          : null;

      const itineraryPromise = this.itineraryAgent
        .createItinerary(tripData, intent, destinations, tokenCb, { compact: true })
        .catch((itineraryError) => {
          logger.error('Orchestrator: Failed to create itinerary — fallback itinerary', {
            error: itineraryError.message
          });
          return { itinerary: [], highlights: [], tips: [] };
        });

      const weatherPromise = weatherService.getDestinationWeather(weatherPayload).catch((wErr) => {
        logger.warn('Orchestrator: weather fetch failed', { error: wErr.message });
        return null;
      });

      let itinerary;
      let weather;
      [itinerary, weather] = await Promise.all([itineraryPromise, weatherPromise]);

      if (
        itinerary &&
        itinerary.itinerary &&
        Array.isArray(itinerary.itinerary) &&
        itinerary.itinerary.length > 0
      ) {
        logger.info('Orchestrator: Itinerary created successfully', {
          days: itinerary.itinerary.length,
          totalActivities: itinerary.itinerary.reduce(
            (sum, day) => sum + (day.activities?.length || 0),
            0
          )
        });
      } else {
        itinerary = { itinerary: [], highlights: [], tips: [] };
      }

      if (progressCallback) {
        progressCallback({
          step: 'itinerary',
          status: 'completed',
          message: 'Creating itinerary'
        });
      }

      if (progressCallback) {
        progressCallback({
          step: 'budget',
          status: 'in_progress',
          message: 'Estimating budget'
        });
      }
      const budget = calculateBudgetFromTripData(tripData, intent, destinations, itinerary);
      if (progressCallback) {
        progressCallback({
          step: 'budget',
          status: 'completed',
          message: 'Estimating budget'
        });
      }

      const optimizations = {
        optimizations: [],
        alternativeActivities: [],
        routeOptimization: { suggested: false, changes: [] },
        finalRecommendations: []
      };

      const tripPlan = await this.compileTripPlan(
        tripData,
        intent,
        destinations,
        itinerary,
        budget,
        optimizations,
        weather
      );

      if (!skipCache) {
        tripPlanCacheService.set(cacheKey, tripPlan);
      }

      logger.info('Orchestrator: Trip plan completed', { tripId: tripPlan.id });
      return tripPlan;
    } catch (error) {
      logger.error('Orchestrator Error:', error);
      throw new Error(`Trip planning failed: ${error.message}`);
    }
  }

  /**
   * Legacy sequential orchestration (4+ LLM-class calls + serial weather).
   */
  async _planTripLegacySequential(tripData, progressCallback = null) {
    if (!this.client) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
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

      if (progressCallback) {
        progressCallback({
          step: 'destinations',
          status: 'in_progress',
          message: 'Finding best destinations'
        });
      }
      if (tripData.state) {
        tripData.to = tripData.state;
        tripData.destination = tripData.state;
        tripData.city = tripData.state;
      } else {
        logger.warn('planTrip - No state provided - destination agent will search generically');
      }

      logger.info('planTrip - Before findDestinations', {
        state: tripData.state || 'UNDEFINED - ONLY THIS WILL BE USED',
        city: tripData.city || 'UNDEFINED (IGNORED)',
        to: tripData.to || 'UNDEFINED (IGNORED)',
        destination: tripData.destination || 'UNDEFINED (IGNORED)',
        note: 'Destination agent will ONLY use state field'
      });

      const destinations = await this.destinationAgent.findDestinations(tripData, intent);

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
        itinerary = { itinerary: [], highlights: [], tips: [] };
      }

      if (progressCallback) {
        progressCallback({
          step: 'itinerary',
          status: 'completed',
          message: 'Creating itinerary'
        });
      }

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

      const optimizations = {
        optimizations: [],
        alternativeActivities: [],
        routeOptimization: { suggested: false, changes: [] },
        finalRecommendations: []
      };

      const weather = await weatherService.getDestinationWeather({
        city: destinations.mainDestination?.city || destinations.mainDestination?.name || tripData.state || tripData.city,
        country: destinations.mainDestination?.country || ''
      });

      const tripPlan = await this.compileTripPlan(
        tripData,
        intent,
        destinations,
        itinerary,
        budget,
        optimizations,
        weather
      );

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
  async compileTripPlan(tripData, intent, destinations, itinerary, budget, optimizations, weather = null) {
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const preferredLanguage = resolvePreferredLanguage(tripData);

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

    const destinationCity = destinations.mainDestination?.city || destinations.mainDestination?.name || tripData.state || tripData.city;

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

    // Build best-time-to-visit recommendation from seasonality + weather context
    const bestTimeToVisit = this.getBestTimeToVisit({
      destination: destinations.mainDestination?.name || destinations.mainDestination?.city || destinationCity,
      country: destinations.mainDestination?.country || '',
      weather,
      travelStyle: intent.travelStyle,
      language: preferredLanguage
    });

    const bestTimeToVisitHtml = this.generateBestTimeToVisitHtml(bestTimeToVisit, preferredLanguage);

    // Generate budget-aware booking links HTML
    const bookingLinksHtml = this.generateBookingLinksHtml({
      destination: destinations.mainDestination?.name || destinations.mainDestination?.city || destinationCity,
      startDate,
      endDate,
      travelers: tripData.travelers || 1,
      budget,
      budgetCategory: intent.budgetCategory || tripData.budgetRange || 'moderate',
      language: preferredLanguage
    });

    // Generate budget breakdown table HTML
    const budgetHtml = this.generateBudgetTableHtml(budget, duration, tripData.travelers || 1, preferredLanguage);
    
    // Generate local transportation HTML
    const localTransportHtml = this.generateLocalTransportHtml(destinations.transportation?.localTransportation, preferredLanguage);

    const enrichedItineraryHtml = itinerary.html || '';

    const summary = getLocalizedPlanSummary({
      from: tripData.from || tripData.origin,
      to: tripData.to || tripData.destination,
      destinationName: destinations.mainDestination.name,
      duration,
      travelStyle: intent.travelStyle,
      preferredLanguage
    });

    return {
      title: summary.title,
      description: summary.description,
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
        purpose: intent.purpose,
        preferredLanguage
      },
      transportation: destinations.transportation,
      transportationTips: destinations.transportation?.localTransportation || null,
      highlights: itinerary.highlights || [],
      tips: itinerary.tips || [],
      optimizations: optimizations.optimizations || [],
      alternativeActivities: optimizations.alternativeActivities || [],
      recommendations: optimizations.finalRecommendations || [],
      weather,
      bestTimeToVisit,
      // Recommended areas for 2-3 day trips
      recommendedAreas: recommendedAreas,
      // HTML itinerary content (new format) - append best-time, booking links, transportation, and budget sections
      itineraryHtml: enrichedItineraryHtml
        ? [enrichedItineraryHtml, bestTimeToVisitHtml, bookingLinksHtml, localTransportHtml, budgetHtml].filter(Boolean).join('\n\n')
        : [bestTimeToVisitHtml, bookingLinksHtml, localTransportHtml, budgetHtml].filter(Boolean).join('\n\n'),
      // Budget breakdown table HTML (also available separately)
      budgetHtml: budgetHtml,
      aiGenerated: true,
      status: 'confirmed',
      createdAt: new Date()
    };
  }

  /**
   * Suggest destination-specific best time to visit.
   * Uses a simple seasonal fallback and enriches with current weather context when available.
   */
  getBestTimeToVisit({ destination, country, weather, travelStyle, language = 'en' }) {
    return buildBestTimeToVisit({ destination, country, weather, travelStyle, language });
  }

  /**
   * Generate HTML for best time to visit recommendation
   */
  generateBestTimeToVisitHtml(bestTimeToVisit, language = 'en') {
    if (!bestTimeToVisit) {
      return '';
    }

    const t = this.getI18nLabels(language);

    let html = `\n<h2>🗓️ ${t.bestTimeToVisitTitle}</h2>\n`;
    html += `<p><strong>${t.idealMonthsLabel}</strong> ${bestTimeToVisit.months || 'N/A'}</p>\n`;
    html += `<p><strong>${t.whyLabel}</strong> ${bestTimeToVisit.reason || 'N/A'}</p>\n`;
    html += `<p><strong>${t.avoidIfPossibleLabel}</strong> ${bestTimeToVisit.avoid || 'N/A'}</p>\n`;

    if (Array.isArray(bestTimeToVisit.tips) && bestTimeToVisit.tips.length > 0) {
      html += `<h3>💡 ${t.seasonalTipsTitle}</h3>\n`;
      html += '<ul style="margin: 10px 0; padding-left: 20px;">\n';
      bestTimeToVisit.tips.forEach((tip) => {
        html += `<li style="margin: 5px 0;">${tip}</li>\n`;
      });
      html += '</ul>\n';
    }

    return html;
  }

  /**
   * Generate budget-aware outbound booking links (no API integration required)
   */
  generateBookingLinksHtml({ destination, startDate, endDate, travelers = 1, budget, budgetCategory = 'moderate', language = 'en' }) {
    if (!destination || !startDate || !endDate) {
      return '';
    }
    const t = this.getI18nLabels(language);

    const checkIn = new Date(startDate).toISOString().split('T')[0];
    const checkOut = new Date(endDate).toISOString().split('T')[0];
    const adults = Math.max(1, parseInt(travelers, 10) || 1);
    const rooms = Math.max(1, Math.ceil(adults / 2));
    const encodedDestination = encodeURIComponent(destination);

    const accommodationTotal = budget?.breakdown?.accommodation || 0;
    const nights = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
    const baseNightly = accommodationTotal > 0 ? Math.round(accommodationTotal / nights) : 2500;

    const rangesByCategory = {
      budget: {
        min: Math.max(500, Math.round(baseNightly * 0.6)),
        max: Math.max(1000, Math.round(baseNightly * 0.95))
      },
      moderate: {
        min: Math.max(1000, Math.round(baseNightly * 0.9)),
        max: Math.max(2000, Math.round(baseNightly * 1.25))
      },
      luxury: {
        min: Math.max(2500, Math.round(baseNightly * 1.4)),
        max: Math.max(4000, Math.round(baseNightly * 2.2))
      }
    };

    const normalizedCategory = (budgetCategory || 'moderate').toLowerCase();
    const currentRange = rangesByCategory[normalizedCategory] || rangesByCategory.moderate;

    const rangeLabel = {
      budget: t.budgetOptionBudget,
      moderate: t.budgetOptionModerate,
      luxury: t.budgetOptionLuxury
    }[normalizedCategory] || t.budgetOptionModerate;

    const categoryLabel = {
      budget: t.budgetCategoryNameBudget,
      moderate: t.budgetCategoryNameModerate,
      luxury: t.budgetCategoryNameLuxury
    }[normalizedCategory] || normalizedCategory;

    const bookingComUrl = `https://www.booking.com/searchresults.html?ss=${encodedDestination}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${adults}&no_rooms=${rooms}`;
    const agodaUrl = `https://www.agoda.com/search?city=${encodedDestination}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&rooms=${rooms}`;
    const googleHotelsUrl = `https://www.google.com/travel/hotels/${encodedDestination}?q=hotels%20in%20${encodedDestination}%20from%20${checkIn}%20to%20${checkOut}`;

    return `
<h2>🏨 ${t.hotelBookingSuggestionsTitle}</h2>
<p><strong>${t.budgetFitLabel}</strong> ${rangeLabel} (${categoryLabel}) | <strong>${t.estimatedNightlyRangeLabel}</strong> ₹${currentRange.min.toLocaleString('en-IN')} - ₹${currentRange.max.toLocaleString('en-IN')}</p>
<div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0;">
  <a href="${bookingComUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; text-decoration: none;">${t.viewOnBooking}</a>
  <a href="${agodaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; text-decoration: none;">${t.viewOnAgoda}</a>
  <a href="${googleHotelsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; text-decoration: none;">${t.viewOnGoogleHotels}</a>
</div>
<p style="font-size: 13px; color: #666;">${t.partnerPriceDisclaimer}</p>
`;
  }

  /**
   * Generate HTML for local transportation tips
   */
  generateLocalTransportHtml(localTransportation, language = 'en') {
    if (!localTransportation) {
      return '';
    }
    const t = this.getI18nLabels(language);

    let html = `\n<h2>🚇 ${t.localTransportationTipsTitle}</h2>\n`;
    html += '<div style="margin: 20px 0;">\n';

    if (localTransportation.metro) {
      html += `<h3>🚇 ${t.metroLabel}</h3>\n`;
      html += `<p>${localTransportation.metro}</p>\n`;
    }

    if (localTransportation.autoRickshaw) {
      html += `<h3>🛺 ${t.autoRickshawLabel}</h3>\n`;
      html += `<p>${localTransportation.autoRickshaw}</p>\n`;
    }

    if (localTransportation.eRickshaw) {
      html += `<h3>🛵 ${t.eRickshawLabel}</h3>\n`;
      html += `<p>${localTransportation.eRickshaw}</p>\n`;
    }

    if (localTransportation.buses) {
      html += `<h3>🚌 ${t.busesLabel}</h3>\n`;
      html += `<p>${localTransportation.buses}</p>\n`;
    }

    if (localTransportation.other) {
      html += `<h3>🚕 ${t.otherTransportationLabel}</h3>\n`;
      html += `<p>${localTransportation.other}</p>\n`;
    }

    if (localTransportation.tips && Array.isArray(localTransportation.tips) && localTransportation.tips.length > 0) {
      html += `<h3>💡 ${t.transportationTipsLabel}</h3>\n`;
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
  generateBudgetTableHtml(budget, duration, travelers, language = 'en') {
    const currency = budget.currency || 'INR';
    const currencySymbol = this.getCurrencySymbol(currency);
    const t = this.getI18nLabels(language);
    
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
<h2>💰 ${t.budgetBreakdownTitle || 'Budget Breakdown'}</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #f5f5f5;">
      <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">${t.categoryLabel}</th>
      <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">${t.amountLabel}</th>
      <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">${t.percentageLabel}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🏨 ${t.accommodationLabel}</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(accommodation)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${accommodationPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🚗 ${t.transportationLabel}</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(transportation)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${transportationPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🍽️ ${t.foodDiningLabel}</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(food)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${foodPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>🎯 ${t.activitiesAttractionsLabel}</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(activities)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${activitiesPct}%</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>📦 ${t.miscellaneousLabel}</strong></td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatAmount(miscellaneous)}</td>
      <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${miscellaneousPct}%</td>
    </tr>
    <tr style="background-color: #e8f5e9; font-weight: bold;">
      <td style="padding: 12px; border: 1px solid #ddd;"><strong>${t.totalLabel}</strong></td>
      <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">${formatAmount(total)}</td>
      <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">100%</td>
    </tr>
  </tbody>
</table>
<p><strong>${t.perPersonLabel}</strong> ${formatAmount(perPerson)} | <strong>${t.perDayLabel}</strong> ${formatAmount(perDay)}</p>
`;
  }

  getI18nLabels(language = 'en') {
    const lang = normalizePreferredLanguage(language);
    const labels = {
      en: {
        bestTimeToVisitTitle: 'Best Time to Visit',
        idealMonthsLabel: 'Ideal months:',
        whyLabel: 'Why:',
        avoidIfPossibleLabel: 'Avoid if possible:',
        seasonalTipsTitle: 'Seasonal Tips',
        hotelBookingSuggestionsTitle: 'Hotel Booking Suggestions',
        budgetFitLabel: 'Budget fit:',
        estimatedNightlyRangeLabel: 'Estimated nightly range:',
        viewOnBooking: 'View on Booking.com',
        viewOnAgoda: 'View on Agoda',
        viewOnGoogleHotels: 'View on Google Hotels',
        partnerPriceDisclaimer: 'Prices and availability may change on partner websites.',
        localTransportationTipsTitle: 'Local Transportation Tips',
        metroLabel: 'Metro/Subway',
        autoRickshawLabel: 'Auto-Rickshaws',
        eRickshawLabel: 'E-Rickshaws',
        busesLabel: 'Buses',
        otherTransportationLabel: 'Other Transportation',
        transportationTipsLabel: 'Transportation Tips',
        categoryLabel: 'Category',
        amountLabel: 'Amount',
        percentageLabel: 'Percentage',
        accommodationLabel: 'Accommodation',
        transportationLabel: 'Transportation',
        foodDiningLabel: 'Food & Dining',
        activitiesAttractionsLabel: 'Activities & Attractions',
        miscellaneousLabel: 'Miscellaneous',
        totalLabel: 'Total',
        perPersonLabel: 'Per Person:',
        perDayLabel: 'Per Day:',
        budgetBreakdownTitle: 'Budget Breakdown',
        budgetOptionBudget: 'Save more',
        budgetOptionModerate: 'Best for your budget',
        budgetOptionLuxury: 'More comfort',
        budgetCategoryNameBudget: 'budget',
        budgetCategoryNameModerate: 'moderate',
        budgetCategoryNameLuxury: 'luxury'
      },
      hi: {
        bestTimeToVisitTitle: 'घूमने का सबसे अच्छा समय',
        idealMonthsLabel: 'आदर्श महीने:',
        whyLabel: 'क्यों:',
        avoidIfPossibleLabel: 'यदि संभव हो तो बचें:',
        seasonalTipsTitle: 'मौसमी सुझाव',
        hotelBookingSuggestionsTitle: 'होटल बुकिंग सुझाव',
        budgetFitLabel: 'बजट अनुकूल:',
        estimatedNightlyRangeLabel: 'अनुमानित प्रति रात रेंज:',
        viewOnBooking: 'Booking.com पर देखें',
        viewOnAgoda: 'Agoda पर देखें',
        viewOnGoogleHotels: 'Google Hotels पर देखें',
        partnerPriceDisclaimer: 'पार्टनर वेबसाइट पर कीमतें और उपलब्धता बदल सकती हैं।',
        localTransportationTipsTitle: 'स्थानीय परिवहन सुझाव',
        metroLabel: 'मेट्रो/सबवे',
        autoRickshawLabel: 'ऑटो-रिक्शा',
        eRickshawLabel: 'ई-रिक्शा',
        busesLabel: 'बसें',
        otherTransportationLabel: 'अन्य परिवहन',
        transportationTipsLabel: 'यातायात सुझाव',
        categoryLabel: 'श्रेणी',
        amountLabel: 'राशि',
        percentageLabel: 'प्रतिशत',
        accommodationLabel: 'आवास',
        transportationLabel: 'परिवहन',
        foodDiningLabel: 'भोजन और डाइनिंग',
        activitiesAttractionsLabel: 'गतिविधियाँ और आकर्षण',
        miscellaneousLabel: 'विविध',
        totalLabel: 'कुल',
        perPersonLabel: 'प्रति व्यक्ति:',
        perDayLabel: 'प्रति दिन:',
        budgetBreakdownTitle: 'बजट विवरण',
        budgetOptionBudget: 'और बचत',
        budgetOptionModerate: 'आपके बजट के लिए बेहतर',
        budgetOptionLuxury: 'अधिक सुविधा',
        budgetCategoryNameBudget: 'किफायती',
        budgetCategoryNameModerate: 'मध्यम',
        budgetCategoryNameLuxury: 'लक्ज़री'
      },
      de: {
        bestTimeToVisitTitle: 'Beste Reisezeit',
        idealMonthsLabel: 'Ideale Monate:',
        whyLabel: 'Warum:',
        avoidIfPossibleLabel: 'Wenn möglich meiden:',
        seasonalTipsTitle: 'Saisonale Tipps',
        hotelBookingSuggestionsTitle: 'Hoteltipps & Buchung',
        budgetFitLabel: 'Passend zum Budget:',
        estimatedNightlyRangeLabel: 'Geschätzter Nachtpreis (Spanne):',
        viewOnBooking: 'Auf Booking.com ansehen',
        viewOnAgoda: 'Auf Agoda ansehen',
        viewOnGoogleHotels: 'Bei Google Hotels ansehen',
        partnerPriceDisclaimer: 'Preise und Verfügbarkeit auf Partner-Websites können sich ändern.',
        localTransportationTipsTitle: 'Tipps zum lokalen Nahverkehr',
        metroLabel: 'U-Bahn/Metro',
        autoRickshawLabel: 'Autorikschas',
        eRickshawLabel: 'E-Rikschas',
        busesLabel: 'Busse',
        otherTransportationLabel: 'Sonstige Verkehrsmittel',
        transportationTipsLabel: 'Verkehrstipps',
        categoryLabel: 'Kategorie',
        amountLabel: 'Betrag',
        percentageLabel: 'Anteil',
        accommodationLabel: 'Unterkunft',
        transportationLabel: 'Transport',
        foodDiningLabel: 'Essen & Trinken',
        activitiesAttractionsLabel: 'Aktivitäten & Sehenswürdigkeiten',
        miscellaneousLabel: 'Sonstiges',
        totalLabel: 'Gesamt',
        perPersonLabel: 'Pro Person:',
        perDayLabel: 'Pro Tag:',
        budgetBreakdownTitle: 'Budgetübersicht',
        budgetOptionBudget: 'Günstigste Wahl',
        budgetOptionModerate: 'Am besten zu Ihrem Budget',
        budgetOptionLuxury: 'Mehr Komfort',
        budgetCategoryNameBudget: 'günstig',
        budgetCategoryNameModerate: 'mittel',
        budgetCategoryNameLuxury: 'luxus'
      }
    };
    return labels[lang] || labels.en;
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
  async planTripWithPreferences(tripData, progressCallback = null, options = {}) {
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

      const hasDestination = !!tripData.state;

      if (!hasDestination) {
        logger.info('No destination provided — suggesting from catalog / fallback');
        if (progressCallback) {
          progressCallback({
            step: 'suggesting',
            status: 'in_progress',
            message: 'Suggesting destinations based on your preferences'
          });
        }

        const intentPreview = deriveIntentFromTripData(tripData);
        const suggestedCity = await destinationDataService.suggestDestinationCityFromCatalog(
          tripData,
          intentPreview
        );

        tripData.state = suggestedCity;
        tripData.to = suggestedCity;
        tripData.destination = suggestedCity;
        tripData.city = suggestedCity;

        if (progressCallback) {
          progressCallback({
            step: 'suggesting',
            status: 'completed',
            message: 'Destinations suggested'
          });
        }
      } else {
        if (tripData.state) {
          tripData.to = tripData.state;
          tripData.destination = tripData.state;
          tripData.city = tripData.state;
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

      logger.info('planTripWithPreferences - About to call planTrip', {
        state: tripData.state,
        city: tripData.city,
        to: tripData.to,
        destination: tripData.destination
      });

      return await this.planTrip(tripData, progressCallback, options);
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
      const newPlan = await this.planTrip(updatedTripData, null, { skipCache: true });
      
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

