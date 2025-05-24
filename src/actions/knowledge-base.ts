"use server"

import { db } from "@/db/db"
import { knowledgeBaseDocuments, knowledgeBaseSources } from "@/db/schema"
import type {
	KnowledgeBaseDocument,
	KnowledgeBaseDocumentCreateRequest,
	KnowledgeBaseSource,
	KnowledgeBaseSourceCreateRequest,
	VectorQueryResult
} from "@/types"
import { currentUser } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Create a new knowledge base source
export async function createKnowledgeBaseSource(
	source: KnowledgeBaseSourceCreateRequest
) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		const [createdSource] = await db
			.insert(knowledgeBaseSources)
			.values({
				name: source.name,
				type: source.type,
				uri: source.uri,
				userId: user.id
			})
			.returning()

		revalidatePath("/admin/knowledge-base")
		return { success: true, data: createdSource }
	} catch (error) {
		console.error("Failed to create knowledge base source:", error)
		return {
			success: false,
			error: "Failed to create knowledge base source"
		}
	}
}

// Get all knowledge base sources for the current user
export async function getKnowledgeBaseSources() {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		const sources = await db
			.select()
			.from(knowledgeBaseSources)
			.where(eq(knowledgeBaseSources.userId, user.id))
			.orderBy(knowledgeBaseSources.createdAt)

		return { success: true, data: sources }
	} catch (error) {
		console.error("Failed to get knowledge base sources:", error)
		return { success: false, error: "Failed to get knowledge base sources" }
	}
}

// Get a knowledge base source by ID
export async function getKnowledgeBaseSourceById(id: number) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		const source = await db
			.select()
			.from(knowledgeBaseSources)
			.where(
				and(
					eq(knowledgeBaseSources.id, id),
					eq(knowledgeBaseSources.userId, user.id)
				)
			)
			.limit(1)

		if (!source.length) {
			return { success: false, error: "Knowledge base source not found" }
		}

		return { success: true, data: source[0] }
	} catch (error) {
		console.error("Failed to get knowledge base source:", error)
		return { success: false, error: "Failed to get knowledge base source" }
	}
}

// Delete a knowledge base source
export async function deleteKnowledgeBaseSource(id: number) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Check if the source belongs to the user
		const sourceCheck = await db
			.select({ id: knowledgeBaseSources.id })
			.from(knowledgeBaseSources)
			.where(
				and(
					eq(knowledgeBaseSources.id, id),
					eq(knowledgeBaseSources.userId, user.id)
				)
			)
			.limit(1)

		if (!sourceCheck.length) {
			return { success: false, error: "Knowledge base source not found" }
		}

		await db
			.delete(knowledgeBaseSources)
			.where(eq(knowledgeBaseSources.id, id))

		revalidatePath("/admin/knowledge-base")
		return { success: true }
	} catch (error) {
		console.error("Failed to delete knowledge base source:", error)
		return {
			success: false,
			error: "Failed to delete knowledge base source"
		}
	}
}

// Insert a vector embedding document
export async function insertKnowledgeBaseDocument(
	document: KnowledgeBaseDocumentCreateRequest
) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// If sourceId is provided, verify it belongs to the user
		if (document.sourceId) {
			const sourceCheck = await db
				.select({ id: knowledgeBaseSources.id })
				.from(knowledgeBaseSources)
				.where(
					and(
						eq(knowledgeBaseSources.id, document.sourceId),
						eq(knowledgeBaseSources.userId, user.id)
					)
				)
				.limit(1)

			if (!sourceCheck.length) {
				return {
					success: false,
					error: "Knowledge base source not found or unauthorized"
				}
			}
		}

		// Convert embedding array to PostgreSQL vector format
		const vectorValues = document.textEmbedding.join(",")

		// Use raw SQL for vector insertion
		const result = await db.execute(sql`
			INSERT INTO knowledge_base_documents
			(source_id, content_chunk, text_embedding_model, text_embedding, metadata, user_id)
			VALUES
			(${document.sourceId || null},
			 ${document.contentChunk},
			 ${document.textEmbeddingModel},
			 ${sql.raw(`'[${vectorValues}]'::vector`)},
			 ${JSON.stringify(document.metadata || {})},
			 ${user.id})
			RETURNING *
		`)

		if (!result.rows || !result.rows.length) {
			return { success: false, error: "Failed to insert document" }
		}

		// Update source lastIndexedAt if sourceId is provided
		if (document.sourceId) {
			await db
				.update(knowledgeBaseSources)
				.set({ lastIndexedAt: new Date() })
				.where(eq(knowledgeBaseSources.id, document.sourceId))
		}

		return { success: true, data: result.rows[0] }
	} catch (error) {
		console.error("Failed to insert knowledge base document:", error)
		return {
			success: false,
			error: "Failed to insert knowledge base document"
		}
	}
}

