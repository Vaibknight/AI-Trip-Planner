/**
 * Derives trip intent from structured trip input — no LLM call.
 * Keeps the same shape as IntentAgent.analyzeIntent success responses for downstream compatibility.
 */

function categorizeBudget(budget) {
  if (budget == null || budget === '') return 'moderate';
  const n = Number(budget);
  if (Number.isNaN(n)) return 'moderate';
  if (n < 20000) return 'budget';
  if (n < 50000) return 'moderate';
  return 'luxury';
}

function estimateDays(tripData) {
  if (tripData.duration != null && tripData.duration !== '') {
    const d = parseInt(String(tripData.duration), 10);
    if (!Number.isNaN(d) && d > 0) return d;
  }
  if (tripData.startDate && tripData.endDate) {
    const start = new Date(tripData.startDate);
    const end = new Date(tripData.endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }
  return 5;
}

function deriveIntentFromTripData(tripData = {}) {
  const travelType = tripData.travelType || 'leisure';
  const travelStyleMap = {
    leisure: 'relaxation',
    business: 'business',
    adventure: 'adventure',
    cultural: 'cultural'
  };

  const budgetCategory =
    typeof tripData.budgetRange === 'string' && tripData.budgetRange.trim()
      ? String(tripData.budgetRange).toLowerCase()
      : categorizeBudget(tripData.budget);

  const derivedTravelStyle =
    tripData.travelStyle ||
    travelStyleMap[travelType] ||
    'cultural';

  let purpose = 'leisure';
  if (travelType === 'business') purpose = 'business';
  else if (travelType === 'adventure') purpose = 'adventure';

  const interests = tripData.interests;
  const priorityInterests = Array.isArray(interests)
    ? interests
    : typeof interests === 'string' && interests
      ? interests.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  return {
    purpose,
    travelStyle: derivedTravelStyle,
    priorityInterests,
    budgetCategory,
    specialRequirements: [],
    estimatedDays: estimateDays(tripData),
    complexity: 'moderate'
  };
}

module.exports = {
  deriveIntentFromTripData,
  categorizeBudget,
  estimateDays
};
