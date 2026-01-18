import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = "https://api.countrystatecity.in/v1";
const API_KEY = process.env.COUNTRY_STATE_CITY_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ country: string }> }
) {
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

    const { country: countryCode } = await params;

    if (!countryCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Country code is required",
        },
        { status: 400 }
      );
    }

    // The API expects ISO2 country code
    const response = await fetch(
      `${API_BASE_URL}/countries/${countryCode}/states`,
      {
        headers: {
          "X-CSCAPI-KEY": API_KEY,
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error ${response.status}:`, errorText);
      
      // Handle case where country has no states (some countries don't have states)
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          data: [],
          message: "No states/provinces available for this country",
        });
      }
      
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const states = await response.json();

    // Handle empty states array
    if (!Array.isArray(states) || states.length === 0) {
      console.log(`No states found for country code: ${countryCode}`);
      return NextResponse.json({
        success: true,
        data: [],
        message: "No states/provinces available for this country",
      });
    }

    // Transform to our format
    const formattedStates = states.map((state: any) => ({
      value: state.name,
      label: state.name,
      iso2: state.iso2,
    }));

    console.log(`Found ${formattedStates.length} states for country code: ${countryCode}`);

    return NextResponse.json({
      success: true,
      data: formattedStates,
    });
  } catch (error) {
    console.error("Error fetching states:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch states",
      },
      { status: 500 }
    );
  }
}

