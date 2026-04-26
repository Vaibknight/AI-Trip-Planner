const logger = require('./logger');
const { isLikelyGeocodableScript } = require('./geocodingContext');

/**
 * Geocoding service using OpenStreetMap Nominatim API
 * Free geocoding service - requires max 1 request per second
 * Map / coordinate lookup uses place context in Latin (trip API fields), not only translated display text.
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
   * @param {string|Object|null|undefined} placeContext - City/region string (legacy) or { city, country }
   * @returns {{ city: string | null, country: string | null }}
   */
  _normalizePlaceContext(placeContext) {
    if (placeContext == null) {
      return { city: null, country: null };
    }
    if (typeof placeContext === 'string') {
      return { city: placeContext, country: null };
    }
    if (typeof placeContext === 'object' && !Array.isArray(placeContext)) {
      const city = placeContext.city || placeContext.state || null;
      const country = placeContext.country != null ? String(placeContext.country).trim() : null;
      return {
        city: city != null && String(city).trim() ? String(city).trim() : null,
        country: country || null
      };
    }
    return { city: null, country: null };
  }

  /**
   * Build a single Nominatim "q" string. Uses English/romanized region + country for disambiguation (map only).
   */
  _buildNominatimQuery(locationName, context) {
    const ctx = this._normalizePlaceContext(context);
    let q = (locationName || '').trim();
    if (ctx.city) {
      const c = ctx.city;
      if (!q.toLowerCase().includes(c.toLowerCase())) {
        q = `${q} ${c}`;
      }
    }
    if (ctx.country) {
      const c = ctx.country;
      if (!q.toLowerCase().includes(c.toLowerCase())) {
        q = `${q} ${c}`;
      }
    }
    return q.trim();
  }

  /**
   * Pull Latin place tokens from mixed text (e.g. Japanese + "Mumbai Airport") for a second Nominatim try.
   * @param {string} text
   * @returns {string | null}
   */
  extractLatinPlaceQuery(text) {
    if (!text) return null;
    const s = String(text);
    const tokens = s.match(/[A-Za-z][A-Za-z0-9.,'&\s-]{1,80}/g);
    if (!tokens || tokens.length === 0) {
      return null;
    }
    const scored = tokens.map(t => t.trim()).filter(t => t.replace(/[^A-Za-z]/g, '').length > 1);
    if (scored.length === 0) {
      return null;
    }
    return scored.sort((a, b) => b.length - a.length)[0] || null;
  }

  /**
   * @param {string} query
   * @returns {Promise<object|null>} first result
   */
  async _nominatimSearch(query) {
    if (!query || !query.trim()) {
      return null;
    }
    await this.waitForRateLimit();
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '0');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
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
      return data[0];
    }
    return null;
  }

  /**
   * Geocode a location name to coordinates (map / pins only; uses Latin-friendly place context when provided).
   * @param {string} locationName - Free text, often from itinerary (may be non-English)
   * @param {string|{city?: string, state?: string, country?: string}|null} [placeContext] - Prefer trip API `state` / `destination` (string or object with city + country)
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  async geocode(locationName, placeContext = null) {
    if (!locationName || typeof locationName !== 'string' || locationName.trim().length === 0) {
      logger.warn('Geocoding: Invalid location name provided', { locationName });
      return null;
    }
    const ctx = this._normalizePlaceContext(placeContext);
    const ctxKey = `ctx:${ctx.city || ''}|${ctx.country || ''}`.toLowerCase();

    const runOnce = async (qBody, logLabel) => {
      const fullQuery = this._buildNominatimQuery(qBody, placeContext);
      if (!fullQuery) {
        return null;
      }
      const cacheKey = `${qBody.trim()}|${ctxKey}`.toLowerCase();
      if (this.cache.has(cacheKey)) {
        logger.debug('Geocoding: Using cached result', { locationName, placeContext, fullQuery, logLabel });
        return this.cache.get(cacheKey);
      }
      try {
        const result = await this._nominatimSearch(fullQuery);
        if (result) {
          const coordinates = {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon)
          };
          this.cache.set(cacheKey, coordinates);
          logger.debug('Geocoding: Success', {
            locationName,
            placeContext,
            fullQuery,
            logLabel,
            coordinates
          });
          return coordinates;
        }
        return null;
      } catch (error) {
        logger.error('Geocoding: Error fetching coordinates', {
          locationName,
          placeContext,
          fullQuery,
          logLabel,
          error: error.message,
          isAborted: error.name === 'AbortError'
        });
        return null;
      }
    };

    // 1) primary: as provided (translated/verbose text + Latin city/country context from trip)
    const trimmed = locationName.trim();
    let coords = await runOnce(trimmed, 'primary');
    if (coords) {
      return coords;
    }

    // 2) Latin substrings: mixed-language lines often still contain "Mumbai", "Bilaspur", etc.
    const latin = this.extractLatinPlaceQuery(trimmed);
    if (latin && latin.length >= 2 && latin.toLowerCase() !== trimmed.toLowerCase()) {
      coords = await runOnce(latin, 'latin-extract');
      if (coords) {
        return coords;
      }
    } else if (latin && !isLikelyGeocodableScript(trimmed) && latin.length >= 3) {
      coords = await runOnce(latin, 'latin-nonascii-primary');
      if (coords) {
        return coords;
      }
    }

    const fullQuery = this._buildNominatimQuery(trimmed, placeContext);
    logger.warn('Geocoding: No results found', {
      locationName,
      placeContext,
      query: fullQuery
    });
    return null;
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
   * @param {Array} activities
   * @param {string|{city?:string, country?:string}|null} [placeContext] - Romanized/English trip fields (map), not only translated text
   */
  async enrichActivitiesWithCoordinates(activities, placeContext = null) {
    if (!Array.isArray(activities) || activities.length === 0) {
      return activities;
    }

    const resolveCtx = (activity) => {
      if (placeContext && typeof placeContext === 'object' && !Array.isArray(placeContext)) {
        return placeContext;
      }
      if (typeof placeContext === 'string' && placeContext) {
        return { city: placeContext, country: null };
      }
      if (activity.location) {
        return { city: String(activity.location), country: null };
      }
      return { city: null, country: null };
    };

    const enrichedActivities = [];
    for (const activity of activities) {
      if (activity.coordinates && activity.coordinates.latitude && activity.coordinates.longitude) {
        enrichedActivities.push(activity);
        continue;
      }
      const locationName = this.extractLocationName(activity);
      if (!locationName || locationName.length === 0) {
        enrichedActivities.push(activity);
        continue;
      }
      const coordinates = await this.geocode(locationName, resolveCtx(activity));
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

