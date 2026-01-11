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
      destination: "",
      travelType: "",
      interests: [],
      season: "",
      duration: 7,
      budget: 0,
      travelers: 2,
      currency: "USD",
    }
  );

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues) {
      setPreferences(initialValues);
    }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      preferences.destination &&
      preferences.travelType &&
      preferences.interests.length > 0 &&
      preferences.season &&
      preferences.duration &&
      preferences.budget > 0 &&
      preferences.travelers &&
      preferences.currency
    ) {
      onSubmit(preferences);
    }
  };

  const cityOptions = CITIES.map((city) => ({ value: city, label: city }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Dropdown
          label="Destination City"
          options={cityOptions}
          value={preferences.destination}
          onChange={(value) =>
            setPreferences({ ...preferences, destination: value as string })
          }
          placeholder="Select destination city"
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
            Budget <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={preferences.budget || ""}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                budget: parseFloat(e.target.value) || 0,
              })
            }
            placeholder="Enter your budget amount"
            required
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

