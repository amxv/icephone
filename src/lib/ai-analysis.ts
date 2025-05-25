import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

// Analysis result schema
const ConversationAnalysisSchema = z.object({
	intent: z.string().optional(),
	sentiment: z
		.object({
			overall: z.enum(["positive", "negative", "neutral", "mixed"]),
			confidence: z.number().min(0).max(1),
			emotions: z.array(z.string())
		})
		.optional(),
	quality: z
		.object({
			score: z.number().min(0).max(10),
			clarity: z.number().min(0).max(10),
			engagement: z.number().min(0).max(10),
			professionalism: z.number().min(0).max(10)
		})
		.optional(),
	objections: z
		.array(
			z.object({
				type: z.string(),
				content: z.string(),
				resolved: z.boolean()
			})
		)
		.optional(),
	actionRecommendations: z
		.array(
			z.object({
				action: z.string(),
				priority: z.enum(["low", "medium", "high", "urgent"]),
				reasoning: z.string()
			})
		)
		.optional(),
	summary: z.string()
})

type AnalysisOptions = {
	analysisType: "intent" | "sentiment" | "quality" | "objections" | "full"
	includeActionRecommendations: boolean
	leadContext?: {
		leadId: number
	}
}

export async function analyzeCallTranscript(
	transcript: string,
	options: AnalysisOptions
): Promise<{
	success: boolean
	data?: z.infer<typeof ConversationAnalysisSchema>
	error?: string
}> {
	try {
		const { analysisType, includeActionRecommendations } = options

		// Create the system prompt based on analysis type
		const systemPrompt = `You are an expert conversation analyst for a CRM and voice agent platform. Analyze the following call transcript and provide insights.`

		let analysisInstructions = ""

		if (analysisType === "full" || analysisType === "intent") {
			analysisInstructions += `
- Determine the customer's primary intent (e.g., "seeking product information", "has technical issue", "wants to schedule meeting", "price negotiation", "complaint", etc.)`
		}

		if (analysisType === "full" || analysisType === "sentiment") {
			analysisInstructions += `
- Analyze the overall sentiment and emotional tone
- Identify key emotions expressed by the customer
- Rate confidence level of sentiment analysis (0-1)`
		}

		if (analysisType === "full" || analysisType === "quality") {
			analysisInstructions += `
- Evaluate call quality on multiple dimensions (0-10 scale):
  * Clarity: How clear was the communication?
  * Engagement: How engaged was the customer?
  * Professionalism: How professional was the interaction?
  * Overall quality score`
		}

		if (analysisType === "full" || analysisType === "objections") {
			analysisInstructions += `
- Identify any customer objections or concerns raised
- Categorize objection types (price, timing, trust, need, etc.)
- Determine if objections were adequately addressed`
		}

		if (includeActionRecommendations) {
			analysisInstructions += `
- Provide specific action recommendations for follow-up
- Prioritize actions (low, medium, high, urgent)
- Include reasoning for each recommendation`
		}

		const userPrompt = `
${systemPrompt}

Analysis Instructions:
${analysisInstructions}

Please provide a comprehensive summary and analysis. Focus on actionable insights that can help improve customer relationships and sales outcomes.

Call Transcript:
${transcript}
		`

		// Generate structured analysis using AI
		const { object: analysis } = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: ConversationAnalysisSchema,
			prompt: userPrompt,
			temperature: 0.3 // Lower temperature for more consistent analysis
		})

		return {
			success: true,
			data: analysis
		}
	} catch (error) {
		console.error("Error in AI transcript analysis:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		}
	}
}

// Additional utility function for batch analysis
export async function analyzeBatchTranscripts(
	transcripts: Array<{ id: string; transcript: string }>,
	options: AnalysisOptions
): Promise<
	Array<{
		id: string
		success: boolean
		data?: z.infer<typeof ConversationAnalysisSchema>
		error?: string
	}>
> {
	const results = []

	for (const { id, transcript } of transcripts) {
		const result = await analyzeCallTranscript(transcript, options)
		results.push({
			id,
			...result
		})
	}

	return results
}
