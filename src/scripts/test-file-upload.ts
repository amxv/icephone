import { sql } from "drizzle-orm"
import {
	getDocumentsForSource,
	getKnowledgeBaseSources
} from "../actions/knowledge-base"
/**
 * Test File Upload Functionality
 *
 * This script tests the file upload and processing system to ensure it works
 * end-to-end with real database operations.
 */
import { processAndEmbedFile } from "../actions/knowledge-base-files"
import { db } from "../db/db"

// Simulate a test file
function createTestFile(content: string, filename: string): File {
	const blob = new Blob([content], { type: "text/plain" })
	return new File([blob], filename, { type: "text/plain" })
}

async function testFileUpload() {
	console.log("🧪 Testing File Upload and Processing")
	console.log("------------------------------------")

	try {
		// Clean up any previous test data
		console.log("Step 1: Cleaning up previous test data...")
		await db.execute(
			sql`DELETE FROM knowledge_base_documents WHERE metadata->>'fileName' LIKE 'test-%'`
		)
		await db.execute(
			sql`DELETE FROM knowledge_base_sources WHERE name LIKE 'test-%'`
		)
		console.log("✅ Cleanup completed")

		// Create a test document
		const testContent = `
		IcePhone is a revolutionary AI-powered CRM and Voice Agent Platform designed specifically for modern businesses.

		Our platform enables business owners to set up custom Voice Agents that can autonomously handle:
		- Inbound customer calls with intelligent response capabilities
		- Outbound cold calling campaigns with personalized messaging
		- Automated follow-up communications based on customer interactions
		- Lead qualification and scoring through AI-driven conversations

		Key Features:
		1. AI Voice Agents: Advanced conversational AI that understands context and intent
		2. CRM Integration: Complete customer relationship management with lead tracking
		3. Analytics Dashboard: Real-time insights into call performance and conversion rates
		4. Automated Workflows: Smart automation for lead nurturing and follow-ups
		5. Multi-channel Communication: Voice, SMS, and email integration

		The platform uses cutting-edge technology including:
		- Natural Language Processing for conversation understanding
		- Machine Learning for continuous improvement of responses
		- Cloud-based infrastructure for scalability and reliability
		- Integration APIs for seamless workflow automation

		IcePhone is perfect for sales teams, customer service departments, and any business looking to enhance their customer communication strategy.
		`

		const testFile = createTestFile(
			testContent.trim(),
			"test-icephone-docs.txt"
		)

		console.log("Step 2: Processing test file...")
		console.log(`File: ${testFile.name} (${testFile.size} bytes)`)

		// Note: This will use simulated user context since we're running outside Next.js
		// In a real scenario, this would run within the authenticated context
		const result = await processAndEmbedFile(
			testFile,
			"IcePhone Documentation Test"
		)

		if (!result.success) {
			console.error("❌ File processing failed:", result.error)
			return
		}

		console.log("✅ File processed successfully!")
		console.log(`- Source ID: ${result.sourceId}`)
		console.log(`- Chunks created: ${result.chunkCount}`)
		if (result.failedChunks && result.failedChunks > 0) {
			console.log(`- Failed chunks: ${result.failedChunks}`)
		}

		// Verify the source was created
		console.log("\nStep 3: Verifying source creation...")
		const sourcesResult = await getKnowledgeBaseSources()

		if (!sourcesResult.success) {
			console.error("❌ Failed to retrieve sources:", sourcesResult.error)
			return
		}

		const testSource = sourcesResult.data?.find(
			(source) => source.name === "IcePhone Documentation Test"
		)

		if (!testSource) {
			console.error("❌ Test source not found in database")
			return
		}

		console.log("✅ Source verified in database")
		console.log(`- ID: ${testSource.id}`)
		console.log(`- Name: ${testSource.name}`)
		console.log(`- Type: ${testSource.type}`)
		console.log(`- URI: ${testSource.uri}`)

		// Verify documents were created
		console.log("\nStep 4: Verifying document chunks...")
		const documentsResult = await getDocumentsForSource(testSource.id)

		if (!documentsResult.success) {
			console.error(
				"❌ Failed to retrieve documents:",
				documentsResult.error
			)
			return
		}

		const documents = documentsResult.data
		if (!documents || !Array.isArray(documents) || documents.length === 0) {
			console.error("❌ No documents found for source")
			return
		}

		console.log("✅ Documents verified in database")
		console.log(`- Total chunks: ${documents.length}`)

		// Display sample chunks
		console.log("\nSample chunks:")
		documents
			.slice(0, 3)
			.forEach((doc: Record<string, unknown>, index: number) => {
				const contentChunk = doc.content_chunk as string
				console.log(
					`  ${index + 1}. ${contentChunk?.substring(0, 100)}...`
				)
			})

		// Test basic search functionality by checking if we can query similar content
		console.log("\nStep 5: Testing search readiness...")

		// Verify vector embeddings exist
		const vectorCheck = await db.execute(sql`
			SELECT id, content_chunk,
				   array_length(text_embedding, 1) as embedding_dimensions
			FROM knowledge_base_documents
			WHERE source_id = ${testSource.id}
			LIMIT 3
		`)

		if (!vectorCheck.rows || vectorCheck.rows.length === 0) {
			console.error("❌ No vector embeddings found")
			return
		}

		console.log("✅ Vector embeddings verified")
		vectorCheck.rows.forEach(
			(row: Record<string, unknown>, index: number) => {
				console.log(
					`  Chunk ${index + 1}: ${row.embedding_dimensions} dimensions`
				)
			}
		)

		// Clean up test data
		console.log("\nStep 6: Cleaning up test data...")
		await db.execute(
			sql`DELETE FROM knowledge_base_documents WHERE source_id = ${testSource.id}`
		)
		await db.execute(
			sql`DELETE FROM knowledge_base_sources WHERE id = ${testSource.id}`
		)
		console.log("✅ Test data cleaned up")

		console.log("\n🎉 File upload test completed successfully!")
		console.log("\n📋 Summary:")
		console.log("- File processing: ✅ Working")
		console.log("- Source creation: ✅ Working")
		console.log("- Document chunking: ✅ Working")
		console.log("- Vector embeddings: ✅ Working")
		console.log("- Database storage: ✅ Working")
	} catch (error) {
		console.error("❌ Test failed with error:", error)
		// Try to clean up on error
		try {
			await db.execute(
				sql`DELETE FROM knowledge_base_documents WHERE metadata->>'fileName' LIKE 'test-%'`
			)
			await db.execute(
				sql`DELETE FROM knowledge_base_sources WHERE name LIKE 'test-%'`
			)
		} catch (cleanupError) {
			console.error("Failed to cleanup after error:", cleanupError)
		}
	}
}

// Run the test
testFileUpload().catch(console.error)
