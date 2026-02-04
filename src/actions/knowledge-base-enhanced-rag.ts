"use server"

import { db_ws as db } from "@/db"
import { knowledgeBaseDocuments, knowledgeBaseSources } from "@/db/schema"
import type { VectorQueryResult } from "@/types"
import { currentUser } from "@/lib/auth/session"
import { and, asc, desc, eq, sql } from "drizzle-orm"

// Import EmbeddingService for real Voyage API integration
import { EmbeddingService } from "../../workers/document-ingestion/src/services/EmbeddingService"

// Enhanced RAG Query System with Local Processing

interface QueryAnalysis {
	queryType:
		| "factual"
		| "analytical"
		| "contextual"
		| "procedural"
		| "multimodal"
	complexity: "simple" | "moderate" | "complex"
	keywords: string[]
	intent: "search" | "question" | "instruction" | "comparison"
	hasVisualContent: boolean
	topics: string[]
}

interface RAGContext {
	documents: VectorQueryResult[]
	totalRelevanceScore: number
	coverageScore: number
	diversityScore: number
	confidenceLevel: "high" | "medium" | "low"
}

interface EnhancedRAGResponse {
	answer: string
	confidence: number
	sources: Array<{
		id: number
		sourceId: number
		sourceName: string
		sourceType: string
		content: string
		relevanceScore: number
		citationIndex: number
	}>
	metadata: {
		queryAnalysis: QueryAnalysis
		contextCoverage: number
		responseMethod: string
		processingTime: number
	}
}

// Query Analysis and Processing
export function analyzeQuery(query: string, images?: string[]): QueryAnalysis {
	const words = query.toLowerCase().split(/\s+/)
	const questionWords = [
		"what",
		"how",
		"why",
		"when",
		"where",
		"who",
		"which"
	]
	const analyticalWords = [
		"compare",
		"analyze",
		"evaluate",
		"assess",
		"versus",
		"vs"
	]
	const instructionalWords = [
		"setup",
		"configure",
		"install",
		"create",
		"build",
		"guide"
	]

	// Determine query type
	let queryType: QueryAnalysis["queryType"] = "factual"
	if (analyticalWords.some((word) => query.toLowerCase().includes(word))) {
		queryType = "analytical"
	} else if (
		instructionalWords.some((word) => query.toLowerCase().includes(word))
	) {
		queryType = "procedural"
	} else if (query.length > 50 || words.length > 10) {
		queryType = "contextual"
	}

	// Determine complexity
	const complexity: QueryAnalysis["complexity"] =
		words.length > 15 || query.includes(" and ")
			? "complex"
			: words.length > 8
				? "moderate"
				: "simple"

	// Extract keywords (remove stop words)
	const stopWords = new Set([
		"the",
		"a",
		"an",
		"and",
		"or",
		"but",
		"in",
		"on",
		"at",
		"to",
		"for",
		"of",
		"with",
		"by",
		"is",
		"are",
		"was",
		"were",
		"be",
		"been",
		"have",
		"has",
		"had",
		"do",
		"does",
		"did",
		"will",
		"would",
		"could",
		"should",
		"may",
		"might",
		"can",
		"about",
		"into",
		"through",
		"during",
		"before",
		"after",
		"above",
		"below",
		"up",
		"down",
		"out",
		"off",
		"over",
		"under",
		"again",
		"further",
		"then",
		"once"
	])

	const keywords = words
		.filter((word) => word.length > 2 && !stopWords.has(word))
		.filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates

	// Determine intent
	const intent: QueryAnalysis["intent"] = questionWords.some((word) =>
		query.toLowerCase().includes(word)
	)
		? "question"
		: instructionalWords.some((word) => query.toLowerCase().includes(word))
			? "instruction"
			: analyticalWords.some((word) => query.toLowerCase().includes(word))
				? "comparison"
				: "search"

	// Extract topics (simplified topic detection)
	const topics = extractTopics(query, keywords)

	return {
		queryType,
		complexity,
		keywords,
		intent,
		hasVisualContent: Boolean(images && images.length > 0),
		topics
	}
}

