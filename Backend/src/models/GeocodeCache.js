const mongoose = require('mongoose');

/**
 * Persistent cache for Nominatim geocoding results (place + context → coordinates).
 */
const geocodeCacheSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    place: { type: String, default: '' },
    contextCity: { type: String, default: '' },
    contextCountry: { type: String, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GeocodeCache', geocodeCacheSchema);
