const mongoose = require('mongoose');

/**
 * Curated destination POIs + optional HTML — hybrid AI arranges from DB-backed facts.
 */
const poiSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, default: 'culture' },
    description: { type: String, default: '' }
  },
  { _id: false }
);

const destinationCatalogSchema = new mongoose.Schema(
  {
    citySlug: { type: String, required: true, unique: true, index: true },
    cityName: { type: String, required: true },
    country: { type: String, default: '' },
    /** Optional fixed coords — skips geocoding for weather */
    latitude: { type: Number },
    longitude: { type: Number },
    popularity: { type: Number, default: 0 },
    seasons: [{ type: String }],
    tags: [{ type: String }],
    keyAreas: [{ type: String }],
    attractions: [poiSchema],
    restaurants: [{ name: String, note: String }],
    hotels: [{ name: String, tier: String }],
    /** Pre-built overview HTML (optional); else generated from fields */
    destinationHtml: { type: String, default: '' },
    transportationNotes: {
      recommended: { type: String, default: 'flight' },
      options: [{ type: String }],
      estimatedCost: { type: Number, default: 0 },
      localTransportation: {
        metro: String,
        autoRickshaw: String,
        eRickshaw: String,
        buses: String,
        other: String,
        tips: [String]
      }
    }
  },
  { timestamps: true }
);

destinationCatalogSchema.index({ tags: 1, popularity: -1 });
destinationCatalogSchema.index({ seasons: 1, popularity: -1 });

module.exports = mongoose.model('DestinationCatalog', destinationCatalogSchema);
