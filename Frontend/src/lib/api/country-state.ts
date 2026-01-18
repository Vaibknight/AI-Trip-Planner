interface Country {
  value: string;
  label: string;
  iso2?: string;
  iso3?: string;
}

interface State {
  value: string;
  label: string;
  iso2?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch all countries from the API
 */
export async function fetchCountries(): Promise<Country[]> {
  try {
    const response = await fetch("/api/countries");
    const result: ApiResponse<Country[]> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch countries");
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching countries:", error);
    throw error;
  }
}

/**
 * Fetch states/provinces for a given country
 * @param countryCode - ISO2 country code (e.g., "US", "IN")
 */
export async function fetchStates(countryCode: string): Promise<State[]> {
  try {
    if (!countryCode) {
      return [];
    }

    const response = await fetch(`/api/countries/${countryCode}/states`);
    const result: ApiResponse<State[]> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch states");
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching states:", error);
    throw error;
  }
}

/**
 * Get country ISO2 code from country name
 * This is a helper to map country names to ISO2 codes for the API
 */
export async function getCountryCode(countryName: string): Promise<string | null> {
  try {
    const countries = await fetchCountries();
    const country = countries.find(
      (c) => c.label.toLowerCase() === countryName.toLowerCase()
    );
    return country?.iso2 || null;
  } catch (error) {
    console.error("Error getting country code:", error);
    return null;
  }
}

