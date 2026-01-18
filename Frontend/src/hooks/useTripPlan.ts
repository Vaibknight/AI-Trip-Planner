import { useState, useCallback } from "react";
import { tripService } from "@/lib/api";
import { getCachedTripPlan, setCachedTripPlan, debugCache } from "@/lib/cache";
import type { TripPreferences } from "@/types/trip";
import type { ApiResponse } from "@/lib/api/shared-types";

export interface ProgressUpdate {
  step: string;
  status: "in_progress" | "completed";
  message: string;
}

interface UseTripPlanReturn {
  generatePlan: (preferences: TripPreferences, bypassCache?: boolean) => Promise<void>;
  plan: any | null;
  isLoading: boolean;
  error: string | null;
  progress: ProgressUpdate | null;
  isCached: boolean;
  clearError: () => void;
}

export function useTripPlan(): UseTripPlanReturn {
  const [plan, setPlan] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isCached, setIsCached] = useState(false);

  const generatePlan = useCallback(async (preferences: TripPreferences, bypassCache = false) => {
    setIsLoading(true);
    setError(null);
    setProgress(null);
    setPlan(null);
    setIsCached(false);

    // Check cache first (unless bypassed)
    if (!bypassCache) {
      try {
        const cacheDebug = debugCache(preferences);
        console.log('[useTripPlan] 🔍 Checking cache for preferences:', {
          origin: preferences.origin,
          country: preferences.country,
          state: preferences.state,
          duration: preferences.duration,
          travelers: preferences.travelers,
        });
        console.log('[useTripPlan] Cache Debug:', cacheDebug);
        
        const cachedPlan = getCachedTripPlan(preferences);
        if (cachedPlan && cachedPlan.plan) {
          console.log('[useTripPlan] ✅ Cache HIT! Using cached plan from localStorage, SKIPPING API call.');
          console.log('[useTripPlan] Cached plan details:', {
            cachedAt: cachedPlan.cachedAt,
            expiresAt: cachedPlan.expiresAt,
            hasPlan: !!cachedPlan.plan,
          });
          setIsCached(true);
          // Simulate a small delay for better UX (shows cache was used)
          await new Promise(resolve => setTimeout(resolve, 300));
          setPlan(cachedPlan.plan);
          setIsLoading(false);
          return; // CRITICAL: Return early to prevent API call
        } else {
          console.log('[useTripPlan] ❌ Cache MISS. No matching cached plan found. Proceeding with API call.');
        }
      } catch (error) {
        console.error('[useTripPlan] Error checking cache:', error);
        console.log('[useTripPlan] Proceeding with API call due to cache error.');
      }
    } else {
      console.log('[useTripPlan] ⚠️ Cache bypassed by user, making API call.');
    }

    let planSetFromStream = false;

    try {
      const response: ApiResponse<any> = await tripService.generatePlan(
        preferences,
        {
          onProgress: (data) => {
            // Update progress when progress events arrive
            if (data.step && data.status && data.message) {
              setProgress({
                step: data.step,
                status: data.status,
                message: data.message,
              });
            }
          },
          onEvent: (event, data) => {
            // Handle complete event - update plan immediately
            if (event === "complete" && data?.data?.trip) {
              const tripPlan = {
                ...data.data.trip,
                // Include itineraryHtml from data if available
                itineraryHtml: data.data.itineraryHtml || data.data.trip.itineraryHtml,
                budgetHtml: data.data.budgetHtml || data.data.trip.budgetHtml,
              };
              setPlan(tripPlan);
              planSetFromStream = true;
              setProgress(null);
              // Cache the plan immediately in localStorage
              try {
                setCachedTripPlan(preferences, tripPlan);
                console.log('[useTripPlan] ✅ Plan cached successfully in localStorage');
              } catch (cacheError) {
                console.error('[useTripPlan] Failed to cache plan:', cacheError);
              }
            }
          },
        }
      );

      if (response.success && response.data) {
        // Final update if not already set from streaming
        if (!planSetFromStream) {
          // Handle both old format (response.data is trip) and new format (response.data.data.trip)
          const tripData = response.data.trip || response.data;
          const planData = {
            ...tripData,
            itineraryHtml: response.data.itineraryHtml || tripData.itineraryHtml,
            budgetHtml: response.data.budgetHtml || tripData.budgetHtml,
          };
          setPlan(planData);
          // Cache the plan in localStorage
          try {
            setCachedTripPlan(preferences, planData);
            console.log('[useTripPlan] ✅ Plan cached successfully in localStorage');
          } catch (cacheError) {
            console.error('[useTripPlan] Failed to cache plan:', cacheError);
          }
        }
        setProgress(null); // Clear progress when complete
      } else {
        setError(
          response.error?.message || "Failed to generate trip plan. Please try again."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generatePlan,
    plan,
    isLoading,
    error,
    progress,
    isCached,
    clearError,
  };
}

