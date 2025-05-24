import { generateRAGResponse, performRAGQuery } from "@/actions/knowledge-base"
import { currentUser } from "@clerk/nextjs/server"
import { type NextRequest, NextResponse } from "next/server"

// Type definitions for the test results
interface TestResults {
	timestamp: string
	testType: string
	userId: string
	basicSearch?: {
		query: string
		success: boolean
		documentsFound: number
		searchType: string
		error: string | null
		topResults?: Array<{
			sourceName: string
			similarity: number
			preview: string
		}>
	}
	ragGeneration?: {
		query: string
		success: boolean
		error: string | null
		response?: {
			answerLength: number
			sourcesUsed: number
			model: string
			answerPreview: string
			sources: Array<{
				name: string
				similarity: number
				citation: number
			}>
		}
	}
	multipleQueries?: Array<{
		type: string
		query: string
		success: boolean
		documentsFound: number
		avgSimilarity: number
	}>
	performance?: {
		query: string
		queryTimeMs: number
		success: boolean
		documentsFound: number
		rating: "GOOD" | "ACCEPTABLE" | "POOR"
	}
}

// These match the actual return types from knowledge-base actions
interface QueryResultDocument {
	id: number
	source_id?: number | null
	sourceId?: number | null
	source_name?: string
	source_type?: string
	content_chunk?: string
	contentChunk?: string
	similarity: number
	metadata?: Record<string, unknown>
}

interface RAGResponseSource {
	id: number
	sourceId: number | null
	sourceName: string
	sourceType: string
	similarity: number
	contentPreview: string
	citationIndex: number
	metadata: Record<string, unknown>
}

interface TestOptions {
	limit?: number
	threshold?: number
	sourceId?: number
	generateResponse?: boolean
	modelProvider?: "openai" | "anthropic" | "google"
	modelName?: string
}

