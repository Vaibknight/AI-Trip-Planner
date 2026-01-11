"use client";

import type { TripPreferences } from "@/types/trip";

interface TripOutputProps {
  preferences: TripPreferences;
  plan?: any | null;
}

export default function TripOutput({ preferences, plan }: TripOutputProps) {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Your Trip Preferences
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generated at {new Date().toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Destination
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {preferences.destination}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Travel Type
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white capitalize">
            {preferences.travelType}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Duration
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {preferences.duration} days
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Season
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white capitalize">
            {preferences.season}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Budget
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {preferences.currency} {preferences.budget.toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Travelers
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {preferences.travelers} {preferences.travelers === 1 ? "Person" : "People"}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Currency
          </h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {preferences.currency}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
          Interests
        </h3>
        <div className="flex flex-wrap gap-2">
          {preferences.interests.map((interest, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium capitalize"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      {plan && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Generated Itinerary
          </h3>
          
          {/* Display HTML Itinerary if available */}
          {plan.itineraryHtml && (
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 animate-fade-in">
              <div 
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: plan.itineraryHtml }}
              />
            </div>
          )}

          {/* Trip Info */}
          {plan.title && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Trip Details
              </h4>
              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <p><strong>Title:</strong> {plan.title}</p>
                {plan.destination && <p><strong>Destination:</strong> {plan.destination}</p>}
                {plan.duration && <p><strong>Duration:</strong> {plan.duration} days</p>}
                {plan.id && <p><strong>Trip ID:</strong> {plan.id}</p>}
              </div>
            </div>
          )}

          {/* Fallback: Display structured itinerary if available (old format) */}
          {!plan.itineraryHtml && plan.itinerary && (
            <>
              {/* Summary if available */}
              {plan.itinerary.summary && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Trip Summary
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {plan.itinerary.summary}
                  </p>
                </div>
              )}

              {/* Estimated Cost */}
              {plan.itinerary.estimatedCost && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Estimated Cost
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {plan.itinerary.estimatedCost.currency}{" "}
                    {plan.itinerary.estimatedCost.min.toLocaleString()} -{" "}
                    {plan.itinerary.estimatedCost.currency}{" "}
                    {plan.itinerary.estimatedCost.max.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Daily Itinerary */}
              {plan.itinerary.days && plan.itinerary.days.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Daily Itinerary
                  </h4>
                  {plan.itinerary.days.map((day, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
                    >
                      <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Day {day.day}
                        {day.date && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                            ({day.date})
                          </span>
                        )}
                      </h5>
                      
                      {day.activities && day.activities.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Activities:
                          </h6>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {day.activities.map((activity, idx) => (
                              <li key={idx}>
                                <strong>{activity.name}</strong> - {activity.time} (
                                {activity.duration})
                                {activity.cost && (
                                  <span className="ml-2">
                                    - {preferences.currency} {activity.cost}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {day.meals && day.meals.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Meals:
                          </h6>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {day.meals.map((meal, idx) => (
                              <li key={idx}>
                                <strong className="capitalize">{meal.type}</strong>:{" "}
                                {meal.name} at {meal.location}
                                {meal.cost && (
                                  <span className="ml-2">
                                    - {preferences.currency} {meal.cost}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {plan.itinerary.recommendations &&
                plan.itinerary.recommendations.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Recommendations
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                      {plan.itinerary.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

