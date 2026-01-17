"use client";

import { useState, useEffect } from "react";
import Dropdown from "./ui/Dropdown";
import MultiSelect from "./ui/MultiSelect";
import {
  CITIES,
  TRAVEL_TYPES,
  INTERESTS,
  SEASONS,
  DURATIONS,
  TRAVELERS,
  CURRENCIES,
} from "@/lib/constants";
import type { TripPreferences } from "@/types/trip";

interface TripFormProps {
  onSubmit: (preferences: TripPreferences) => void;
  isLoading?: boolean;
  initialValues?: TripPreferences | null;
}

export default function TripForm({
  onSubmit,
  isLoading = false,
  initialValues,
}: TripFormProps) {
  const [preferences, setPreferences] = useState<TripPreferences>(
    initialValues || {
      origin: "",
      state: "",
      travelType: "",
      interests: [],
      season: "",
      duration: 7,
      budgetRangeString: "",
      travelers: 2,
      currency: "USD",
      startDateTime: "",
      endDateTime: "",
    }
  );

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues) {
      setPreferences(initialValues);
    }
  }, [initialValues]);

  // Update departure datetime min when arrival datetime changes
  useEffect(() => {
    if (preferences.startDateTime && preferences.endDateTime) {
      if (preferences.endDateTime < preferences.startDateTime) {
        setPreferences((prev) => ({
          ...prev,
          endDateTime: prev.startDateTime,
        }));
      }
    }
  }, [preferences.startDateTime, preferences.endDateTime]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      preferences.origin &&
      preferences.state &&
      preferences.travelType &&
      preferences.interests.length > 0 &&
      preferences.season &&
      preferences.duration &&
      preferences.budgetRangeString &&
      preferences.travelers &&
      preferences.currency &&
      preferences.startDateTime &&
      preferences.endDateTime
    ) {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string for API
      // datetime-local gives us local time, we need to convert to UTC ISO string
      const payload: TripPreferences = {
        ...preferences,
        startDateTime: preferences.startDateTime
          ? new Date(preferences.startDateTime).toISOString()
          : undefined,
        endDateTime: preferences.endDateTime
          ? new Date(preferences.endDateTime).toISOString()
          : undefined,
      };
      onSubmit(payload);
    }
  };

  const cityOptions = CITIES.map((city) => ({ value: city, label: city }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Origin <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={preferences.origin || ""}
            onChange={(e) =>
              setPreferences({ ...preferences, origin: e.target.value })
            }
            placeholder="Enter origin city (e.g., New York)"
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 dark:text-white"
          />
        </div>

        <Dropdown
          label="State"
          options={cityOptions}
          value={preferences.state}
          onChange={(value) =>
            setPreferences({ ...preferences, state: value as string })
          }
          placeholder="Select state"
          required
        />

        <Dropdown
          label="Travel Type"
          options={TRAVEL_TYPES}
          value={preferences.travelType}
          onChange={(value) =>
            setPreferences({ ...preferences, travelType: value as string })
          }
          placeholder="Select travel type"
          required
        />

        <Dropdown
          label="Season"
          options={SEASONS}
          value={preferences.season}
          onChange={(value) =>
            setPreferences({ ...preferences, season: value as string })
          }
          placeholder="Select season"
          required
        />

        <Dropdown
          label="Duration"
          options={DURATIONS}
          value={preferences.duration}
          onChange={(value) =>
            setPreferences({ ...preferences, duration: value as number })
          }
          placeholder="Select duration"
          required
        />

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Budget Range String <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={preferences.budgetRangeString || ""}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                budgetRangeString: e.target.value,
              })
            }
            placeholder="Enter budget range string (e.g., 10000)"
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 dark:text-white"
          />
        </div>

        <Dropdown
          label="Number of Travelers"
          options={TRAVELERS}
          value={preferences.travelers}
          onChange={(value) =>
            setPreferences({ ...preferences, travelers: value as number })
          }
          placeholder="Select number of travelers"
          required
        />

        <Dropdown
          label="Currency"
          options={CURRENCIES}
          value={preferences.currency}
          onChange={(value) =>
            setPreferences({ ...preferences, currency: value as string })
          }
          placeholder="Select currency"
          required
        />

        {/* Start Date and Time */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Date & Time <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="datetime-local"
            value={
              preferences.startDateTime
                ? preferences.startDateTime.includes("T")
                  ? preferences.startDateTime.slice(0, 16)
                  : preferences.startDateTime
                : ""
            }
            onChange={(e) =>
              setPreferences({
                ...preferences,
                startDateTime: e.target.value,
              })
            }
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 dark:text-white"
          />
        </div>

        {/* End Date and Time */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            End Date & Time <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="datetime-local"
            value={
              preferences.endDateTime
                ? preferences.endDateTime.includes("T")
                  ? preferences.endDateTime.slice(0, 16)
                  : preferences.endDateTime
                : ""
            }
            onChange={(e) =>
              setPreferences({
                ...preferences,
                endDateTime: e.target.value,
              })
            }
            min={
              preferences.startDateTime ||
              new Date().toISOString().slice(0, 16)
            }
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <MultiSelect
        label="Interests"
        options={INTERESTS}
        value={preferences.interests}
        onChange={(value) =>
          setPreferences({ ...preferences, interests: value })
        }
        placeholder="Select your interests"
        required
      />

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
      >
        {isLoading ? "Generating Plan..." : "Generate Trip Plan"}
      </button>
    </form>
  );
}

