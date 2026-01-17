const openRouterClient = require('../openRouterClient');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class DestinationAgent {
  constructor() {
    this.client = openRouterClient;
  }

  /**
   * Sleep/delay helper to avoid rate limits
   * @param {number} ms - Milliseconds to wait
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Find and analyze best destinations and routes
   * Returns HTML format - no JSON parsing
   */
  async findDestinations(tripData, intent) {
    try {
      // CRITICAL: ONLY use state field - no fallbacks to city/to/destination
      const state = tripData.state || '';
      const origin = tripData.origin || tripData.from || 'Origin';
      
      logger.info('Destination Agent - findDestinations called', {
        state: tripData.state || 'UNDEFINED',
        city: tripData.city || 'UNDEFINED (IGNORED)',
        to: tripData.to || 'UNDEFINED (IGNORED)',
        destination: tripData.destination || 'UNDEFINED (IGNORED)',
        usingState: state || 'EMPTY - WILL SEARCH GENERIC',
        allTripDataKeys: Object.keys(tripData),
        tripDataRaw: JSON.stringify({
          state: tripData.state,
          city: tripData.city,
          to: tripData.to,
          destination: tripData.destination
        })
      });
      
      // Enhanced prompt for 2-3 day trips to emphasize areas
      const isShortTrip = intent.estimatedDays >= 2 && intent.estimatedDays <= 3;
      const areasInstruction = isShortTrip 
        ? `\nIMPORTANT: Since this is a ${intent.estimatedDays}-day trip, focus on recommending the BEST 3-5 areas/neighborhoods that travelers should explore. These areas should be walkable or easily accessible and contain multiple attractions/activities nearby.`
        : '';
      
      // Single HTML prompt for all destination information
      // CRITICAL: ONLY use state - no fallbacks
      if (!state) {
        logger.warn('Destination Agent: No state provided - will search generically');
      }
      
      const prompt = `Research ${state || 'a suitable destination'} for a ${intent.estimatedDays}-day trip.

Origin: ${origin}
Destination: ${state || 'a suitable destination'}${state ? ' (USE THIS EXACT DESTINATION - DO NOT CHANGE IT)' : ' (suggest a suitable destination)'}
Interests: ${intent.priorityInterests.join(', ')}
Season: ${tripData.season || 'any'}
Budget: ${intent.budgetCategory}${areasInstruction}

CRITICAL: If a specific destination state is provided (${state}), you MUST research that exact destination. Do NOT suggest a different destination. Use "${state}" exactly as provided.

Generate HTML content with destination information:

<h2>Destination Overview</h2>
<p><strong>Name:</strong> [Full destination name]</p>
<p><strong>City:</strong> [City name]</p>
<p><strong>Country:</strong> [Country name]</p>
<p><strong>Description:</strong> [2-3 sentence description]</p>
<p><strong>Best Time to Visit:</strong> [Best season/months]</p>

<h3>Key Areas</h3>
<ul>
<li>[Area/Neighborhood 1]${isShortTrip ? ' - Brief description of why this area is recommended' : ''}</li>
<li>[Area/Neighborhood 2]${isShortTrip ? ' - Brief description of why this area is recommended' : ''}</li>
<li>[Area/Neighborhood 3]${isShortTrip ? ' - Brief description of why this area is recommended' : ''}</li>
${isShortTrip ? '<li>[Area/Neighborhood 4] - Brief description of why this area is recommended</li>\n<li>[Area/Neighborhood 5] - Brief description of why this area is recommended</li>' : '<li>[Area/Neighborhood 4]</li>\n<li>[Area/Neighborhood 5]</li>'}
</ul>

<h2>Transportation</h2>
<p><strong>Recommended:</strong> [flight|train|bus|car]</p>
<p><strong>Options:</strong> [option1, option2]</p>
<p><strong>Estimated Cost:</strong> [amount]</p>

<h3>Local Transportation Tips</h3>
<p>Information about getting around within ${state || 'the destination'}:</p>
<ul>
<li><strong>Metro/Subway:</strong> [Availability, key stations, operating hours, approximate cost]</li>
<li><strong>Auto-Rickshaws:</strong> [Availability, typical fare range, tips for using]</li>
<li><strong>E-Rickshaws:</strong> [Availability, typical fare range, where to find them]</li>
<li><strong>Buses:</strong> [Availability, key routes, fare information]</li>
<li><strong>Other:</strong> [Taxis, app-based rides (Uber/Ola), bike rentals, walking tips]</li>
</ul>
<p><strong>Transportation Tips:</strong> [2-3 practical tips for getting around efficiently, best modes for different areas, cost-saving tips]</p>

<h2>Top Attractions</h2>
<ul>
<li><strong>[Attraction Name 1]</strong> - [Type: nature|adventure|culture|food|nightlife|history|art|architecture] - [Brief description]</li>
<li><strong>[Attraction Name 2]</strong> - [Type] - [Description]</li>
...
</ul>

Requirements:
- Use REAL attraction names (e.g., "Red Fort", "Eiffel Tower", "Louvre Museum")
- Include 10-15 specific attractions
- Use HTML format only - no JSON, no markdown code blocks
- No explanations, just the HTML content`;

      const response = await this.client.chatCompletion({
        model: config.openRouterModel,
        messages: [
          {
            role: 'system',
            content: 'Output HTML destination information only. Use real place names. No JSON, no markdown code blocks, no explanations.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 1000 : 800
      });

      // Get HTML content directly - no JSON parsing
      let destinationHtml = response.content || '';
      
      // Clean up HTML - remove markdown code blocks if present
      destinationHtml = destinationHtml.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();
      
      // Basic HTML sanitization
      destinationHtml = this.sanitizeHtml(destinationHtml);
      
      if (!destinationHtml || destinationHtml.length < 50) {
        logger.warn('Destination Agent: HTML response too short, using fallback');
        throw new Error('HTML response too short or empty');
      }
      
      // Parse HTML to extract structured data for internal compatibility
      const structuredData = this.parseHtmlToStructured(destinationHtml, state || '', intent, tripData);
      
      logger.info('Destination Agent: HTML response received and parsed', {
        htmlLength: destinationHtml.length,
        hasMainDestination: !!structuredData.mainDestination,
        attractionsCount: structuredData.attractions.length
      });
      
      return {
        html: destinationHtml,
        ...structuredData
      };
    } catch (error) {
      logger.error('Destination Agent Error:', error);
      // Return basic destination structure on error - use state only
      const fallbackDestination = tripData.state || 'Destination';
      return {
        html: `<h2>Destination Overview</h2><p><strong>Name:</strong> ${fallbackDestination}</p>`,
        mainDestination: {
          name: fallbackDestination,
          city: fallbackDestination,
          country: '',
          description: '',
          bestTimeToVisit: tripData.season || 'All year',
          keyAreas: []
        },
        route: [],
        transportation: {
          recommended: 'flight',
          options: ['flight', 'train'],
          estimatedCost: 0,
          localTransportation: {
            metro: null,
            autoRickshaw: null,
            eRickshaw: null,
            buses: null,
            other: null,
            tips: []
          }
        },
        attractions: []
      };
    }
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   */
  sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return '';
    
    // Remove script tags and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Parse HTML to extract structured data for internal compatibility
   */
  parseHtmlToStructured(html, defaultDestination, intent, tripData) {
    const result = {
      mainDestination: {
        name: defaultDestination,
        city: defaultDestination,
        country: '',
        description: '',
        bestTimeToVisit: tripData.season || 'All year',
        keyAreas: []
      },
      route: [],
      transportation: {
        recommended: 'flight',
        options: ['flight', 'train'],
        estimatedCost: 0,
        localTransportation: {
          metro: null,
          autoRickshaw: null,
          eRickshaw: null,
          buses: null,
          other: null,
          tips: []
        }
      },
      attractions: []
    };

    try {
      // Extract destination name
      const nameMatch = html.match(/<strong>Name:<\/strong>\s*([^<]+)/i);
      if (nameMatch) {
        result.mainDestination.name = nameMatch[1].trim();
        result.mainDestination.city = nameMatch[1].trim();
      }

      // Extract country
      const countryMatch = html.match(/<strong>Country:<\/strong>\s*([^<]+)/i);
      if (countryMatch) {
        result.mainDestination.country = countryMatch[1].trim();
      }

      // Extract description
      const descMatch = html.match(/<strong>Description:<\/strong>\s*([^<]+)/i);
      if (descMatch) {
        result.mainDestination.description = descMatch[1].trim();
      }

      // Extract best time to visit
      const timeMatch = html.match(/<strong>Best Time to Visit:<\/strong>\s*([^<]+)/i);
      if (timeMatch) {
        result.mainDestination.bestTimeToVisit = timeMatch[1].trim();
      }

      // Extract key areas (with optional descriptions)
      const areasMatch = html.match(/<h3>Key Areas<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
      if (areasMatch) {
        const areasList = areasMatch[1];
        const areaItems = areasList.match(/<li>([\s\S]*?)<\/li>/g);
        if (areaItems) {
          result.mainDestination.keyAreas = areaItems.map(item => {
            const cleanItem = item.replace(/<\/?li>/g, '').trim();
            // Extract area name (before dash if description exists)
            const areaName = cleanItem.split(' - ')[0].trim();
            return areaName;
          });
        }
      }

      // Extract transportation
      const transportMatch = html.match(/<strong>Recommended:<\/strong>\s*([^<]+)/i);
      if (transportMatch) {
        result.transportation.recommended = transportMatch[1].trim().toLowerCase();
      }

      const optionsMatch = html.match(/<strong>Options:<\/strong>\s*([^<]+)/i);
      if (optionsMatch) {
        result.transportation.options = optionsMatch[1].trim().split(',').map(o => o.trim());
      }

      const costMatch = html.match(/<strong>Estimated Cost:<\/strong>\s*([^<]+)/i);
      if (costMatch) {
        const costStr = costMatch[1].trim().replace(/[^\d]/g, '');
        result.transportation.estimatedCost = parseInt(costStr) || 0;
      }

      // Extract local transportation tips
      result.transportation.localTransportation = {
        metro: null,
        autoRickshaw: null,
        eRickshaw: null,
        buses: null,
        other: null,
        tips: []
      };

      // Extract local transportation section
      const localTransportMatch = html.match(/<h3>Local Transportation Tips<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
      if (localTransportMatch) {
        const transportList = localTransportMatch[1];
        const transportItems = transportList.match(/<li>([\s\S]*?)<\/li>/g);
        if (transportItems) {
          transportItems.forEach(item => {
            const cleanItem = item.replace(/<\/?li>/g, '').trim();
            // Extract transportation type and info
            if (cleanItem.includes('<strong>Metro/Subway:</strong>')) {
              result.transportation.localTransportation.metro = cleanItem
                .replace(/<strong>Metro\/Subway:<\/strong>\s*/i, '')
                .replace(/<[^>]+>/g, '')
                .trim();
            } else if (cleanItem.includes('<strong>Auto-Rickshaws:</strong>')) {
              result.transportation.localTransportation.autoRickshaw = cleanItem
                .replace(/<strong>Auto-Rickshaws:<\/strong>\s*/i, '')
                .replace(/<[^>]+>/g, '')
                .trim();
            } else if (cleanItem.includes('<strong>E-Rickshaws:</strong>')) {
              result.transportation.localTransportation.eRickshaw = cleanItem
                .replace(/<strong>E-Rickshaws:<\/strong>\s*/i, '')
                .replace(/<[^>]+>/g, '')
                .trim();
            } else if (cleanItem.includes('<strong>Buses:</strong>')) {
              result.transportation.localTransportation.buses = cleanItem
                .replace(/<strong>Buses:<\/strong>\s*/i, '')
                .replace(/<[^>]+>/g, '')
                .trim();
            } else if (cleanItem.includes('<strong>Other:</strong>')) {
              result.transportation.localTransportation.other = cleanItem
                .replace(/<strong>Other:<\/strong>\s*/i, '')
                .replace(/<[^>]+>/g, '')
                .trim();
            }
          });
        }
      }

      // Extract transportation tips
      const tipsMatch = html.match(/<strong>Transportation Tips:<\/strong>\s*([^<]+)/i);
      if (tipsMatch) {
        const tipsText = tipsMatch[1].trim();
        // Split tips by common separators (periods, semicolons, or newlines)
        result.transportation.localTransportation.tips = tipsText
          .split(/[.;]\s+/)
          .map(tip => tip.trim())
          .filter(tip => tip.length > 0);
      }

      // Extract attractions
      const attractionsMatch = html.match(/<h2>Top Attractions<\/h2>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
      if (attractionsMatch) {
        const attractionsList = attractionsMatch[1];
        const attractionItems = attractionsList.match(/<li>([\s\S]*?)<\/li>/g);
        if (attractionItems) {
          result.attractions = attractionItems.map(item => {
            const cleanItem = item.replace(/<\/?li>/g, '').trim();
            const nameMatch = cleanItem.match(/<strong>([^<]+)<\/strong>/);
            const name = nameMatch ? nameMatch[1].trim() : cleanItem.split('-')[0].trim();
            const typeMatch = cleanItem.match(/Type:\s*([^-\n]+)/i);
            const type = typeMatch ? typeMatch[1].trim() : 'culture';
            const descMatch = cleanItem.match(/-\s*([^-]+)$/);
            const description = descMatch ? descMatch[1].trim() : '';
            
            return {
              name,
              type: type.toLowerCase(),
              priority: 'medium',
              description
            };
          });
        }
      }
    } catch (parseError) {
      logger.warn('Destination Agent: Error parsing HTML, using defaults', {
        error: parseError.message
      });
    }

    return result;
  }
}

module.exports = DestinationAgent;