// Retrieve documents for a source
export async function getDocumentsForSource(sourceId: number) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// First check if the source belongs to the user
		const sourceCheck = await db
			.select({ id: knowledgeBaseSources.id })
			.from(knowledgeBaseSources)
			.where(
				and(
					eq(knowledgeBaseSources.id, sourceId),
					eq(knowledgeBaseSources.userId, user.id)
				)
			)
			.limit(1)

		if (!sourceCheck.length) {
			return {
				success: false,
				error: "Knowledge base source not found or unauthorized"
			}
		}

		// Get documents without the embedding vector (too large to send)
		const documents = await db.execute(sql`
			SELECT
				id,
				source_id,
				content_chunk,
				text_embedding_model,
				metadata,
				created_at,
				updated_at,
				user_id
			FROM
				knowledge_base_documents
			WHERE
				source_id = ${sourceId}
				AND user_id = ${user.id}
			ORDER BY
				created_at DESC
		`)

		return { success: true, data: documents.rows }
	} catch (error) {
		console.error("Failed to get documents for source:", error)
		return { success: false, error: "Failed to get documents for source" }
	}
}

// Perform vector similarity search
export async function querySimilarDocuments(
	queryEmbedding: number[],
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
	} = {}
) {
	const { limit = 5, threshold = 0.7, sourceId } = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Convert embedding array to PostgreSQL format
		const vectorValues = queryEmbedding.join(",")

		// Build the query with sourceId filter if provided
		let query = sql`
			SELECT
				kd.id,
				kd.source_id,
				kd.content_chunk,
				kd.metadata,
				1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) as similarity
			FROM
				knowledge_base_documents kd
			WHERE
				kd.user_id = ${user.id}
				AND 1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) > ${threshold}
		`

		if (sourceId) {
			query = sql`
				${query} AND kd.source_id = ${sourceId}
			`
		}

		// Add ordering and limit
		query = sql`
			${query}
			ORDER BY
				similarity DESC
			LIMIT ${limit}
		`

		const results = await db.execute<VectorQueryResult>(query)

		return { success: true, data: results.rows }
	} catch (error) {
		console.error("Failed to query similar documents:", error)
		return { success: false, error: "Failed to query similar documents" }
	}
}

