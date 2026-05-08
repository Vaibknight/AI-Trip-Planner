/**
 * Seed DestinationCatalog with sample destinations (hybrid AI + DB architecture).
 * Run: node scripts/seed-destination-catalog.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../src/config/config');
const DestinationCatalog = require('../src/models/DestinationCatalog');

const samples = [
  {
    citySlug: 'mumbai',
    cityName: 'Mumbai',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    popularity: 100,
    tags: ['food', 'nightlife', 'culture', 'beach'],
    seasons: ['winter', 'monsoon', 'summer'],
    keyAreas: ['Colaba & Fort', 'Bandra West', 'Juhu', 'Powai'],
    attractions: [
      { name: 'Gateway of India', type: 'history', description: 'Waterfront landmark and harbor overlook.' },
      { name: 'Elephanta Caves', type: 'culture', description: 'UNESCO rock-cut caves on Elephanta Island.' },
      { name: 'Marine Drive', type: 'nature', description: 'Sea-facing promenade known as the Queen’s Necklace.' },
      { name: 'Chhatrapati Shivaji Maharaj Terminus', type: 'architecture', description: 'Victorian-era railway terminus (UNESCO).' }
    ],
    restaurants: [{ name: 'Trishna', note: 'Coastal seafood' }, { name: 'Britannia & Co.', note: 'Heritage Parsi cafe' }],
    hotels: [{ name: 'Taj Mahal Palace', tier: 'luxury' }],
    transportationNotes: {
      recommended: 'train',
      options: ['local train', 'metro', 'uber'],
      estimatedCost: 2500,
      localTransportation: {
        metro: 'Metro Line 3 expanding — check airport connectivity.',
        autoRickshaw: 'Metered and app-hailable — negotiate short hops.',
        buses: 'BEST buses city-wide.',
        tips: ['Avoid rush-hour locals if luggage-heavy.', 'Use prepaid taxis from airport.']
      }
    }
  },
  {
    citySlug: 'delhi',
    cityName: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    popularity: 95,
    tags: ['history', 'food', 'shopping', 'culture'],
    seasons: ['winter', 'summer'],
    keyAreas: ['Old Delhi', 'Connaught Place', 'Hauz Khas', 'Mehrauli'],
    attractions: [
      { name: 'Red Fort', type: 'history', description: 'Mughal fort and museums.' },
      { name: 'Qutub Minar', type: 'history', description: 'Tallest brick minaret (UNESCO).' },
      { name: 'India Gate', type: 'landmark', description: 'Memorial arch and lawns.' },
      { name: 'Humayun’s Tomb', type: 'history', description: 'Garden tomb precursor to Taj Mahal.' }
    ],
    restaurants: [{ name: 'Karim’s', note: 'Mughlai near Jama Masjid' }],
    hotels: [{ name: 'The Imperial', tier: 'luxury' }],
    transportationNotes: {
      recommended: 'metro',
      options: ['metro', 'uber', 'rickshaw'],
      estimatedCost: 2000,
      localTransportation: {
        metro: 'Dense DMRC network — AC coaches.',
        tips: ['Carry metro card or use NCMC.', 'Plan Old Delhi walks early morning.']
      }
    }
  }
];

async function run() {
  await mongoose.connect(config.mongodbUri);
  for (const doc of samples) {
    await DestinationCatalog.findOneAndUpdate(
      { citySlug: doc.citySlug },
      { $set: doc },
      { upsert: true }
    );
    console.log('Upserted:', doc.citySlug);
  }
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
