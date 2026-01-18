"use client";

import { useState, useEffect } from "react";
import TripForm from "@/components/TripForm";
import TripOutput from "@/components/TripOutput";
import AuthContainer from "@/components/auth/AuthContainer";
import { useTripPlan } from "@/hooks/useTripPlan";
import { useAuth } from "@/contexts/AuthContext";
import { clearExpiredCache } from "@/lib/cache";
import type { TripPreferences } from "@/types/trip";

export default function Home() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [tripPreferences, setTripPreferences] =
    useState<TripPreferences | null>(null);
  const { generatePlan, plan, isLoading, error, progress, isCached } = useTripPlan();

  const handleSubmit = async (preferences: TripPreferences) => {
    setTripPreferences(preferences);
    await generatePlan(preferences);
  };

  // Clear expired cache on mount
  useEffect(() => {
    clearExpiredCache();
  }, []);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth UI if not authenticated
  if (!isAuthenticated) {
    return <AuthContainer />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header with Title and User Info */}
        <header className="mb-12">
          {/* Main Header Bar */}
          <div className="flex items-center justify-between mb-8">
            {/* Left Side - Title */}
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                <span className="inline-block mr-2">✈️</span>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Trip Planner AI
                </span>
              </h1>
            </div>
            
            {/* Right Side - User Info */}
            <div className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-3 rounded-xl shadow-md border border-gray-200/50 dark:border-gray-700/50">
              {/* User Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                {user?.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  user?.email?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              
              {/* User Info */}
              <div className="hidden sm:block">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Welcome back
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                  {user?.name || user?.email}
                </p>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={logout}
                className="ml-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                title="Logout"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>
          
        </header>

        {/* Single Card with Scrollable Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 md:p-8">
            {/* Form Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                Trip Preferences
              </h2>
              <TripForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                initialValues={tripPreferences}
              />
            </div>

            {/* Divider */}
            {(tripPreferences || isLoading) && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>
            )}

            {/* Output Section */}
            {(tripPreferences || isLoading) && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Trip Plan
                  </h2>
                  {isCached && plan && (
                    <span className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Cached
                    </span>
                  )}
                </div>
                {error && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}
                {isLoading && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent"></div>
                      </div>
                      <div className="flex-1">
                        {progress ? (
                          <>
                            <p className="text-blue-800 dark:text-blue-200 font-medium flex items-center gap-2">
                              <span className="inline-block w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></span>
                              {progress.message}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full capitalize">
                                {progress.step}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                progress.status === 'completed' 
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                                  : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                              }`}>
                                {progress.status.replace('_', ' ')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="text-blue-800 dark:text-blue-200 font-medium">
                            Generating your trip plan...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {tripPreferences && (
                  <TripOutput preferences={tripPreferences} plan={plan} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
