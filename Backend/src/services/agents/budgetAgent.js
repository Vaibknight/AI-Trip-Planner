const openRouterClient = require('../openRouterClient');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class BudgetAgent {
  constructor() {
    this.client = openRouterClient;
  }

  /**
   * Estimate and optimize budget
   */
  async estimateBudget(tripData, intent, destinations, itinerary) {
    try {
      const totalDays = intent.estimatedDays;
      const travelers = tripData.travelers || 1;
      const targetBudget = tripData.budget || 30000;
      const currency = tripData.currency || 'INR';

      const prompt = `Estimate and optimize the budget for this trip:
      
      Duration: ${totalDays} days
      Travelers: ${travelers}
      Target Budget: ${targetBudget} ${currency}
      Budget Category: ${intent.budgetCategory}
      Destination: ${destinations.mainDestination.name}
      Transportation: ${destinations.transportation.recommended}
      Activities: ${itinerary.itinerary?.length || 0} days of activities
      
      Calculate:
      1. Accommodation costs (per night)
      2. Transportation costs (to/from and local)
      3. Food costs (per day)
      4. Activity/attraction costs
      5. Miscellaneous costs
      6. Total estimated cost
      7. Budget optimization suggestions
      
      Respond in JSON format:
      {
        "breakdown": {
          "accommodation": 10000,
          "transportation": 8000,
          "food": 6000,
          "activities": 4000,
          "miscellaneous": 2000
        },
        "total": 30000,
        "perPerson": 15000,
        "perDay": 3000,
        "currency": "INR",
        "optimizations": [
          {
            "category": "accommodation",
            "suggestion": "Consider budget hotels",
            "potentialSavings": 2000
          }
        ],
        "budgetStatus": "within|over|under",
        "variance": 0
      }`;

      const response = await this.client.chatCompletion({
        model: config.openRouterModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel budget planner. Provide accurate cost estimates and practical budget optimization suggestions.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        // Free models use reasoning tokens - need much higher limit (reasoning can use 80-90% of tokens)
        max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 800 : 400,
        response_format: { type: 'json_object' }
      });

      const budget = this.client.parseJSONResponse(response.content);
      
      // Calculate variance
      budget.variance = budget.total - targetBudget;
      if (Math.abs(budget.variance) < targetBudget * 0.1) {
        budget.budgetStatus = 'within';
      } else if (budget.variance > 0) {
        budget.budgetStatus = 'over';
      } else {
        budget.budgetStatus = 'under';
      }

      logger.info('Budget Agent: Budget estimated', { total: budget.total, status: budget.budgetStatus });
      return budget;
    } catch (error) {
      logger.error('Budget Agent Error:', error);
      // Return basic budget structure on error
      const totalDays = intent.estimatedDays;
      const travelers = tripData.travelers || 1;
      const targetBudget = tripData.budget || 30000;
      
      return {
        breakdown: {
          accommodation: targetBudget * 0.4,
          transportation: targetBudget * 0.3,
          food: targetBudget * 0.15,
          activities: targetBudget * 0.1,
          miscellaneous: targetBudget * 0.05
        },
        total: targetBudget,
        perPerson: targetBudget / travelers,
        perDay: targetBudget / totalDays,
        currency: tripData.currency || 'INR',
        optimizations: [],
        budgetStatus: 'within',
        variance: 0
      };
    }
  }
}

module.exports = BudgetAgent;

