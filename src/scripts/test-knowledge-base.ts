import { sql } from "drizzle-orm"
import { eq } from "drizzle-orm"
/**
 * Knowledge Base Test Script
 *
 * This script tests the knowledge base implementation using direct database access
 * since we're running outside of the Next.js context where Clerk authentication
 * would normally be available.
 */
import { db } from "../db/db"
import { knowledgeBaseDocuments, knowledgeBaseSources } from "../db/schema"

// Test user ID for records
const TEST_USER_ID = "test_user_123"

// Helper function to safely check array results
function safeArrayLength(result: unknown): number {
	if (!result) return 0
	if (Array.isArray(result)) return result.length
	// Handle Neon QueryResult
	if (result && typeof result === "object" && "rows" in result) {
		const rows = (result as { rows: unknown[] }).rows
		return Array.isArray(rows) ? rows.length : 0
	}
	return 0
}

// Helper function to safely get the first row of results
function safeGetFirstRow(result: unknown): Record<string, unknown> | null {
	if (!result) return null
	if (Array.isArray(result) && result.length > 0)
		return result[0] as Record<string, unknown>
	// Handle Neon QueryResult
	if (result && typeof result === "object" && "rows" in result) {
		const rows = (result as { rows: unknown[] }).rows
		if (Array.isArray(rows) && rows.length > 0)
			return rows[0] as Record<string, unknown>
	}
	return null
}

