const VALID = new Set(['flight', 'train', 'bus', 'car', 'other']);

/** Single-word tokens from AI in various languages → canonical enum */
const TOKEN_ALIAS = {
  // train
  zug: 'train',
  tren: 'train',
  treno: 'train',
  tåg: 'train',
  trein: 'train',
  ferrocarril: 'train',
  kereta: 'train',
  tgv: 'train',
  eisenbahn: 'train',
  schnellzug: 'train',
  поезд: 'train',
  // flight
  flug: 'flight',
  flugzeug: 'flight',
  vuelo: 'flight',
  aereo: 'flight',
  aéreo: 'flight',
  avion: 'flight',
  avión: 'flight',
  voo: 'flight',
  flyg: 'flight',
  lento: 'flight',
  // bus
  autobus: 'bus',
  omnibus: 'bus',
  autocar: 'bus',
  ônibus: 'bus',
  onibus: 'bus',
  'linja-auto': 'bus',
  // car
  auto: 'car',
  coche: 'car',
  voiture: 'car',
  macchina: 'car',
  wagen: 'car',
  pkw: 'car',
  fahrzeug: 'car'
};

/**
 * @param {string|undefined|null} value
 * @returns {'flight'|'train'|'bus'|'car'|'other'}
 */
function normalizeTransportationRecommended(value) {
  if (value == null) return 'other';
  const raw = String(value).trim();
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (VALID.has(lower)) return lower;

  const firstSegment = lower.split(/[,;|/]/)[0].trim();
  const firstToken = firstSegment.split(/[\s–—-]+/)[0].replace(/[.:;]/g, '');

  const mapped = TOKEN_ALIAS[firstToken] || TOKEN_ALIAS[firstSegment];
  if (mapped) return mapped;

  // Phrase / substring heuristics (order matters)
  if (/\bautobus\b|ônibus|onibus|^\s*bus\s*\(|^bus$|\bbusfahrt\b|公交车|公車|バス\b/.test(firstSegment)) {
    return 'bus';
  }
  if (/\bzug\b|eisenbahn|schnellzug|intercity|treno|treni|\bice\b|tgv|ferrovia|поезд|tåg|train\b(?!ing)|\brail(way)?\b/.test(firstSegment)) {
    return 'train';
  }
  if (/\bflug|flugzeug|vuelo|aereo|avion|aerial|aeroplane|airplane|lentokone|航班|飛|飞机|hava|uçuş/.test(firstSegment) || (firstSegment.startsWith('voo ') && !/ônibus|onibus/i.test(firstSegment))) {
    return 'flight';
  }
  if (/\b(bus|buses|coach|coaché)\b/i.test(firstSegment) && !/training|business|busi/i.test(firstSegment)) {
    return 'bus';
  }
  if (/\b(mietwagen|rent( a)? car|self[- ]?drive|voiture|coche|pkw|macchina(?!\s*da)|^car$|^auto$|^(car|wagen) )\b/i.test(firstSegment) && !/autobus|ônibus/i.test(firstSegment)) {
    return 'car';
  }
  if (/(^|[^a-z])voo[^a-z]|^voo$/.test(firstSegment) && firstSegment.length < 40) {
    return 'flight';
  }

  return 'other';
}

module.exports = { normalizeTransportationRecommended };
