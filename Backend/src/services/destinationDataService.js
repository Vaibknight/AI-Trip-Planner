const DestinationCatalog = require('../models/DestinationCatalog');
const logger = require('../utils/logger');
const { normalizeTransportationRecommended } = require('../utils/transportationEnum');

function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSyntheticDestinations(tripData, intent) {
  const city =
    tripData.state ||
    tripData.city ||
    tripData.to ||
    tripData.destination ||
    'Destination';
  const fallbackDestination = city;
  return {
    html: `<h2>Destination Overview</h2><p><strong>Name:</strong> ${fallbackDestination}</p><p><strong>City:</strong> ${fallbackDestination}</p>`,
    mainDestination: {
      name: fallbackDestination,
      city: fallbackDestination,
      country: tripData.country || '',
      description: '',
      bestTimeToVisit: tripData.season || 'All year',
      keyAreas: []
    },
    route: [],
    transportation: {
      recommended: 'flight',
      options: ['flight', 'train'],
      estimatedCost: 0,
      localTransportation: {
        metro: null,
        autoRickshaw: null,
        eRickshaw: null,
        buses: null,
        other: null,
        tips: []
      }
    },
    attractions: [],
    catalogCoords: null,
    source: 'synthetic'
  };
}

function catalogDocToDestinations(doc, tripData, intent) {
  const city = doc.cityName;
  const areas = doc.keyAreas?.length ? doc.keyAreas : [];
  const attractions = (doc.attractions || []).map((a) => ({
    name: a.name,
    type: (a.type || 'culture').toLowerCase(),
    priority: 'medium',
    description: a.description || ''
  }));

  let html = doc.destinationHtml;
  if (!html || html.length < 40) {
    const areaList = areas.length
      ? areas.map((a) => `<li>${a}</li>`).join('')
      : '<li>City center</li><li>Historic quarter</li>';
    const attrList = attractions.slice(0, 12).map(
      (a) =>
        `<li><strong>${a.name}</strong> - Type: ${a.type} - ${a.description || 'Popular spot'}</li>`
    );
    html = `
<h2>Destination Overview</h2>
<p><strong>Name:</strong> ${city}</p>
<p><strong>City:</strong> ${city}</p>
<p><strong>Country:</strong> ${doc.country || ''}</p>
<p><strong>Description:</strong> Curated highlights for ${city}.</p>
<h3>Key Areas</h3>
<ul>${areaList}</ul>
<h2>Top Attractions</h2>
<ul>${attrList.join('')}</ul>
`.trim();
  }

  const trans = doc.transportationNotes || {};
  const local = trans.localTransportation || {};

  return {
    html,
    mainDestination: {
      name: city,
      city,
      country: doc.country || '',
      description: '',
      bestTimeToVisit: tripData.season || 'All year',
      keyAreas: areas
    },
    route: [],
    transportation: {
      recommended: normalizeTransportationRecommended(trans.recommended || 'flight'),
      options: Array.isArray(trans.options) && trans.options.length ? trans.options : ['flight', 'train'],
      estimatedCost: trans.estimatedCost || 0,
      localTransportation: {
        metro: local.metro || null,
        autoRickshaw: local.autoRickshaw || null,
        eRickshaw: local.eRickshaw || null,
        buses: local.buses || null,
        other: local.other || null,
        tips: Array.isArray(local.tips) ? local.tips : []
      }
    },
    attractions,
    catalogCoords:
      typeof doc.latitude === 'number' && typeof doc.longitude === 'number'
        ? { latitude: doc.latitude, longitude: doc.longitude }
        : null,
    source: 'catalog'
  };
}

/**
 * Resolve destination bundle — MongoDB catalog first, else lightweight synthetic (no destination LLM).
 */
async function resolveDestinations(tripData, intent) {
  const label =
    tripData.state || tripData.to || tripData.destination || tripData.city || '';
  const slug = slugify(label);

  try {
    if (slug) {
      let doc = await DestinationCatalog.findOne({ citySlug: slug }).lean();
      if (!doc && label) {
        doc = await DestinationCatalog.findOne({
          cityName: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        }).lean();
      }
      if (doc) {
        logger.info('DestinationDataService: catalog hit', { citySlug: slug, cityName: doc.cityName });
        return catalogDocToDestinations(doc, tripData, intent);
      }
    }
  } catch (err) {
    logger.warn('DestinationDataService: catalog query failed', { error: err.message });
  }

  logger.info('DestinationDataService: using synthetic destination bundle', {
    label: label || 'none'
  });
  const syn = buildSyntheticDestinations(tripData, intent);
  return syn;
}

/**
 * When user did not pick a destination — suggest from catalog by tags/season.
 */
async function suggestDestinationCityFromCatalog(tripData, intent) {
  try {
    const interests = (tripData.interests || []).slice(0, 6).map((x) => String(x).toLowerCase());
    const season = tripData.season ? String(tripData.season).toLowerCase() : null;

    let doc = await DestinationCatalog.findOne({
      $or: [{ tags: { $in: interests } }, ...(season ? [{ seasons: season }] : [])]
    })
      .sort({ popularity: -1 })
      .lean();

    if (!doc) {
      doc = await DestinationCatalog.findOne().sort({ popularity: -1 }).lean();
    }

    if (doc?.cityName) {
      logger.info('DestinationDataService: suggested city from catalog', { city: doc.cityName });
      return doc.cityName;
    }
  } catch (err) {
    logger.warn('DestinationDataService: suggestDestination failed', { error: err.message });
  }

  return 'Goa';
}

module.exports = {
  resolveDestinations,
  suggestDestinationCityFromCatalog,
  slugify,
  buildSyntheticDestinations
};
