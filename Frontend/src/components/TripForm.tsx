"use client";

import { useState, useEffect } from "react";
import Dropdown from "./ui/Dropdown";
import SearchableDropdown from "./ui/SearchableDropdown";
import MultiSelect from "./ui/MultiSelect";
import {
  TRAVEL_TYPES,
  INTERESTS,
  SEASONS,
  DURATIONS,
  TRAVELERS,
  CURRENCIES,
} from "@/lib/constants";
import { fetchCountries, fetchStates, getCountryCode } from "@/lib/api/country-state";
import { getCurrencyForCountry, validateCurrency } from "@/lib/country-currency";
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
      country: "",
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

  const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
  const [states, setStates] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [countryCodeMap, setCountryCodeMap] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch countries on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setIsLoadingCountries(true);
        const fetchedCountries = await fetchCountries();
        setCountries(fetchedCountries);
        
        // Create a map of country names to ISO2 codes
        const codeMap: Record<string, string> = {};
        fetchedCountries.forEach((country) => {
          if (country.iso2) {
            codeMap[country.label] = country.iso2;
          }
        });
        setCountryCodeMap(codeMap);
      } catch (error) {
        console.error("Failed to load countries:", error);
        // Fallback to empty array - form will still work but without countries
      } finally {
        setIsLoadingCountries(false);
      }
    };

    loadCountries();
  }, []);

  // Auto-set currency when country changes
  useEffect(() => {
    if (preferences.country) {
      const currencyCode = getCurrencyForCountry(preferences.country);
      const validatedCurrency = validateCurrency(currencyCode, CURRENCIES);
      
      setPreferences((prev) => {
        // Only update if currency is different to avoid unnecessary updates
        if (prev.currency !== validatedCurrency) {
          console.log(`Auto-setting currency to ${validatedCurrency} for ${preferences.country}`);
          return {
            ...prev,
            currency: validatedCurrency,
          };
        }
        return prev;
      });
    }
  }, [preferences.country]); // Only depend on country, not currency

  // Fetch states when country changes
  useEffect(() => {
    const loadStates = async () => {
      if (!preferences.country) {
        setStates([]);
        return;
      }

      try {
        setIsLoadingStates(true);
        const countryCode = countryCodeMap[preferences.country];
        
        if (countryCode) {
          console.log(`Fetching states for country: ${preferences.country} (${countryCode})`);
          const fetchedStates = await fetchStates(countryCode);
          console.log(`Loaded ${fetchedStates.length} states for ${preferences.country}`);
          setStates(fetchedStates);
        } else {
          // If no ISO2 code found, try to fetch it
          console.log(`Looking up ISO2 code for country: ${preferences.country}`);
          const code = await getCountryCode(preferences.country);
          if (code) {
            console.log(`Found ISO2 code ${code} for ${preferences.country}`);
            const fetchedStates = await fetchStates(code);
            console.log(`Loaded ${fetchedStates.length} states for ${preferences.country}`);
            setStates(fetchedStates);
            // Update the map for future use
            setCountryCodeMap((prev) => ({
              ...prev,
              [preferences.country]: code,
            }));
          } else {
            console.warn(`No ISO2 code found for country: ${preferences.country}`);
            setStates([]);
          }
        }
        
        // Reset state selection when country changes
        setPreferences((prev) => ({
          ...prev,
          state: "",
        }));
      } catch (error) {
        console.error("Failed to load states:", error);
        setStates([]);
      } finally {
        setIsLoadingStates(false);
      }
    };

    loadStates();
  }, [preferences.country, countryCodeMap]);

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues) {
      setPreferences(initialValues);
    }
  }, [initialValues]);

  // Removed auto-calculation - users can select departure date freely

  // Validation functions
  const validateField = (fieldName: string, value: any): string | undefined => {
    switch (fieldName) {
      case "origin":
        if (!value || !value.trim()) {
          return "Origin is required";
        }
        break;
      case "country":
        if (!value || !value.trim()) {
          return "Country is required";
        }
        break;
      case "state":
        if (!value || !value.trim()) {
          return "State/Province is required";
        }
        break;
      case "travelType":
        if (!value || !value.trim()) {
          return "Travel type is required";
        }
        break;
      case "season":
        if (!value || !value.trim()) {
          return "Season is required";
        }
        break;
      case "duration":
        if (!value || value <= 0) {
          return "Duration is required";
        }
        break;
      case "budgetRangeString":
        if (!value || !value.trim()) {
          return "Budget range is required";
        }
        break;
      case "travelers":
        if (!value || value <= 0) {
          return "Number of travelers is required";
        }
        break;
      case "currency":
        if (!value || !value.trim()) {
          return "Currency is required";
        }
        break;
      case "startDateTime":
        if (!value || !value.trim()) {
          return "Start date & time is required";
        }
        break;
      case "endDateTime":
        if (!value || !value.trim()) {
          return "End date & time is required";
        }
        if (preferences.startDateTime && preferences.duration) {
          const startDate = new Date(preferences.startDateTime);
          const minEndDate = new Date(startDate);
          minEndDate.setDate(minEndDate.getDate() + preferences.duration);
          const selectedEndDate = new Date(value);
          
          if (selectedEndDate < minEndDate) {
            return `End date must be at least ${preferences.duration} day${preferences.duration > 1 ? 's' : ''} after start date`;
          }
        } else if (preferences.startDateTime && value < preferences.startDateTime) {
          return "End date must be after start date";
        }
        break;
      case "interests":
        if (!value || value.length === 0) {
          return "At least one interest is required";
        }
        break;
      default:
        return undefined;
    }
    return undefined;
  };

  const validateAllFields = (): boolean => {
    const errors: Record<string, string | undefined> = {};
    
    errors.origin = validateField("origin", preferences.origin);
    errors.country = validateField("country", preferences.country);
    errors.state = validateField("state", preferences.state);
    errors.travelType = validateField("travelType", preferences.travelType);
    errors.season = validateField("season", preferences.season);
    errors.duration = validateField("duration", preferences.duration);
    errors.budgetRangeString = validateField("budgetRangeString", preferences.budgetRangeString);
    errors.travelers = validateField("travelers", preferences.travelers);
    errors.currency = validateField("currency", preferences.currency);
    errors.startDateTime = validateField("startDateTime", preferences.startDateTime);
    errors.endDateTime = validateField("endDateTime", preferences.endDateTime);
    errors.interests = validateField("interests", preferences.interests);

    // Remove undefined values
    const filteredErrors: Record<string, string | undefined> = {};
    Object.keys(errors).forEach((key) => {
      if (errors[key]) {
        filteredErrors[key] = errors[key];
      }
    });

    setFieldErrors(filteredErrors);
    return Object.keys(filteredErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    if (validateAllFields()) {
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
            onChange={(e) => {
              setPreferences({ ...preferences, origin: e.target.value });
              if (isSubmitted && fieldErrors.origin) {
                const error = validateField("origin", e.target.value);
                setFieldErrors((prev) => ({
                  ...prev,
                  origin: error || undefined,
                }));
              }
            }}
            placeholder="Enter origin city (e.g., New York)"
            className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900 dark:text-white ${
              isSubmitted && fieldErrors.origin
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:ring-blue-500"
            }`}
          />
          {isSubmitted && fieldErrors.origin && (
            <p className="mt-1 text-sm text-red-500">{fieldErrors.origin}</p>
          )}
        </div>

        <SearchableDropdown
          label="Country"
          options={countries}
          value={preferences.country}
          onChange={(value) => {
            setPreferences({ ...preferences, country: value as string, state: "" });
            if (isSubmitted && fieldErrors.country) {
              const error = validateField("country", value);
              setFieldErrors((prev) => ({
                ...prev,
                country: error || undefined,
              }));
            }
          }}
          placeholder={isLoadingCountries ? "Loading countries..." : "Select country"}
          searchPlaceholder="Search countries..."
          required
          disabled={isLoadingCountries}
          error={fieldErrors.country}
          showError={isSubmitted}
        />

        <SearchableDropdown
          label="State/Province"
          options={states}
          value={preferences.state}
          onChange={(value) => {
            setPreferences({ ...preferences, state: value as string });
            if (isSubmitted && fieldErrors.state) {
              const error = validateField("state", value);
              setFieldErrors((prev) => ({
                ...prev,
                state: error || undefined,
              }));
            }
          }}
          placeholder={
            isLoadingStates
              ? "Loading states..."
              : preferences.country
              ? "Select state/province"
              : "Select country first"
          }
          searchPlaceholder="Search states/provinces..."
          required
          disabled={!preferences.country || isLoadingStates}
          error={fieldErrors.state}
          showError={isSubmitted}
        />

        <Dropdown
          label="Travel Type"
          options={TRAVEL_TYPES}
          value={preferences.travelType}
          onChange={(value) => {
            setPreferences({ ...preferences, travelType: value as string });
            if (isSubmitted && fieldErrors.travelType) {
              const error = validateField("travelType", value);
              setFieldErrors((prev) => ({
                ...prev,
                travelType: error || undefined,
              }));
            }
          }}
          placeholder="Select travel type"
          required
          error={fieldErrors.travelType}
          showError={isSubmitted}
        />

        <Dropdown
          label="Season"
          options={SEASONS}
          value={preferences.season}
          onChange={(value) => {
            setPreferences({ ...preferences, season: value as string });
            if (isSubmitted && fieldErrors.season) {
              const error = validateField("season", value);
              setFieldErrors((prev) => ({
                ...prev,
                season: error || undefined,
              }));
            }
          }}
          placeholder="Select season"
          required
          error={fieldErrors.season}
          showError={isSubmitted}
        />

        <Dropdown
          label="Duration"
          options={DURATIONS}
          value={preferences.duration}
          onChange={(value) => {
            const newDuration = value as number;
            setPreferences((prev) => ({
              ...prev,
              duration: newDuration,
              // Removed auto-calculation - users can set endDateTime freely
            }));
            if (isSubmitted && fieldErrors.duration) {
              const error = validateField("duration", value);
              setFieldErrors((prev) => ({
                ...prev,
                duration: error || undefined,
              }));
            }
          }}
          placeholder="Select duration"
          required
          error={fieldErrors.duration}
          showError={isSubmitted}
        />

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Budget Range String <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={preferences.budgetRangeString || ""}
            onChange={(e) => {
              setPreferences({
                ...preferences,
                budgetRangeString: e.target.value,
              });
              if (isSubmitted && fieldErrors.budgetRangeString) {
                const error = validateField("budgetRangeString", e.target.value);
                setFieldErrors((prev) => ({
                  ...prev,
                  budgetRangeString: error || undefined,
                }));
              }
            }}
            placeholder="Enter budget range string (e.g., 10000)"
            className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900 dark:text-white ${
              isSubmitted && fieldErrors.budgetRangeString
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:ring-blue-500"
            }`}
          />
          {isSubmitted && fieldErrors.budgetRangeString && (
            <p className="mt-1 text-sm text-red-500">{fieldErrors.budgetRangeString}</p>
          )}
        </div>

        <Dropdown
          label="Number of Travelers"
          options={TRAVELERS}
          value={preferences.travelers}
          onChange={(value) => {
            setPreferences({ ...preferences, travelers: value as number });
            if (isSubmitted && fieldErrors.travelers) {
              const error = validateField("travelers", value);
              setFieldErrors((prev) => ({
                ...prev,
                travelers: error || undefined,
              }));
            }
          }}
          placeholder="Select number of travelers"
          required
          error={fieldErrors.travelers}
          showError={isSubmitted}
        />

        <Dropdown
          label="Currency"
          options={CURRENCIES}
          value={preferences.currency}
          onChange={(value) =>
            setPreferences({ ...preferences, currency: value as string })
          }
          placeholder={
            preferences.country
              ? "Auto-selected based on country"
              : "Select country first"
          }
          required
          disabled={true}
          error={fieldErrors.currency}
          showError={isSubmitted}
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
            onChange={(e) => {
              const newStartDateTime = e.target.value;
              setPreferences((prev) => ({
                ...prev,
                startDateTime: newStartDateTime,
                // Removed auto-calculation - users can set endDateTime freely
              }));
              if (isSubmitted && fieldErrors.startDateTime) {
                const error = validateField("startDateTime", newStartDateTime);
                setFieldErrors((prev) => ({
                  ...prev,
                  startDateTime: error || undefined,
                }));
              }
            }}
            min={new Date().toISOString().slice(0, 16)}
            className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-gray-900 dark:text-white ${
              isSubmitted && fieldErrors.startDateTime
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:ring-blue-500"
            }`}
          />
          {isSubmitted && fieldErrors.startDateTime && (
            <p className="mt-1 text-sm text-red-500">{fieldErrors.startDateTime}</p>
          )}
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
            onChange={(e) => {
              const newEndDateTime = e.target.value;
              setPreferences({
                ...preferences,
                endDateTime: newEndDateTime,
              });
              if (isSubmitted && fieldErrors.endDateTime) {
                const error = validateField("endDateTime", newEndDateTime);
                setFieldErrors((prev) => ({
                  ...prev,
                  endDateTime: error || undefined,
                }));
              }
            }}
            min={new Date().toISOString().slice(0, 16)}
            className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
              isSubmitted && fieldErrors.endDateTime
                ? "border-red-500 focus:ring-red-500 text-gray-900 dark:text-white"
                : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:ring-blue-500 text-gray-900 dark:text-white"
            }`}
          />
          {isSubmitted && fieldErrors.endDateTime && (
            <p className="mt-1 text-sm text-red-500">{fieldErrors.endDateTime}</p>
          )}
        </div>
      </div>

      <MultiSelect
        label="Interests"
        options={INTERESTS}
        value={preferences.interests}
        onChange={(value) => {
          setPreferences({ ...preferences, interests: value });
          if (isSubmitted && fieldErrors.interests) {
            const error = validateField("interests", value);
            setFieldErrors((prev) => ({
              ...prev,
              interests: error || undefined,
            }));
          }
        }}
        placeholder="Select your interests"
        required
        error={fieldErrors.interests}
        showError={isSubmitted}
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