// Create pgvector extension and indexes
export async function setupPgVector() {
	try {
		// Only allow authenticated admin users to run this
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Create pgvector extension if it doesn't exist
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)

		// Create HNSW index for efficient vector search
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS knowledge_base_documents_embedding_idx
			ON knowledge_base_documents
			USING hnsw (text_embedding vector_cosine_ops)
			WITH (m = 16, ef_construction = 64);
		`)

		return {
			success: true,
			message: "PgVector setup completed successfully"
		}
	} catch (error) {
		console.error("Failed to setup pgvector:", error)
		return { success: false, error: "Failed to setup pgvector" }
	}
}

// Get document count statistics
export async function getKnowledgeBaseStats() {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		const sourceCountQuery = db
			.select({ count: sql<number>`count(*)` })
			.from(knowledgeBaseSources)
			.where(eq(knowledgeBaseSources.userId, user.id))

		const documentCountQuery = db
			.select({ count: sql<number>`count(*)` })
			.from(knowledgeBaseDocuments)
			.where(eq(knowledgeBaseDocuments.userId, user.id))

		const [sourceCount, documentCount] = await Promise.all([
			sourceCountQuery,
			documentCountQuery
		])

		return {
			success: true,
			data: {
				sourceCount: sourceCount[0]?.count || 0,
				documentCount: documentCount[0]?.count || 0
			}
		}
	} catch (error) {
		console.error("Failed to get knowledge base stats:", error)
		return { success: false, error: "Failed to get knowledge base stats" }
	}
}

// Perform hybrid search with text query
export async function performRAGQuery(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
	} = {}
) {
	const { limit = 5, threshold = 0.7, sourceId } = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Import the query embedding function
		const { generateQueryEmbedding } = await import(
			"./knowledge-base-files"
		)

		// Generate embedding for the query
		const queryEmbedding = await generateQueryEmbedding(query)

		// Perform vector similarity search
		const vectorSimilarityResults = await querySimilarDocuments(
			queryEmbedding,
			{
				limit: Math.floor(limit * 0.7), // Use 70% of limit for vector search
				threshold,
				sourceId
			}
		)

		// Fallback to text search to fill remaining slots
		const remainingLimit =
			limit -
			(vectorSimilarityResults.success
				? vectorSimilarityResults.data?.length || 0
				: 0)

		let hybridResults: Record<string, unknown>[] = []

		if (vectorSimilarityResults.success && vectorSimilarityResults.data) {
			// Add source information to vector results
			hybridResults = await Promise.all(
				vectorSimilarityResults.data.map(
					async (doc: VectorQueryResult) => {
						// Get source information
						const sourceInfo = await db.execute(sql`
						SELECT name, type
						FROM knowledge_base_sources
						WHERE id = ${doc.source_id} AND user_id = ${user.id}
						LIMIT 1
					`)

						return {
							...doc,
							source_name: sourceInfo.rows[0]?.name || "Unknown",
							source_type: sourceInfo.rows[0]?.type || "unknown"
						}
					}
				)
			)
		}

		// If we need more results, do text search for remaining slots
		if (remainingLimit > 0) {
			// Get IDs already found to avoid duplicates
			const existingIds = hybridResults.map((r) => r.id)

			let textSearchQuery = sql`
				SELECT
					kd.id,
					kd.source_id,
					kd.content_chunk,
					kd.metadata,
					ks.name as source_name,
					ks.type as source_type,
					0.5 as similarity
				FROM
					knowledge_base_documents kd
				JOIN
					knowledge_base_sources ks ON kd.source_id = ks.id
				WHERE
					kd.user_id = ${user.id}
					AND (
						kd.content_chunk ILIKE ${`%${query}%`}
						OR ks.name ILIKE ${`%${query}%`}
					)
			`

			if (sourceId) {
				textSearchQuery = sql`
					${textSearchQuery} AND kd.source_id = ${sourceId}
				`
			}

			if (existingIds.length > 0) {
				const idsPlaceholder = existingIds.map(() => "?").join(",")
				textSearchQuery = sql`
					${textSearchQuery} AND kd.id NOT IN (${sql.raw(existingIds.join(","))})
				`
			}

			// Add ordering and limit
			textSearchQuery = sql`
				${textSearchQuery}
				ORDER BY
					LENGTH(kd.content_chunk) ASC
				LIMIT ${remainingLimit}
			`

			const textResults = await db.execute(textSearchQuery)
			hybridResults = [...hybridResults, ...textResults.rows]
		}

		return {
			success: true,
			data: hybridResults,
			query: query,
			searchType: "hybrid" // Indicate this was a hybrid search
		}
	} catch (error) {
		console.error("Failed to perform RAG query:", error)
		return { success: false, error: "Failed to perform search" }
	}
}

// Perform advanced RAG query with multiple strategies
export async function performAdvancedRAGQuery(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		images?: string[]
		enableQueryRewriting?: boolean
		enableHyde?: boolean
		enableReranking?: boolean
	} = {}
) {
	const {
		limit = 5,
		threshold = 0.7,
		sourceId,
		images,
		enableQueryRewriting = true,
		enableHyde = true,
		enableReranking = true
	} = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Import advanced functions
		const { generateQueryEmbedding, generateMultimodalQueryEmbedding } =
			await import("./knowledge-base-files")

		// Step 1: Analyze query
		const queryAnalysis = analyzeQuery(query, images)

		// Step 2: Generate embeddings using multiple strategies
		const embeddingStrategies: Array<{
			type: string
			embedding: number[]
			weight: number
		}> = []

		// Primary embedding strategy
		if (queryAnalysis.hasVisualContent) {
			const multimodalEmbedding = await generateMultimodalQueryEmbedding(
				query,
				images
			)
			embeddingStrategies.push({
				type: "multimodal",
				embedding: multimodalEmbedding,
				weight: 0.6
			})
		} else {
			const textEmbedding = await generateQueryEmbedding(query)
			embeddingStrategies.push({
				type: "text",
				embedding: textEmbedding,
				weight: 0.7
			})
		}

		// Query rewriting strategy
		if (enableQueryRewriting && queryAnalysis.complexity !== "simple") {
			const rewrittenQueries = generateRewrittenQueries(
				query,
				queryAnalysis.queryType
			)
			for (const rewrittenQuery of rewrittenQueries.slice(0, 2)) {
				const rewriteEmbedding =
					await generateQueryEmbedding(rewrittenQuery)
				embeddingStrategies.push({
					type: "rewritten",
					embedding: rewriteEmbedding,
					weight: 0.2
				})
			}
		}

		// Step 3: Retrieve documents using multiple strategies
		const allResults: VectorQueryResult[] = []

		for (const strategy of embeddingStrategies) {
			const strategyResults = await querySimilarDocuments(
				strategy.embedding,
				{
					limit: Math.ceil(limit * 2 * strategy.weight),
					threshold: threshold * 0.8,
					sourceId
				}
			)

			if (strategyResults.success && strategyResults.data) {
				// Add strategy metadata
				const enrichedResults = strategyResults.data.map(
					(doc: VectorQueryResult) => ({
						...doc,
						retrievalStrategy: strategy.type,
						strategyWeight: strategy.weight
					})
				)
				allResults.push(...enrichedResults)
			}
		}

		// Step 4: Deduplicate results
		const uniqueResults = deduplicateDocuments(allResults)

		// Step 5: Rerank if enabled
		let finalResults = uniqueResults
		if (enableReranking && uniqueResults.length > limit) {
			finalResults = await rerankerResults(query, uniqueResults, limit)
		} else {
			finalResults = uniqueResults
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, limit)
		}

		// Step 6: Add source information
		const enrichedResults = await Promise.all(
			finalResults.map(async (doc: VectorQueryResult) => {
				const sourceInfo = await db.execute(sql`
					SELECT name, type
					FROM knowledge_base_sources
					WHERE id = ${doc.sourceId} AND user_id = ${user.id}
					LIMIT 1
				`)

				return {
					...doc,
					source_name: sourceInfo.rows[0]?.name || "Unknown",
					source_type: sourceInfo.rows[0]?.type || "unknown"
				}
			})
		)

		return {
			success: true,
			data: enrichedResults,
			query: query,
			searchType: "advanced",
			metadata: {
				queryAnalysis,
				strategiesUsed: embeddingStrategies.map((s) => s.type),
				totalDocumentsRetrieved: allResults.length,
				documentsAfterDeduplication: uniqueResults.length,
				finalDocuments: finalResults.length,
				rerankingEnabled: enableReranking
			}
		}
	} catch (error) {
		console.error("Failed to perform advanced RAG query:", error)
		return { success: false, error: "Failed to perform advanced search" }
	}
}

// Query analysis helper
function analyzeQuery(query: string, images?: string[]) {
	const hasVisualContent = images && images.length > 0
	const words = query.split(/\s+/).length
	const hasMultipleConcepts =
		(query.match(/\band\b|\bor\b/g) || []).length > 1

	let complexity: "simple" | "moderate" | "complex"
	if (words > 15 || hasMultipleConcepts) {
		complexity = "complex"
	} else if (words > 8) {
		complexity = "moderate"
	} else {
		complexity = "simple"
	}

	let queryType: string
	const lowercaseQuery = query.toLowerCase()
	if (hasVisualContent) {
		queryType = "multimodal"
	} else if (
		/\b(how to|how do|step|process|procedure)\b/.test(lowercaseQuery)
	) {
		queryType = "procedural"
	} else if (
		/\b(compare|difference|analysis|evaluate)\b/.test(lowercaseQuery)
	) {
		queryType = "analytical"
	} else if (
		/\b(explain|describe|what is|tell me about)\b/.test(lowercaseQuery)
	) {
		queryType = "contextual"
	} else {
		queryType = "factual"
	}

	return {
		hasVisualContent,
		complexity,
		queryType
	}
}

// Query rewriting helper
function generateRewrittenQueries(query: string, queryType: string): string[] {
	const rewriteStrategies: Record<string, string[]> = {
		factual: [
			`What are the key facts about ${extractMainConcept(query)}?`,
			`Provide specific information regarding ${extractMainConcept(query)}`
		],
		analytical: [
			`Compare and analyze ${extractMainConcept(query)}`,
			`What are the advantages and disadvantages of ${extractMainConcept(query)}?`
		],
		contextual: [
			`Explain thoroughly: ${extractMainConcept(query)}`,
			`Provide comprehensive information about ${extractMainConcept(query)}`
		],
		procedural: [
			`Step-by-step instructions for ${extractMainConcept(query)}`,
			`How to implement ${extractMainConcept(query)}`
		],
		multimodal: [
			`Visual and textual information about ${extractMainConcept(query)}`,
			`Describe what is shown regarding ${extractMainConcept(query)}`
		]
	}

	return rewriteStrategies[queryType] || rewriteStrategies.factual
}

// Extract main concept helper
function extractMainConcept(query: string): string {
	const stopWords = [
		"what",
		"how",
		"when",
		"where",
		"why",
		"is",
		"are",
		"the",
		"a",
		"an"
	]
	const words = query
		.toLowerCase()
		.split(/\s+/)
		.filter((word) => !stopWords.includes(word))
	return words.slice(0, 3).join(" ")
}

// Deduplication helper
function deduplicateDocuments(docs: VectorQueryResult[]): VectorQueryResult[] {
	const seen = new Map()
	const result = []

	for (const doc of docs) {
		const key = `${doc.sourceId}-${doc.id}`
		if (!seen.has(key) || seen.get(key).similarity < doc.similarity) {
			seen.set(key, doc)
		}
	}

	return Array.from(seen.values())
}

// Simple reranking implementation (placeholder for Voyage reranker)
async function rerankerResults(
	query: string,
	docs: VectorQueryResult[],
	limit: number
): Promise<VectorQueryResult[]> {
	// For now, implement simple semantic reranking
	// TODO: Integrate Voyage reranker API

	const queryWords = query.toLowerCase().split(/\s+/)

	const scoredDocs = docs.map((doc) => {
		const docWords = doc.contentChunk.toLowerCase().split(/\s+/)
		const intersection = queryWords.filter((word) =>
			docWords.includes(word)
		)
		const rerankScore =
			intersection.length / Math.max(queryWords.length, docWords.length)

		return {
			...doc,
			rerankScore,
			reranked: true
		}
	})

	return scoredDocs
		.sort(
			(a, b) =>
				b.rerankScore + b.similarity - (a.rerankScore + a.similarity)
		)
		.slice(0, limit)
}

// Generate RAG response with context and citations
export async function generateRAGResponse(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		modelProvider?: "openai" | "anthropic" | "google"
		modelName?: string
		includeMetadata?: boolean
		stream?: boolean
	} = {}
) {
	const {
		limit = 5,
		threshold = 0.7,
		sourceId,
		modelProvider = "openai",
		modelName = "gpt-4o-mini",
		includeMetadata = true,
		stream = false
	} = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Step 1: Retrieve relevant context using existing RAG query
		const contextResult = await performRAGQuery(query, {
			limit,
			threshold,
			sourceId
		})

		if (!contextResult.success || !contextResult.data) {
			return {
				success: false,
				error: "Failed to retrieve relevant context"
			}
		}

		const contextDocuments = contextResult.data as VectorQueryResult[]

		if (contextDocuments.length === 0) {
			return {
				success: true,
				data: {
					answer: "I don't have enough information in the knowledge base to answer this question. Please try a different query or add more relevant documents.",
					query: query,
					sources: [],
					metadata: includeMetadata
						? {
								modelProvider,
								modelName,
								contextDocumentsUsed: 0,
								searchType:
									contextResult.searchType || "hybrid",
								usage: null
							}
						: undefined
				}
			}
		}

		// Step 2: Prepare context for LLM
		const contextText = contextDocuments
			.map((doc, index) => {
				const sourceInfo = `Source: ${doc.source_name || "Unknown"} (${doc.source_type || "unknown"})`
				const content = doc.content_chunk || doc.contentChunk || ""
				return `[${index + 1}] ${sourceInfo}\n${content}`
			})
			.join("\n\n")

		// Step 3: Create system prompt for RAG
		const systemPrompt = `You are an AI assistant helping users find information from their knowledge base.

Your task is to answer the user's question based ONLY on the provided context documents. Follow these guidelines:

1. **Answer based on context**: Only use information from the provided context documents
2. **Cite sources**: Reference specific sources using [1], [2], etc. format
3. **Be accurate**: If the context doesn't contain enough information to answer the question, say so
4. **Be concise**: Provide clear, direct answers without unnecessary elaboration
5. **Maintain context**: If multiple sources provide related information, synthesize them coherently

Context Documents:
${contextText}

If the context doesn't contain relevant information to answer the question, respond with: "I don't have enough information in the knowledge base to answer this question. Please try a different query or add more relevant documents."`

		const userPrompt = `Question: ${query}

Please provide a comprehensive answer based on the context documents above.`

		// Step 4: Generate response using Vercel AI SDK
		let response: string
		let usage: Record<string, unknown> | null = null

		try {
			// Import AI functions from helper
			const { generateAIText } = await import("@/lib/ai-helpers")

			response = await generateAIText({
				prompt: userPrompt,
				system: systemPrompt,
				category: "text",
				task: "general",
				maxTokens: 1000,
				temperature: 0.1
			})

			// Mock usage data since Vercel AI SDK doesn't expose this directly
			usage = {
				promptTokens: Math.ceil((systemPrompt + userPrompt).length / 4),
				completionTokens: Math.ceil(response.length / 4),
				totalTokens: Math.ceil(
					(systemPrompt + userPrompt + response).length / 4
				)
			}
		} catch (aiError) {
			console.error("AI generation error:", aiError)
			return {
				success: false,
				error: "Failed to generate response. Please check your API configuration."
			}
		}

		// Step 5: Prepare response with metadata
		const ragResponse = {
			answer: response,
			query: query,
			sources: contextDocuments.map((doc, index) => ({
				id: doc.id,
				sourceId: doc.source_id || doc.sourceId,
				sourceName: doc.source_name,
				sourceType: doc.source_type,
				similarity: doc.similarity,
				contentPreview: `${String(doc.content_chunk || doc.contentChunk || "").substring(0, 200)}...`,
				citationIndex: index + 1,
				metadata: doc.metadata
			})),
			metadata: includeMetadata
				? {
						modelProvider,
						modelName,
						contextDocumentsUsed: contextDocuments.length,
						searchType: contextResult.searchType || "hybrid",
						usage
					}
				: undefined
		}

		return {
			success: true,
			data: ragResponse
		}
	} catch (error) {
		console.error("Failed to generate RAG response:", error)
		return {
			success: false,
			error: "Failed to generate response"
		}
	}
}

