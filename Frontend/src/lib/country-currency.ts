/**
 * Mapping of country names to their primary currency codes
 * This is used to automatically set currency based on selected country
 */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Major countries
  "United States": "USD",
  "United Kingdom": "GBP",
  "Canada": "CAD",
  "Australia": "AUD",
  "Germany": "EUR",
  "France": "EUR",
  "Italy": "EUR",
  "Spain": "EUR",
  "India": "INR",
  "Japan": "JPY",
  "China": "CNY",
  "Thailand": "THB",
  "Singapore": "SGD",
  "Malaysia": "MYR",
  "Indonesia": "IDR",
  "United Arab Emirates": "AED",
  "South Korea": "KRW",
  "Brazil": "BRL",
  "Mexico": "MXN",
  "Argentina": "ARS",
  
  // Additional European countries using EUR
  "Austria": "EUR",
  "Belgium": "EUR",
  "Finland": "EUR",
  "Greece": "EUR",
  "Ireland": "EUR",
  "Luxembourg": "EUR",
  "Netherlands": "EUR",
  "Portugal": "EUR",
  
  // Other countries
  "Switzerland": "CHF",
  "Norway": "NOK",
  "Sweden": "SEK",
  "Denmark": "DKK",
  "Poland": "PLN",
  "Russia": "RUB",
  "Turkey": "TRY",
  "Saudi Arabia": "SAR",
  "South Africa": "ZAR",
  "Egypt": "EGP",
  "Israel": "ILS",
  "New Zealand": "NZD",
  "Philippines": "PHP",
  "Vietnam": "VND",
  "Bangladesh": "BDT",
  "Pakistan": "PKR",
  "Sri Lanka": "LKR",
  "Nepal": "NPR",
  "Bhutan": "BTN",
  "Myanmar": "MMK",
  "Cambodia": "KHR",
  "Laos": "LAK",
  "Maldives": "MVR",
  "Afghanistan": "AFN",
  "Iran": "IRR",
  "Iraq": "IQD",
  "Kuwait": "KWD",
  "Qatar": "QAR",
  "Oman": "OMR",
  "Bahrain": "BHD",
  "Jordan": "JOD",
  "Lebanon": "LBP",
  "Yemen": "YER",
  "Chile": "CLP",
  "Colombia": "COP",
  "Peru": "PEN",
  "Venezuela": "VES",
  "Ecuador": "USD", // Uses USD
  "Uruguay": "UYU",
  "Paraguay": "PYG",
  "Bolivia": "BOB",
  "Costa Rica": "CRC",
  "Panama": "USD", // Uses USD
  "Guatemala": "GTQ",
  "Honduras": "HNL",
  "Nicaragua": "NIO",
  "El Salvador": "USD", // Uses USD
  "Dominican Republic": "DOP",
  "Cuba": "CUP",
  "Jamaica": "JMD",
  "Haiti": "HTG",
  "Trinidad and Tobago": "TTD",
  "Barbados": "BBD",
  "Bahamas": "BSD",
  "Belize": "BZD",
};

/**
 * Get currency code for a given country name
 * @param countryName - Name of the country
 * @returns Currency code (e.g., "USD", "EUR") or "USD" as default
 */
export function getCurrencyForCountry(countryName: string): string {
  if (!countryName) {
    return "USD"; // Default currency
  }
  
  return COUNTRY_TO_CURRENCY[countryName] || "USD";
}

/**
 * Check if a currency code is available in the CURRENCIES list
 * @param currencyCode - Currency code to check
 * @param availableCurrencies - List of available currencies
 * @returns The currency code if available, or "USD" as fallback
 */
export function validateCurrency(
  currencyCode: string,
  availableCurrencies: { value: string; label: string }[]
): string {
  const isAvailable = availableCurrencies.some(
    (curr) => curr.value === currencyCode
  );
  
  return isAvailable ? currencyCode : "USD";
}

