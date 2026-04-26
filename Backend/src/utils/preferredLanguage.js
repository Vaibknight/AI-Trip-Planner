/**
 * User-facing content language (ISO 639-1) → display name for model prompts.
 * Keep in sync with preferencesTripValidator supported codes.
 */
const SUPPORTED_CODES = new Set([
  'en', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'hi', 'ar', 'ru', 'ko'
]);

/**
 * Normalize BCP-47 and messy client values to a supported ISO 639-1 code.
 * Examples: " de " → "de", "de-DE" → "de", "en_US" → "en"
 * @param {string|undefined|null} input
 * @returns {string}
 */
function normalizePreferredLanguage(input) {
  if (input == null) return 'en';
  const s = String(input).trim();
  if (!s) return 'en';
  const lower = s.toLowerCase();
  if (SUPPORTED_CODES.has(lower)) return lower;
  const primary = lower.split(/[-_]/)[0].replace(/[^a-z]/g, '');
  if (primary && SUPPORTED_CODES.has(primary)) return primary;
  return 'en';
}

/**
 * @param {object} [source]
 * @param {string} [source.preferredLanguage]
 * @param {string} [source.language]
 * @param {string} [source.locale]
 * @returns {string}
 */
function resolvePreferredLanguage(source) {
  if (!source || typeof source !== 'object') return 'en';
  return normalizePreferredLanguage(source.preferredLanguage ?? source.language ?? source.locale);
}

const LANGUAGE_NAMES = {
  en: 'English',
  mr: 'Marathi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Chinese',
  hi: 'Hindi',
  ar: 'Arabic',
  ru: 'Russian',
  ko: 'Korean'
};

/**
 * @param {string} [code]
 * @returns {string} e.g. "Hindi" for "hi", defaults to English
 */
function getTargetLanguageName(code) {
  const lang = normalizePreferredLanguage(code);
  return LANGUAGE_NAMES[lang] || 'English';
}

module.exports = {
  LANGUAGE_NAMES,
  SUPPORTED_CODES,
  normalizePreferredLanguage,
  resolvePreferredLanguage,
  getTargetLanguageName
};