function extractTopics(query: string, keywords: string[]): string[] {
	// Simple topic extraction based on domain knowledge
	const topicKeywords = {
		"voice-agents": [
			"voice",
			"agent",
			"call",
			"phone",
			"speaking",
			"conversation"
		],
		crm: [
			"crm",
			"salesforce",
			"hubspot",
			"pipedrive",
			"integration",
			"lead"
		],
		pricing: [
			"cost",
			"price",
			"pricing",
			"plan",
			"subscription",
			"billing"
		],
		setup: ["setup", "configure", "install", "create", "deploy"],
		troubleshooting: [
			"issue",
			"problem",
			"error",
			"fix",
			"troubleshoot",
			"debug"
		],
		features: ["feature", "capability", "function", "option", "setting"]
	}

	const topics: string[] = []
	const queryLower = query.toLowerCase()

	for (const [topic, relatedWords] of Object.entries(topicKeywords)) {
		if (relatedWords.some((word) => queryLower.includes(word))) {
			topics.push(topic)
		}
	}

	return topics.length > 0 ? topics : ["general"]
}

// Enhanced Vector Search with Hybrid Retrieval
export async function performEnhancedVectorSearch(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		hybridWeight?: number
	} = {}
): Promise<{ success: boolean; data?: VectorQueryResult[]; error?: string }> {
	const {
		limit = 10,
		threshold = 0.3,
		sourceId,
		hybridWeight = 0.7
	} = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Use real Voyage API for embeddings
		const queryEmbedding = await generateRealQueryEmbedding(query)

		// Perform vector similarity search
		let vectorQuery = sql`
			SELECT
				kd.id,
				kd.source_id,
				kd.content_chunk,
				kd.metadata,
				ks.name as source_name,
				ks.type as source_type,
				(1 - (kd.text_embedding <=> ${sql.raw(`'[${queryEmbedding.join(",")}]'::vector`)})) as similarity
			FROM knowledge_base_documents kd
			JOIN knowledge_base_sources ks ON kd.source_id = ks.id
			WHERE kd.user_id = ${user.id}
			AND (1 - (kd.text_embedding <=> ${sql.raw(`'[${queryEmbedding.join(",")}]'::vector`)})) >= ${threshold}
		`

		if (sourceId) {
			vectorQuery = sql`${vectorQuery} AND kd.source_id = ${sourceId}`
		}

		vectorQuery = sql`${vectorQuery} ORDER BY similarity DESC LIMIT ${Math.floor(limit * hybridWeight)}`

		const vectorResults = await db.execute(vectorQuery)

		// Perform keyword search for remaining slots
		const remainingLimit = limit - vectorResults.rows.length
		let keywordResults: VectorQueryResult[] = []

		if (remainingLimit > 0) {
			const keywords = query.toLowerCase().split(/\s+/)
			const keywordPattern = keywords.map((k) => `%${k}%`).join(" ")

			let keywordQuery = sql`
				SELECT
					kd.id,
					kd.source_id,
					kd.content_chunk,
					kd.metadata,
					ks.name as source_name,
					ks.type as source_type,
					0.5 as similarity
				FROM knowledge_base_documents kd
				JOIN knowledge_base_sources ks ON kd.source_id = ks.id
				WHERE kd.user_id = ${user.id}
				AND (
					kd.content_chunk ILIKE ${`%${query}%`}
					OR ks.name ILIKE ${`%${query}%`}
				)
			`

			if (sourceId) {
				keywordQuery = sql`${keywordQuery} AND kd.source_id = ${sourceId}`
			}

			// Exclude documents already found in vector search
			if (vectorResults.rows.length > 0) {
				const existingIds = vectorResults.rows
					.map((r) => r.id)
					.join(",")
				keywordQuery = sql`${keywordQuery} AND kd.id NOT IN (${sql.raw(existingIds)})`
			}

			keywordQuery = sql`${keywordQuery} ORDER BY LENGTH(kd.content_chunk) ASC LIMIT ${remainingLimit}`

			const keywordResultsRaw = await db.execute(keywordQuery)
			keywordResults = keywordResultsRaw.rows as VectorQueryResult[]
		}

		// Combine and enhance results
		const allResults = [
			...vectorResults.rows,
			...keywordResults
		] as VectorQueryResult[]

		return {
			success: true,
			data: allResults
		}
	} catch (error) {
		console.error("Enhanced vector search failed:", error)
		return { success: false, error: "Failed to perform enhanced search" }
	}
}

