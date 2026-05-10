const mongoose = require('mongoose');

/**
 * Persistent cache for Nominatim geocoding results (place + context → coordinates).
 * `key` remains the lookup key; placeName / city / country mirror human-readable fields.
 */
const geocodeCacheSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    /** Normalized primary query used for this cache entry */
    placeName: { type: String, default: '' },
    /** Legacy field — same as placeName when set from geocoder */
    place: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    contextCity: { type: String, default: '' },
    contextCountry: { type: String, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    formattedAddress: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GeocodeCache', geocodeCacheSchema);
