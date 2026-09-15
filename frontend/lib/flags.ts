/**
 * Country name / location to ISO 3166-1 alpha-2 mapping utility.
 * Maps FastF1 schedule event location data to 2-letter country codes for vector SVG flag rendering.
 */

const COUNTRY_ISO_MAP: Record<string, string> = {
  // Countries
  "Bahrain": "BH",
  "Saudi Arabia": "SA",
  "Australia": "AU",
  "Japan": "JP",
  "China": "CN",
  "United States": "US",
  "USA": "US",
  "Italy": "IT",
  "Monaco": "MC",
  "Spain": "ES",
  "Canada": "CA",
  "Austria": "AT",
  "Great Britain": "GB",
  "United Kingdom": "GB",
  "UK": "GB",
  "Hungary": "HU",
  "Belgium": "BE",
  "Netherlands": "NL",
  "Azerbaijan": "AZ",
  "Singapore": "SG",
  "Mexico": "MX",
  "Brazil": "BR",
  "Qatar": "QA",
  "United Arab Emirates": "AE",
  "UAE": "AE",
  "Abu Dhabi": "AE",
  "France": "FR",
  "Germany": "DE",
  "Portugal": "PT",
  "Turkey": "TR",
  "Russia": "RU",
  "Malaysia": "MY",

  // Circuit / Cities / Locations
  "Sakhir": "BH",
  "Jeddah": "SA",
  "Melbourne": "AU",
  "Suzuka": "JP",
  "Shanghai": "CN",
  "Miami": "US",
  "Miami Gardens": "US",
  "Austin": "US",
  "Las Vegas": "US",
  "Imola": "IT",
  "Monza": "IT",
  "Mugello": "IT",
  "Monte Carlo": "MC",
  "Barcelona": "ES",
  "Madrid": "ES",
  "Montréal": "CA",
  "Montreal": "CA",
  "Spielberg": "AT",
  "Silverstone": "GB",
  "Budapest": "HU",
  "Spa-Francorchamps": "BE",
  "Spa": "BE",
  "Zandvoort": "NL",
  "Baku": "AZ",
  "Marina Bay": "SG",
  "Mexico City": "MX",
  "São Paulo": "BR",
  "Sao Paulo": "BR",
  "Lusail": "QA",
  "Yas Island": "AE",
  "Yas Marina": "AE",
  "Le Castellet": "FR",
  "Nürburgring": "DE",
  "Nurburgring": "DE",
  "Portimão": "PT",
  "Portimao": "PT",
  "Istanbul": "TR",
  "Sochi": "RU",
  "Kuala Lumpur": "MY",
};

export function getCountryIsoCode(country?: string, location?: string): string | undefined {
  if (!country && !location) return undefined;

  if (country && COUNTRY_ISO_MAP[country]) {
    return COUNTRY_ISO_MAP[country];
  }
  if (location && COUNTRY_ISO_MAP[location]) {
    return COUNTRY_ISO_MAP[location];
  }

  // Substring fallback search
  for (const [key, code] of Object.entries(COUNTRY_ISO_MAP)) {
    if (country && country.toLowerCase().includes(key.toLowerCase())) {
      return code;
    }
    if (location && location.toLowerCase().includes(key.toLowerCase())) {
      return code;
    }
  }

  return undefined;
}
