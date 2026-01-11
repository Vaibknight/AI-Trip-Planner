const openRouterClient = require('../openRouterClient');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class IntentAgent {
  constructor() {
    this.client = openRouterClient;
  }

  /**
   * Analyze user's trip intent and preferences
   */
  async analyzeIntent(tripData) {
    try {
      const prompt = `Analyze the user's trip planning intent based on the following information:
      
      Origin: ${tripData.from || tripData.origin}
      Destination: ${tripData.to || tripData.destination}
      Start Date: ${tripData.startDate}
      End Date: ${tripData.endDate}
      Budget: ${tripData.budget} ${tripData.currency || 'INR'}
      Travelers: ${tripData.travelers || 1}
      Interests: ${Array.isArray(tripData.interests) ? tripData.interests.join(', ') : tripData.interests || 'Not specified'}
      
      Determine:
      1. Primary trip purpose (leisure, business, adventure, family, etc.)
      2. Travel style preferences
      3. Priority interests
      4. Budget category (budget, moderate, luxury)
      5. Any special requirements
      
      Respond in JSON format:
      {
        "purpose": "leisure|business|adventure|family|romantic",
        "travelStyle": "adventure|relaxation|cultural|family|business",
        "priorityInterests": ["interest1", "interest2"],
        "budgetCategory": "budget|moderate|luxury",
        "specialRequirements": ["requirement1", "requirement2"],
        "estimatedDays": number,
        "complexity": "simple|moderate|complex"
      }`;

      const response = await this.client.chatCompletion({
        model: config.openRouterModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel intent analyzer. Analyze user preferences and determine their trip planning intent accurately.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        // Reduced tokens for speed
        max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 500 : 300,
        response_format: { type: 'json_object' }
      });

      // Check if content is empty
      if (!response.content || response.content.length === 0) {
        logger.error('Intent Agent: Empty response from AI', {
          usage: response.usage,
          model: response.model
        });
        throw new Error('AI returned empty response');
      }

      const intent = this.client.parseJSONResponse(response.content);
      logger.info('Intent Agent: Intent analyzed', intent);
      return intent;
    } catch (error) {
      logger.error('Intent Agent Error:', error);
      // Return default intent on error
      return {
        purpose: 'leisure',
        travelStyle: 'cultural',
        priorityInterests: tripData.interests || [],
        budgetCategory: this.categorizeBudget(tripData.budget),
        specialRequirements: [],
        estimatedDays: this.calculateDays(tripData.startDate, tripData.endDate),
        complexity: 'moderate'
      };
    }
  }

  categorizeBudget(budget) {
    if (!budget) return 'moderate';
    if (budget < 20000) return 'budget';
    if (budget < 50000) return 'moderate';
    return 'luxury';
  }

  calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

module.exports = IntentAgent;

