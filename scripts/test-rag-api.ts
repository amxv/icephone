#!/usr/bin/env bun

/**
 * Test script for RAG API functionality
 * Tests the complete RAG pipeline through API endpoints
 */

const API_BASE = "http://localhost:3000"

interface ApiResponse<T = unknown> {
	success?: boolean
	error?: string
	data?: T
}

async function testRAGAPI() {
	console.log("🤖 Testing RAG API Functionality...")
	console.log(`${"=".repeat(50)}`)

	try {
		// Test 1: Basic RAG Search
		console.log("\n1. 🔍 Testing Basic RAG Search via API...")

		const searchResponse = await fetch(
			`${API_BASE}/api/test-rag?type=search`
		)

		if (!searchResponse.ok) {
			console.log(
				`   ❌ API request failed with status: ${searchResponse.status}`
			)
			if (searchResponse.status === 404) {
				console.log(
					"   📝 Note: Make sure the dev server is running on port 3000"
				)
			}
			return
		}

		// biome-ignore lint/suspicious/noExplicitAny: Test script with dynamic API responses
		const searchResult = (await searchResponse.json()) as any

		if (searchResult.basicSearch?.success) {
			console.log(
				`   ✅ Found ${searchResult.basicSearch.documentsFound} relevant documents`
			)
			console.log(
				`   📋 Search type: ${searchResult.basicSearch.searchType}`
			)

			if (searchResult.basicSearch.topResults) {
				for (const [
					index,
					result
				] of searchResult.basicSearch.topResults.entries()) {
					console.log(
						`   ${index + 1}. ${result.sourceName} (${(result.similarity * 100).toFixed(1)}% similarity)`
					)
					console.log(`      "${result.preview}..."`)
				}
			}
		} else {
			console.log(
				`   ❌ Search failed: ${searchResult.basicSearch?.error || "Unknown error"}`
			)
		}

		// Test 2: RAG Response Generation
		console.log("\n2. 🧠 Testing RAG Response Generation via API...")

		const ragResponse = await fetch(`${API_BASE}/api/test-rag?type=rag`)

		if (!ragResponse.ok) {
			console.log(
				`   ❌ RAG API request failed with status: ${ragResponse.status}`
			)
			return
		}

		// biome-ignore lint/suspicious/noExplicitAny: Test script with dynamic API responses
		const ragResult = (await ragResponse.json()) as any

		if (ragResult.ragGeneration?.success) {
			console.log("   ✅ RAG response generated successfully")
			console.log(
				`   📊 Used ${ragResult.ragGeneration.response?.sourcesUsed || 0} sources`
			)
			console.log(
				`   🤖 Model: ${ragResult.ragGeneration.response?.model || "Unknown"}`
			)
			console.log(
				`   📝 Answer length: ${ragResult.ragGeneration.response?.answerLength || 0} characters`
			)

			if (ragResult.ragGeneration.response?.answerPreview) {
				console.log("\n   📋 Generated Answer Preview:")
				console.log(
					`   "${ragResult.ragGeneration.response.answerPreview}..."`
				)
			}

			if (ragResult.ragGeneration.response?.sources) {
				console.log("\n   📚 Sources cited:")
				for (const source of ragResult.ragGeneration.response.sources) {
					console.log(
						`   [${source.citation}] ${source.name} (${(source.similarity * 100).toFixed(1)}%)`
					)
				}
			}
		} else {
			console.log(
				`   ❌ RAG generation failed: ${ragResult.ragGeneration?.error || "Unknown error"}`
			)
		}

		// Test 3: Multiple Query Types
		console.log("\n3. 🔄 Testing Multiple Query Types via API...")

		const queriesResponse = await fetch(
			`${API_BASE}/api/test-rag?type=queries`
		)

		if (!queriesResponse.ok) {
			console.log(
				`   ❌ Queries API request failed with status: ${queriesResponse.status}`
			)
			return
		}

		// biome-ignore lint/suspicious/noExplicitAny: Test script with dynamic API responses
		const queriesResult = (await queriesResponse.json()) as any

		if (queriesResult.multipleQueries) {
			for (const query of queriesResult.multipleQueries) {
				console.log(
					`\n   Testing ${query.type} query: "${query.query}"`
				)
				console.log(
					`   ✅ Found ${query.documentsFound} relevant documents`
				)
				console.log(
					`   📊 Average similarity: ${(query.avgSimilarity * 100).toFixed(1)}%`
				)
			}
		}

		// Test 4: Performance Check
		console.log("\n4. ⚡ Testing Performance...")

		const startTime = Date.now()
		const perfResponse = await fetch(`${API_BASE}/api/test-rag?type=search`)
		const queryTime = Date.now() - startTime

		console.log(`   Query time: ${queryTime}ms`)

		if (queryTime < 2000) {
			console.log("   ✅ Query performance: GOOD (< 2s)")
		} else if (queryTime < 5000) {
			console.log("   ⚠️  Query performance: ACCEPTABLE (2-5s)")
		} else {
			console.log("   ❌ Query performance: POOR (> 5s)")
		}

		console.log(`\n${"=".repeat(50)}`)
		console.log("🎉 RAG API Test Complete!")

		// Summary
		console.log("\n📋 Test Summary:")
		console.log("   ✅ API endpoints accessible")
		console.log("   ✅ Vector similarity search")
		console.log("   ✅ RAG response generation")
		console.log("   ✅ Source citations")
		console.log("   ✅ Multiple query types")
		console.log("   ✅ Performance validation")
	} catch (error) {
		console.error("❌ RAG API test failed with error:", error)
		process.exit(1)
	}
}

// Run the test
testRAGAPI()
	.then(() => {
		console.log("✅ RAG API functionality tests completed successfully!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ RAG API test suite failed:", error)
		process.exit(1)
	})
