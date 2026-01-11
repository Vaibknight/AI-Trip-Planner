# OpenRouter Setup Guide

This backend uses **OpenRouter** for AI model access instead of direct OpenAI API. OpenRouter provides access to multiple AI models through a unified API.

## Why OpenRouter?

- **Multiple Models**: Access to various AI models (GPT-4, Claude, Llama, etc.)
- **Unified API**: Single API for all models
- **Cost Effective**: Competitive pricing
- **Easy Switching**: Change models without code changes

## Setup Instructions

### 1. Get OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up for an account
3. Go to [API Keys](https://openrouter.ai/keys)
4. Create a new API key
5. Copy your API key

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_MODEL=openai/gpt-4
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_NAME=Trip Planner
```

### 3. Available Models

OpenRouter supports many models. Common options:

**OpenAI Models:**
- `openai/gpt-4` - GPT-4 (default)
- `openai/gpt-4-turbo` - GPT-4 Turbo
- `openai/gpt-3.5-turbo` - GPT-3.5 Turbo (cheaper)

**Anthropic Models:**
- `anthropic/claude-3-opus`
- `anthropic/claude-3-sonnet`
- `anthropic/claude-3-haiku`

**Other Models:**
- `google/gemini-pro`
- `meta-llama/llama-2-70b-chat`
- And many more...

See [OpenRouter Models](https://openrouter.ai/models) for the full list.

### 4. Model Selection

Choose a model based on your needs:

- **Best Quality**: `openai/gpt-4` or `anthropic/claude-3-opus`
- **Balanced**: `openai/gpt-4-turbo` or `anthropic/claude-3-sonnet`
- **Cost Effective**: `openai/gpt-3.5-turbo` or `anthropic/claude-3-haiku`

Update `OPENROUTER_MODEL` in your `.env` file.

## Code Structure

### OpenRouter Client

The `src/services/openRouterClient.js` file handles all OpenRouter API calls:

```javascript
const openRouterClient = require('./openRouterClient');

// Make a chat completion request
const response = await openRouterClient.chatCompletion({
  model: 'openai/gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 1000
});

// Parse JSON response
const data = openRouterClient.parseJSONResponse(response.content);
```

### Agent Services

All agent services use the OpenRouter client:

- `src/services/agents/intentAgent.js`
- `src/services/agents/destinationAgent.js`
- `src/services/agents/itineraryAgent.js`
- `src/services/agents/budgetAgent.js`
- `src/services/agents/optimizerAgent.js`

### Orchestrator

The orchestrator (`src/services/orchestratorService.js`) coordinates all agents and uses OpenRouter for all AI calls.

## API Differences from OpenAI

OpenRouter uses a similar API to OpenAI, but with these differences:

1. **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
2. **Headers**: 
   - `Authorization: Bearer <key>`
   - `HTTP-Referer`: Your app URL (optional)
   - `X-Title`: Your app name (optional)
3. **Model Format**: Uses provider/model format (e.g., `openai/gpt-4`)

The OpenRouter client handles all these differences automatically.

## Testing

After setup, test the API:

```bash
# Start the server
npm run dev

# The server will use OpenRouter for all AI operations
# Test by making a trip planning request
```

## Troubleshooting

### Error: "OpenRouter API key not configured"

- Check that `OPENROUTER_API_KEY` is set in `.env`
- Restart the server after adding the key

### Error: "Model not found"

- Verify the model name format (e.g., `openai/gpt-4`)
- Check [OpenRouter Models](https://openrouter.ai/models) for available models

### Rate Limiting

- OpenRouter has rate limits based on your plan
- Check your usage at [OpenRouter Dashboard](https://openrouter.ai/activity)

### Cost Management

- Monitor usage at [OpenRouter Dashboard](https://openrouter.ai/activity)
- Different models have different costs
- Consider using cheaper models for development

## Migration from OpenAI

If you were using OpenAI directly:

1. Remove `OPENAI_API_KEY` from `.env` (optional, kept for backward compatibility)
2. Add `OPENROUTER_API_KEY` to `.env`
3. Set `OPENROUTER_MODEL` (defaults to `openai/gpt-4`)
4. Restart the server

The code automatically uses OpenRouter when `OPENROUTER_API_KEY` is set.

## Support

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter Discord](https://discord.gg/fVyRa7G3nY)
- [OpenRouter GitHub](https://github.com/OpenRouterTeam/openrouter-node)









