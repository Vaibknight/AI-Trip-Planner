/**
 * “Best time to visit” copy per language. Mirrors scenario logic in orchestrator (EN baseline).
 * @param {object} p
 * @param {string} p.language
 */
const { normalizePreferredLanguage } = require('./preferredLanguage');

function buildBestTimeToVisit(p) {
  const destinationLower = (p.destination || '').toLowerCase();
  const countryLower = (p.country || '').toLowerCase();
  const style = p.travelStyle || 'general';
  const lang = normalizePreferredLanguage(p.language);
  const weather = p.weather;
  const tips = [];

  let months;
  let reason;
  let avoid;

  if (lang === 'de') {
    months = 'Oktober bis März';
    reason = 'Angenehmes Wetter und gute Bedingungen für Sightseeing.';
    avoid = 'Juni bis September (starker Monsun in vielen Regionen).';

    if (countryLower === 'india' || destinationLower.includes('goa')) {
      if (destinationLower.includes('goa')) {
        months = 'November bis Februar';
        reason = 'Angenehmes Strandenwetter, niedrige Luftfeuchte, gute Nachtleben-Saison.';
        avoid = 'Juni bis September (Monsun mit häufigem Regen).';
      } else if (destinationLower.includes('ladakh')) {
        months = 'Mai bis September';
        reason = 'Hochstraßen und Pässe meist passierbar.';
        avoid = 'November bis März (harte winterliche Bedingungen in großer Höhe).';
      } else if (destinationLower.includes('rajasthan')) {
        months = 'Oktober bis März';
        reason = 'Kühlere Wüstentemperaturen, tagsüber gutes Wandern.';
        avoid = 'April bis Juni (Hitzespitze).';
      } else if (destinationLower.includes('kerala')) {
        months = 'September bis März';
        reason = 'Ausbalanciertes Klima für Backwaters, Strände und Hügelland.';
        avoid = 'Juni bis August (starker Monsun in vielen Gegenden).';
      }
    }

    if (style === 'relaxation') {
      tips.push('Nebensaisontermine bevorzugen: oft bessere Preise und weniger Trubel.');
    } else if (style === 'adventure') {
      tips.push('Fenster für Wandern/Wassersport vorab prüfen (Regeln/Saison).');
    } else {
      tips.push('4–8 Wochen im Voraus buchen – mehr Auswahl bei der Unterkunft.');
    }
  } else {
    // English (and fallback for all other language codes: labels still localized via getI18nLabels)
    months = 'October to March';
    reason = 'Pleasant weather and better conditions for sightseeing.';
    avoid = 'June to September (heavy monsoon in many regions).';

    if (countryLower === 'india' || destinationLower.includes('goa')) {
      if (destinationLower.includes('goa')) {
        months = 'November to February';
        reason = 'Comfortable beach weather, lower humidity, and strong nightlife season.';
        avoid = 'June to September (monsoon with frequent heavy rain).';
      } else if (destinationLower.includes('ladakh')) {
        months = 'May to September';
        reason = 'Roads and high-altitude passes are generally accessible.';
        avoid = 'November to March (extreme winter conditions).';
      } else if (destinationLower.includes('rajasthan')) {
        months = 'October to March';
        reason = 'Cooler desert temperatures make daytime exploration comfortable.';
        avoid = 'April to June (peak summer heat).';
      } else if (destinationLower.includes('kerala')) {
        months = 'September to March';
        reason = 'Balanced climate for backwaters, beaches, and hill stations.';
        avoid = 'June to August (strong monsoon in many parts).';
      }
    }

    if (style === 'relaxation') {
      tips.push('Prefer shoulder season dates for better prices and less crowd.');
    } else if (style === 'adventure') {
      tips.push('Check local activity windows (trekking/watersports) before booking.');
    } else {
      tips.push('Book 4–8 weeks early for better accommodation options.');
    }
  }

  if (weather?.current) {
    const currentTemp = weather.current.temperatureC;
    const currentCondition = weather.current.condition || 'current conditions';
    if (lang === 'de') {
      if (typeof currentTemp === 'number') {
        tips.push(
          `Aktuelles Wetter: ungefähr ${currentTemp.toFixed(1)}°C, ${String(currentCondition).toLowerCase()}.`
        );
      } else {
        tips.push(`Aktuell: ${String(currentCondition).toLowerCase()}.`);
      }
    } else {
      if (typeof currentTemp === 'number') {
        tips.push(
          `Current weather is around ${currentTemp.toFixed(1)}°C with ${String(currentCondition).toLowerCase()}.`
        );
      } else {
        tips.push(`Current weather indicates ${String(currentCondition).toLowerCase()}.`);
      }
    }
  }

  return { months, reason, avoid, tips };
}

module.exports = { buildBestTimeToVisit };
