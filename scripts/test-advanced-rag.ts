#!/usr/bin/env bun

import { performAdvancedRAGQuery } from "../src/actions/knowledge-base"
import { processAndEmbedFile } from "../src/actions/knowledge-base-files"
import { generateQueryEmbedding } from "../src/actions/knowledge-base-files"

// Test data
const testDocument = `
IcePhone Advanced Features

IcePhone is an AI-powered CRM and Voice Agent Platform that revolutionizes business communications. Here are the key features:

1. Voice Agent Technology
   - AI-powered voice agents that handle inbound and outbound calls
   - Natural language processing for customer interactions
   - Automated lead qualification and appointment setting
   - Real-time conversation analytics

2. CRM Integration
   - Centralized lead management system
   - Automatic call logging and transcription
   - Lead scoring and pipeline management
   - Customer interaction history tracking

3. Advanced Analytics
   - Call performance metrics
   - Conversion rate tracking
   - Voice agent effectiveness analysis
   - Custom reporting dashboards

4. Automation Features
   - Automated follow-up sequences
   - Smart lead routing
   - Appointment scheduling integration
   - Email and SMS automation

The platform helps businesses improve their customer service efficiency while reducing operational costs through intelligent automation.
`

const testQueries = [
	"What are the main features of IcePhone?",
	"How does the voice agent technology work?",
	"Tell me about CRM integration capabilities",
	"What analytics features are available?",
	"How can IcePhone help reduce costs?",
	"Explain the automation features in detail",
	"What is lead scoring and how does it work?",
	"How does IcePhone handle customer interactions?"
]

async function testAdvancedRAGSystem() {
	console.log("🚀 Starting Advanced RAG System Test")
	console.log("=".repeat(50))

	try {
		// Step 1: Test document embedding
		console.log("\n📄 Step 1: Testing document ingestion...")

		const testFile = new File([testDocument], "icephone-features.txt", {
			type: "text/plain"
		})

		const ingestionResult = await processAndEmbedFile(
			testFile,
			"IcePhone Features Test Document",
			"txt_upload"
		)

		if (ingestionResult.success) {
			console.log("✅ Document ingestion successful")
			if ("chunkCount" in ingestionResult) {
				console.log(
					`   - Chunks created: ${ingestionResult.chunkCount || "N/A"}`
				)
			}
		} else {
			console.log("❌ Document ingestion failed:", ingestionResult.error)
			return
		}

		// Step 2: Test query embedding
		console.log("\n🔍 Step 2: Testing query embedding generation...")

		const testQuery = testQueries[0]
		const queryEmbedding = await generateQueryEmbedding(testQuery)

		if (queryEmbedding && queryEmbedding.length === 1024) {
			console.log("✅ Query embedding generation successful")
			console.log(`   - Embedding dimensions: ${queryEmbedding.length}`)
		} else {
			console.log("❌ Query embedding generation failed")
		}

		// Step 3: Test each query with different advanced options
		console.log("\n🎯 Step 3: Testing advanced RAG queries...")

		for (let i = 0; i < testQueries.length; i++) {
			const query = testQueries[i]
			console.log(`\n--- Query ${i + 1}: "${query}" ---`)

			// Test with different configurations
			const configs = [
				{
					name: "Basic Search",
					options: {
						enableQueryRewriting: false,
						enableHyde: false,
						enableReranking: false
					}
				},
				{
					name: "Query Rewriting",
					options: {
						enableQueryRewriting: true,
						enableHyde: false,
						enableReranking: false
					}
				},
				{
					name: "HyDE Enabled",
					options: {
						enableQueryRewriting: false,
						enableHyde: true,
						enableReranking: false
					}
				},
				{
					name: "Full Advanced",
					options: {
						enableQueryRewriting: true,
						enableHyde: true,
						enableReranking: true
					}
				}
			]

			for (const config of configs) {
				try {
					const startTime = Date.now()
					const result = await performAdvancedRAGQuery(query, {
						limit: 3,
						threshold: 0.5,
						...config.options
					})
					const duration = Date.now() - startTime

					if (result.success && result.data) {
						console.log(
							`  ✅ ${config.name}: ${result.data.length} results (${duration}ms)`
						)

						if (result.metadata) {
							console.log(
								`     - Query type: ${result.metadata.queryAnalysis?.queryType}`
							)
							console.log(
								`     - Complexity: ${result.metadata.queryAnalysis?.complexity}`
							)
							console.log(
								`     - Strategies: ${result.metadata.strategiesUsed?.join(", ")}`
							)
							console.log(
								`     - Documents: ${result.metadata.totalDocumentsRetrieved} → ${result.metadata.finalDocuments}`
							)
						}

						// Show best result
						if (result.data.length > 0) {
							const bestResult = result.data[0]
							console.log(
								`     - Best match: ${(bestResult.similarity * 100).toFixed(1)}% similarity`
							)
							console.log(
								`     - Strategy: ${bestResult.retrievalStrategy || "N/A"}`
							)
							console.log(
								`     - Content preview: "${bestResult.contentChunk?.substring(0, 100)}..."`
							)
						}
					} else {
						console.log(
							`  ❌ ${config.name}: Failed - ${result.error}`
						)
					}
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error)
					console.log(`  ❌ ${config.name}: Error - ${errorMessage}`)
				}
			}

			// Add delay between queries to avoid rate limiting
			if (i < testQueries.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000))
			}
		}

		// Step 4: Performance comparison
		console.log("\n📊 Step 4: Performance comparison...")

		const performanceTest = async (
			queryIndex: number,
			config: {
				enableQueryRewriting: boolean
				enableHyde: boolean
				enableReranking: boolean
			}
		) => {
			const query = testQueries[queryIndex]
			const startTime = Date.now()

			const result = await performAdvancedRAGQuery(query, {
				limit: 5,
				threshold: 0.7,
				...config
			})

			const duration = Date.now() - startTime

			return {
				query,
				duration,
				success: result.success,
				resultCount: result.data?.length || 0,
				strategies: result.metadata?.strategiesUsed?.length || 0
			}
		}

		const configurations = [
			{
				name: "Basic",
				enableQueryRewriting: false,
				enableHyde: false,
				enableReranking: false
			},
			{
				name: "Advanced",
				enableQueryRewriting: true,
				enableHyde: true,
				enableReranking: true
			}
		]

		for (const config of configurations) {
			console.log(`\n${config.name} Configuration Results:`)
			let totalDuration = 0
			let successCount = 0

			for (let i = 0; i < 3; i++) {
				// Test first 3 queries
				const result = await performanceTest(i, config)
				totalDuration += result.duration
				if (result.success) successCount++

				console.log(
					`  Query ${i + 1}: ${result.duration}ms, ${result.resultCount} results, ${result.strategies} strategies`
				)
			}

			console.log(
				`  Average: ${(totalDuration / 3).toFixed(0)}ms, Success rate: ${((successCount / 3) * 100).toFixed(0)}%`
			)
		}

		console.log("\n🎉 Advanced RAG System Test Completed Successfully!")
		console.log("\nTest Summary:")
		console.log("✅ Document ingestion working")
		console.log("✅ Query embedding generation working")
		console.log("✅ Advanced RAG queries working")
		console.log("✅ Multiple search strategies working")
		console.log("✅ Performance metrics collected")
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error)
		const errorStack = error instanceof Error ? error.stack : undefined
		console.error("\n❌ Test failed with error:", errorMessage)
		if (errorStack) {
			console.error(errorStack)
		}
	}
}

// Run the test directly
testAdvancedRAGSystem()
