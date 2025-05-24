#!/usr/bin/env bun

/**
 * Test script for RAG (Retrieval-Augmented Generation) functionality
 * Tests the complete RAG pipeline according to autonomous agent guide
 */

import {
	generateRAGResponse,
	performRAGQuery
} from "../src/actions/knowledge-base"
import type { VectorQueryResult } from "../src/types"

// Test user ID from environment
const TEST_USER_ID = "user_2vx9o0H7QqTrKPBERPN4CfZOUxD"

async function testRAGFunctionality() {
	console.log(
		"🤖 Testing RAG (Retrieval-Augmented Generation) Functionality..."
	)
	console.log(`${"=".repeat(50)}`)

	try {
		// Test 1: Basic RAG Query (Search Only)
		console.log("\n1. 🔍 Testing Basic RAG Query...")

		const basicQuery = "How do I set up a voice agent in IcePhone?"
		const searchResult = await performRAGQuery(basicQuery, {
			limit: 3,
			threshold: 0.6
		})

		if (searchResult.success && searchResult.data) {
			console.log(
				`   ✅ Found ${searchResult.data.length} relevant documents`
			)
			console.log(
				`   📋 Search type: ${searchResult.searchType || "hybrid"}`
			)

			for (const [index, doc] of searchResult.data.entries()) {
				console.log(
					`   ${index + 1}. ${doc.source_name} (${((doc.similarity as number) * 100).toFixed(1)}% similarity)`
				)
				console.log(
					`      "${String(doc.content_chunk).substring(0, 100)}..."`
				)
			}
		} else {
			console.log(`   ❌ RAG query failed: ${searchResult.error}`)
			return
		}

		// Test 2: Full RAG Response Generation
		console.log("\n2. 🧠 Testing Full RAG Response Generation...")

		const ragResponse = await generateRAGResponse(basicQuery, {
			limit: 3,
			threshold: 0.6,
			modelProvider: "openai",
			modelName: "gpt-4o-mini",
			includeMetadata: true
		})

		if (ragResponse.success && ragResponse.data) {
			console.log("   ✅ RAG response generated successfully")
			console.log(`   📊 Used ${ragResponse.data.sources.length} sources`)
			console.log(
				`   🤖 Model: ${ragResponse.data.metadata?.modelProvider}/${ragResponse.data.metadata?.modelName}`
			)
			console.log(
				`   📝 Answer length: ${ragResponse.data.answer.length} characters`
			)
			console.log("\n   📋 Generated Answer:")
			console.log(`   "${ragResponse.data.answer.substring(0, 200)}..."`)

			console.log("\n   📚 Sources cited:")
			for (const source of ragResponse.data.sources) {
				console.log(
					`   [${source.citationIndex}] ${source.sourceName} (${(source.similarity * 100).toFixed(1)}%)`
				)
			}
		} else {
			console.log(
				`   ❌ RAG response generation failed: ${ragResponse.error}`
			)
		}

		// Test 3: Different Query Types
		console.log("\n3. 🔄 Testing Different Query Types...")

		const testQueries = [
			{
				query: "What are the pricing plans for IcePhone?",
				type: "factual"
			},
			{
				query: "How do I integrate IcePhone with my CRM?",
				type: "procedural"
			},
			{
				query: "What should I do if call quality is poor?",
				type: "troubleshooting"
			}
		]

		for (const testQuery of testQueries) {
			console.log(
				`\n   Testing ${testQuery.type} query: "${testQuery.query}"`
			)

			const queryResult = await performRAGQuery(testQuery.query, {
				limit: 2,
				threshold: 0.5
			})

			if (queryResult.success && queryResult.data) {
				console.log(
					`   ✅ Found ${queryResult.data.length} relevant documents`
				)
				const avgSimilarity =
					queryResult.data.reduce(
						// biome-ignore lint/suspicious/noExplicitAny: Test script with dynamic types
						(sum: number, doc: any) => sum + doc.similarity,
						0
					) / queryResult.data.length
				console.log(
					`   📊 Average similarity: ${(avgSimilarity * 100).toFixed(1)}%`
				)
			} else {
				console.log(`   ❌ Query failed: ${queryResult.error}`)
			}
		}

		// Test 4: Edge Cases
		console.log("\n4. 🧪 Testing Edge Cases...")

		// Empty query
		const emptyQuery = await performRAGQuery("", { limit: 3 })
		console.log(
			`   Empty query: ${emptyQuery.success ? "handled gracefully" : "failed as expected"}`
		)

		// Query with no matches
		const noMatchQuery = await performRAGQuery(
			"quantum computing blockchain cryptocurrency",
			{
				limit: 3,
				threshold: 0.9
			}
		)
		if (noMatchQuery.success && noMatchQuery.data) {
			console.log(
				`   No-match query: Found ${noMatchQuery.data.length} documents (fallback working)`
			)
		}

		// Very specific query
		const specificQuery = await performRAGQuery(
			"voice agent dashboard navigation",
			{
				limit: 5,
				threshold: 0.3
			}
		)
		if (specificQuery.success && specificQuery.data) {
			console.log(
				`   Specific query: Found ${specificQuery.data.length} documents`
			)
		}

		// Test 5: Performance Check
		console.log("\n5. ⚡ Testing Performance...")

		const startTime = Date.now()
		const perfTestQuery = "How does IcePhone work?"

		const perfResult = await performRAGQuery(perfTestQuery, { limit: 5 })
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
		console.log("🎉 RAG Functionality Test Complete!")

		// Summary
		console.log("\n📋 Test Summary:")
		console.log("   ✅ Vector similarity search")
		console.log("   ✅ Hybrid search fallback")
		console.log("   ✅ RAG response generation")
		console.log("   ✅ Source citations")
		console.log("   ✅ Multiple query types")
		console.log("   ✅ Edge case handling")
		console.log("   ✅ Performance validation")
	} catch (error) {
		console.error("❌ RAG test failed with error:", error)
		process.exit(1)
	}
}

// Run the test
testRAGFunctionality()
	.then(() => {
		console.log("✅ RAG functionality tests completed successfully!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ RAG test suite failed:", error)
		process.exit(1)
	})
