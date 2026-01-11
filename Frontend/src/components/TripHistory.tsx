"use client";

import { useState, useEffect } from "react";
import { getTripHistory, deleteTripFromHistory, clearTripHistory, type SavedTrip } from "@/lib/storage";
import type { TripPreferences } from "@/types/trip";

interface TripHistoryProps {
  onLoadTrip: (trip: TripPreferences) => void;
}

export default function TripHistory({ onLoadTrip }: TripHistoryProps) {
  const [history, setHistory] = useState<SavedTrip[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const refreshHistory = () => {
    setHistory(getTripHistory());
  };

  useEffect(() => {
    refreshHistory();
    
    // Listen for storage changes (in case of multiple tabs)
    const handleStorageChange = () => {
      refreshHistory();
    };
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event when trip is saved in same tab
    const handleTripSaved = () => {
      refreshHistory();
    };
    window.addEventListener("tripSaved", handleTripSaved);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tripSaved", handleTripSaved);
    };
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTripFromHistory(id);
    setHistory(getTripHistory());
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all trip history?")) {
      clearTripHistory();
      setHistory([]);
    }
  };

  const handleLoadTrip = (trip: SavedTrip) => {
    const { id, createdAt, plan, ...preferences } = trip;
    onLoadTrip(preferences);
    setIsOpen(false);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* History Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all z-40 flex items-center gap-2"
        title="View Trip History"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {history.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {history.length}
          </span>
        )}
      </button>

      {/* History Sidebar */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Trip History
              </h2>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    No trip history yet
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                    Your saved trips will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((trip) => (
                    <div
                      key={trip.id}
                      className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
                      onClick={() => handleLoadTrip(trip)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {trip.destination}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded capitalize">
                              {trip.travelType}
                            </span>
                            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              {trip.duration} days
                            </span>
                            <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded capitalize">
                              {trip.season}
                            </span>
                            <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                              {trip.travelers} {trip.travelers === 1 ? "person" : "people"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {trip.interests.slice(0, 3).map((interest, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded capitalize"
                              >
                                {interest}
                              </span>
                            ))}
                            {trip.interests.length > 3 && (
                              <span className="text-xs px-2 py-0.5 text-gray-500 dark:text-gray-400">
                                +{trip.interests.length - 3} more
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(trip.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(trip.id, e)}
                          className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete trip"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