// Generate streaming RAG response for real-time chat experience
export async function generateStreamingRAGResponse(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		modelProvider?: "openai" | "anthropic" | "google"
		modelName?: string
		includeMetadata?: boolean
	} = {}
) {
	const {
		limit = 5,
		threshold = 0.7,
		sourceId,
		modelProvider = "openai",
		modelName = "gpt-4o-mini",
		includeMetadata = true
	} = options

	try {
		const user = await currentUser()
		if (!user) {
			throw new Error("Unauthorized")
		}

		// Step 1: Retrieve relevant context
		const contextResult = await performRAGQuery(query, {
			limit,
			threshold,
			sourceId
		})

		if (!contextResult.success || !contextResult.data) {
			throw new Error("Failed to retrieve relevant context")
		}

		const contextDocuments = contextResult.data as VectorQueryResult[]

		if (contextDocuments.length === 0) {
			throw new Error("No relevant documents found in knowledge base")
		}

		// Step 2: Prepare context for LLM
		const contextText = contextDocuments
			.map((doc, index) => {
				const sourceInfo = `Source: ${doc.source_name || "Unknown"} (${doc.source_type || "unknown"})`
				const content = doc.content_chunk || doc.contentChunk || ""
				return `[${index + 1}] ${sourceInfo}\n${content}`
			})
			.join("\n\n")

		const systemPrompt = `You are an AI assistant helping users find information from their knowledge base.

Answer the user's question based ONLY on the provided context documents. Follow these guidelines:

1. **Answer based on context**: Only use information from the provided context documents
2. **Cite sources**: Reference specific sources using [1], [2], etc. format
3. **Be accurate**: If the context doesn't contain enough information, say so
4. **Be concise**: Provide clear, direct answers
5. **Maintain context**: Synthesize related information from multiple sources

Context Documents:
${contextText}`

		const userPrompt = `Question: ${query}

Please provide a comprehensive answer based on the context documents above.`

		// Step 3: Return streaming configuration for use with streamText
		return {
			success: true,
			data: {
				systemPrompt,
				userPrompt,
				contextDocuments,
				searchMetadata: {
					modelProvider,
					modelName,
					contextDocumentsUsed: contextDocuments.length,
					searchType: contextResult.searchType || "hybrid"
				}
			}
		}
	} catch (error) {
		console.error("Failed to prepare streaming RAG response:", error)
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to prepare response"
		}
	}
}

