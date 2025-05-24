import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"

// AI Model Configuration
// Change these to switch providers/models across your entire application

export const AI_MODELS = {
	// Text generation models
	text: {
		// For HyDE generation and general text processing
		general: openai("gpt-4o-mini"),
		// For more complex reasoning tasks
		reasoning: openai("gpt-4o"),
		// For fast, simple tasks
		fast: openai("gpt-3.5-turbo")
		// Alternative providers (uncomment to switch)
		// general: anthropic("claude-3-5-sonnet-20241022"),
		// reasoning: anthropic("claude-3-5-sonnet-20241022"),
		// fast: google("gemini-1.5-flash"),
	},

	// Chat/conversation models
	chat: {
		// For customer support and general chat
		support: openai("gpt-4o-mini"),
		// For complex customer queries requiring reasoning
		complex: openai("gpt-4o")
		// Alternative providers
		// support: anthropic("claude-3-5-haiku-20241022"),
		// complex: anthropic("claude-3-5-sonnet-20241022"),
	},

	// Analysis models
	analysis: {
		// For call transcription analysis
		calls: openai("gpt-4o-mini"),
		// For document analysis
		documents: openai("gpt-4o-mini"),
		// For sentiment analysis
		sentiment: openai("gpt-3.5-turbo")
		// Alternative providers
		// calls: anthropic("claude-3-5-sonnet-20241022"),
		// documents: google("gemini-1.5-pro"),
	}
} as const

// Default model settings
export const DEFAULT_AI_SETTINGS = {
	maxTokens: 1000,
	temperature: 0.7
} as const

// HyDE specific settings
export const HYDE_SETTINGS = {
	maxTokens: 300,
	temperature: 0.3
} as const

// Function to get the current model for a specific task
export function getAIModel(category: keyof typeof AI_MODELS, task: string) {
	const categoryModels = AI_MODELS[category] as Record<string, unknown>
	const models = categoryModels as Record<string, ReturnType<typeof openai>>
	return models[task] || models.general || AI_MODELS.text.general
}

// Environment variable validation
export function validateAIEnvironment() {
	const warnings: string[] = []

	if (!process.env.OPENAI_API_KEY) {
		warnings.push("OPENAI_API_KEY not found")
	}

	if (!process.env.ANTHROPIC_API_KEY) {
		warnings.push(
			"ANTHROPIC_API_KEY not found - Anthropic models will not work"
		)
	}

	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		warnings.push(
			"GOOGLE_GENERATIVE_AI_API_KEY not found - Google models will not work"
		)
	}

	return warnings
}
