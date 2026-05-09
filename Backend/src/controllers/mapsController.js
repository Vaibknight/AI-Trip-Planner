const geocodingService = require('../utils/geocoding');

/**
 * GET /api/maps/geocode?place=...&city=&country=
 * POST /api/maps/geocode/batch { places: string[], city?, country? }
 */
const geocodeQuery = async (req, res, next) => {
  try {
    const place = req.query.place;
    if (!place || !String(place).trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Query parameter "place" is required'
      });
    }
    const city = req.query.city || req.query.state || '';
    const country = req.query.country || '';
    const placeContext = {
      city: city ? String(city).trim() : null,
      country: country ? String(country).trim() : null
    };
    console.time('maps:geocode');
    const coordinates = await geocodingService.geocode(String(place).trim(), placeContext);
    console.timeEnd('maps:geocode');
    if (!coordinates) {
      return res.status(404).json({
        status: 'error',
        message: 'No coordinates found for this place',
        data: { place: String(place).trim() }
      });
    }
    res.json({
      status: 'success',
      data: {
        place: String(place).trim(),
        coordinates
      }
    });
  } catch (err) {
    next(err);
  }
};

const MAX_BATCH = 40;

const geocodeBatch = async (req, res, next) => {
  try {
    const { places, city, country } = req.body || {};
    const placeContext = {
      city: city != null && String(city).trim() ? String(city).trim() : null,
      country: country != null && String(country).trim() ? String(country).trim() : null
    };
    if (!Array.isArray(places)) {
      return res.status(400).json({
        status: 'error',
        message: 'Request body must include a "places" array'
      });
    }
    const unique = [...new Set(places.map((p) => String(p).trim()).filter((p) => p.length > 0))].slice(
      0,
      MAX_BATCH
    );
    console.time('maps:geocodeBatch');
    const { results, meta } = await geocodingService.geocodeBatchParallel(unique, placeContext);
    console.timeEnd('maps:geocodeBatch');
    console.log(
      JSON.stringify({
        tag: 'maps:geocodeBatch',
        durationMs: meta.durationMs,
        uniqueCount: meta.uniqueCount,
        concurrency: meta.concurrency,
        mongoPrefetchHits: meta.mongoPrefetchHits
      })
    );
    res.json({
      status: 'success',
      data: {
        results,
        placeContext,
        meta
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  geocodeQuery,
  geocodeBatch
};
