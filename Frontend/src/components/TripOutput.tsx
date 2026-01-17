"use client";

import type { TripPreferences } from "@/types/trip";
import type { TripData } from "@/lib/api/types";

interface TripOutputProps {
  preferences: TripPreferences;
  plan?: TripData | null;
}

export default function TripOutput({ preferences, plan }: TripOutputProps) {
  if (!plan) return null;

  // Debug: Log to verify data structure
  console.log("Full plan object:", plan);
  console.log("Transportation:", plan.transportation);
  console.log("Local Transportation exists:", !!plan.transportation?.localTransportation);
  if (plan.transportation?.localTransportation) {
    console.log("Local Transportation data:", plan.transportation.localTransportation);
    console.log("Local Transportation keys:", Object.keys(plan.transportation.localTransportation));
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Trip Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">{plan.title}</h2>
        {plan.description && (
          <p className="text-blue-100 text-lg">{plan.description}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          {plan.origin && (
            <div>
              <span className="text-blue-200">From:</span>{" "}
              <span className="font-semibold">{plan.origin}</span>
            </div>
          )}
          {plan.destination && (
            <div>
              <span className="text-blue-200">To:</span>{" "}
              <span className="font-semibold">{plan.destination}</span>
            </div>
          )}
          {plan.duration && (
            <div>
              <span className="text-blue-200">Duration:</span>{" "}
              <span className="font-semibold">{plan.duration} days</span>
            </div>
          )}
          {plan.travelers && (
            <div>
              <span className="text-blue-200">Travelers:</span>{" "}
              <span className="font-semibold">{plan.travelers}</span>
            </div>
          )}
        </div>
        {plan.startDate && plan.endDate && (
          <div className="mt-3 text-sm text-blue-100">
            <span className="font-semibold">Trip Dates:</span>{" "}
            {formatDateTime(plan.startDate)} - {formatDateTime(plan.endDate)}
          </div>
        )}
      </div>

      {/* Destinations Info */}
      {plan.destinations && plan.destinations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📍 Destinations
          </h3>
          <div className="space-y-4">
            {plan.destinations.map((dest, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                  {dest.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {dest.city}, {dest.country}
                </p>
                {dest.description && (
                  <p className="text-gray-700 dark:text-gray-300 mt-2">
                    {dest.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Breakdown */}
      {plan.budget && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            💰 Budget Breakdown
          </h3>
          
          {/* Budget Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {plan.budget.currency} {plan.budget.total.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Per Person</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {plan.budget.currency} {plan.budget.perPerson.toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Per Day</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {plan.budget.currency} {plan.budget.perDay.toLocaleString()}
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {plan.budget.status || "Within Budget"}
              </p>
            </div>
          </div>

          {/* Budget Breakdown by Category */}
          {plan.budget.breakdown && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Category Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(plan.budget.breakdown).map(([category, amount]) => {
                      const percentage = plan.budget.total > 0 
                        ? ((amount as number) / plan.budget.total * 100).toFixed(1)
                        : "0.0";
                      const currencySymbol = plan.budget.currency === "INR" ? "₹" : 
                                           plan.budget.currency === "USD" ? "$" :
                                           plan.budget.currency === "EUR" ? "€" :
                                           plan.budget.currency === "GBP" ? "£" :
                                           plan.budget.currency;
                      const categoryLabels: Record<string, string> = {
                        accommodation: "🏨 Accommodation",
                        transportation: "🚗 Transportation",
                        food: "🍽️ Food & Dining",
                        activities: "🎯 Activities & Attractions",
                        other: "📦 Miscellaneous",
                      };
                      return (
                        <tr key={category} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="px-4 py-3 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
                            <strong>{categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1)}</strong>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
                            {currencySymbol} {(amount as number).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                            {percentage}%
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-green-50 dark:bg-green-900/20 font-bold">
                      <td className="px-4 py-3 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
                        <strong>Total</strong>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
                        {plan.budget.currency === "INR" ? "₹" : 
                         plan.budget.currency === "USD" ? "$" :
                         plan.budget.currency === "EUR" ? "€" :
                         plan.budget.currency === "GBP" ? "£" :
                         plan.budget.currency} {plan.budget.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                <strong>Per Person:</strong> {plan.budget.currency === "INR" ? "₹" : 
                 plan.budget.currency === "USD" ? "$" :
                 plan.budget.currency === "EUR" ? "€" :
                 plan.budget.currency === "GBP" ? "£" :
                 plan.budget.currency} {plan.budget.perPerson.toLocaleString()} | <strong>Per Day:</strong> {plan.budget.currency === "INR" ? "₹" : 
                 plan.budget.currency === "USD" ? "$" :
                 plan.budget.currency === "EUR" ? "€" :
                 plan.budget.currency === "GBP" ? "£" :
                 plan.budget.currency} {Math.round(plan.budget.perDay).toLocaleString()}
              </p>
            </div>
          )}

          {/* Budget Optimizations */}
          {plan.budget.optimizations && plan.budget.optimizations.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                💡 Budget Optimizations
              </h4>
              <div className="space-y-3">
                {plan.budget.optimizations.map((opt, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white capitalize">
                        {opt.category}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {opt.suggestion}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        Save {plan.budget.currency} {opt.potentialSavings.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget HTML if available */}
          {plan.budgetHtml && (
            <div className="mt-6">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: plan.budgetHtml }}
              />
            </div>
          )}
        </div>
      )}

      {/* Transportation Details */}
      {plan.transportation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            🚗 Transportation
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recommended</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {plan.transportation.recommended}
              </p>
            </div>

            {plan.transportation.options && plan.transportation.options.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Options</p>
                <div className="flex flex-wrap gap-2">
                  {plan.transportation.options.map((option, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {plan.transportation.estimatedCost && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Estimated Cost</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {plan.budget?.currency || "USD"} {plan.transportation.estimatedCost.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local Transportation - Separate Section */}
      {plan.transportation?.localTransportation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            🚇 Local Transportation Options
          </h3>
          {(plan.transportation.localTransportation.metro ||
            plan.transportation.localTransportation.autoRickshaw ||
            plan.transportation.localTransportation.eRickshaw ||
            plan.transportation.localTransportation.buses ||
            plan.transportation.localTransportation.other) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.transportation.localTransportation?.metro && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700 shadow-sm">
                <p className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-2xl">🚇</span> Metro
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {plan.transportation.localTransportation.metro}
                </p>
              </div>
            )}
            {plan.transportation.localTransportation?.autoRickshaw && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-4 border border-green-200 dark:border-green-700 shadow-sm">
                <p className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-2xl">🛺</span> Auto Rickshaw
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {plan.transportation.localTransportation.autoRickshaw}
                </p>
              </div>
            )}
            {plan.transportation.localTransportation?.eRickshaw && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-4 border border-purple-200 dark:border-purple-700 shadow-sm">
                <p className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-2xl">🛵</span> E-Rickshaw
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {plan.transportation.localTransportation.eRickshaw}
                </p>
              </div>
            )}
            {plan.transportation.localTransportation?.buses && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-lg p-4 border border-orange-200 dark:border-orange-700 shadow-sm">
                <p className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-2xl">🚌</span> Buses
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {plan.transportation.localTransportation.buses}
                </p>
              </div>
            )}
            {plan.transportation.localTransportation?.other && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm md:col-span-2">
                <p className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-2xl">🚕</span> Other Transportation Options
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {plan.transportation.localTransportation.other}
                </p>
              </div>
            )}
          </div>
          )}
          {plan.transportation.localTransportation?.tips &&
            plan.transportation.localTransportation.tips.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-6 border-2 border-blue-300 dark:border-blue-700">
                <p className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-lg">
                  <span className="text-2xl">💡</span> Transportation Tips
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {plan.transportation.localTransportation.tips.map((tip, idx) => (
                    <li key={idx} className="leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      {/* HTML Itinerary */}
      {plan.itineraryHtml && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📅 Detailed Itinerary
          </h3>
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: plan.itineraryHtml }}
          />
        </div>
      )}

      {/* Structured Itinerary (if HTML not available) */}
      {!plan.itineraryHtml && plan.itinerary && plan.itinerary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📅 Daily Itinerary
          </h3>
          <div className="space-y-6">
            {plan.itinerary.map((day, idx) => (
              <div
                key={idx}
                className="border-l-4 border-blue-500 pl-4 pb-4 last:pb-0"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Day {day.day}: {day.title}
                  </h4>
                  {day.estimatedCost && (
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {plan.budget?.currency || "USD"} {day.estimatedCost.toLocaleString()}
                    </span>
                  )}
                </div>
                {day.date && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {formatDate(day.date)}
                  </p>
                )}

                {day.activities && day.activities.length > 0 && (
                  <div className="space-y-2">
                    {day.activities.map((activity, actIdx) => (
                      <div
                        key={actIdx}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {activity.name}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {activity.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {activity.startTime && activity.endTime && (
                                <span>
                                  ⏰ {activity.startTime} - {activity.endTime}
                                </span>
                              )}
                              {activity.location && (
                                <span>📍 {activity.location}</span>
                              )}
                              {activity.type && (
                                <span className="capitalize">🏷️ {activity.type}</span>
                              )}
                            </div>
                          </div>
                          {activity.cost && (
                            <div className="text-right ml-4">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {activity.cost.currency} {activity.cost.amount.toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                        {activity.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                            {activity.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {day.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 italic">
                    {day.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips and Recommendations */}
      {(plan.tips && plan.tips.length > 0) ||
        (plan.recommendations && plan.recommendations.length > 0) ||
        (plan.highlights && plan.highlights.length > 0) ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            💡 Tips & Recommendations
          </h3>
          <div className="space-y-4">
            {plan.highlights && plan.highlights.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Highlights
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                  {plan.highlights.map((highlight, idx) => (
                    <li key={idx}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.tips && plan.tips.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Tips</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                  {plan.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.recommendations && plan.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Recommendations
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                  {plan.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