export async function GET(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const testType = searchParams.get("type") || "all"

		const results: TestResults = {
			timestamp: new Date().toISOString(),
			testType,
			userId: user.id
		}

		console.log("🤖 Starting RAG functionality test...")

		// Test 1: Basic RAG Query (Search Only)
		if (testType === "all" || testType === "search") {
			console.log("1. 🔍 Testing Basic RAG Query...")

			const basicQuery = "How do I set up a voice agent in IcePhone?"
			const searchResult = await performRAGQuery(basicQuery, {
				limit: 3,
				threshold: 0.6
			})

			results.basicSearch = {
				query: basicQuery,
				success: searchResult.success,
				documentsFound: searchResult.data?.length || 0,
				searchType: searchResult.searchType || "unknown",
				error: searchResult.error || null
			}

			if (searchResult.success && searchResult.data) {
				results.basicSearch.topResults = searchResult.data
					.slice(0, 2)
					.map((doc: Record<string, unknown>) => ({
						sourceName: (doc.source_name as string) || "",
						similarity: (doc.similarity as number) || 0,
						preview: String(
							doc.content_chunk || doc.contentChunk || ""
						).substring(0, 100)
					}))
			}
		}

		// Test 2: Full RAG Response Generation
		if (testType === "all" || testType === "rag") {
			console.log("2. 🧠 Testing Full RAG Response Generation...")

			const ragQuery = "What are the pricing plans for IcePhone?"
			const ragResponse = await generateRAGResponse(ragQuery, {
				limit: 3,
				threshold: 0.6,
				modelProvider: "openai",
				modelName: "gpt-4o-mini",
				includeMetadata: true
			})

			results.ragGeneration = {
				query: ragQuery,
				success: ragResponse.success,
				error: ragResponse.error || null
			}

			if (ragResponse.success && ragResponse.data) {
				results.ragGeneration.response = {
					answerLength: ragResponse.data.answer.length,
					sourcesUsed: ragResponse.data.sources.length,
					model: `${ragResponse.data.metadata?.modelProvider}/${ragResponse.data.metadata?.modelName}`,
					answerPreview: ragResponse.data.answer.substring(0, 200),
					// biome-ignore lint/suspicious/noExplicitAny: Dynamic RAG response types
					sources: ragResponse.data.sources.map((source: any) => ({
						name: source.sourceName,
						similarity: source.similarity,
						citation: source.citationIndex
					}))
				}
			}
		}

		// Test 3: Multiple Query Types
		if (testType === "all" || testType === "queries") {
			console.log("3. 🔄 Testing Different Query Types...")

			const testQueries = [
				{
					query: "How do I integrate IcePhone with my CRM?",
					type: "procedural"
				},
				{
					query: "What should I do if call quality is poor?",
					type: "troubleshooting"
				}
			]

			results.multipleQueries = []

			for (const testQuery of testQueries) {
				const queryResult = await performRAGQuery(testQuery.query, {
					limit: 2,
					threshold: 0.5
				})

				results.multipleQueries.push({
					type: testQuery.type,
					query: testQuery.query,
					success: queryResult.success,
					documentsFound: queryResult.data?.length || 0,
					avgSimilarity: queryResult.data?.length
						? queryResult.data.reduce(
								// biome-ignore lint/suspicious/noExplicitAny: Dynamic query result types
								(sum: number, doc: any) => sum + doc.similarity,
								0
							) / queryResult.data.length
						: 0
				})
			}
		}

		// Test 4: Performance Check
		if (testType === "all" || testType === "performance") {
			console.log("4. ⚡ Testing Performance...")

			const startTime = Date.now()
			const perfTestQuery = "How does IcePhone work?"

			const perfResult = await performRAGQuery(perfTestQuery, {
				limit: 5
			})
			const queryTime = Date.now() - startTime

			results.performance = {
				query: perfTestQuery,
				queryTimeMs: queryTime,
				success: perfResult.success,
				documentsFound: perfResult.data?.length || 0,
				rating:
					queryTime < 2000
						? "GOOD"
						: queryTime < 5000
							? "ACCEPTABLE"
							: "POOR"
			}
		}

		console.log("🎉 RAG functionality test completed!")

		return NextResponse.json({
			success: true,
			data: results,
			summary: {
				testType,
				totalTests: Object.keys(results).length - 3, // Subtract metadata fields
				timestamp: results.timestamp
			}
		})
	} catch (error) {
		console.error("❌ RAG test failed:", error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		)
	}
}

export async function POST(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const body = (await request.json()) as {
			query?: string
			options?: TestOptions
		}
		const { query, options = {} } = body

		if (!query || typeof query !== "string") {
			return NextResponse.json(
				{ error: "Query is required and must be a string" },
				{ status: 400 }
			)
		}

		console.log(`🔍 Testing custom RAG query: "${query}"`)

		// Test custom query
		const searchResult = await performRAGQuery(query, {
			limit: options.limit || 5,
			threshold: options.threshold || 0.6,
			sourceId: options.sourceId
		})

		if (!searchResult.success) {
			return NextResponse.json(
				{
					success: false,
					error: searchResult.error
				},
				{ status: 500 }
			)
		}

		// Generate full RAG response if requested
		let ragResponse = null
		if (options.generateResponse) {
			const response = await generateRAGResponse(query, {
				limit: options.limit || 5,
				threshold: options.threshold || 0.6,
				sourceId: options.sourceId,
				modelProvider: options.modelProvider || "openai",
				modelName: options.modelName || "gpt-4o-mini",
				includeMetadata: true
			})

			if (response.success) {
				ragResponse = response.data
			}
		}

		return NextResponse.json({
			success: true,
			data: {
				query,
				searchResults: {
					documentsFound: searchResult.data?.length || 0,
					searchType: searchResult.searchType,
					documents: searchResult.data
				},
				ragResponse,
				timestamp: new Date().toISOString()
			}
		})
	} catch (error) {
		console.error("❌ Custom RAG test failed:", error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		)
	}
}
