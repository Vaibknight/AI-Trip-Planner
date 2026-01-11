const openRouterClient = require('../openRouterClient');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class OptimizerAgent {
  constructor() {
    this.client = openRouterClient;
  }

  /**
   * Optimize the complete trip plan
   */
  async optimizePlan(tripData, intent, destinations, itinerary, budget) {
    try {
      const prompt = `Optimize this trip plan for the best experience:
      
      Trip Details:
      - Duration: ${intent.estimatedDays} days
      - Travelers: ${tripData.travelers || 1}
      - Budget: ${budget.total} ${budget.currency}
      - Travel Style: ${intent.travelStyle}
      - Interests: ${intent.priorityInterests.join(', ')}
      
      Current Plan:
      - Destinations: ${destinations.mainDestination.name}
      - Activities: ${itinerary.itinerary?.length || 0} days
      - Budget Status: ${budget.budgetStatus}
      - Budget Variance: ${budget.variance} ${budget.currency}
      
      Optimize for:
      1. Time efficiency (minimize travel time, maximize experience)
      2. Cost efficiency (if over budget, suggest alternatives)
      3. Experience quality (ensure activities match interests)
      4. Practicality (realistic timing, rest periods)
      5. Flexibility (suggest alternatives)
      
      Respond in JSON format:
      {
        "optimizations": [
          {
            "type": "time|cost|experience|practicality",
            "suggestion": "Optimization suggestion",
            "impact": "high|medium|low",
            "estimatedSavings": 0,
            "estimatedTimeSaved": 0
          }
        ],
        "alternativeActivities": [
          {
            "day": 1,
            "original": "Activity name",
            "alternative": "Alternative activity",
            "reason": "Why this is better",
            "costDifference": 0
          }
        ],
        "routeOptimization": {
          "suggested": true,
          "changes": ["change1", "change2"]
        },
        "finalRecommendations": ["recommendation1", "recommendation2"]
      }`;

      const response = await this.client.chatCompletion({
        model: config.openRouterModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert trip optimizer. Analyze and optimize travel plans for efficiency, cost-effectiveness, and quality of experience.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        // Free models use reasoning tokens - need much higher limit (reasoning can use 80-90% of tokens)
        max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 1500 : 400,
        response_format: { type: 'json_object' }
      });

      const optimizations = this.client.parseJSONResponse(response.content);
      logger.info('Optimizer Agent: Plan optimized', { optimizations: optimizations.optimizations?.length });
      return optimizations;
    } catch (error) {
      logger.error('Optimizer Agent Error:', error);
      return {
        optimizations: [],
        alternativeActivities: [],
        routeOptimization: { suggested: false, changes: [] },
        finalRecommendations: []
      };
    }
  }
}

module.exports = OptimizerAgent;

