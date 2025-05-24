# AI Integration Guide

This document explains how AI is integrated into IcePhone using the Vercel AI SDK.

## Overview

We've standardized all AI model interactions using the [Vercel AI SDK](https://ai-sdk.dev/), which provides:

- **Unified API** across different AI providers (OpenAI, Anthropic, Google)
- **Easy model switching** without code changes
- **Type safety** for structured outputs
- **Streaming support** for real-time chat
- **Built-in error handling** and retries

## Setup

### 1. Environment Variables

Add these API keys to your `.env.local` file:

```bash
# Required for OpenAI models (GPT-4, GPT-3.5-turbo, etc.)
OPENAI_API_KEY=your_openai_api_key_here

# Optional - for Anthropic models (Claude)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional - for Google models (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Already configured - for embeddings
VOYAGE_API_KEY=pa-MVhBmHIEPn4JhLea0yJ8cg5Oa3vLcXvBFrzE3bcA7ft
```

### 2. Model Configuration

All AI models are configured in `src/lib/ai-config.ts`. To switch providers or models, simply uncomment the desired configuration:

```typescript
export const AI_MODELS = {
  text: {
    // Default: OpenAI GPT-4o-mini
    general: openai("gpt-4o-mini"),

    // To switch to Anthropic Claude:
    // general: anthropic("claude-3-5-sonnet-20241022"),

    // To switch to Google Gemini:
    // general: google("gemini-1.5-pro"),
  },
  // ... other categories
}
```

## Usage

### 1. Simple Text Generation

Use the helper functions for common tasks:

```typescript
import { generateAIText } from "@/lib/ai-helpers"

// Generate a response
const response = await generateAIText({
  prompt: "Explain the benefits of CRM software",
  system: "You are a helpful business consultant",
  category: "text",
  task: "general"
})
```

### 2. Structured Data Extraction

Extract structured data with type safety:

```typescript
import { generateAIObject } from "@/lib/ai-helpers"
import { z } from "zod"

const leadSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  company: z.string().optional()
})

const leadData = await generateAIObject({
  prompt: "Extract contact info from: John Smith from Acme Corp, john@acme.com",
  schema: leadSchema,
  category: "analysis",
  task: "documents"
})
// Result: { name: "John Smith", email: "john@acme.com", company: "Acme Corp" }
```

### 3. Streaming Responses

For real-time chat interfaces:

```typescript
import { streamAIText } from "@/lib/ai-helpers"

const stream = await streamAIText({
  prompt: "How can I improve my sales process?",
  category: "chat",
  task: "support"
})

// Use with React streaming components
return stream.toDataStreamResponse()
```

### 4. Convenience Functions

Pre-built functions for common IcePhone tasks:

```typescript
import {
  analyzeCallTranscript,
  generateEmailResponse,
  summarizeContent,
  extractLeadInfo
} from "@/lib/ai-helpers"

// Analyze a call
const insights = await analyzeCallTranscript(transcriptText)

// Generate email response
const emailReply = await generateEmailResponse({
  originalEmail: "...",
  context: "Customer inquiry about pricing",
  tone: "professional"
})

// Summarize content
const summary = await summarizeContent(longDocument, "brief")

// Extract lead information
const leadInfo = await extractLeadInfo(formSubmissionText)
```

## Migration from Direct API Calls

### Before (Direct OpenAI API)

```typescript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: prompt }
    ],
    max_tokens: 300,
    temperature: 0.3
  })
})

const data = await response.json()
const text = data.choices[0].message.content
```

### After (Vercel AI SDK)

```typescript
import { generateText } from "ai"
import { AI_MODELS, HYDE_SETTINGS } from "@/lib/ai-config"

const { text } = await generateText({
  model: AI_MODELS.text.general,
  system: "You are helpful",
  prompt,
  maxTokens: HYDE_SETTINGS.maxTokens,
  temperature: HYDE_SETTINGS.temperature
})
```

## Benefits

1. **Easy Provider Switching**: Change one line in config to switch from OpenAI to Claude or Gemini
2. **Consistent Interface**: Same API regardless of provider
3. **Better Error Handling**: Built-in retry logic and error messages
4. **Type Safety**: Structured outputs with Zod validation
5. **Streaming Support**: Real-time responses for chat interfaces
6. **Cost Optimization**: Easy A/B testing of different models
7. **Future Proof**: New providers can be added without code changes

## Current AI Usage in IcePhone

- **HyDE Generation**: `src/actions/knowledge-base-files.ts` - generates hypothetical answers for better document retrieval
- **Call Analysis**: Ready for implementation with `analyzeCallTranscript()`
- **Email Responses**: Ready for implementation with `generateEmailResponse()`
- **Lead Extraction**: Ready for implementation with `extractLeadInfo()`

## Best Practices

1. **Use the helpers**: Prefer `generateAIText()` over direct `generateText()` calls
2. **Configure once**: Set models in `ai-config.ts`, not in individual files
3. **Handle errors**: Always wrap AI calls in try-catch blocks
4. **Monitor costs**: Different models have different pricing
5. **Test model switches**: Validate output quality when changing providers
6. **Use appropriate models**: Fast models for simple tasks, powerful models for complex reasoning

## Troubleshooting

1. **Missing API Key**: Check console warnings on startup
2. **Rate Limits**: AI SDK handles retries automatically
3. **Model Errors**: Check if the model name is correct in the provider's documentation
4. **Type Errors**: Ensure Zod schemas match expected output structure

## Next Steps

- Add more specialized functions for IcePhone use cases
- Implement caching for repeated AI calls
- Add usage tracking and cost monitoring
- Set up A/B testing for different models
