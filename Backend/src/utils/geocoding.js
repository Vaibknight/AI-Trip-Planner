const logger = require('./logger');
const pLimit = require('p-limit');
const { isLikelyGeocodableScript } = require('./geocodingContext');

const NOMINATIM_HTTP_TIMEOUT_MS = parseInt(process.env.NOMINATIM_HTTP_TIMEOUT_MS || '10000', 10);
const NOMINATIM_MAX_ATTEMPTS = parseInt(process.env.NOMINATIM_MAX_ATTEMPTS || '3', 10);
/** Parallel geocode tasks (each still respects shared Nominatim rate limit); default 5 */
const GEOCODE_BATCH_CONCURRENCY = Math.min(
  10,
  Math.max(1, parseInt(process.env.GEOCODE_BATCH_CONCURRENCY || '5', 10) || 5)
);

/**
 * Geocoding service using OpenStreetMap Nominatim API
 * Free geocoding service - requires max 1 request per second to nominatim.openstreetmap.org
 * Map / coordinate lookup uses place context in Latin (trip API fields), not only translated display text.
 */
class GeocodingService {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org/search';
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between Nominatim HTTP calls (shared across workers)
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
   * Strip itinerary-style prefixes / pick venue after commas so Nominatim sees POI names, not full sentences.
   * @param {string} s
   * @returns {string}
   */
  _stripLeadingActivityPrefixes(s) {
    if (!s) return '';
    const patterns = [
      /^return\s+to\s+/i,
      /^travel\s+to\s+/i,
      /^day\s+trip\s+to\s+/i,
      /^trip\s+to\s+/i,
      /^visit\s+to\s+/i,
      /^visit\s+/i,
      /^check-in\s+at\s+/i,
      /^check-out\s+(from\s+)?/i,
      /^(breakfast|brunch|lunch|dinner|supper|coffee|tea|snacks?)\s+at\s+/i,
      /^(breakfast|brunch|lunch|dinner)\s+on\s+(the\s+)?/i,
      /^(explore|tour|stroll)\s+(through\s+|of\s+|to\s+)?/i
    ];
    let t = String(s).trim();
    for (let round = 0; round < 6; round++) {
      const before = t;
      for (const re of patterns) {
        t = t.replace(re, '').trim();
      }
      if (t === before) break;
    }
    return t;
  }

  /**
   * Skip comma-tail segments like "evening free" when a better segment exists earlier.
   * @param {string} seg
   * @returns {boolean}
   */
  _isVagueGeocodeSegment(seg) {
    const t = (seg || '').trim().toLowerCase();
    if (t.length < 2) return true;
    if (/^(evening|morning|afternoon|night)\b/.test(t) && /\b(free|leisure|rest)\b/.test(t)) return true;
    if (/^free\s+time$/i.test(t)) return true;
    if (/^relax/i.test(t)) return true;
    return false;
  }

  /**
   * Normalize free-text itinerary lines for geocoding (used before cache key + Nominatim).
   * @param {string} text
   * @returns {string}
   */
  sanitizePlaceForGeocode(text) {
    if (!text || typeof text !== 'string') return '';
    let s = String(text).trim().replace(/\s+/g, ' ');
    if (!s) return '';

    const flight = s.match(/^flight\s+from\s+.+\s+to\s+(.+)$/i);
    if (flight && flight[1] && flight[1].trim().length >= 2) {
      return flight[1].trim();
    }

    if (s.includes(',')) {
      const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        let seg = this._stripLeadingActivityPrefixes(parts[i]);
        if (this._isVagueGeocodeSegment(seg)) continue;
        if (seg.length >= 2 && !/^(return|travel)\s+to\s+/i.test(seg)) {
          return seg;
        }
      }
      return this._stripLeadingActivityPrefixes(parts[parts.length - 1] || s).trim();
    }

