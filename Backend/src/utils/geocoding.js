const logger = require('./logger');

/**
 * Geocoding service using OpenStreetMap Nominatim API
 * Free geocoding service - requires max 1 request per second
 */
class GeocodingService {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org/search';
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests (Nominatim requirement)
    this.cache = new Map(); // Simple in-memory cache to avoid duplicate requests
  }

  /**
   * Geocode a location name to coordinates
   * @param {string} locationName - Name of the location (e.g., "Kapaleeshwarar Temple Chennai")
   * @param {string} city - Optional city name to improve accuracy
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  async geocode(locationName, city = null) {
    if (!locationName || typeof locationName !== 'string' || locationName.trim().length === 0) {
      logger.warn('Geocoding: Invalid location name provided', { locationName });
      return null;
    }

    // Check cache first
    const cacheKey = `${locationName}|${city || ''}`.toLowerCase();
    if (this.cache.has(cacheKey)) {
      logger.debug('Geocoding: Using cached result', { locationName, city });
      return this.cache.get(cacheKey);
    }

    // Build search query
    let query = locationName.trim();
    if (city && !query.toLowerCase().includes(city.toLowerCase())) {
      query = `${query} ${city}`;
    }

    try {
      // Wait for rate limiting
      await this.waitForRateLimit();

      // Build URL with query parameters
      const url = new URL(this.baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('addressdetails', '0');

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'AI-Trip-Planner/1.0' // Required by Nominatim
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const coordinates = {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon)
        };

        // Cache the result
        this.cache.set(cacheKey, coordinates);

        logger.debug('Geocoding: Success', {
          locationName,
          city,
          coordinates
        });

        return coordinates;
      } else {
        logger.warn('Geocoding: No results found', { locationName, city, query });
        return null;
      }
    } catch (error) {
      logger.error('Geocoding: Error fetching coordinates', {
        locationName,
        city,
        query,
        error: error.message,
        isAborted: error.name === 'AbortError'
      });
      return null;
    }
  }

  /**
   * Geocode multiple locations with rate limiting
   * @param {Array<{name: string, city?: string}>} locations - Array of location objects
   * @returns {Promise<Array<{name: string, coordinates: {latitude: number, longitude: number} | null}>>}
   */
  async geocodeBatch(locations) {
    if (!Array.isArray(locations) || locations.length === 0) {
      return [];
    }

    const results = [];
    
    for (const location of locations) {
      const coordinates = await this.geocode(location.name, location.city);
      results.push({
        name: location.name,
        coordinates
      });
    }

    return results;
  }

  /**
   * Extract location name from activity name and location
   * @param {Object} activity - Activity object with name and location
   * @returns {string} - Location name for geocoding
   */
  extractLocationName(activity) {
    // Use activity name as primary source (it usually contains the place name)
    // Fallback to location field if name is generic
    const name = activity.name || '';
    const location = activity.location || '';

    // If name contains specific place names (not generic like "Check-in", "Explore")
    const genericPatterns = /^(check-in|check-out|explore|visit|breakfast|lunch|dinner|coffee)/i;
    
    if (name && !genericPatterns.test(name.trim())) {
      // Name contains specific place, use it
      return name.trim();
    } else if (location) {
      // Use location field
      return location.trim();
    } else {
      // Fallback to name
      return name.trim();
    }
  }

  /**
   * Enrich activities with coordinates
   * @param {Array} activities - Array of activity objects
   * @param {string} city - City name for better geocoding accuracy
   * @returns {Promise<Array>} - Activities with coordinates added
   */
  async enrichActivitiesWithCoordinates(activities, city = null) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return activities;
    }

    const enrichedActivities = [];

    for (const activity of activities) {
      // Skip if coordinates already exist
      if (activity.coordinates && activity.coordinates.latitude && activity.coordinates.longitude) {
        enrichedActivities.push(activity);
        continue;
      }

      // Skip generic activities that don't have specific locations
      const locationName = this.extractLocationName(activity);
      if (!locationName || locationName.length === 0) {
        enrichedActivities.push(activity);
        continue;
      }

      // Geocode the location
      const coordinates = await this.geocode(locationName, city || activity.location);

      enrichedActivities.push({
        ...activity,
        coordinates: coordinates || undefined
      });
    }

    return enrichedActivities;
  }

  /**
   * Wait for rate limit (max 1 request per second)
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Clear the cache (useful for testing or memory management)
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const geocodingService = new GeocodingService();
module.exports = geocodingService;

