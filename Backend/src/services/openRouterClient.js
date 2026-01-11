const config = require('../config/config');
const logger = require('../utils/logger');

class OpenRouterClient {
  constructor() {
    this.apiKey = config.openRouterApiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.defaultModel = config.openRouterModel || 'openai/gpt-4';
    this.maxRetries = 2; // Maximum number of retries for rate limit errors (reduced for faster failure)
    this.baseRetryDelay = 1000; // Base delay in milliseconds (1 second - reduced for speed)
    
    if (!this.apiKey) {
      logger.warn('OpenRouter API key not found. AI features will be disabled.');
    }
  }

  /**
   * Sleep/delay helper for retries
   * @param {number} ms - Milliseconds to wait
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a chat completion request to OpenRouter with retry logic for rate limits
   * @param {Object} params - Request parameters
   * @param {number} retryCount - Current retry attempt (internal use)
   * @returns {Promise<Object>} Response from OpenRouter
   */
  async chatCompletion(params, retryCount = 0) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const {
      model = this.defaultModel,
      messages,
      temperature = 0.7,
      max_tokens = null, // Optional - let model decide if not specified
      response_format = null
    } = params;

    try {
      const requestBody = {
        model,
        messages,
        temperature
      };

      // Only add max_tokens if specified (some free models work better without it)
      if (max_tokens !== null && max_tokens !== undefined) {
        requestBody.max_tokens = max_tokens;
      }

      // Add response_format if specified (for JSON mode)
      // Note: Some free models may not support JSON mode, so we'll handle errors gracefully
      if (response_format) {
        requestBody.response_format = response_format;
      }

      // Add timeout to prevent hanging requests (30 seconds max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        // Use fetch (built-in in Node 18+, or use node-fetch for older versions)
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': config.openRouterHttpReferer || '', // Optional: Your app URL
            'X-Title': config.openRouterAppName || 'Trip Planner' // Optional: Your app name
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || 
            `OpenRouter API error: ${response.status} ${response.statusText}`;
          
          // Handle rate limit errors (429) with retry logic
          if (response.status === 429 && retryCount < this.maxRetries) {
            // Calculate exponential backoff delay: baseDelay * 2^retryCount
            const retryDelay = this.baseRetryDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 500; // Add random jitter (0-500ms) to avoid thundering herd
            const totalDelay = retryDelay + jitter;
            
            logger.warn(`OpenRouter Rate Limit (429) - Retrying in ${Math.round(totalDelay)}ms (attempt ${retryCount + 1}/${this.maxRetries})`, {
              status: response.status,
              error: errorData,
              model: model,
              retryCount: retryCount + 1,
              delay: Math.round(totalDelay)
            });
            
            // Wait before retrying
            await this.sleep(totalDelay);
            
            // Retry the request
            return this.chatCompletion(params, retryCount + 1);
          }
          
          // Log detailed error for debugging
          logger.error('OpenRouter API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            model: model,
            retryCount: retryCount,
            willRetry: response.status === 429 && retryCount < this.maxRetries
          });
          
