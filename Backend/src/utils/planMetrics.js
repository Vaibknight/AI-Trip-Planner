/**
 * Compute generation-quality metrics for a trip plan response.
 * Throughput is derived from serialized plan size over wall time (characters/sec).
 * Pipeline error rate reflects optional subsystems that degraded (itinerary / weather / guidance text).
 * Recommendation accuracy is a heuristic match against stated interests and budget fit.
 */

function computeRecommendationAccuracy(tripPlan, tripRequestData) {
  let score = 52;
  const interests = (tripRequestData?.interests || []).map((i) =>
    String(i).toLowerCase().trim()
  ).filter(Boolean);

  const textBlob = [
    ...(tripPlan?.recommendations || []).map(String),
    ...(tripPlan?.highlights || []).map(String),
    ...(tripPlan?.tips || []).map(String),
    (tripPlan?.description && String(tripPlan.description)) || '',
    JSON.stringify(tripPlan?.itinerary || []),
  ]
    .join(' ')
    .toLowerCase();

  if (interests.length) {
    let matched = 0;
    for (const term of interests) {
      if (term.length > 1 && textBlob.includes(term)) matched += 1;
    }
    score += Math.min(38, Math.round((matched / interests.length) * 38));
  } else {
    score += 18;
  }

  const budgetTotal = tripPlan?.budget?.total;
  const targetBudget = Number(tripRequestData?.budget);
  if (budgetTotal && targetBudget > 0) {
    const ratio = budgetTotal / targetBudget;
    if (ratio >= 0.85 && ratio <= 1.15) score += 10;
    else if (ratio >= 0.7 && ratio <= 1.35) score += 5;
  }

  const planStyle = tripPlan?.preferences?.travelStyle;
  const reqStyle = tripRequestData?.travelStyle;
  if (planStyle && reqStyle && planStyle === reqStyle) {
    score += 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function computeGenerationMetrics(tripPlan, tripRequestData, elapsedMs) {
  const safeElapsed = Math.max(Number(elapsedMs) || 0, 1);
  let payloadSize = 0;
  try {
    payloadSize = JSON.stringify(tripPlan || {}).length;
  } catch {
    payloadSize = 0;
  }
  const throughputCharsPerSec = Math.round((payloadSize / safeElapsed) * 1000);

  const itineraryDays = Array.isArray(tripPlan?.itinerary) ? tripPlan.itinerary : [];
  const hasItinerary = itineraryDays.some((d) => (d?.activities?.length || 0) > 0);

  const hasWeather = !!(
    tripPlan?.weather?.current ||
    (tripPlan?.weather?.forecast && tripPlan.weather.forecast.length > 0)
  );

  const recs = tripPlan?.recommendations;
  const hasRecs = Array.isArray(recs) ? recs.length > 0 : !!recs;
  const hasHighlights = Array.isArray(tripPlan?.highlights) && tripPlan.highlights.length > 0;
  const hasGuidanceText = hasRecs || hasHighlights;

  const checks = [
    { ok: hasItinerary },
    { ok: hasWeather },
    { ok: hasGuidanceText }
  ];
  const failed = checks.filter((c) => !c.ok).length;
  const pipelineErrorRatePercent =
    Math.round((failed / checks.length) * 1000) / 10;

  const recommendationAccuracyPercent = computeRecommendationAccuracy(
    tripPlan,
    tripRequestData
  );

  return {
    responseTimeMs: Math.round(safeElapsed),
    throughputCharsPerSec,
    pipelineErrorRatePercent,
    recommendationAccuracyPercent
  };
}

module.exports = {
  computeGenerationMetrics,
  computeRecommendationAccuracy
};