// Real Voyage API embedding generation
async function generateRealQueryEmbedding(query: string): Promise<number[]> {
	try {
		// Get Voyage API key from environment variables
		const voyageApiKey = process.env.VOYAGE_API_KEY

		if (!voyageApiKey) {
			console.warn(
				"VOYAGE_API_KEY not found, falling back to mock embedding"
			)
			return generateMockQueryEmbedding(query)
		}

		// Initialize EmbeddingService with real API key
		const embeddingService = new EmbeddingService(voyageApiKey)

		// Generate real embedding using Voyage API
		const embedding = await embeddingService.generateQueryEmbedding(
			query,
			"voyage-3"
		)

		return embedding
	} catch (error) {
		console.error(
			"Failed to generate real embedding, falling back to mock:",
			error
		)
		return generateMockQueryEmbedding(query)
	}
}

// Fallback mock embedding generation for development/error cases
async function generateMockQueryEmbedding(query: string): Promise<number[]> {
	// Generate a consistent pseudo-random embedding based on query content
	// This is for testing purposes only
	const hash = simpleHash(query)
	const embedding: number[] = []

	for (let i = 0; i < 1024; i++) {
		const value = Math.sin(hash + i) * 10000
		embedding.push((value - Math.floor(value)) * 2 - 1) // Normalize to [-1, 1]
	}

	return embedding
}

function simpleHash(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	return Math.abs(hash)
}

// Context Ranking and Reranking
export function rankAndRerankeResults(
	results: VectorQueryResult[],
	query: string,
	queryAnalysis: QueryAnalysis
): VectorQueryResult[] {
	// Implement local reranking based on multiple factors
	return results
		.map((result) => {
			let rerankScore = result.similarity || 0

			// Boost based on keyword matches
			const contentLower = String(
				result.contentChunk || result.content_chunk || ""
			).toLowerCase()
			const keywordMatches = queryAnalysis.keywords.filter((keyword) =>
				contentLower.includes(keyword.toLowerCase())
			).length

			rerankScore +=
				(keywordMatches / queryAnalysis.keywords.length) * 0.3

			// Boost based on document length (prefer more substantial content)
			const contentLength = String(
				result.contentChunk || result.content_chunk || ""
			).length
			if (contentLength > 500) rerankScore += 0.1
			if (contentLength > 1000) rerankScore += 0.1

			// Boost based on source type relevance
			const sourceType = String(result.source_type || "")
			if (
				queryAnalysis.queryType === "procedural" &&
				sourceType.includes("guide")
			) {
				rerankScore += 0.2
			}

			return {
				...result,
				similarity: Math.min(rerankScore, 1.0), // Cap at 1.0
				reranked: true
			}
		})
		.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
}

