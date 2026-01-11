const OpenAI = require('openai');
const config = require('../config/config');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    if (!config.openaiApiKey) {
      logger.warn('OpenAI API key not found. AI features will be disabled.');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }
  }

  /**
   * Generate a trip plan using AI
   * @param {Object} params - Trip planning parameters
   * @returns {Promise<Object>} Generated trip plan
   */
  async generateTripPlan(params) {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      destinations,
      startDate,
      endDate,
      budget,
      travelStyle,
      interests = [],
      dietaryRestrictions = [],
      accessibility = []
    } = params;

    const prompt = this.buildTripPlanningPrompt({
      destinations,
      startDate,
      endDate,
      budget,
      travelStyle,
      interests,
      dietaryRestrictions,
      accessibility
    });

    try {
      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel planner. Generate detailed, practical, and personalized trip itineraries in JSON format. Always provide realistic recommendations based on the user\'s preferences and budget.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const response = JSON.parse(completion.choices[0].message.content);
      return this.parseAIResponse(response, params);
    } catch (error) {
      logger.error('Error generating trip plan:', error);
      throw new Error(`AI service error: ${error.message}`);
    }
  }

  /**
   * Build the prompt for trip planning
   */
  buildTripPlanningPrompt(params) {
    const { destinations, startDate, endDate, budget, travelStyle, interests, dietaryRestrictions, accessibility } = params;
    
    const destinationList = Array.isArray(destinations) 
      ? destinations.map(d => typeof d === 'string' ? d : `${d.city}, ${d.country}`).join(', ')
      : destinations;

    let prompt = `Create a detailed trip itinerary for the following requirements:\n\n`;
    prompt += `Destinations: ${destinationList}\n`;
    prompt += `Start Date: ${startDate}\n`;
    prompt += `End Date: ${endDate}\n`;
    prompt += `Budget Level: ${budget}\n`;
    prompt += `Travel Style: ${travelStyle}\n`;

    if (interests.length > 0) {
      prompt += `Interests: ${interests.join(', ')}\n`;
    }

    if (dietaryRestrictions.length > 0) {
      prompt += `Dietary Restrictions: ${dietaryRestrictions.join(', ')}\n`;
    }

    if (accessibility.length > 0) {
      prompt += `Accessibility Needs: ${accessibility.join(', ')}\n`;
    }

    prompt += `\nPlease provide a JSON response with the following structure:
    {
      "title": "Trip title",
      "description": "Brief trip description",
      "itinerary": [
        {
          "date": "YYYY-MM-DD",
          "activities": [
            {
              "name": "Activity name",
              "description": "Activity description",
              "type": "attraction|restaurant|hotel|activity|transport",
              "location": "Location address",
              "startTime": "HH:MM",
              "endTime": "HH:MM",
              "duration": 120,
              "cost": {
                "amount": 50,
                "currency": "USD"
              },
              "notes": "Additional notes"
            }
          ],
          "notes": "Day notes"
        }
      ],
      "budgetBreakdown": {
        "accommodation": 500,
        "transportation": 300,
        "food": 400,
        "activities": 200,
        "other": 100
      },
      "recommendations": ["Recommendation 1", "Recommendation 2"]
    }`;

    return prompt;
  }

  /**
   * Parse and validate AI response
   */
  parseAIResponse(aiResponse, params) {
    const { destinations, startDate, endDate, budget, travelStyle } = params;

    // Ensure destinations is an array
    const destinationArray = Array.isArray(destinations) 
      ? destinations 
      : [{ city: destinations, country: '' }];

    const parsedDestinations = destinationArray.map(dest => {
      if (typeof dest === 'string') {
        const parts = dest.split(',').map(s => s.trim());
        return {
          name: parts[0],
          city: parts[0],
          country: parts[1] || ''
        };
      }
      return {
        name: dest.name || dest.city,
        city: dest.city,
        country: dest.country || ''
      };
    });

    return {
      title: aiResponse.title || 'AI Generated Trip',
      description: aiResponse.description || '',
      destinations: parsedDestinations,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      duration: this.calculateDuration(startDate, endDate),
      budget: {
        total: this.calculateTotalBudget(aiResponse.budgetBreakdown),
        currency: 'USD',
        breakdown: {
          accommodation: aiResponse.budgetBreakdown?.accommodation || 0,
          transportation: aiResponse.budgetBreakdown?.transportation || 0,
          food: aiResponse.budgetBreakdown?.food || 0,
          activities: aiResponse.budgetBreakdown?.activities || 0,
          other: aiResponse.budgetBreakdown?.other || 0
        }
      },
      itinerary: this.parseItinerary(aiResponse.itinerary || [], startDate),
      preferences: {
        budget,
        travelStyle,
        interests: params.interests || [],
        dietaryRestrictions: params.dietaryRestrictions || [],
        accessibility: params.accessibility || []
      },
      aiGenerated: true,
      aiPrompt: this.buildTripPlanningPrompt(params),
      recommendations: aiResponse.recommendations || []
    };
  }

  /**
   * Parse itinerary from AI response
   */
  parseItinerary(itinerary, startDate) {
    if (!Array.isArray(itinerary)) return [];

    const start = new Date(startDate);
    
    return itinerary.map((day, index) => {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + index);

      return {
        date: currentDate,
        activities: day.activities || [],
        notes: day.notes || ''
      };
    });
  }

  /**
   * Calculate duration in days
   */
  calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate total budget
   */
  calculateTotalBudget(breakdown) {
    if (!breakdown) return 0;
    return Object.values(breakdown).reduce((sum, val) => sum + (val || 0), 0);
  }

  /**
   * Enhance existing trip with AI suggestions
   */
  async enhanceTrip(tripData) {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Given this trip plan, provide suggestions for improvement:
    ${JSON.stringify(tripData, null, 2)}
    
    Provide suggestions in JSON format:
    {
      "suggestions": ["Suggestion 1", "Suggestion 2"],
      "alternativeActivities": [...],
      "budgetOptimizations": [...]
    }`;

    try {
      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel advisor providing helpful suggestions to improve trip plans.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      logger.error('Error enhancing trip:', error);
      throw new Error(`AI service error: ${error.message}`);
    }
  }
}

module.exports = new AIService();