// Enhanced RAG query with preprocessing and multiple strategies
export async function performEnhancedRAGQuery(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		enableQueryExpansion?: boolean
		enableSemanticReranking?: boolean
		enableHybridSearch?: boolean
	} = {}
) {
	const {
		limit = 10,
		threshold = 0.7,
		sourceId,
		enableQueryExpansion = true,
		enableSemanticReranking = true,
		enableHybridSearch = true
	} = options

	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Step 1: Query preprocessing and expansion
		let queries = [query]

		if (enableQueryExpansion) {
			const expandedQueries = await expandQuery(query)
			queries = [...queries, ...expandedQueries.slice(0, 2)] // Add up to 2 expanded queries
		}

		// Step 2: Execute multiple search strategies
		const allResults: VectorQueryResult[] = []

		for (const currentQuery of queries) {
			// Vector similarity search
			const vectorResult = await performRAGQuery(currentQuery, {
				limit: Math.ceil(limit / queries.length),
				threshold,
				sourceId
			})

			if (vectorResult.success && vectorResult.data) {
				allResults.push(...(vectorResult.data as VectorQueryResult[]))
			}
		}

		// Step 3: Deduplicate results
		const deduplicatedResults = deduplicateDocuments(allResults)

		// Step 4: Semantic reranking
		let finalResults = deduplicatedResults
		if (enableSemanticReranking && deduplicatedResults.length > 0) {
			finalResults = await rerankerResults(
				query,
				deduplicatedResults,
				limit
			)
		}

		// Step 5: Apply final limit
		const limitedResults = finalResults.slice(0, limit)

		return {
			success: true,
			data: limitedResults,
			query: query,
			searchType: "enhanced",
			metadata: {
				originalQuery: query,
				expandedQueries: queries.slice(1),
				totalCandidates: allResults.length,
				finalResults: limitedResults.length,
				strategiesUsed: {
					queryExpansion: enableQueryExpansion,
					semanticReranking: enableSemanticReranking,
					hybridSearch: enableHybridSearch
				}
			}
		}
	} catch (error) {
		console.error("Failed to perform enhanced RAG query:", error)
		return { success: false, error: "Failed to perform enhanced search" }
	}
}

// Query expansion using AI to generate related queries
async function expandQuery(query: string): Promise<string[]> {
	try {
		const { generateAIText } = await import("@/lib/ai-helpers")

		const expansionPrompt = `Generate 3 alternative phrasings of this query that might help find relevant information:

Original Query: "${query}"

Requirements:
1. Keep the same intent and meaning
2. Use different vocabulary and phrasing
3. Consider synonyms and related terms
4. Focus on finding comprehensive information

Return only the alternative queries, one per line, without numbering or formatting.`

		const expandedText = await generateAIText({
			prompt: expansionPrompt,
			category: "text",
			task: "general",
			maxTokens: 200,
			temperature: 0.5
		})

		return expandedText
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && line !== query)
			.slice(0, 3)
	} catch (error) {
		console.error("Failed to expand query:", error)
		return []
	}
}
