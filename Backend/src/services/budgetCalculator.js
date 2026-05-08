const logger = require('../utils/logger');
const { getTargetLanguageName, resolvePreferredLanguage } = require('../utils/preferredLanguage');

/**
 * Formula-based budget matching user target — no LLM.
 * Output shape matches BudgetAgent + compileTripPlan expectations.
 */
function calculateBudgetFromTripData(tripData, intent, destinations, _itinerary) {
  const totalDays = Math.max(1, intent.estimatedDays || 1);
  const travelers = Math.max(1, parseInt(tripData.travelers, 10) || 1);
  const targetBudget = Number(tripData.budget) > 0 ? Number(tripData.budget) : 30000;
  const currency = tripData.currency || 'INR';

  const category = (intent.budgetCategory || 'moderate').toLowerCase();
  let ratios = {
    accommodation: 0.38,
    transportation: 0.22,
    food: 0.2,
    activities: 0.14,
    miscellaneous: 0.06
  };
  if (category === 'budget') {
    ratios = { accommodation: 0.35, transportation: 0.28, food: 0.22, activities: 0.1, miscellaneous: 0.05 };
  } else if (category === 'luxury') {
    ratios = { accommodation: 0.45, transportation: 0.18, food: 0.18, activities: 0.14, miscellaneous: 0.05 };
  }

  const breakdown = {
    accommodation: Math.round(targetBudget * ratios.accommodation),
    transportation: Math.round(targetBudget * ratios.transportation),
    food: Math.round(targetBudget * ratios.food),
    activities: Math.round(targetBudget * ratios.activities),
    miscellaneous: Math.round(targetBudget * ratios.miscellaneous)
  };

  let sum =
    breakdown.accommodation +
    breakdown.transportation +
    breakdown.food +
    breakdown.activities +
    breakdown.miscellaneous;
  const drift = targetBudget - sum;
  if (drift !== 0) {
    breakdown.miscellaneous = Math.max(0, breakdown.miscellaneous + drift);
    sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  }

  const lang = getTargetLanguageName(resolvePreferredLanguage(tripData));
  const destName =
    destinations?.mainDestination?.name ||
    destinations?.mainDestination?.city ||
    tripData.state ||
    tripData.destination ||
    'destination';

  const optimizations = [
    {
      category: 'accommodation',
      suggestion:
        lang === 'English'
          ? `Compare stays in ${destName} — book slightly off-center for better nightly rates.`
          : `Compare stays in ${destName} for value.`,
      potentialSavings: Math.round(targetBudget * 0.05)
    },
    {
      category: 'food',
      suggestion:
        lang === 'English'
          ? 'Mix sit-down meals with local markets or lunch specials.'
          : 'Balance restaurants with local markets.',
      potentialSavings: Math.round(targetBudget * 0.03)
    }
  ];

  logger.info('BudgetCalculator: computed formula budget', {
    total: targetBudget,
    currency,
    travelers,
    totalDays
  });

  return {
    breakdown,
    total: targetBudget,
    perPerson: Math.round(targetBudget / travelers),
    perDay: Math.round(targetBudget / totalDays),
    currency,
    optimizations,
    budgetStatus: 'within',
    variance: 0
  };
}

module.exports = {
  calculateBudgetFromTripData
};
