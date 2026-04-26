/**
 * Resolves place names for Nominatim only. Prefer user/API fields (Latin script) over
 * AI-translated display names in the user's language, which are poor geocoding queries.
 */

/**
 * @param {string} [s]
 * @returns {boolean}
 */
function isLikelyGeocodableScript(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length < 2) return false;
  // Latin letters, digits, common punctuation (OSM place names)
  const asciiLike = t.match(/[A-Za-z0-9\u00C0-\u024F.,'\s-]/g);
  const alen = (asciiLike || []).join('').replace(/\s/g, '').length;
  const clen = t.replace(/\s/g, '').length;
  return alen / Math.max(clen, 1) > 0.35;
}

/**
 * @param {Object} [tripData]
 * @param {Object} [destinations]
 * @returns {{ city: string, country: string, origin: string }}
 */
function getGeocodingPlaceContext(tripData, destinations) {
  const d = tripData && typeof tripData === 'object' ? tripData : {};
  const m = destinations && destinations.mainDestination ? destinations.mainDestination : null;

  const candidates = [
    d.state,
    d.to,
    d.destination,
    d.city,
    m && isLikelyGeocodableScript(m.city) ? m.city : null,
    m && isLikelyGeocodableScript(m.name) ? m.name : null
  ];

  let city = '';
  for (const c of candidates) {
    if (c && String(c).trim() && isLikelyGeocodableScript(String(c))) {
      city = String(c).trim();
      break;
    }
  }
  if (!city) {
    for (const c of candidates) {
      if (c && String(c).trim()) {
        city = String(c).trim();
        break;
      }
    }
  }

  let country = (m && m.country) ? String(m.country).trim() : '';
  if (!country && d.country) {
    country = String(d.country).trim();
  }

  const origin = d.from || d.origin;
  return {
    city: city || 'India',
    country,
    origin: origin != null ? String(origin).trim() : ''
  };
}

module.exports = {
  getGeocodingPlaceContext,
  isLikelyGeocodableScript
};
