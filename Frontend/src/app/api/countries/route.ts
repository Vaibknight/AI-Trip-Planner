import { NextResponse } from "next/server";

const API_BASE_URL = "https://api.countrystatecity.in/v1";
const API_KEY = process.env.COUNTRY_STATE_CITY_API_KEY || "";

export async function GET() {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "API key not configured",
        },
        { status: 500 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/countries`, {
      headers: {
        "X-CSCAPI-KEY": API_KEY,
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const countries = await response.json();

    // Transform to our format
    const formattedCountries = countries.map((country: any) => ({
      value: country.name,
      label: country.name,
      iso2: country.iso2,
      iso3: country.iso3,
    }));

    return NextResponse.json({
      success: true,
      data: formattedCountries,
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch countries",
      },
      { status: 500 }
    );
  }
}

