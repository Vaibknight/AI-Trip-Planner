const logger = require('../utils/logger');
const geocodingService = require('../utils/geocoding');

class WeatherService {
  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1/forecast';
    this.cache = new Map();
    this.cacheTtlMs = 30 * 60 * 1000; // 30 minutes
  }

  getWmoDescription(code) {
    const codeMap = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };
    return codeMap[code] || 'Unknown';
  }

  getCachedWeather(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(cacheKey);
      return null;
    }
    return entry.data;
  }

  setCachedWeather(cacheKey, data) {
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      data
    });
  }

  async getDestinationWeather({ city, country = '' }) {
    if (!city || typeof city !== 'string') {
      return null;
    }

    const cacheKey = `${city}|${country}`.toLowerCase();
    const cached = this.getCachedWeather(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const coordinates = await geocodingService.geocode(city, country || null);
      if (!coordinates?.latitude || !coordinates?.longitude) {
        logger.warn('Weather: unable to geocode destination', { city, country });
        return null;
      }

      const url = new URL(this.baseUrl);
      url.searchParams.set('latitude', String(coordinates.latitude));
      url.searchParams.set('longitude', String(coordinates.longitude));
      url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m');
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
      url.searchParams.set('forecast_days', '5');
      url.searchParams.set('timezone', 'auto');

      const response = await fetch(url.toString(), { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Weather API failed: ${response.status}`);
      }

      const payload = await response.json();
      const current = payload.current || {};
      const daily = payload.daily || {};

      const forecast = (daily.time || []).map((date, index) => ({
        date,
        minC: daily.temperature_2m_min?.[index] ?? null,
        maxC: daily.temperature_2m_max?.[index] ?? null,
        rainProbability: daily.precipitation_probability_max?.[index] ?? null,
        condition: this.getWmoDescription(daily.weather_code?.[index])
      }));

      const weatherData = {
        source: 'open-meteo',
        unit: 'C',
        location: {
          city,
          country,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        },
        current: {
          temperatureC: current.temperature_2m ?? null,
          feelsLikeC: current.apparent_temperature ?? null,
          humidity: current.relative_humidity_2m ?? null,
          windKph: current.wind_speed_10m ?? null,
          condition: this.getWmoDescription(current.weather_code),
          observedAt: current.time || null
        },
        forecast,
        lastUpdated: new Date()
      };

      this.setCachedWeather(cacheKey, weatherData);
      return weatherData;
    } catch (error) {
      logger.warn('Weather: failed to fetch destination weather', {
        city,
        country,
        error: error.message
      });
      return null;
    }
  }
}

module.exports = new WeatherService();