// Local Response Generation (without external APIs)
export function generateLocalRAGResponse(
	query: string,
	context: RAGContext,
	queryAnalysis: QueryAnalysis
): string {
	// Generate a structured response based on the context
	const relevantDocs = context.documents.slice(0, 5) // Use top 5 documents

	if (relevantDocs.length === 0) {
		return "I don't have enough information in the knowledge base to answer this question. Please try a different query or add more relevant documents."
	}

	// Create response based on query type
	let response = ""

	switch (queryAnalysis.queryType) {
		case "factual":
			response = generateFactualResponse(query, relevantDocs)
			break
		case "procedural":
			response = generateProceduralResponse(query, relevantDocs)
			break
		case "analytical":
			response = generateAnalyticalResponse(query, relevantDocs)
			break
		case "contextual":
			response = generateContextualResponse(query, relevantDocs)
			break
		default:
			response = generateGeneralResponse(query, relevantDocs)
	}

	// Add source citations
	response += "\n\nSources:\n"
	relevantDocs.forEach((doc, index) => {
		response += `[${index + 1}] ${doc.source_name} (${doc.source_type})\n`
	})

	return response
}

function generateFactualResponse(
	query: string,
	docs: VectorQueryResult[]
): string {
	// Extract the most relevant facts from the documents
	const facts = docs.flatMap((doc) =>
		extractKeyFacts(String(doc.content_chunk || ""))
	)

	if (facts.length === 0) {
		return "Based on the available information, I found relevant content but couldn't extract specific facts."
	}

	return `Based on the knowledge base:\n\n${facts
		.slice(0, 3)
		.map((fact) => `• ${fact}`)
		.join("\n")}`
}

function generateProceduralResponse(
	query: string,
	docs: VectorQueryResult[]
): string {
	// Look for step-by-step instructions
	const steps = docs.flatMap((doc) =>
		extractSteps(String(doc.content_chunk || ""))
	)

	if (steps.length === 0) {
		return "I found relevant information but couldn't identify specific procedural steps. Please review the source documents for detailed instructions."
	}

	return `Here's how to proceed:\n\n${steps
		.slice(0, 8)
		.map((step, index) => `${index + 1}. ${step}`)
		.join("\n")}`
}

function generateAnalyticalResponse(
	query: string,
	docs: VectorQueryResult[]
): string {
	// Provide a comparison or analysis
	const keyPoints = docs.flatMap((doc) =>
		extractKeyPoints(String(doc.content_chunk || ""))
	)

	return `Analysis based on the knowledge base:\n\n${keyPoints
		.slice(0, 5)
		.map((point) => `• ${point}`)
		.join("\n")}`
}

function generateContextualResponse(
	query: string,
	docs: VectorQueryResult[]
): string {
	// Provide comprehensive context
	const contexts = docs
		.slice(0, 3)
		.map((doc) => doc.content_chunk || "")
		.join("\n\n")

	return `Based on the available information:\n\n${contexts}`
}

function generateGeneralResponse(
	query: string,
	docs: VectorQueryResult[]
): string {
	// General response fallback
	const content = docs
		.slice(0, 2)
		.map((doc) => doc.content_chunk || "")
		.join("\n\n")

	return `Here's what I found in the knowledge base:\n\n${content}`
}

// Helper functions for content extraction
function extractKeyFacts(text: string): string[] {
	// Simple fact extraction - look for sentences with definitive statements
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10)
	return sentences
		.filter((sentence) => {
			const lower = sentence.toLowerCase()
			return (
				lower.includes("is") ||
				lower.includes("are") ||
				lower.includes("offers") ||
				lower.includes("provides")
			)
		})
		.map((s) => s.trim())
		.slice(0, 3)
}

function extractSteps(text: string): string[] {
	// Look for numbered steps or bullet points
	const stepPatterns = [
		/\d+\)\s*([^.!?]+)/g,
		/\d+\.\s*([^.!?]+)/g,
		/Step \d+:?\s*([^.!?]+)/gi,
		/First[,:]?\s*([^.!?]+)/gi,
		/Next[,:]?\s*([^.!?]+)/gi,
		/Then[,:]?\s*([^.!?]+)/gi,
		/Finally[,:]?\s*([^.!?]+)/gi
	]

	const steps: string[] = []

	for (const pattern of stepPatterns) {
		let match: RegExpExecArray | null
		while (true) {
			match = pattern.exec(text)
			if (match === null) break
			steps.push(match[1].trim())
		}
	}

	return steps.slice(0, 6) // Limit to 6 steps
}

