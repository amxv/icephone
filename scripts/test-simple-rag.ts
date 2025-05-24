#!/usr/bin/env bun

import { performAdvancedRAGQuery } from "../src/actions/knowledge-base"

async function testAdvancedRAG() {
	console.log("🚀 Testing Advanced RAG System")

	const testQueries = [
		"What are the main features of IcePhone?",
		"How does voice agent technology work?",
		"What CRM features are available?"
	]

	for (const query of testQueries) {
		console.log(`\n🔍 Testing: "${query}"`)

		try {
			const result = await performAdvancedRAGQuery(query, {
				limit: 3,
				threshold: 0.5,
				enableQueryRewriting: true,
				enableHyde: true,
				enableReranking: true
			})

			if (result.success) {
				console.log(
					`✅ Success: Found ${result.data?.length || 0} results`
				)
				console.log(
					`   Query type: ${result.metadata?.queryAnalysis?.queryType}`
				)
				console.log(
					`   Strategies: ${result.metadata?.strategiesUsed?.join(", ")}`
				)
			} else {
				console.log(`❌ Failed: ${result.error}`)
			}
		} catch (error) {
			console.log(`❌ Error: ${String(error)}`)
		}
	}

	console.log("\n✨ Test completed!")
}

testAdvancedRAG()
