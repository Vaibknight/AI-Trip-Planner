require('dotenv').config();

module.exports = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/trip-planner',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  
  // OpenRouter
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 
    (process.env.USE_PAID === 'true' 
      ? 'mistralai/mistral-small' 
      : 'meta-llama/llama-3.2-3b-instruct:free'),
  openRouterHttpReferer: process.env.OPENROUTER_HTTP_REFERER || '',
  openRouterAppName: process.env.OPENROUTER_APP_NAME || 'Trip Planner',
  
  // Legacy OpenAI support (for backward compatibility)
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100, // requests per window
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

