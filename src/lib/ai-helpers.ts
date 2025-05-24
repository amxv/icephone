import { generateObject, generateText, streamText } from "ai"
import { z } from "zod"
import {
	AI_MODELS,
	DEFAULT_AI_SETTINGS,
	validateAIEnvironment
} from "./ai-config"

// Initialize AI environment validation (runs once on import)
const envWarnings = validateAIEnvironment()
if (envWarnings.length > 0) {
	console.warn("AI Environment warnings:", envWarnings.join(", "))
}

/**
 * Generate text using the configured AI model for a specific task
 */
export async function generateAIText({
	prompt,
	system,
	category = "text",
	task = "general",
	maxTokens = DEFAULT_AI_SETTINGS.maxTokens,
	temperature = DEFAULT_AI_SETTINGS.temperature
}: {
	prompt: string
	system?: string
	category?: keyof typeof AI_MODELS
	task?: string
	maxTokens?: number
	temperature?: number
}) {
	try {
		// Get the appropriate model for the task
		const categoryModels = AI_MODELS[category] as Record<string, unknown>
		const models = categoryModels as Record<
			string,
			ReturnType<typeof import("@ai-sdk/openai").openai>
		>
		const model = models[task] || models.general || AI_MODELS.text.general

		const { text } = await generateText({
			model,
			system,
			prompt,
			maxTokens,
			temperature
		})

		return text
	} catch (error) {
		console.error(
			`Error generating AI text for ${category}/${task}:`,
			error
		)
		throw new Error(
			`Failed to generate text: ${error instanceof Error ? error.message : "Unknown error"}`
		)
	}
}

/**
 * Generate structured data using AI with type safety
 */
export async function generateAIObject<T>({
	prompt,
	system,
	schema,
	category = "text",
	task = "general",
	maxTokens = DEFAULT_AI_SETTINGS.maxTokens,
	temperature = DEFAULT_AI_SETTINGS.temperature
}: {
	prompt: string
	system?: string
	schema: z.ZodSchema<T>
	category?: keyof typeof AI_MODELS
	task?: string
	maxTokens?: number
	temperature?: number
}) {
	try {
		// Get the appropriate model for the task
		const categoryModels = AI_MODELS[category] as Record<string, unknown>
		const models = categoryModels as Record<
			string,
			ReturnType<typeof import("@ai-sdk/openai").openai>
		>
		const model = models[task] || models.general || AI_MODELS.text.general

		const { object } = await generateObject({
			model,
			system,
			prompt,
			schema,
			maxTokens,
			temperature
		})

		return object
	} catch (error) {
		console.error(
			`Error generating AI object for ${category}/${task}:`,
			error
		)
		throw new Error(
			`Failed to generate object: ${error instanceof Error ? error.message : "Unknown error"}`
		)
	}
}

/**
 * Stream text responses for real-time chat/conversation
 */
export async function streamAIText({
	prompt,
	system,
	category = "chat",
	task = "support",
	maxTokens = DEFAULT_AI_SETTINGS.maxTokens,
	temperature = DEFAULT_AI_SETTINGS.temperature
}: {
	prompt: string
	system?: string
	category?: keyof typeof AI_MODELS
	task?: string
	maxTokens?: number
	temperature?: number
}) {
	try {
		// Get the appropriate model for the task
		const categoryModels = AI_MODELS[category] as Record<string, unknown>
		const models = categoryModels as Record<
			string,
			ReturnType<typeof import("@ai-sdk/openai").openai>
		>
		const model = models[task] || models.general || AI_MODELS.text.general

		const result = await streamText({
			model,
			system,
			prompt,
			maxTokens,
			temperature
		})

		return result
	} catch (error) {
		console.error(`Error streaming AI text for ${category}/${task}:`, error)
		throw new Error(
			`Failed to stream text: ${error instanceof Error ? error.message : "Unknown error"}`
		)
	}
}

// Convenience functions for common tasks

/**
 * Analyze call transcripts for insights
 */
export async function analyzeCallTranscript(transcript: string) {
	return generateAIText({
		prompt: `Analyze this call transcript and provide insights about the conversation, including key topics discussed, sentiment, and potential action items:\n\n${transcript}`,
		system: "You are an expert call analyst. Provide concise, actionable insights about call transcripts.",
		category: "analysis",
		task: "calls",
		temperature: 0.3
	})
}

/**
 * Generate email responses based on context
 */
export async function generateEmailResponse({
	originalEmail,
	context,
	tone = "professional"
}: {
	originalEmail: string
	context: string
	tone?: "professional" | "friendly" | "urgent"
}) {
	return generateAIText({
		prompt: `Generate a ${tone} email response to the following email, considering this context: ${context}\n\nOriginal email:\n${originalEmail}`,
		system: `You are a helpful email assistant. Generate appropriate ${tone} email responses that are clear, concise, and actionable.`,
		category: "text",
		task: "general",
		temperature: 0.7
	})
}

/**
 * Summarize documents or content
 */
export async function summarizeContent(content: string, maxLength = "brief") {
	const lengthInstructions = {
		brief: "in 2-3 sentences",
		medium: "in 1-2 paragraphs",
		detailed: "with comprehensive detail including key points and takeaways"
	}

	return generateAIText({
		prompt: `Summarize the following content ${lengthInstructions[maxLength as keyof typeof lengthInstructions] || lengthInstructions.brief}:\n\n${content}`,
		system: "You are an expert at creating clear, accurate summaries that capture the essential information.",
		category: "analysis",
		task: "documents",
		temperature: 0.3
	})
}

/**
 * Extract structured data from unstructured text
 */
export async function extractLeadInfo(text: string) {
	const leadSchema = z.object({
		name: z.string().optional(),
		email: z.string().email().optional(),
		phone: z.string().optional(),
		company: z.string().optional(),
		position: z.string().optional(),
		notes: z.string().optional(),
		urgency: z.enum(["low", "medium", "high"]).optional()
	})

	return generateAIObject({
		prompt: `Extract lead information from the following text. If certain fields cannot be determined, leave them as null:\n\n${text}`,
		system: "You are an expert at extracting lead information from various text sources like emails, call transcripts, and forms.",
		schema: leadSchema,
		category: "analysis",
		task: "documents",
		temperature: 0.1
	})
}
