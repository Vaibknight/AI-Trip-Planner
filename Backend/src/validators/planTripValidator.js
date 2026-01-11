const { body } = require('express-validator');

/**
 * Validator for /plan-trip endpoint
 * Matches the UI input screen requirements
 */
const planTripValidator = [
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
  
  // At least one of from/to or origin/destination must be provided
  body().custom((value) => {
    if (!value.from && !value.origin && !value.to && !value.destination) {
      throw new Error('Either (from, to) or (origin, destination) must be provided');
    }
    return true;
  }),
  
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .toDate(),
  
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
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
  
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number')
    .toFloat(),
  
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
  
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),
  
  body('interests.*')
    .optional()
    .isString()
    .trim()
    .isIn(['nature', 'adventure', 'food', 'culture', 'nightlife', 'history', 'shopping', 'beach', 'mountains'])
    .withMessage('Invalid interest. Must be one of: nature, adventure, food, culture, nightlife, history, shopping, beach, mountains')
];

module.exports = {
  planTripValidator
};









