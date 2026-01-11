const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  description: String,
  imageUrl: String
}, { _id: false });

const activitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  type: {
    type: String,
    enum: ['attraction', 'restaurant', 'cafe', 'hotel', 'activity', 'transport', 'other'],
    default: 'activity'
  },
  location: String,
  timeSlot: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    default: 'morning'
  },
  startTime: String,
  endTime: String,
  duration: Number, // in minutes
  cost: {
    amount: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  notes: String
}, { _id: false });

const dayItinerarySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  day: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    trim: true
  },
  activities: [activitySchema],
  notes: String,
  estimatedCost: { type: Number, default: 0 }
}, { _id: false });

const tripSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a trip title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  origin: {
    type: String,
    trim: true
  },
  destination: {
    type: String,
    trim: true
  },
  travelers: {
    type: Number,
    default: 1,
    min: 1
  },
  destinations: [destinationSchema],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  duration: {
    type: Number, // in days
    required: true
  },
  budget: {
    total: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    breakdown: {
      accommodation: { type: Number, default: 0 },
      transportation: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      activities: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    perPerson: { type: Number, default: 0 },
    perDay: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['within', 'over', 'under'],
      default: 'within'
    },
    variance: { type: Number, default: 0 },
    optimizations: [{
      category: String,
      suggestion: String,
      potentialSavings: Number
    }]
  },
  transportation: {
    recommended: {
      type: String,
      enum: ['flight', 'train', 'bus', 'car', 'other']
    },
    options: [String],
    estimatedCost: { type: Number, default: 0 }
  },
  itinerary: [dayItinerarySchema],
  itineraryHtml: {
    type: String,
    default: null
  },
  preferences: {
    budget: {
      type: String,
      enum: ['budget', 'moderate', 'luxury'],
      default: 'moderate'
    },
    travelStyle: {
      type: String,
      enum: ['adventure', 'relaxation', 'cultural', 'family', 'business'],
      default: 'cultural'
    },
    interests: [String],
    dietaryRestrictions: [String],
    accessibility: [String]
  },
  status: {
    type: String,
    enum: ['draft', 'planning', 'confirmed', 'completed', 'cancelled'],
    default: 'draft'
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  aiPrompt: String, // Store the original prompt used for AI generation
  highlights: [String],
  tips: [String],
  optimizations: [{
    type: {
      type: String,
      enum: ['time', 'cost', 'experience', 'practicality']
    },
    suggestion: String,
    impact: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    estimatedSavings: { type: Number, default: 0 },
    estimatedTimeSaved: { type: Number, default: 0 }
  }],
  alternativeActivities: [{
    day: Number,
    original: String,
    alternative: String,
    reason: String,
    costDifference: { type: Number, default: 0 }
  }],
  recommendations: [String],
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
tripSchema.index({ userId: 1, createdAt: -1 });
tripSchema.index({ status: 1 });
tripSchema.index({ startDate: 1, endDate: 1 });

// Calculate duration before saving
tripSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    this.duration = diffDays;
  }
  next();
});

module.exports = mongoose.model('Trip', tripSchema);

