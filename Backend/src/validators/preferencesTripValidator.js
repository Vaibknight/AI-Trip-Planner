const { body } = require('express-validator');

/**
 * Validator for /plan-trip-with-preferences endpoint
 * Simplified payload structure
 */
const preferencesTripValidator = [
  // Destination (required)
  body('destination')
    .notEmpty()
    .withMessage('Destination is required')
    .trim()
    .isString()
    .withMessage('Destination must be a string'),
  
  // Travel Type (optional)
  body('travelType')
    .optional()
    .isIn(['leisure', 'business', 'adventure', 'cultural'])
    .withMessage('Travel type must be one of: leisure, business, adventure, cultural'),
  
  // Interests (optional array)
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),
  
  body('interests.*')
    .optional()
    .isString()
    .trim()
    .withMessage('Each interest must be a string'),
  
  // Season (optional)
  body('season')
    .optional()
    .isIn(['spring', 'summer', 'fall', 'winter'])
    .withMessage('Season must be one of: spring, summer, fall, winter'),
  
  // Trip Duration (required)
  body('duration')
    .notEmpty()
    .withMessage('Trip duration is required')
    .isInt({ min: 1, max: 30 })
    .withMessage('Trip duration must be between 1 and 30 days')
    .toInt(),
  
  // Budget Amount (optional)
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget amount must be a positive number')
    .toFloat(),
  
  // Travelers (optional)
  body('travelers')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Travelers must be between 1 and 50')
    .toInt(),
  
  // Currency (optional)
  body('currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code (e.g., USD, INR)')
];

module.exports = {
  preferencesTripValidator
};


