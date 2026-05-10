/**
 * Normalize itinerary / AI activity lines into geocodable place names.
 * Keep in sync with Frontend `src/lib/placeNormalization.ts` where possible.
 */

const LEADING_ACTIVITY_PATTERNS = [
  /^arrive\s+(at\s+)?/i,
  /^arrival\s+(at\s+)?/i,
  /^depart\s+(for\s+)?/i,
  /^departure\s+(for\s+)?/i,
  /^return\s+to\s+/i,
  /^travel\s+to\s+/i,
  /^transfer\s+(to\s+)?/i,
  /^head\s+(to\s+)?/i,
  /^make\s+your\s+way\s+(to\s+)?/i,
  /^day\s+trip\s+to\s+/i,
  /^trip\s+to\s+/i,
  /^visit\s+to\s+/i,
  /^visit\s+/i,
  /^check-in\s+at\s+/i,
  /^check-out\s+(from\s+)?/i,
  /^pick-?up\s+(at\s+)?/i,
  /^drop-?off\s+(at\s+)?/i,
  /^(breakfast|brunch|lunch|dinner|supper|coffee|tea|snacks?)\s+at\s+/i,
  /^(breakfast|brunch|lunch|dinner)\s+on\s+(the\s+)?/i,
  /^(explore|tour|stroll)\s+(through\s+|of\s+|to\s+)?/i,
  /^sunset\s+(at\s+|over\s+)?/i,
  /^sunrise\s+(at\s+)?/i,
  /^evening\s+at\s+/i,
  /^morning\s+at\s+/i,
  /^afternoon\s+at\s+/i,
  /^night\s+at\s+/i,
  /^dinner\s+with\s+a\s+view\s+(at\s+|of\s+|over\s+)?/i,
  /^shopping\s+(at\s+|in\s+)/i,
  /^bamboo\s+rafting\s+in\s+/i,
  /^rafting\s+(in\s+|on\s+|at\s+)/i,
  /^boat\s+(ride|cruise)\s+(on\s+|in\s+|at\s+)/i,
  /^cruise\s+(on\s+|in\s+|at\s+)/i,
  /^hiking\s+(at\s+|in\s+|to\s+)/i,
  /^trek\s+(to\s+|in\s+|at\s+)/i,
  /^snorkel(ing)?\s+(at\s+|in\s+)/i,
  /^scuba\s+(at\s+|in\s+)/i,
  /^swimming\s+(at\s+|in\s+)/i,
  /^photography\s+(at\s+|of\s+)/i,
  /^photo\s+stop\s+(at\s+)?/i,
  /^optional\s*:\s*/i,
  /^leisure\s+time\s+(at\s+)?/i,
  /^free\s+time\s+(at\s+)?/i
];

const VAGUE_SEGMENT = /^(evening|morning|afternoon|night)\b.*\b(free|leisure|rest)\b/i;

/**
 * @param {string} s
 * @returns {string}
 */
function stripLeadingActivityPrefixes(s) {
  if (!s) return '';
  let t = String(s).trim();
  for (let round = 0; round < 8; round++) {
    const before = t;
    for (const re of LEADING_ACTIVITY_PATTERNS) {
      t = t.replace(re, '').trim();
    }
    if (t === before) break;
  }
  return t;
}

/**
 * @param {string} seg
 * @returns {boolean}
 */
function isVagueGeocodeSegment(seg) {
  const t = (seg || '').trim().toLowerCase();
  if (t.length < 2) return true;
  if (VAGUE_SEGMENT.test(t)) return true;
  if (/^free\s+time$/i.test(t)) return true;
  if (/^relax/i.test(t)) return true;
  if (/^local\s+(cuisine|food|dishes?|specialties)\b/i.test(t)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizePlaceForGeocode(text) {
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
      let seg = stripLeadingActivityPrefixes(parts[i]);
      if (isVagueGeocodeSegment(seg)) continue;
      if (seg.length >= 2 && !/^(return|travel)\s+to\s+/i.test(seg)) {
        return seg;
      }
    }
    return stripLeadingActivityPrefixes(parts[parts.length - 1] || s).trim();
  }

  return stripLeadingActivityPrefixes(s).trim();
}

/**
 * Skip Nominatim for lines that are unlikely to be a single mappable POI.
 * @param {string} cleaned
 * @returns {boolean}
 */
function shouldSkipGeocodeQuery(cleaned) {
  const t = (cleaned || '').trim();
  if (t.length < 2) return true;
  const lower = t.toLowerCase();
  if (/^(check-in|check-out|explore|visit|stroll|nightlife|leisure|relax)$/i.test(t)) return true;
  if (/^(breakfast|brunch|lunch|dinner|supper|snack)$/i.test(t)) return true;
  if (/^free\s+time$/i.test(lower)) return true;
  if (/^rest\s+day$/i.test(lower)) return true;
  if (/^day\s+at\s+leisure$/i.test(lower)) return true;
  if (/^taste\s+(of\s+|the\s+)?/i.test(t) && t.length < 28) return true;
  if (/^try\s+local\b/i.test(t) && t.length < 24) return true;
  if (/^enjoy\s+traditional\b/i.test(t) && !/\b(at|in|near)\s+[A-Z]/i.test(t)) return true;
  if (/^savor\s+/i.test(t) && t.length < 20) return true;
  if (/^authentic\s+(local\s+)?(cuisine|food|meal)/i.test(t)) return true;
  if (/^street\s+food\s+tour$/i.test(t)) return true;
  if (/^cooking\s+class$/i.test(t) && !/\b(at|in)\s+/i.test(lower)) return true;
  if (/^wine\s+tasting$/i.test(t) && !/\b(at|in)\s+/i.test(lower)) return true;
  if (/^food\s+walk$/i.test(t)) return true;
  if (/^guided?\s+walk$/i.test(t) && t.length < 18) return true;
  if (/^shopping\s+$/i.test(t)) return true;
  if (/^local\s+market\s*$/i.test(t)) return true;
  if (/^evening\s+on\s+your\s+own$/i.test(t)) return true;
  if (/^flexible\s+time$/i.test(t)) return true;
  if (/^optional\s+activity$/i.test(t)) return true;
  if (/^local\s+breakfast$/i.test(t)) return true;
  return false;
}

module.exports = {
  normalizePlaceForGeocode,
  stripLeadingActivityPrefixes,
  isVagueGeocodeSegment,
  shouldSkipGeocodeQuery
};
