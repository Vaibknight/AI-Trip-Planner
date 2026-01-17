const { body } = require('express-validator');

/**
 * Validator for /plan-trip-with-preferences endpoint
 * Simplified payload structure
 */
const preferencesTripValidator = [
  // Destination fields - at least one should be provided
  body('destination')
    .optional()
    .trim()
    .isString()
    .withMessage('Destination must be a string'),
  
  body('state')
    .optional()
    .trim()
    .isString()
    .withMessage('State must be a string'),
  
  // At least one destination field must be provided
  body().custom((value) => {
    if (!value.destination && !value.state) {
      throw new Error('At least one of destination or state must be provided');
    }
    return true;
  }),
  
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
  
  // Budget Range (optional) - accepts any string input
  body('budgetRange')
    .optional()
    .trim()
    .isString()
    .withMessage('Budget range must be a string'),
  
  // Budget Range String (optional)
  body('budgetRangeString')
    .optional()
    .isString()
    .trim()
    .withMessage('Budget range string must be a string'),
  
  // Origin (optional)
  body('origin')
    .optional()
    .trim()
    .isString()
    .withMessage('Origin must be a string'),
  
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
    .withMessage('Currency must be a 3-letter code (e.g., USD, INR)'),
  
  // Start Date and Time (optional)
  body('startDateTime')
    .optional()
    .isISO8601()
    .withMessage('Start date and time must be a valid ISO 8601 datetime string (e.g., 2024-06-01T14:30:00Z)'),
  
  // End Date and Time (optional)
  body('endDateTime')
    .optional()
    .isISO8601()
    .withMessage('End date and time must be a valid ISO 8601 datetime string (e.g., 2024-06-08T18:00:00Z)')
];

module.exports = {
  preferencesTripValidator
};


