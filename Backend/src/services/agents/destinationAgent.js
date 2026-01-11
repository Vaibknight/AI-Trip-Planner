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
      const city = tripData.city || tripData.to || tripData.destination || '';
      const destination = tripData.to || tripData.destination || '';
      const origin = tripData.origin || tripData.from || 'Origin';
      
      // Single HTML prompt for all destination information
      const prompt = `Research ${city || destination} for a ${intent.estimatedDays}-day trip.

Origin: ${origin}
Destination: ${city || destination}
Interests: ${intent.priorityInterests.join(', ')}
Season: ${tripData.season || 'any'}
Budget: ${intent.budgetCategory}

Generate HTML content with destination information:

<h2>Destination Overview</h2>
<p><strong>Name:</strong> [Full destination name]</p>
<p><strong>City:</strong> [City name]</p>
<p><strong>Country:</strong> [Country name]</p>
<p><strong>Description:</strong> [2-3 sentence description]</p>
<p><strong>Best Time to Visit:</strong> [Best season/months]</p>

<h3>Key Areas</h3>
<ul>
<li>[Area/Neighborhood 1]</li>
<li>[Area/Neighborhood 2]</li>
<li>[Area/Neighborhood 3]</li>
<li>[Area/Neighborhood 4]</li>
<li>[Area/Neighborhood 5]</li>
</ul>

<h2>Transportation</h2>
<p><strong>Recommended:</strong> [flight|train|bus|car]</p>
<p><strong>Options:</strong> [option1, option2]</p>
<p><strong>Estimated Cost:</strong> [amount]</p>

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
      const structuredData = this.parseHtmlToStructured(destinationHtml, city || destination, intent, tripData);
      
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
      // Return basic destination structure on error
      const destination = tripData.to || tripData.destination || '';
      return {
        html: `<h2>Destination Overview</h2><p><strong>Name:</strong> ${destination}</p>`,
        mainDestination: {
          name: destination,
          city: destination,
          country: '',
          description: '',
          bestTimeToVisit: tripData.season || 'All year',
          keyAreas: []
        },
        route: [],
        transportation: {
          recommended: 'flight',
          options: ['flight', 'train'],
          estimatedCost: 0
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
        estimatedCost: 0
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

      // Extract key areas
      const areasMatch = html.match(/<h3>Key Areas<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
      if (areasMatch) {
        const areasList = areasMatch[1];
        const areaItems = areasList.match(/<li>([^<]+)<\/li>/g);
        if (areaItems) {
          result.mainDestination.keyAreas = areaItems.map(item => 
            item.replace(/<\/?li>/g, '').trim()
          );
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

