const openRouterClient = require('../openRouterClient');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class ItineraryAgent {
  constructor() {
    this.client = openRouterClient;
  }

  /**
   * Create detailed day-by-day itinerary with streaming support
   * @param {Object} tripData - Trip data
   * @param {Object} intent - User intent
   * @param {Object} destinations - Destination data
   * @param {Function} onToken - Optional callback for token streaming
   */
  async createItinerary(tripData, intent, destinations, onToken = null) {
    try {
      // Build comprehensive prompt with all parameters
      const city = tripData.city || destinations.mainDestination.city || destinations.mainDestination.name;
      const country = destinations.mainDestination.country || '';
      const season = tripData.season || 'winter';
      const travelType = tripData.travelType || 'leisure';
      const budgetRange = tripData.budgetRange || intent.budgetCategory || 'moderate';
      const budgetRangeString = tripData.budgetRangeString || '';
      
      // HTML format prompt - avoids JSON parsing issues
      const origin = tripData.origin || tripData.from || 'Origin';
      const destination = city;
      const budgetLabel = budgetRange === 'luxury' ? 'Luxury' : budgetRange === 'budget' ? 'Budget' : 'Moderate';
      
      const prompt = `Create a ${intent.estimatedDays}-day ${budgetLabel} ${season} tour of ${destination}.

Origin: ${origin}
Destination: ${destination}
Interests: ${intent.priorityInterests.join(', ')}
Attractions: ${destinations.attractions?.slice(0, 8).map(a => a.name).join(', ') || destination}

Generate HTML itinerary in this EXACT format with proper HTML tags:

<h1>${intent.estimatedDays}-Day ${budgetLabel} ${season.charAt(0).toUpperCase() + season.slice(1)} Tour of ${destination}</h1>

<h2>✈️ Travel Summary</h2>
<table>
<tr><th>Leg</th><th>Departure</th><th>Arrival</th><th>Duration</th></tr>
<tr><td>${origin} → ${destination}</td><td>[time]</td><td>[time]</td><td>[duration]</td></tr>
</table>

<h2>📅 Day 1</h2>
<ul>
<li>[HH:MM] — [Activity name - use REAL place names]</li>
<li>[HH:MM] — [Activity name]</li>
<li>[HH:MM] — [Lunch/Dinner at Restaurant Name - use REAL restaurant names]</li>
<li>[HH:MM] — [Coffee at Cafe Name - use REAL cafe names]</li>
<li>[HH:MM] — [Activity name]</li>
</ul>

<h2>📅 Day 2</h2>
<ul>
<li>[HH:MM] — [Activity name]</li>
<li>[HH:MM] — [Activity name]</li>
</ul>

Continue for all ${intent.estimatedDays} days.

CRITICAL REQUIREMENTS:
- Use REAL place/restaurant/cafe names (e.g., "Red Fort", "Karim's Restaurant", "Indian Coffee House")
- Include cafes between activities
- Times: Breakfast 8-9, Lunch 12-13, Dinner 19-20:30, Coffee 10-11 & 15-16
- 5-7 activities per day with specific timing
- Match ${budgetRange} budget
- Output ONLY valid HTML with proper tags - no JSON, no markdown, no \\n characters, no code blocks
- Use proper HTML structure: <h1>, <h2>, <table>, <ul>, <li> tags
- Each activity must be on a separate <li> tag`;

      let response;
      let itineraryHtml = '';
      
      // If streaming callback provided, use streaming API
      if (onToken && typeof onToken === 'function') {
        try {
          itineraryHtml = await this.client.chatCompletionStream({
            model: config.openRouterModel,
            messages: [
              {
                role: 'system',
                content: 'Output HTML itinerary only. Use real place names. No JSON, no markdown code blocks, no explanations.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 3000 : 2000
          }, onToken);
          
          // Create response object from streamed content
          response = {
            content: itineraryHtml,
            usage: null,
            model: config.openRouterModel,
            finishReason: 'stop',
            reasoning: null
          };
        } catch (streamError) {
          logger.warn('Itinerary Agent: Streaming failed, falling back to non-streaming', {
            error: streamError.message
          });
          // Fall through to non-streaming
        }
      }
      
      // Non-streaming fallback or if streaming not requested
      if (!response || !response.content) {
        try {
          response = await this.client.chatCompletion({
            model: config.openRouterModel,
            messages: [
              {
                role: 'system',
                content: 'Output HTML itinerary only. Use real place names. No JSON, no markdown code blocks, no explanations.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 3000 : 2000
          });
        } catch (jsonModeError) {
          logger.warn('Itinerary Agent: JSON mode not supported, trying without it', {
            error: jsonModeError.message,
            model: config.openRouterModel
          });
          
          response = await this.client.chatCompletion({
            model: config.openRouterModel,
            messages: [
              {
                role: 'system',
                content: 'Output HTML itinerary only. Use real place names. No JSON, no markdown code blocks, no explanations.\n\nYou are NOT allowed to use internal chain-of-thought reasoning. You must answer concisely and directly. Do not think step by step. Only output the final answer.'
              },
              {
                role: 'user',
                content: prompt + '\n\nOutput ONLY HTML. No markdown code blocks, no JSON, no explanations.'
              }
            ],
            temperature: 0.3,
            max_tokens: (config.openRouterModel && config.openRouterModel.includes(':free')) ? 3000 : 2000
          });
        }
      }

      // Validate response structure
      if (!response || !response.content) {
        logger.error('Itinerary Agent: Invalid response from AI', {
          response: response,
          hasContent: !!response?.content,
          usage: response?.usage,
          finishReason: response?.finishReason,
          hasReasoning: !!response?.reasoning
        });
        
        // If we have reasoning content, try to extract itinerary from it
        // Free models often put the actual response in reasoning when they hit token limits
        if (response?.reasoning && response.reasoning.length > 100) {
          logger.warn('Itinerary Agent: No content but found reasoning, attempting extraction', {
            reasoningLength: response.reasoning.length,
            reasoningPreview: response.reasoning.substring(0, 200)
          });
          try {
            const extracted = this.extractItineraryFromText(response.reasoning, tripData, intent, destinations);
            if (extracted && extracted.itinerary && extracted.itinerary.length > 0) {
              logger.info('Itinerary Agent: Successfully extracted from reasoning content', {
                days: extracted.itinerary.length
              });
              return extracted;
            }
          } catch (extractError) {
            logger.warn('Itinerary Agent: Failed to extract from reasoning', { error: extractError.message });
          }
        }
        
        throw new Error('Invalid response from AI: missing content');
      }

      logger.info('Itinerary Agent: Received response from AI', {
        contentLength: response.content?.length,
        contentPreview: response.content?.substring(0, 200)
      });

      // HTML response - no JSON parsing needed
      let itinerary;
      try {
        // Log the raw response for debugging
        logger.info('Itinerary Agent: Raw AI response', {
          contentLength: response.content?.length,
          first500Chars: response.content?.substring(0, 500),
          contentType: typeof response.content
        });
        
        // Get HTML content directly
        let itineraryHtml = response.content || '';
        
        // Clean up HTML - remove markdown code blocks if present
        itineraryHtml = itineraryHtml.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();
        
        // Fix common HTML formatting issues
        itineraryHtml = this.fixHtmlFormatting(itineraryHtml);
        
        // Basic HTML sanitization - remove script tags and dangerous attributes
        itineraryHtml = this.sanitizeHtml(itineraryHtml);
        
        logger.info('Itinerary Agent: HTML response received', {
          htmlLength: itineraryHtml.length,
          hasContent: itineraryHtml.length > 0
        });
        
        if (!itineraryHtml || itineraryHtml.length < 50) {
          throw new Error('HTML response too short or empty');
        }
        
        // Convert HTML to structured format for compatibility
        itinerary = {
          html: itineraryHtml,
          itinerary: this.parseHtmlToItinerary(itineraryHtml, tripData, intent, destinations),
          highlights: [],
          tips: []
        };
        
      } catch (parseError) {
        logger.error('Itinerary Agent: Failed to process HTML response', {
          error: parseError.message,
          responseLength: response.content?.length,
          responsePreview: response.content?.substring(0, 500)
        });
        throw new Error(`Failed to process itinerary HTML: ${parseError.message}`);
      }
      
      // Validate itinerary structure
      if (!itinerary || !itinerary.itinerary || !Array.isArray(itinerary.itinerary)) {
        logger.error('Itinerary Agent: Invalid response structure', {
          hasItinerary: !!itinerary,
          itineraryType: typeof itinerary?.itinerary,
          itineraryValue: itinerary?.itinerary,
          responsePreview: response.content?.substring(0, 500),
          fullResponse: JSON.stringify(itinerary, null, 2).substring(0, 1000)
        });
        throw new Error('Invalid itinerary structure from AI response');
      }

      // Validate that we have activities
      const totalActivities = itinerary.itinerary.reduce((sum, day) => sum + (day.activities?.length || 0), 0);
      if (totalActivities === 0) {
        logger.error('Itinerary Agent: No activities generated', {
          days: itinerary.itinerary.length,
          daysWithActivities: itinerary.itinerary.filter(d => d.activities?.length > 0).length,
          responsePreview: response.content?.substring(0, 1000)
        });
        throw new Error('No activities generated in itinerary');
      }

      // Log warning if generic activities detected but don't fail
      const hasGenericActivities = itinerary.itinerary.some(day => 
        day.activities?.some(act => 
          act.name?.toLowerCase().includes('explore') && 
          act.name?.toLowerCase().includes(city.toLowerCase())
        )
      );

      if (hasGenericActivities) {
        logger.warn('Itinerary Agent: Generic activities detected, but returning response anyway');
      }
      
      logger.info('Itinerary Agent: Itinerary created successfully', { 
        days: itinerary.itinerary.length,
        totalActivities,
        hasHighlights: (itinerary.highlights?.length || 0) > 0,
        hasTips: (itinerary.tips?.length || 0) > 0,
        sampleActivity: itinerary.itinerary[0]?.activities?.[0]?.name || 'N/A'
      });
      
      return itinerary;
    } catch (error) {
      logger.error('Itinerary Agent Error:', error);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        city: tripData.city || destinations.mainDestination.city,
        destination: destinations.mainDestination.name
      });
      // Re-throw the error so orchestrator knows it failed
      // The orchestrator will handle the error appropriately
      throw error;
    }
  }

  /**
   * Extract itinerary from plain text/markdown when JSON parsing fails
   * This is a fallback for when the model returns text instead of JSON
   */
  extractItineraryFromText(content, tripData, intent, destinations) {
    const city = tripData.city || destinations.mainDestination.city || destinations.mainDestination.name;
    const duration = intent.estimatedDays || 7;
    const itinerary = [];
    
    // Try to extract day-by-day information from text
    // Look for patterns like "Day 1:", "Day 2:", etc.
    const dayPattern = /Day\s+(\d+)[:\.]?\s*(.*?)(?=Day\s+\d+|$)/gis;
    const days = content.matchAll(dayPattern);
    
    let dayIndex = 0;
    for (const dayMatch of days) {
      dayIndex++;
      if (dayIndex > duration) break;
      
      const dayContent = dayMatch[2] || dayMatch[0];
      const activities = [];
      
      // Try to extract activities with times (e.g., "08:00 - Breakfast at...")
      const timePattern = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})?\s*:?\s*(.+?)(?=\d{1,2}:\d{2}|$)/gi;
      const activityMatches = dayContent.matchAll(timePattern);
      
      for (const activityMatch of activityMatches) {
        const startTime = activityMatch[1] + ':' + activityMatch[2];
        const endTime = activityMatch[3] ? (activityMatch[3] + ':' + activityMatch[4]) : null;
        const activityText = activityMatch[5] || activityMatch[0];
        
        // Try to identify activity type from text
        let type = 'activity';
        if (activityText.toLowerCase().includes('breakfast') || activityText.toLowerCase().includes('lunch') || activityText.toLowerCase().includes('dinner')) {
          type = 'restaurant';
        } else if (activityText.toLowerCase().includes('cafe') || activityText.toLowerCase().includes('coffee')) {
          type = 'cafe';
        } else if (activityText.toLowerCase().includes('hotel') || activityText.toLowerCase().includes('check-in') || activityText.toLowerCase().includes('check-out')) {
          type = 'hotel';
        } else if (activityText.toLowerCase().includes('visit') || activityText.toLowerCase().includes('tour')) {
          type = 'attraction';
        }
        
        activities.push({
          name: activityText.trim().substring(0, 100), // Limit length
          description: activityText.trim(),
          type: type,
          location: city,
          timeSlot: this.getTimeSlot(startTime),
          startTime: startTime,
          endTime: endTime || this.calculateEndTime(startTime, 120),
          duration: 120,
          cost: {
            amount: 0,
            currency: tripData.currency || 'USD'
          },
          notes: ''
        });
      }
      
      // If no activities found with time pattern, create at least one activity from day content
      if (activities.length === 0 && dayContent.trim().length > 10) {
        activities.push({
          name: `Day ${dayIndex} Activities`,
          description: dayContent.trim().substring(0, 200),
          type: 'activity',
          location: city,
          timeSlot: 'morning',
          startTime: '09:00',
          endTime: '17:00',
          duration: 480,
          cost: {
            amount: 1000,
            currency: tripData.currency || 'USD'
          },
          notes: ''
        });
      }
      
      if (activities.length > 0) {
        itinerary.push({
          day: dayIndex,
          date: new Date(tripData.startDate),
          title: `Day ${dayIndex}`,
          activities: activities,
          notes: '',
          estimatedCost: activities.reduce((sum, act) => sum + (act.cost?.amount || 0), 0)
        });
      }
    }
    
    // If we couldn't extract days, create a basic structure
    if (itinerary.length === 0) {
      logger.warn('Could not extract structured itinerary from text, creating basic structure');
      for (let i = 0; i < duration; i++) {
        const dayDate = new Date(tripData.startDate);
        dayDate.setDate(dayDate.getDate() + i);
        
        itinerary.push({
          day: i + 1,
          date: dayDate,
          title: i === 0 ? 'Arrival & Exploration' : i === duration - 1 ? 'Departure' : `Day ${i + 1}`,
          activities: [
            {
              name: i === 0 ? 'Check-in at hotel' : i === duration - 1 ? 'Check-out from hotel' : `Explore ${city}`,
              description: i === 0 ? 'Arrive and settle into your accommodation' : i === duration - 1 ? 'Final day - prepare for departure' : `Enjoy activities and attractions in ${city}`,
              type: i === 0 || i === duration - 1 ? 'hotel' : 'activity',
              location: city,
              timeSlot: 'morning',
              startTime: '09:00',
              endTime: '17:00',
              duration: 480,
              cost: {
                amount: 1000,
                currency: tripData.currency || 'USD'
              },
              notes: ''
            }
          ],
          notes: '',
          estimatedCost: 1000
        });
      }
    }
    
      return {
      itinerary: itinerary,
        highlights: [],
        tips: []
      };
    }

  /**
   * Determine time slot from time string
   */
  getTimeSlot(timeStr) {
    if (!timeStr) return 'morning';
    const hour = parseInt(timeStr.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Calculate end time from start time and duration
   */
  calculateEndTime(startTime, durationMinutes) {
    if (!startTime) return '17:00';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  /**
   * Fix HTML formatting issues - remove literal \n, fix spacing, ensure proper structure
   */
  fixHtmlFormatting(html) {
    if (!html) return '';
    
    // Replace literal \n characters with actual newlines first
    html = html.replace(/\\n/g, '\n');
    
    // Replace markdown headers with HTML headers
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    
    // Fix markdown list items to HTML list items (but preserve existing HTML lists)
    const lines = html.split('\n');
    let inList = false;
    let fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line is a markdown list item
      if (/^-\s+(.+)$/.test(line.trim()) && !line.trim().startsWith('<li>')) {
        if (!inList) {
          fixedLines.push('<ul>');
          inList = true;
        }
        const content = line.replace(/^-\s+/, '').trim();
        fixedLines.push(`<li>${content}</li>`);
      } else {
        if (inList) {
          fixedLines.push('</ul>');
          inList = false;
        }
        fixedLines.push(line);
      }
    }
    if (inList) {
      fixedLines.push('</ul>');
    }
    html = fixedLines.join('\n');
    
    // Fix missing spaces around em dashes
    html = html.replace(/(\d{2}:\d{2})—/g, '$1 — ');
    html = html.replace(/—([A-Za-z])/g, ' — $1');
    
    // Fix concatenated words in activity names (e.g., "VisitRedFort" -> "Visit Red Fort")
    html = html.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Fix cases where activities are concatenated (e.g., "Visit ISKCON Temple- 16:00")
    html = html.replace(/([a-zA-Z])(-\s*\d{2}:\d{2}\s*—)/g, '$1\n<li>$2');
    
    // Ensure proper spacing in activity lists
    html = html.replace(/(\d{2}:\d{2})\s*—\s*/g, '$1 — ');
    
    // Fix table structure - ensure proper HTML table tags
    if (html.includes('<table>') && !html.includes('<tr>')) {
      // Try to fix markdown tables
      html = html.replace(/\|\s*(.+?)\s*\|/g, (match, content) => {
        if (content.includes('---')) return ''; // Skip separator rows
        const cells = content.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length > 0) {
          return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
        return match;
      });
    }
    
    // Fix missing newlines between sections
    html = html.replace(/(<\/ul>)(<h2>)/g, '$1\n\n$2');
    html = html.replace(/(<\/table>)(<h2>)/g, '$1\n\n$2');
    html = html.replace(/(<\/h2>)(<ul>)/g, '$1\n$2');
    
    // Fix cases where activities are concatenated (e.g., "Visit ISKCON Temple- 16:00")
    html = html.replace(/([a-zA-Z])(-\s*\d{2}:\d{2}\s*—)/g, '$1\n<li>$2');
    
    // Ensure proper spacing in activity lists
    html = html.replace(/(\d{2}:\d{2})\s*—\s*/g, '$1 — ');
    
    // Fix table structure - ensure proper HTML table tags
    if (html.includes('<table>') && !html.includes('<tr>')) {
      // Try to fix markdown tables
      html = html.replace(/\|\s*(.+?)\s*\|/g, (match, content) => {
        if (content.includes('---')) return ''; // Skip separator rows
        const cells = content.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length > 0) {
          return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
        return match;
      });
    }
    
    return html.trim();
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   */
  sanitizeHtml(html) {
    if (!html) return '';
    
    // Remove script tags and event handlers
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    html = html.replace(/javascript:/gi, '');
    
    // Allow safe HTML tags only
    const allowedTags = ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'strong', 'em', 'br', 'hr'];
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    
    html = html.replace(tagPattern, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return '';
    });
    
    return html;
  }

  /**
   * Parse HTML itinerary to structured format for database storage
   */
  parseHtmlToItinerary(html, tripData, intent, destinations) {
    const itinerary = [];
    const city = tripData.city || destinations.mainDestination.city || destinations.mainDestination.name;
    const duration = intent.estimatedDays || 7;
    
    // Extract day sections from HTML
    const dayPattern = /## 📅 Day (\d+)[\s\S]*?(?=## 📅 Day \d+|$)/gi;
    const dayMatches = html.matchAll(dayPattern);
    
    let dayIndex = 0;
    for (const dayMatch of dayMatches) {
      dayIndex++;
      if (dayIndex > duration) break;
      
      const dayContent = dayMatch[0];
      const activities = [];
      
      // Extract activities with times (format: "- [HH:MM] — [Activity name]")
      const activityPattern = /-\s*\[?(\d{1,2}):(\d{2})\]?\s*[—–-]\s*(.+?)(?=-\s*\[?\d{1,2}:\d{2}|$)/gi;
      const activityMatches = dayContent.matchAll(activityPattern);
      
      for (const activityMatch of activityMatches) {
        const startTime = activityMatch[1] + ':' + activityMatch[2];
        const activityName = activityMatch[3].trim();
        
        // Determine activity type
        let type = 'activity';
        const nameLower = activityName.toLowerCase();
        if (nameLower.includes('breakfast') || nameLower.includes('lunch') || nameLower.includes('dinner')) {
          type = 'restaurant';
        } else if (nameLower.includes('cafe') || nameLower.includes('coffee')) {
          type = 'cafe';
        } else if (nameLower.includes('hotel') || nameLower.includes('check-in') || nameLower.includes('check-out')) {
          type = 'hotel';
        } else if (nameLower.includes('visit') || nameLower.includes('tour')) {
          type = 'attraction';
        }
        
        activities.push({
          name: activityName,
          description: activityName,
          type: type,
          location: city,
          timeSlot: this.getTimeSlot(startTime),
          startTime: startTime,
          endTime: this.calculateEndTime(startTime, 120),
          duration: 120,
          cost: {
            amount: 0,
            currency: tripData.currency || 'USD'
          },
          notes: ''
        });
      }
      
      if (activities.length > 0) {
        itinerary.push({
          day: dayIndex,
          date: new Date(tripData.startDate),
          title: `Day ${dayIndex}`,
          activities: activities,
          notes: '',
          estimatedCost: activities.reduce((sum, act) => sum + (act.cost?.amount || 0), 0)
        });
      }
    }
    
    // If no days extracted, create basic structure
    if (itinerary.length === 0) {
      for (let i = 0; i < duration; i++) {
        const dayDate = new Date(tripData.startDate);
        dayDate.setDate(dayDate.getDate() + i);
        
        itinerary.push({
          day: i + 1,
          date: dayDate,
          title: i === 0 ? 'Arrival & Exploration' : i === duration - 1 ? 'Departure' : `Day ${i + 1}`,
          activities: [{
            name: i === 0 ? 'Check-in at hotel' : i === duration - 1 ? 'Check-out from hotel' : `Explore ${city}`,
            description: '',
            type: i === 0 || i === duration - 1 ? 'hotel' : 'activity',
            location: city,
            timeSlot: 'morning',
            startTime: '09:00',
            endTime: '17:00',
            duration: 480,
            cost: { amount: 1000, currency: tripData.currency || 'USD' },
            notes: ''
          }],
          notes: '',
          estimatedCost: 1000
        });
      }
    }
    
    return itinerary;
  }
}

module.exports = ItineraryAgent;