function extractKeyPoints(text: string): string[] {
	// Extract key points for analytical responses
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 15)
	return sentences
		.filter((sentence) => {
			const lower = sentence.toLowerCase()
			return (
				lower.includes("include") ||
				lower.includes("feature") ||
				lower.includes("support") ||
				lower.includes("allow")
			)
		})
		.map((s) => s.trim())
		.slice(0, 4)
}

// Main Enhanced RAG Function
export async function performEnhancedRAGQuery(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		includeMetadata?: boolean
	} = {}
): Promise<{ success: boolean; data?: EnhancedRAGResponse; error?: string }> {
	const startTime = Date.now()
	const {
		limit = 5,
		threshold = 0.3,
		sourceId,
		includeMetadata = true
	} = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Step 1: Analyze the query
		const queryAnalysis = analyzeQuery(query)

		// Step 2: Perform enhanced vector search
		const searchResult = await performEnhancedVectorSearch(query, {
			limit: limit * 2, // Get more candidates for reranking
			threshold,
			sourceId
		})

		if (!searchResult.success || !searchResult.data) {
			return {
				success: false,
				error: searchResult.error || "Search failed"
			}
		}

		// Step 3: Rank and rerank results
		const rankedResults = rankAndRerankeResults(
			searchResult.data,
			query,
			queryAnalysis
		)
		const finalResults = rankedResults.slice(0, limit)

		// Step 4: Create context
		const context: RAGContext = {
			documents: finalResults,
			totalRelevanceScore: finalResults.reduce(
				(sum, doc) => sum + (doc.similarity || 0),
				0
			),
			coverageScore: Math.min(finalResults.length / limit, 1.0),
			diversityScore: calculateDiversityScore(finalResults),
			confidenceLevel: determineConfidenceLevel(
				finalResults,
				queryAnalysis
			)
		}

		// Step 5: Generate response
		const answer = generateLocalRAGResponse(query, context, queryAnalysis)

		// Step 6: Format response
		const response: EnhancedRAGResponse = {
			answer,
			confidence: context.totalRelevanceScore / finalResults.length,
			sources: finalResults.map((doc, index) => ({
				id: doc.id,
				sourceId: Number(doc.source_id || doc.sourceId || 0),
				sourceName: String(doc.source_name || "Unknown"),
				sourceType: String(doc.source_type || "unknown"),
				content: `${String(doc.content_chunk || "").substring(0, 200)}...`,
				relevanceScore: doc.similarity || 0,
				citationIndex: index + 1
			})),
			metadata: includeMetadata
				? {
						queryAnalysis,
						contextCoverage: context.coverageScore,
						responseMethod: "local-processing",
						processingTime: Date.now() - startTime
					}
				: ({} as EnhancedRAGResponse["metadata"])
		}

		return { success: true, data: response }
	} catch (error) {
		console.error("Enhanced RAG query failed:", error)
		return { success: false, error: "Failed to process enhanced RAG query" }
	}
}

function calculateDiversityScore(results: VectorQueryResult[]): number {
	// Calculate diversity based on different sources
	const uniqueSources = new Set(results.map((r) => r.source_id || r.sourceId))
	return uniqueSources.size / Math.max(results.length, 1)
}

function determineConfidenceLevel(
	results: VectorQueryResult[],
	queryAnalysis: QueryAnalysis
): "high" | "medium" | "low" {
	const avgSimilarity =
		results.reduce((sum, r) => sum + (r.similarity || 0), 0) /
		results.length
	const hasMultipleSources =
		new Set(results.map((r) => r.source_id || r.sourceId)).size > 1

	if (avgSimilarity > 0.7 && hasMultipleSources) return "high"
	if (avgSimilarity > 0.5 || hasMultipleSources) return "medium"
	return "low"
}
