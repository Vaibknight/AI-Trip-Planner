const crypto = require('crypto');
const logger = require('../utils/logger');

const DEFAULT_TTL_MS = parseInt(process.env.TRIP_PLAN_CACHE_TTL_MS || String(60 * 60 * 1000), 10); // 1 hour

/** In-memory LRU-ish cache for identical plan requests */
class TripPlanCacheService {
  constructor() {
    this.store = new Map();
    this.maxEntries = parseInt(process.env.TRIP_PLAN_CACHE_MAX_ENTRIES || '200', 10);
  }

  buildKey(tripData) {
    const normalized = {
      state: tripData.state || tripData.destination || tripData.to || '',
      from: tripData.from || tripData.origin || '',
      duration: tripData.duration,
      budget: tripData.budget,
      currency: tripData.currency,
      travelers: tripData.travelers,
      interests: Array.isArray(tripData.interests)
        ? [...tripData.interests].sort().join(',')
        : String(tripData.interests || ''),
      season: tripData.season || '',
      travelType: tripData.travelType || '',
      startDate: tripData.startDate ? new Date(tripData.startDate).toISOString().slice(0, 10) : '',
      endDate: tripData.endDate ? new Date(tripData.endDate).toISOString().slice(0, 10) : '',
      preferencesBased: !!tripData.preferencesBased
    };
    const raw = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    logger.debug('TripPlanCache: hit', { key: key.slice(0, 12) });
    return entry.value;
  }

  set(key, value) {
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + DEFAULT_TTL_MS
    });
    logger.debug('TripPlanCache: set', { key: key.slice(0, 12) });
  }
}

module.exports = new TripPlanCacheService();
