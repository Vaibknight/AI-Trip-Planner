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
      // Use tripData.budget as the target - this is the user's input budget
      const targetBudget = tripData.budget || 30000;
      const currency = tripData.currency || 'INR';
      
      logger.info('Budget Agent: Starting budget estimation', {
        targetBudget,
        currency,
        travelers,
        totalDays,
        budgetRange: tripData.budgetRange
      });

      const prompt = `Estimate and optimize the budget for this trip:
      
      Duration: ${totalDays} days
      Travelers: ${travelers}
      Target Budget: ${targetBudget} ${currency} (THIS IS THE MAXIMUM - total MUST NOT exceed this)
      Budget Category: ${intent.budgetCategory}
      Destination: ${destinations.mainDestination.name}
      Transportation: ${destinations.transportation.recommended}
      Activities: ${itinerary.itinerary?.length || 0} days of activities
      
      CRITICAL REQUIREMENT: The total budget MUST be equal to or less than ${targetBudget} ${currency}. 
      Distribute the budget across categories proportionally while staying within this limit.
      
      Calculate:
      1. Accommodation costs (per night)
      2. Transportation costs (to/from and local)
      3. Food costs (per day)
      4. Activity/attraction costs
      5. Miscellaneous costs
      6. Total estimated cost (MUST be ≤ ${targetBudget} ${currency})
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
      
      // Validate budget structure
      if (!budget.breakdown || !budget.total) {
        logger.warn('Budget Agent: Invalid budget structure from AI, using fallback');
        throw new Error('Invalid budget structure from AI');
      }
      
      // ALWAYS normalize budget to match targetBudget exactly
      // This ensures the user's input budget is respected
      if (budget.total !== targetBudget && budget.total > 0) {
        logger.info('Budget Agent: Normalizing budget to match target', {
          generatedTotal: budget.total,
          targetBudget: targetBudget,
          difference: budget.total - targetBudget
        });
        
        // Calculate scale factor to normalize to target budget
        const scaleFactor = targetBudget / budget.total;
        
        // Scale all breakdown items proportionally
        budget.breakdown.accommodation = Math.round((budget.breakdown.accommodation || 0) * scaleFactor);
        budget.breakdown.transportation = Math.round((budget.breakdown.transportation || 0) * scaleFactor);
        budget.breakdown.food = Math.round((budget.breakdown.food || 0) * scaleFactor);
        budget.breakdown.activities = Math.round((budget.breakdown.activities || 0) * scaleFactor);
        
        // Handle both 'miscellaneous' and 'other' fields
        const miscAmount = budget.breakdown.miscellaneous || budget.breakdown.other || 0;
        budget.breakdown.miscellaneous = Math.round(miscAmount * scaleFactor);
        if (budget.breakdown.other !== undefined) {
          budget.breakdown.other = budget.breakdown.miscellaneous;
        }
        
        // Recalculate total to check for rounding differences
        const recalculatedTotal = (budget.breakdown.accommodation || 0) +
          (budget.breakdown.transportation || 0) +
          (budget.breakdown.food || 0) +
          (budget.breakdown.activities || 0) +
          (budget.breakdown.miscellaneous || budget.breakdown.other || 0);
        
        // Adjust miscellaneous to account for any rounding differences
        const difference = targetBudget - recalculatedTotal;
        if (Math.abs(difference) > 0) {
          budget.breakdown.miscellaneous = Math.max(0, (budget.breakdown.miscellaneous || 0) + difference);
          if (budget.breakdown.other !== undefined) {
            budget.breakdown.other = budget.breakdown.miscellaneous;
          }
        }
      }
      
      // Always set total to targetBudget to ensure exact match
      budget.total = targetBudget;
      budget.perPerson = targetBudget / travelers;
      budget.perDay = targetBudget / totalDays;
      
      // Calculate variance
      budget.variance = budget.total - targetBudget;
      if (Math.abs(budget.variance) < targetBudget * 0.1) {
        budget.budgetStatus = 'within';
      } else if (budget.variance > 0) {
        budget.budgetStatus = 'over';
      } else {
        budget.budgetStatus = 'under';
      }

      logger.info('Budget Agent: Budget estimated', { 
        total: budget.total, 
        targetBudget: targetBudget,
        status: budget.budgetStatus,
        variance: budget.variance
      });
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

