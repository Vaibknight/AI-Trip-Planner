const { body } = require('express-validator');

const createTripValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('destinations')
    .isArray({ min: 1 })
    .withMessage('At least one destination is required'),
  
  body('destinations.*.city')
    .trim()
    .notEmpty()
    .withMessage('City is required for each destination'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .toDate(),
  
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .toDate()
    .custom((value, { req }) => {
      if (value <= req.body.startDate) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  body('preferences.budget')
    .optional()
    .isIn(['budget', 'moderate', 'luxury'])
    .withMessage('Budget must be budget, moderate, or luxury'),
  
  body('preferences.travelStyle')
    .optional()
    .isIn(['adventure', 'relaxation', 'cultural', 'family', 'business'])
    .withMessage('Invalid travel style')
];

const updateTripValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .toDate(),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .toDate()
];

const generateTripValidator = [
  // Support both old format (destinations) and new format (from/to)
  body('destinations')
    .optional()
    .custom((value) => {
      if (typeof value === 'string' || Array.isArray(value)) {
        return true;
      }
      throw new Error('Destinations must be a string or array');
    }),
  
  // Support new format with from/to
  body('from')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Origin city is required'),
  
  body('to')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Destination city is required'),
  
  body('origin')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Origin city is required'),
  
  body('destination')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Destination city is required'),
  
  // At least one format must be provided
  body().custom((value) => {
    const hasDestinations = value.destinations && (typeof value.destinations === 'string' || Array.isArray(value.destinations));
    const hasFromTo = (value.from || value.origin) && (value.to || value.destination);
    
    if (!hasDestinations && !hasFromTo) {
      throw new Error('Either destinations (string/array) or (from/to or origin/destination) must be provided');
    }
    return true;
  }),
  
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .toDate(),
  
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .toDate()
    .custom((value, { req }) => {
      const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
      if (startDate && value <= startDate) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  // Support both numeric budget and enum budget
  body('budget')
    .optional()
    .custom((value) => {
      // Allow numeric budget (for plan-trip format)
      if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
        return true;
      }
      // Allow enum budget (for legacy format)
      if (['budget', 'moderate', 'luxury'].includes(value)) {
        return true;
      }
      throw new Error('Budget must be a positive number or one of: budget, moderate, luxury');
    }),
  
  body('currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code (e.g., INR, USD)'),
  
  body('travelers')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Travelers must be between 1 and 50')
    .toInt(),
  
  body('travelStyle')
    .optional()
    .isIn(['adventure', 'relaxation', 'cultural', 'family', 'business'])
    .withMessage('Invalid travel style'),
  
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),
  
  body('interests.*')
    .optional()
    .isString()
    .trim()
    .isIn(['nature', 'adventure', 'food', 'culture', 'nightlife', 'history', 'shopping', 'beach', 'mountains'])
    .withMessage('Invalid interest')
];

module.exports = {
  createTripValidator,
  updateTripValidator,
  generateTripValidator
};