    return this._stripLeadingActivityPrefixes(s).trim();
  }

  /**
   * Body string used for primary Mongo prefetch (matches first successful runOnce lookup).
   * @param {string} trimmed
   * @returns {string}
   */
  _primaryLookupBody(trimmed) {
    const sanitized = this.sanitizePlaceForGeocode(trimmed);
    if (sanitized && sanitized.length >= 2 && sanitized.toLowerCase() !== trimmed.toLowerCase()) {
      return sanitized;
    }
    return trimmed;
  }

  /**
   * @param {string} query
   * @returns {Promise<object|null>} first result
   */
  async _loadFromMongo(cacheKey) {
    try {
      const GeocodeCache = require('../models/GeocodeCache');
      const doc = await GeocodeCache.findOne({ key: cacheKey }).lean();
      if (doc && typeof doc.latitude === 'number' && typeof doc.longitude === 'number') {
        return { latitude: doc.latitude, longitude: doc.longitude };
      }
    } catch (err) {
      logger.debug('Geocoding: MongoDB cache read skipped', { error: err.message });
    }
    return null;
  }

  /**
   * @param {string} cacheKey
   * @param {string} placeSnippet
   * @param {string|object|null} placeContext
   * @param {{ latitude: number, longitude: number }} coordinates
   */
  async _saveToMongo(cacheKey, placeSnippet, placeContext, coordinates) {
    try {
      const GeocodeCache = require('../models/GeocodeCache');
      const ctx = this._normalizePlaceContext(placeContext);
      await GeocodeCache.findOneAndUpdate(
        { key: cacheKey },
        {
          key: cacheKey,
          place: placeSnippet || '',
          contextCity: ctx.city || '',
          contextCountry: ctx.country || '',
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        },
        { upsert: true }
      );
    } catch (err) {
      logger.warn('Geocoding: MongoDB cache write failed', { error: err.message });
    }
  }

  /**
   * HTTP GET to Nominatim with shared rate limit, per-request timeout, and retries on transient failures.
   */
  async _nominatimSearch(query) {
    if (!query || !query.trim()) {
      return null;
    }
    const urlString = (() => {
      const url = new URL(this.baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('addressdetails', '0');
      return url.toString();
    })();

    let lastError;
    for (let attempt = 1; attempt <= NOMINATIM_MAX_ATTEMPTS; attempt++) {
      const httpStart = Date.now();
      try {
        await this.waitForRateLimit();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_HTTP_TIMEOUT_MS);
        const response = await fetch(urlString, {
          method: 'GET',
          headers: {
            'User-Agent': 'AI-Trip-Planner/1.0'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const httpMs = Date.now() - httpStart;
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          logger.warn('Geocoding: Nominatim HTTP error', {
            status: response.status,
            attempt,
            httpMs,
            retryable
          });
          if (retryable && attempt < NOMINATIM_MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
            continue;
          }
          throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        logger.debug('Geocoding: Nominatim OK', { attempt, httpMs, hasResults: !!(data && data.length) });
        if (data && data.length > 0) {
          return data[0];
        }
        return null;
      } catch (error) {
        lastError = error;
        const transient =
          error.name === 'AbortError' ||
          /fetch|network|ECONNRESET|ETIMEDOUT/i.test(error.message || '');
        logger.warn('Geocoding: Nominatim attempt failed', {
          attempt,
          message: error.message,
          transient,
          httpMs: Date.now() - httpStart
        });
        if (attempt < NOMINATIM_MAX_ATTEMPTS && transient) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        throw error;
      }
    }
    if (lastError) throw lastError;
    return null;
  }

  /**
   * Primary cache key for a place string + context (matches geocode runOnce primary path).
   */
  _primaryCacheKey(placeTrimmed, placeContext) {
    const ctx = this._normalizePlaceContext(placeContext);
    const ctxKey = `ctx:${ctx.city || ''}|${ctx.country || ''}`.toLowerCase();
    return `${placeTrimmed}|${ctxKey}`.toLowerCase();
  }

  /**
   * Bulk-load MongoDB cache entries into the in-memory map before parallel geocode.
   */
  async _prefetchMongoByKeys(cacheKeys) {
    if (!cacheKeys || cacheKeys.length === 0) return { found: 0 };
    const uniqueKeys = [...new Set(cacheKeys)];
    try {
      const GeocodeCache = require('../models/GeocodeCache');
      const docs = await GeocodeCache.find({ key: { $in: uniqueKeys } })
        .select('key latitude longitude')
        .lean()
        .maxTimeMS(8000);
      let found = 0;
      for (const doc of docs) {
        if (doc && typeof doc.latitude === 'number' && typeof doc.longitude === 'number') {
          this.cache.set(doc.key, { latitude: doc.latitude, longitude: doc.longitude });
          found++;
        }
      }
      logger.info('Geocoding: Mongo prefetch', {
        requestedKeys: uniqueKeys.length,
        docsFound: found
      });
      return { found };
    } catch (err) {
      logger.warn('Geocoding: Mongo prefetch failed', { error: err.message });
      return { found: 0 };
    }
  }

  /**
   * Parallel batch geocode with p-limit, deduped keys, Mongo prefetch, Promise.all workers.
   * Nominatim calls remain globally rate-limited (1/s) via waitForRateLimit inside _nominatimSearch.
   *
   * @param {string[]} places
   * @param {object|null} placeContext
   * @returns {Promise<{ results: Array<{ place: string, coordinates: object|null }>, meta: object }>}
   */
  async geocodeBatchParallel(places, placeContext = null) {
    const tBatch = Date.now();
    const raw = Array.isArray(places) ? places : [];
    const unique = [...new Set(raw.map((p) => String(p).trim()).filter((p) => p.length > 0))];

    if (unique.length === 0) {
      return {
        results: [],
        meta: {
          durationMs: 0,
          uniqueCount: 0,
          concurrency: GEOCODE_BATCH_CONCURRENCY,
          mongoPrefetchHits: 0,
          nominatimApprox: 'see logs'
        }
      };
    }

    const prefetchKeys = unique.map((p) =>
      this._primaryCacheKey(this._primaryLookupBody(p), placeContext)
    );
    const prefetch = await this._prefetchMongoByKeys(prefetchKeys);

    const limit = pLimit(GEOCODE_BATCH_CONCURRENCY);
    const tasks = unique.map((place) =>
      limit(() => this.geocode(place, placeContext))
    );
    const coordsList = await Promise.all(tasks);

    const results = unique.map((place, i) => ({
      place,
      coordinates: coordsList[i] || null
    }));

    const durationMs = Date.now() - tBatch;
    logger.info('Geocoding: batch parallel complete', {
      durationMs,
      uniqueCount: unique.length,
      concurrency: GEOCODE_BATCH_CONCURRENCY,
      mongoPrefetchDocs: prefetch.found
    });

    return {
      results,
      meta: {
        durationMs,
        uniqueCount: unique.length,
        concurrency: GEOCODE_BATCH_CONCURRENCY,
        mongoPrefetchHits: prefetch.found
      }
    };
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
      const mongoCoords = await this._loadFromMongo(cacheKey);
      if (mongoCoords) {
        this.cache.set(cacheKey, mongoCoords);
        logger.debug('Geocoding: MongoDB cache hit', { locationName, cacheKey, logLabel });
        return mongoCoords;
      }
      try {
        const result = await this._nominatimSearch(fullQuery);
        if (result) {
          const coordinates = {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon)
          };
          this.cache.set(cacheKey, coordinates);
          await this._saveToMongo(cacheKey, qBody.trim(), placeContext, coordinates);
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

    // 1) sanitized itinerary text (POI / city names), then 2) as provided
    const trimmed = locationName.trim();
    const sanitized = this.sanitizePlaceForGeocode(trimmed);
    let coords = null;
    if (
      sanitized &&
      sanitized.length >= 2 &&
      sanitized.toLowerCase() !== trimmed.toLowerCase()
    ) {
      coords = await runOnce(sanitized, 'sanitized');
      if (coords) {
        return coords;
      }
    }
    coords = await runOnce(trimmed, 'primary');
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