          // If we've exhausted retries for 429, provide a helpful error message
          if (response.status === 429 && retryCount >= this.maxRetries) {
            throw new Error(`Rate limit exceeded after ${this.maxRetries} retries. The free model is temporarily rate-limited. Please wait a moment and try again, or consider adding your own API key: https://openrouter.ai/settings/integrations`);
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // Log response for debugging
        logger.debug('OpenRouter API Response', {
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          model: data.model,
          usage: data.usage,
          finishReason: data.choices?.[0]?.finish_reason,
          messageRole: data.choices?.[0]?.message?.role
        });
        
        // OpenRouter response format is similar to OpenAI
        if (data.choices && data.choices.length > 0) {
        let content = data.choices[0].message.content;
        const finishReason = data.choices[0].finish_reason;
        const usage = data.usage;
        
        // Log the raw content structure for debugging
        logger.debug('OpenRouter Raw Content Structure', {
          contentType: typeof content,
          isArray: Array.isArray(content),
          isNull: content === null,
          isUndefined: content === undefined,
          isEmptyString: content === '',
          contentValue: content,
          contentLength: typeof content === 'string' ? content.length : 'N/A',
          contentKeys: typeof content === 'object' && content !== null ? Object.keys(content).slice(0, 10) : null,
          finishReason: finishReason,
          usage: usage,
          reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens || 0,
          actualContentTokens: (usage?.completion_tokens || 0) - (usage?.completion_tokens_details?.reasoning_tokens || 0)
        });
        
        // Check if content is null or undefined (different from empty string)
        if (content === null || content === undefined) {
          logger.error('OpenRouter: Content is null or undefined', {
            message: data.choices[0].message,
            usage: usage,
            finishReason: finishReason
          });
          throw new Error('OpenRouter API returned null or undefined content');
        }
        
        // Check if content is empty and finish reason is "length" - token limit hit
        if ((!content || content.length === 0) && finishReason === 'length') {
          const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;
          const totalCompletionTokens = usage?.completion_tokens || 0;
          
          logger.error('OpenRouter: Empty content due to token limit - reasoning consumed all tokens', {
            finishReason: finishReason,
            totalCompletionTokens: totalCompletionTokens,
            reasoningTokens: reasoningTokens,
            actualContentTokens: totalCompletionTokens - reasoningTokens,
            maxTokens: 'Check agent max_tokens setting',
            recommendation: 'Increase max_tokens or reduce prompt size'
          });
          
          // Don't throw error - return empty string and let agent handle it
          // But log it as a critical issue
        }
        
        // Handle different content formats - some models return content in unexpected formats
        if (typeof content !== 'string') {
          logger.warn('OpenRouter: Content is not a string, attempting conversion', {
            contentType: typeof content,
            isArray: Array.isArray(content),
            contentSample: typeof content === 'object' ? JSON.stringify(content).substring(0, 200) : content
          });
          
          // If it's an array, join it
          if (Array.isArray(content)) {
            content = content.join('');
          }
          // If it's an object with character indices (like {"0":"s","1":"t",...}), convert to string
          else if (typeof content === 'object' && content !== null) {
            // Check if it looks like a string converted to object (has numeric keys)
            const keys = Object.keys(content);
            const hasNumericKeys = keys.length > 0 && keys.every(key => !isNaN(parseInt(key)));
            
            if (hasNumericKeys) {
              // Reconstruct string from object with numeric indices
              const sortedKeys = keys.map(k => parseInt(k)).sort((a, b) => a - b);
              content = sortedKeys.map(k => content[k.toString()]).join('');
              logger.info('Reconstructed string from object with numeric indices', {
                originalLength: keys.length,
                reconstructedLength: content.length
              });
            } else {
              // Regular object - stringify it
              content = JSON.stringify(content);
            }
          }
          // If it's a number or other type, convert to string
          else {
            content = String(content);
          }
        }
        
        // Final validation - ensure content is a string (empty string is valid)
        if (typeof content !== 'string') {
          logger.error('OpenRouter: Could not convert content to string', {
            originalContent: data.choices[0].message.content,
            contentType: typeof content,
            content: content
          });
          throw new Error('Invalid content format from OpenRouter API: content is not a string');
        }
        
        // Check if content is empty - this is a problem
        if (content.length === 0) {
          const finishReason = data.choices[0].finish_reason;
          logger.error('OpenRouter: Content is empty string - model returned no response', {
            originalContent: data.choices[0].message.content,
            messageStructure: data.choices[0].message,
            finishReason: finishReason,
            usage: data.usage,
            model: data.model,
            possibleReasons: [
              finishReason === 'length' ? 'Model hit token limit (max_tokens too low)' : null,
              finishReason === 'stop' ? 'Model stopped early' : null,
              finishReason === 'content_filter' ? 'Content was filtered' : null,
              'Model failed to generate response',
              'Response format issue',
              'Free model limitations'
            ].filter(Boolean)
          });
          
          throw new Error("AI returned empty response — retry with higher max_tokens or different model.");
        }
        
        logger.debug('OpenRouter Response Content (final)', {
          contentLength: content.length,
          contentPreview: content.substring(0, 200),
          contentType: typeof content
        });
        
        // Include reasoning content if available (for free models that use reasoning tokens)
        // Check multiple possible locations for reasoning content
        let reasoning = null;
        const message = data.choices[0].message;
        if (message.reasoning) {
          reasoning = typeof message.reasoning === 'string' ? message.reasoning : 
                     (message.reasoning.text || JSON.stringify(message.reasoning));
        } else if (message.messageStructure?.reasoning) {
          reasoning = typeof message.messageStructure.reasoning === 'string' ? 
                     message.messageStructure.reasoning :
                     (message.messageStructure.reasoning.text || JSON.stringify(message.messageStructure.reasoning));
        } else if (message.messageStructure?.reasoning_details && 
                   Array.isArray(message.messageStructure.reasoning_details) &&
                   message.messageStructure.reasoning_details.length > 0) {
          // Extract reasoning from reasoning_details array
          reasoning = message.messageStructure.reasoning_details
            .map(detail => detail.text || JSON.stringify(detail))
            .join('\n');
        }
        
        return {
          content: content,
          usage: data.usage,
          model: data.model,
          finishReason: data.choices[0].finish_reason,
          reasoning: reasoning,
          messageStructure: data.choices[0].message.messageStructure || null
        };
      }

        logger.error('OpenRouter: No choices in response', { data });
        throw new Error('No response from OpenRouter');
      } catch (error) {
        // Clear timeout if still active
        clearTimeout(timeoutId);
        
        // Handle timeout errors
        if (error.name === 'AbortError') {
          logger.error('OpenRouter API Request Timeout (30s exceeded)', {
            model: params.model || this.defaultModel,
            retryCount: retryCount
          });
          throw new Error('Request timeout: The AI service took too long to respond. Please try again.');
        }
        
        logger.error('OpenRouter API Error:', error);
        throw error;
      }
    } catch (error) {
      // Handle timeout errors
      if (error.name === 'AbortError') {
        logger.error('OpenRouter API Request Timeout (30s exceeded)', {
          model: params.model || this.defaultModel,
          retryCount: retryCount
        });
        throw new Error('Request timeout: The AI service took too long to respond. Please try again.');
      }
      
      logger.error('OpenRouter API Error:', error);
      throw error;
    }
  }

  /**
   * Stream chat completion with token-by-token updates
   * @param {Object} params - Request parameters
   * @param {Function} onToken - Callback for each token (token: string)
   * @returns {Promise<string>} Complete response content
   */
  async chatCompletionStream(params, onToken) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const {
      model = this.defaultModel,
      messages,
      temperature = 0.7,
      max_tokens = null,
      response_format = null
    } = params;

    const requestBody = {
      model,
      messages,
      temperature,
      stream: true // Enable streaming
    };

    if (max_tokens !== null && max_tokens !== undefined) {
      requestBody.max_tokens = max_tokens;
    }

    if (response_format) {
      requestBody.response_format = response_format;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for streaming

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.openRouterHttpReferer || '',
          'X-Title': config.openRouterAppName || 'Trip Planner'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              continue;
            }

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;
              const content = delta?.content;

              if (content) {
                fullContent += content;
                // Call the token callback
                if (onToken && typeof onToken === 'function') {
                  onToken(content);
                }
              }
            } catch (e) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }

      return fullContent;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The AI service took too long to respond.');
      }
      throw error;
    }
  }

  /**
   * Stream chat completion with token-by-token updates
   * @param {Object} params - Request parameters
   * @param {Function} onToken - Callback for each token (token: string)
   * @returns {Promise<string>} Complete response content
   */
  async chatCompletionStream(params, onToken) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const {
      model = this.defaultModel,
      messages,
      temperature = 0.7,
      max_tokens = null,
      response_format = null
    } = params;

    const requestBody = {
      model,
      messages,
      temperature,
      stream: true // Enable streaming
    };

    if (max_tokens !== null && max_tokens !== undefined) {
      requestBody.max_tokens = max_tokens;
    }

    if (response_format) {
      requestBody.response_format = response_format;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for streaming

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.openRouterHttpReferer || '',
          'X-Title': config.openRouterAppName || 'Trip Planner'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            
            if (data === '[DONE]') {
              continue;
            }

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;
              const content = delta?.content;

              if (content) {
                fullContent += content;
                // Call the token callback
                if (onToken && typeof onToken === 'function') {
                  onToken(content);
                }
              }
            } catch (e) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }

      return fullContent;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The AI service took too long to respond.');
      }
      throw error;
    }
  }

  /**
   * Parse JSON response from OpenRouter
   */
  parseJSONResponse(content) {
    try {
      // Handle case where content might not be a string
      if (content === null || content === undefined) {
        logger.error('Invalid content: null or undefined');
        throw new Error('Content is null or undefined');
      }
      
      // Convert to string if needed
      if (typeof content !== 'string') {
        logger.warn('parseJSONResponse: Content is not a string, attempting conversion', {
          contentType: typeof content,
          contentValue: content,
          isArray: Array.isArray(content)
        });
        
        if (Array.isArray(content)) {
          content = content.join('');
        } else if (typeof content === 'object' && content !== null) {
          // Check if it's an object with numeric keys (string converted to object)
          const keys = Object.keys(content);
          const hasNumericKeys = keys.length > 0 && keys.every(key => !isNaN(parseInt(key)));
          
          if (hasNumericKeys) {
            // Reconstruct string from object with numeric indices
            const sortedKeys = keys.map(k => parseInt(k)).sort((a, b) => a - b);
            content = sortedKeys.map(k => content[k.toString()]).join('');
            logger.info('parseJSONResponse: Reconstructed string from object with numeric indices', {
              originalLength: keys.length,
              reconstructedLength: content.length
            });
          } else {
            // Regular object - stringify it
            content = JSON.stringify(content);
          }
        } else {
          content = String(content);
        }
      }
      
      // Handle empty string case - this is a critical error
      if (content === '') {
        logger.error('parseJSONResponse: Content is empty string - cannot parse JSON');
        throw new Error('Cannot parse empty string as JSON - model likely hit token limit');
      }
      
      if (typeof content !== 'string') {
        logger.error('Invalid content type for JSON parsing after conversion:', typeof content);
        throw new Error('Content is not a string');
      }

      // Clean the content - remove any leading/trailing whitespace
      let cleanedContent = content.trim();
      
      logger.debug('Parsing JSON response', {
        contentLength: cleanedContent.length,
        startsWithBacktick: cleanedContent.startsWith('`'),
        first100Chars: cleanedContent.substring(0, 100)
      });

      // Method 1: Try to extract JSON from markdown code blocks (most common case)
      // Match ```json ... ``` or ``` ... ```
      const codeBlockMatch = cleanedContent.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          const jsonInBlock = codeBlockMatch[1].trim();
          // Check if JSON is incomplete (ends with { or [ without closing, or ends with comma)
          if (jsonInBlock.endsWith('{') || jsonInBlock.endsWith('[') || 
              (jsonInBlock.endsWith(',') && !jsonInBlock.includes('}')) ||
              jsonInBlock.length < 10) {
            logger.error('JSON in code block appears incomplete - model hit token limit', {
              blockContent: jsonInBlock,
              blockLength: jsonInBlock.length,
              endsWith: jsonInBlock.slice(-5)
            });
            throw new Error('Incomplete JSON - model hit token limit. Increase max_tokens.');
          }
          const parsed = JSON.parse(jsonInBlock);
          logger.info('Successfully parsed JSON from markdown code block');
          return parsed;
        } catch (e) {
          logger.warn('Found code block but failed to parse JSON inside it', {
            error: e.message,
            blockContent: codeBlockMatch[1].substring(0, 200)
          });
          // If it's incomplete, throw error to trigger fallback
          if (e.message.includes('Incomplete JSON')) {
            throw e;
          }
        }
      }
      
      // Method 2: Try to find JSON object in the content (look for { ... })
      // Use a more robust regex that handles nested objects
      const jsonObjectMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch && jsonObjectMatch[0]) {
        try {
          const jsonStr = jsonObjectMatch[0];
          const parsed = JSON.parse(jsonStr);
          logger.info('Successfully parsed JSON object from content');
          return parsed;
        } catch (e) {
          logger.warn('Found JSON-like object but failed to parse', {
            error: e.message,
            objectPreview: jsonObjectMatch[0].substring(0, 200)
          });
        }
      }
      
      // Method 3: Try direct JSON parse (if content is already JSON)
      try {
        const parsed = JSON.parse(cleanedContent);
        logger.info('Successfully parsed JSON directly');
        return parsed;
      } catch (e) {
        logger.warn('Direct JSON parse failed', { error: e.message });
      }
      
      // Method 4: Try to clean and extract JSON more aggressively
      // Remove any text before first { and after last }
      const firstBrace = cleanedContent.indexOf('{');
      const lastBrace = cleanedContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const extractedJson = cleanedContent.substring(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(extractedJson);
          logger.info('Successfully parsed JSON by extracting from content');
          return parsed;
        } catch (e) {
          logger.warn('Failed to parse extracted JSON', { error: e.message });
        }
      }
      
      // Method 5: Try to fix incomplete JSON (add missing closing braces)
      if (firstBrace !== -1) {
        try {
          let incompleteJson = cleanedContent.substring(firstBrace);
          // Count open and close braces
          const openBraces = (incompleteJson.match(/\{/g) || []).length;
          const closeBraces = (incompleteJson.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          
          if (missingBraces > 0 && missingBraces <= 3) {
            // Try to complete the JSON by adding missing closing braces
            incompleteJson += '}'.repeat(missingBraces);
            const parsed = JSON.parse(incompleteJson);
            logger.info('Successfully parsed incomplete JSON by adding missing braces', {
              addedBraces: missingBraces
            });
            return parsed;
          }
        } catch (e) {
          logger.warn('Failed to fix incomplete JSON', { error: e.message });
        }
      }
      
      // If all methods fail, throw error with helpful message
      throw new Error('Could not extract valid JSON from response');
    } catch (error) {
      logger.error('Error parsing JSON response:', error);
      logger.error('Response content (first 1000 chars):', content?.substring(0, 1000));
      logger.error('Response content (last 500 chars):', content?.substring(Math.max(0, content.length - 500)));
      throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
    }
  }
}

module.exports = new OpenRouterClient();

