import {
	SearchKnowledgeBaseSchema,
	AnalyzeConversationSchema
} from "../schemas"
import { logLeadInteraction } from "../utils"
import { db_ws } from "@/db"
import { leads } from "@/db/schema"
import { eq, and } from "drizzle-orm"

// Search Knowledge Base Tool - allows voice agents to search the knowledge base for relevant information
export async function searchKnowledgeBase(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const validated = SearchKnowledgeBaseSchema.parse(parameters)
		const { query, limit, threshold, sourceId, includeMetadata } = validated

		// Import the knowledge base search function
		const { performRAGQuery } = await import("@/actions/knowledge-base")

		// Perform the knowledge base search
		const searchResult = await performRAGQuery(query, {
			limit,
			threshold,
			sourceId
		})

		if (!searchResult.success) {
			await logLeadInteraction(
				0, // No specific lead for knowledge base searches
				"knowledge_base_search",
				"vapi_tool",
				toolCallId,
				null,
				{ query, error: searchResult.error },
				{
					toolCallId,
					searchQuery: query,
					success: false,
					error: searchResult.error
				},
				userId
			)

			return {
				toolCallId,
				result: `Knowledge base search failed: ${searchResult.error || "Unknown error"}`
			}
		}

		const documents = searchResult.data as Array<{
			id: number
			source_id: number
			content_chunk: string
			metadata: Record<string, unknown>
			source_name: string
			source_type: string
			similarity?: number
		}>

		if (!documents || documents.length === 0) {
			await logLeadInteraction(
				0,
				"knowledge_base_search",
				"vapi_tool",
				toolCallId,
				null,
				{ query, results: 0 },
				{
					toolCallId,
					searchQuery: query,
					success: true,
					resultsFound: 0
				},
				userId
			)

			return {
				toolCallId,
				result: `No relevant information found in the knowledge base for "${query}". You may want to suggest the caller contact support for more specific assistance.`
			}
		}

		// Format results for voice agent consumption
		let formattedResult = `Found ${documents.length} relevant result${documents.length > 1 ? "s" : ""} in the knowledge base for "${query}":\n\n`

		documents.forEach((doc, index) => {
			const content = String(doc.content_chunk || "").trim()
			// Truncate content for voice response (keep it concise)
			const truncatedContent =
				content.length > 300
					? `${content.substring(0, 300)}...`
					: content

			formattedResult += `${index + 1}. From ${doc.source_name} (${doc.source_type}):\n`
			formattedResult += `${truncatedContent}\n`

			if (includeMetadata && doc.similarity) {
				formattedResult += `   (Relevance: ${Math.round(doc.similarity * 100)}%)\n`
			}
			formattedResult += "\n"
		})

		// Add guidance for voice agent
		formattedResult +=
			"You can use this information to answer the caller's question. If you need more specific details, you can search again with a more targeted query."

		// Log the successful search
		await logLeadInteraction(
			0,
			"knowledge_base_search",
			"vapi_tool",
			toolCallId,
			null,
			{ query, results: documents.length },
			{
				toolCallId,
				searchQuery: query,
				success: true,
				resultsFound: documents.length,
				sources: documents.map((doc) => ({
					id: doc.id,
					source_name: doc.source_name,
					source_type: doc.source_type,
					similarity: doc.similarity
				}))
			},
			userId
		)

		return { toolCallId, result: formattedResult }
	} catch (error) {
		console.error("Error searching knowledge base:", error)

		// Log the error
		await logLeadInteraction(
			0,
			"knowledge_base_search",
			"vapi_tool",
			toolCallId,
			null,
			{
				query: parameters.query,
				error: error instanceof Error ? error.message : "Unknown error"
			},
			{
				toolCallId,
				searchQuery: parameters.query,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error"
			},
			userId
		)

		return {
			toolCallId,
			result: `Failed to search knowledge base: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}

// Conversation Analysis Tool - analyzes call transcripts for insights and recommendations
export async function analyzeConversation(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const validated = AnalyzeConversationSchema.parse(parameters)
		const {
			callId,
			transcript,
			analysisType,
			includeActionRecommendations,
			leadId
		} = validated

		// Validate user context - if leadId provided, ensure user access
		if (leadId) {
			const lead = await db_ws.query.leads.findFirst({
				where: and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, userId)
				)
			})

			if (!lead) {
				return {
					toolCallId,
					result: "Lead not found or access denied"
				}
			}
		}

		// Import AI analysis function
		const { analyzeCallTranscript } = await import("@/lib/ai-analysis")

		// Perform conversation analysis
		const analysisResult = await analyzeCallTranscript(transcript, {
			analysisType,
			includeActionRecommendations,
			leadContext: leadId
				? { leadId: Number.parseInt(leadId) }
				: undefined
		})

		if (!analysisResult.success) {
			await logLeadInteraction(
				leadId ? Number.parseInt(leadId) : 0,
				"conversation_analysis",
				"vapi_tool",
				toolCallId,
				null,
				{ error: analysisResult.error },
				{
					toolCallId,
					analysisType,
					success: false,
					error: analysisResult.error
				},
				userId
			)

			return {
				toolCallId,
				result: `Conversation analysis failed: ${analysisResult.error || "Unknown error"}`
			}
		}

		const analysis = analysisResult.data as {
			intent?: string
			sentiment?: {
				overall: string
				confidence: number
				emotions: string[]
			}
			quality?: {
				score: number
				clarity: number
				engagement: number
				professionalism: number
			}
			objections?: Array<{
				type: string
				content: string
				resolved: boolean
			}>
			actionRecommendations?: Array<{
				action: string
				priority: string
				reasoning: string
			}>
			summary: string
		}

		// Format results for voice agent consumption
		let formattedResult = `Conversation Analysis Results:\n\n`

		// Add summary first
		formattedResult += `Summary: ${analysis.summary}\n\n`

		// Add specific analysis based on type requested
		if (analysisType === "full" || analysisType === "intent") {
			if (analysis.intent) {
				formattedResult += `Customer Intent: ${analysis.intent}\n\n`
			}
		}

		if (analysisType === "full" || analysisType === "sentiment") {
			if (analysis.sentiment) {
				formattedResult += `Sentiment Analysis:\n`
				formattedResult += `- Overall Sentiment: ${analysis.sentiment.overall} (${Math.round(analysis.sentiment.confidence * 100)}% confidence)\n`
				if (analysis.sentiment.emotions?.length > 0) {
					formattedResult += `- Key Emotions: ${analysis.sentiment.emotions.join(", ")}\n\n`
				}
			}
		}

		if (analysisType === "full" || analysisType === "quality") {
			if (analysis.quality) {
				formattedResult += `Call Quality Assessment:\n`
				formattedResult += `- Overall Quality Score: ${analysis.quality.score}/10\n`
				formattedResult += `- Clarity: ${analysis.quality.clarity}/10\n`
				formattedResult += `- Customer Engagement: ${analysis.quality.engagement}/10\n`
				formattedResult += `- Professionalism: ${analysis.quality.professionalism}/10\n\n`
			}
		}

		if (analysisType === "full" || analysisType === "objections") {
			if (analysis.objections && analysis.objections.length > 0) {
				formattedResult += `Customer Objections Detected:\n`
				analysis.objections.forEach((objection, index) => {
					formattedResult += `${index + 1}. ${objection.type}: "${objection.content}" ${objection.resolved ? "(Resolved)" : "(Unresolved)"}\n`
				})
				formattedResult += "\n"
			}
		}

		if (includeActionRecommendations && analysis.actionRecommendations) {
			formattedResult += `Recommended Next Actions:\n`
			analysis.actionRecommendations.forEach((rec, index) => {
				formattedResult += `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}\n`
				formattedResult += `   Reason: ${rec.reasoning}\n`
			})
		}

		// Log the successful analysis
		await logLeadInteraction(
			leadId ? Number.parseInt(leadId) : 0,
			"conversation_analysis",
			"vapi_tool",
			toolCallId,
			null,
			{
				analysisType,
				analysisResult: analysis,
				callId
			},
			{
				toolCallId,
				analysisType,
				success: true,
				transcriptLength: transcript.length,
				includeActionRecommendations
			},
			userId
		)

		return { toolCallId, result: formattedResult }
	} catch (error) {
		console.error("Error analyzing conversation:", error)

		// Log the error
		await logLeadInteraction(
			parameters.leadId ? Number.parseInt(String(parameters.leadId)) : 0,
			"conversation_analysis",
			"vapi_tool",
			toolCallId,
			null,
			{
				error: error instanceof Error ? error.message : "Unknown error"
			},
			{
				toolCallId,
				analysisType: parameters.analysisType,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				parameters
			},
			userId
		)

		return {
			toolCallId,
			result: `Failed to analyze conversation: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}