async function testKnowledgeBaseOperations() {
	console.log("🧪 Starting Knowledge Base Test with Server Actions")
	console.log("------------------------------------------")

	try {
		// Step 1: Verify pgvector extension is available
		console.log("Step 1: Verifying pgvector extension...")

		try {
			// Create pgvector extension if it doesn't exist
			await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)

			// Verify extension is available
			const extensionCheck = await db.execute(
				sql`SELECT extname FROM pg_extension WHERE extname = 'vector';`
			)
			const extensionExists = safeArrayLength(extensionCheck) > 0

			if (!extensionExists) {
				throw new Error("Vector extension not available")
			}

			console.log("✅ PgVector extension is available")
		} catch (error) {
			console.error("Error verifying pgvector:", error)
			throw error
		}

		// Step 2: Clean up any previous test data
		console.log("\nStep 2: Cleaning up previous test data...")
		await db.execute(
			sql`DELETE FROM knowledge_base_documents WHERE metadata->>'test' = 'true'`
		)
		await db.execute(
			sql`DELETE FROM knowledge_base_sources WHERE name = 'Test Source'`
		)
		console.log("✅ Cleanup successful")

		// Step 3: Create a test knowledge base source
		console.log("\nStep 3: Creating test knowledge base source...")

		// Create source directly using Drizzle
		const [createdSource] = await db
			.insert(knowledgeBaseSources)
			.values({
				name: "Test Source",
				type: "txt_upload",
				uri: "test-document.txt",
				userId: TEST_USER_ID
			})
			.returning()

		if (!createdSource || !createdSource.id) {
			throw new Error("Failed to create source")
		}

		const sourceId = createdSource.id
		console.log(`✅ Created source with ID: ${sourceId}`)

		// Step 4: Create test embeddings and insert documents
		console.log(
			"\nStep 4: Creating and inserting test documents with embeddings..."
		)

		// Create 3 different test embeddings (1024 dimensions for Voyage-3.5)
		const embedding1 = Array.from(
			{ length: 1024 },
			() => Math.random() * 2 - 1
		)
		const embedding2 = Array.from(
			{ length: 1024 },
			() => Math.random() * 2 - 1
		)
		const embedding3 = Array.from(
			{ length: 1024 },
			() => Math.random() * 2 - 1
		)

		// Insert documents using direct SQL since Drizzle doesn't handle pgvector natively
		const insertDocument = async (
			content: string,
			embedding: number[],
			metadata: Record<string, unknown>
		) => {
			try {
				// Log out what we're doing
				console.log(
					`Inserting document: ${content.substring(0, 20)}... with embedding array of length ${embedding.length}`
				)

				// Format the vector data correctly
				const vectorValues = embedding.join(",")

				// Insert with explicit cast to vector type
				const result = await db.execute(sql`
          INSERT INTO knowledge_base_documents
          (source_id, content_chunk, text_embedding_model, text_embedding, metadata, user_id)
          VALUES
          (${sourceId},
           ${content},
           ${"test-model"},
           ${sql.raw(`'[${vectorValues}]'::vector`)},
           ${JSON.stringify(metadata)},
           ${TEST_USER_ID})
          RETURNING id, source_id, content_chunk
        `)

				// Check if we got a result back
				const insertedRow = safeGetFirstRow(result)
				if (!insertedRow) {
					console.error("No row returned from insertion")
					return null
				}

				console.log(
					`Successfully inserted document with ID: ${insertedRow.id}`
				)
				return insertedRow
			} catch (error) {
				console.error("Error inserting document:", error)
				return null
			}
		}

		// Insert the documents
		const doc1 = await insertDocument(
			"IcePhone is an AI-powered CRM platform for managing customer calls.",
			embedding1,
			{ test: true, page: 1 }
		)

		const doc2 = await insertDocument(
			"The platform uses voice agents to handle inbound and outbound calls.",
			embedding2,
			{ test: true, page: 2 }
		)

		const doc3 = await insertDocument(
			"IcePhone provides lead tracking and qualification features.",
			embedding3,
			{ test: true, page: 3 }
		)

		if (!doc1 || !doc2 || !doc3) {
			throw new Error("Failed to insert all documents")
		}

		console.log("✅ Successfully inserted 3 test documents")

		// Step 5: Retrieve source and documents
		console.log("\nStep 5: Verifying source and documents retrieval...")

		// Get sources directly
		const sources = await db
			.select()
			.from(knowledgeBaseSources)
			.where(eq(knowledgeBaseSources.userId, TEST_USER_ID))

		const foundSource = sources.find(
			(s) => s.name === "Test Source" && s.id === sourceId
		)
		if (!foundSource) {
			throw new Error("Test source not found in retrieved sources")
		}

		console.log("✅ Successfully retrieved sources")

		// Get documents for source directly
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
        AND user_id = ${TEST_USER_ID}
      ORDER BY
        created_at DESC
    `)

		const documentsCount = safeArrayLength(documents)
		if (documentsCount !== 3) {
			throw new Error(`Expected 3 documents, found ${documentsCount}`)
		}

		console.log("✅ Successfully retrieved documents for source")

		// Step 6: Test vector similarity search
		console.log("\nStep 6: Testing vector similarity search...")

		// Query for similar documents directly
		// Convert embedding array to PostgreSQL format
		const vectorValues = embedding1.join(",")

		// Query for similar documents
		const similarDocs = await db.execute(sql`
      SELECT
        kd.id,
        kd.source_id,
        kd.content_chunk,
        kd.metadata,
        1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) as similarity
      FROM
        knowledge_base_documents kd
      WHERE
        kd.user_id = ${TEST_USER_ID}
        AND 1 - (kd.text_embedding <=> ${sql.raw(`'[${vectorValues}]'::vector`)}) > 0.5
      ORDER BY
        similarity DESC
      LIMIT 3
    `)

		if (safeArrayLength(similarDocs) === 0) {
			throw new Error("No similar documents found")
		}

		// The first document should be the most similar (since we used its embedding)
		const similarDocsCount = safeArrayLength(similarDocs)
		const firstDoc = safeGetFirstRow(similarDocs)

		console.log(`Found ${similarDocsCount} similar documents`)
		if (firstDoc) {
			console.log(`Top result similarity: ${firstDoc.similarity}`)
		}

		// Verify if the top result has the highest similarity
		if (
			!firstDoc ||
			typeof firstDoc.similarity !== "number" ||
			firstDoc.similarity < 0.9
		) {
			throw new Error("Expected top result to have similarity > 0.9")
		}

		console.log("✅ Vector similarity search working correctly")

		// Step 7: Clean up test data
		console.log("\nStep 7: Cleaning up test data...")

		// Delete source directly (should cascade delete documents)
		await db
			.delete(knowledgeBaseSources)
			.where(eq(knowledgeBaseSources.id, sourceId))

		console.log("✅ Successfully deleted source")

		// Step 8: Verify deletion
		const sourcesAfterDelete = await db
			.select()
			.from(knowledgeBaseSources)
			.where(eq(knowledgeBaseSources.id, sourceId))

		if (sourcesAfterDelete.length > 0) {
			throw new Error("Source was not properly deleted")
		}

		// Check if documents were cascade deleted
		const documentCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM knowledge_base_documents
      WHERE source_id = ${sourceId}
    `)

		const countRow = safeGetFirstRow(documentCount)
		if (!countRow || Number.parseInt(String(countRow.count || "0")) > 0) {
			throw new Error("Documents were not cascade deleted")
		}

		console.log("✅ Verified deletion of source and associated documents")

		console.log("\n🎉 All tests passed successfully!")
		return true
	} catch (error) {
		console.error("\n❌ Test failed:", error)
		return false
	} finally {
		// Extra cleanup in case anything failed
		try {
			await db.execute(
				sql`DELETE FROM knowledge_base_documents WHERE metadata->>'test' = 'true'`
			)
			await db.execute(
				sql`DELETE FROM knowledge_base_sources WHERE name = 'Test Source'`
			)
		} catch (cleanupError) {
			console.error("Error during cleanup:", cleanupError)
		}
	}
}

// Execute test
testKnowledgeBaseOperations().then((success) => {
	if (!success) {
		process.exit(1)
	}
	process.exit(0)
})
