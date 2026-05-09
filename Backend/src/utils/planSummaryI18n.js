/**
 * Plan title and short description for the compiled trip (JSON + DB).
 * Travel style words use the same English tokens as the intent (relaxation, business, adventure, cultural).
 */
const { normalizePreferredLanguage } = require('./preferredLanguage');

const EN = (d, dest, style) => `A ${d}-day ${style} trip to ${dest}`;

const DESCRIPTION_BY_LANG = {
  en: EN,
  hi: (d, dest, style) => `${dest} के लिए ${d} दिन की ${style} यात्रा`,
  mr: (d, dest, style) => `${dest} साठी ${d} दिवसांचा ${style} स्टाइलमध्ये प्रवास`,
  bn: (d, dest, style) => `${dest} ${d} দিনের ${style} ভ্রমণ`,
  ta: (d, dest, style) => `${dest} -க்கு ${d} நாள் ${style} பயணம்`,
  te: (d, dest, style) => `${dest} కు ${d} రోజుల ${style} ప్రయాణం`,
  kn: (d, dest, style) => `${dest}ಗೆ ${d} ದಿನಗಳ ${style} ಪ್ರವಾಸ`,
  ml: (d, dest, style) => `${dest} ${d} ദിവസത്തേക്ക് ${style} യാത്ര`,
  es: (d, dest, style) => `Un viaje de ${d} días (${style}) a ${dest}`,
  fr: (d, dest, style) => `Un voyage de ${d} jours (${style}) vers ${dest}`,
  de: (d, dest, style) => `Eine ${d}-tägige Reise im Stil “${style}” nach ${dest}`,
  it: (d, dest, style) => `Un viaggio di ${d} giorni (${style}) a ${dest}`,
  pt: (d, dest, style) => `Uma viagem de ${d} dias (${style}) a ${dest}`,
  ja: (d, dest, style) => `${dest}への${d}日間の（${style}）旅行`,
  zh: (d, dest, style) => `前往${dest}的${d}天“${style}”行程`,
  ar: (d, dest, style) => `رحلة لمدة ${d} يوم بأسلوب ${style} إلى ${dest}`,
  ru: (d, dest, style) => `${d}-дневная поездка в стиле “${style}” в ${dest}`,
  ko: (d, dest, style) => `${dest}로 떠나는 ${d}일 ${style} 여행`
};

/**
 * @param {Object} p
 * @param {string} [p.from]
 * @param {string} [p.to] fallback destination when destinationName is missing
  * @param {string} [p.destinationName] primary destination display name
 * @param {number} p.duration
 * @param {string} [p.travelStyle] intent.travelStyle
 * @param {string} [p.preferredLanguage] ISO 639-1
 * @returns {{ title: string, description: string }}
 */
function getLocalizedPlanSummary(p) {
  const fromStr = (p.from != null && String(p.from).trim() !== '') ? String(p.from).trim() : '—';
  const dest =
    (p.destinationName != null && String(p.destinationName).trim() !== '')
      ? String(p.destinationName).trim()
      : (p.to != null && String(p.to).trim() !== '')
        ? String(p.to).trim()
        : 'Destination';
  const d = Math.max(1, Math.min(365, parseInt(p.duration, 10) || 1));
  const style = (p.travelStyle || 'cultural').toString();
  const lang = normalizePreferredLanguage(p.preferredLanguage);


  const title = `${fromStr} → ${dest}`;
  const descFn = DESCRIPTION_BY_LANG[lang] || EN;
  return { title, description: descFn(d, dest, style) };
}

module.exports = { getLocalizedPlanSummary };
