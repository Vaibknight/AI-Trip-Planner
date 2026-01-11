const { body } = require('express-validator');

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateUserValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters'),
  
  body('preferences.budget')
    .optional()
    .isIn(['budget', 'moderate', 'luxury'])
    .withMessage('Budget must be budget, moderate, or luxury'),
  
  body('preferences.travelStyle')
    .optional()
    .isIn(['adventure', 'relaxation', 'cultural', 'family', 'business'])
    .withMessage('Invalid travel style')
];

module.exports = {
  registerValidator,
  loginValidator,
  updateUserValidator
};









