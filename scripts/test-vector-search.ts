#!/usr/bin/env bun

/**
 * Test script for vector search functionality
 * Tests the database vector search without authentication
 */

import { sql } from "drizzle-orm"
import { db } from "../src/db/db"

// Test user ID from environment
const TEST_USER_ID = "user_2vx9o0H7QqTrKPBERPN4CfZOUxD"

async function testVectorSearch() {
	console.log("🔍 Testing Vector Search Functionality...")
	console.log("=".repeat(50))

	try {
		// Test 1: Check if we have documents with embeddings
		console.log("\n1. 📊 Checking Vector Data...")

		const documentsQuery = await db.execute(sql`
			SELECT
				COUNT(*) as total_docs,
				COUNT(CASE WHEN text_embedding IS NOT NULL THEN 1 END) as docs_with_embeddings
			FROM knowledge_base_documents
			WHERE user_id = ${TEST_USER_ID}
		`)

		const stats = documentsQuery.rows[0]
		console.log(`   ✅ Total documents: ${stats.total_docs}`)
		console.log(
			`   ✅ Documents with embeddings: ${stats.docs_with_embeddings}`
		)

		if (Number(stats.docs_with_embeddings) === 0) {
			console.log("   ⚠️  No documents with embeddings found.")
			return
		}

		// Test 2: Test vector similarity search with a mock embedding
		console.log("\n2. 🧮 Testing Vector Similarity Search...")

		// Create a mock embedding vector (1024 dimensions for Voyage AI embeddings)
		const mockEmbedding = Array(1024)
			.fill(0)
			.map(() => Math.random() * 0.1)
		const vectorValues = mockEmbedding.join(",")

		const similarityQuery = await db.execute(sql`
			SELECT
				kd.id,
				kd.content_chunk,
				ks.name as source_name,
				ks.type as source_type,
				1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) as similarity
			FROM
				knowledge_base_documents kd
			JOIN
				knowledge_base_sources ks ON kd.source_id = ks.id
			WHERE
				kd.user_id = ${TEST_USER_ID}
				AND kd.text_embedding IS NOT NULL
			ORDER BY
				similarity DESC
			LIMIT 3
		`)

		console.log(
			`   ✅ Found ${similarityQuery.rows.length} similar documents`
		)
		similarityQuery.rows.forEach((doc, index) => {
			console.log(
				`   ${index + 1}. ${doc.source_name} (${(Number(doc.similarity) * 100).toFixed(1)}% similarity)`
			)
			console.log(
				`      "${String(doc.content_chunk).substring(0, 100)}..."`
			)
		})

		// Test 3: Test text search fallback
		console.log("\n3. 📝 Testing Text Search Fallback...")

		const textQuery = await db.execute(sql`
			SELECT
				kd.id,
				kd.content_chunk,
				ks.name as source_name,
				ks.type as source_type
			FROM
				knowledge_base_documents kd
			JOIN
				knowledge_base_sources ks ON kd.source_id = ks.id
			WHERE
				kd.user_id = ${TEST_USER_ID}
				AND (
					kd.content_chunk ILIKE ${"%IcePhone%"}
					OR ks.name ILIKE ${"%IcePhone%"}
				)
			LIMIT 3
		`)

		console.log(
			`   ✅ Found ${textQuery.rows.length} documents with text search`
		)
		textQuery.rows.forEach((doc, index) => {
			console.log(`   ${index + 1}. ${doc.source_name}`)
			console.log(
				`      "${String(doc.content_chunk).substring(0, 100)}..."`
			)
		})

		// Test 4: Test pgvector extension
		console.log("\n4. 🔧 Testing pgvector Extension...")

		const extensionQuery = await db.execute(sql`
			SELECT extname, extversion
			FROM pg_extension
			WHERE extname = 'vector'
		`)

		if (extensionQuery.rows.length > 0) {
			console.log(
				`   ✅ pgvector extension installed (version: ${extensionQuery.rows[0].extversion})`
			)
		} else {
			console.log("   ❌ pgvector extension not found")
		}

		// Test 5: Check vector index
		console.log("\n5. 📈 Testing Vector Index...")

		const indexQuery = await db.execute(sql`
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE tablename = 'knowledge_base_documents'
			AND indexname LIKE '%embedding%'
		`)

		if (indexQuery.rows.length > 0) {
			console.log(
				`   ✅ Vector index found: ${indexQuery.rows[0].indexname}`
			)
		} else {
			console.log("   ⚠️  No vector index found (may impact performance)")
		}

		console.log(`\n${"=".repeat(50)}`)
		console.log("🎉 Vector Search Test Complete!")
	} catch (error) {
		console.error("❌ Test failed with error:", error)
		process.exit(1)
	}
}

// Run the test
testVectorSearch()
	.then(() => {
		console.log("✅ Vector search tests completed successfully!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ Test suite failed:", error)
		process.exit(1)
	})
