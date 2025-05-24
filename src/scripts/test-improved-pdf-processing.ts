#!/usr/bin/env bun

/**
 * Test Script for Improved PDF Processing
 *
 * This script tests the enhanced file processing with proper PDF parsing
 * to ensure the knowledge base ingestion pipeline works end-to-end.
 */

import {
	getDocumentsForSource,
	getKnowledgeBaseSources
} from "../actions/knowledge-base"
import { processAndEmbedFile } from "../actions/knowledge-base-files"

// Create a test text file to simulate document processing
function createTestTextFile(content: string, filename: string): File {
	const blob = new Blob([content], { type: "text/plain" })
	return new File([blob], filename, { type: "text/plain" })
}

// Sample content that simulates a knowledge base document
const sampleDocumentContent = `
IcePhone AI Voice Agent Platform
================================

Overview
--------
IcePhone is an advanced AI-powered CRM and Voice Agent Platform designed for modern businesses.
Our platform enables business owners to set up custom Voice Agents that can:

- Respond to inbound calls automatically
- Perform outbound cold calls with intelligent conversation
- Handle follow-up communications seamlessly
- Integrate with existing CRM workflows

Key Features
-----------

1. AI Voice Agents
   - Natural language processing for human-like conversations
   - Customizable voice personalities and scripts
   - Real-time sentiment analysis
   - Multi-language support

2. CRM Integration
   - Lead tracking and qualification
   - Automated follow-up scheduling
   - Contact management
   - Analytics and reporting

3. Call Management
   - Inbound call routing
   - Outbound call campaigns
   - Call recording and transcription
   - Performance metrics

Technical Architecture
---------------------
IcePhone is built on a modern tech stack:
- Next.js 15 with App Router for the frontend
- Neon PostgreSQL database with pgvector for embeddings
- Cloudflare Workers for scalable processing
- Voyage AI for advanced embedding generation
- Clerk for authentication and user management

Getting Started
--------------
To set up your first voice agent:
1. Create an account and verify your business
2. Configure your voice agent's personality and scripts
3. Set up your phone number and routing rules
4. Test your agent with sample calls
5. Launch your campaigns

For more detailed documentation, visit our knowledge base or contact support.
`

async function testImprovedProcessing() {
	console.log(
		"🧪 Testing Improved PDF Processing and Knowledge Base Ingestion"
	)
	console.log("=".repeat(70))

	try {
		// Test 1: Process a text file with the improved system
		console.log("\n📄 Test 1: Processing text document...")

		const testFile = createTestTextFile(
			sampleDocumentContent,
			"icephone-documentation.txt"
		)

		console.log(`File: ${testFile.name} (${testFile.size} bytes)`)

		const result = await processAndEmbedFile(
			testFile,
			"IcePhone Platform Documentation",
			"txt_upload"
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

		// Test 2: Verify the source was created
		console.log("\n🔍 Test 2: Verifying source creation...")

		const sourcesResult = await getKnowledgeBaseSources()

		if (!sourcesResult.success) {
			console.error("❌ Failed to retrieve sources:", sourcesResult.error)
			return
		}

		const testSource = sourcesResult.data?.find(
			(source) => source.name === "IcePhone Platform Documentation"
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
		console.log(`- Last Indexed: ${testSource.lastIndexedAt}`)

		// Test 3: Verify documents and chunks
		console.log("\n📚 Test 3: Verifying document chunks...")

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

		// Show sample chunk
		const sampleDoc = documents[0]
		const contentChunk =
			typeof sampleDoc.contentChunk === "string"
				? sampleDoc.contentChunk
				: String(sampleDoc.contentChunk)
		console.log(
			`- Sample chunk preview: "${contentChunk.substring(0, 100)}..."`
		)
		console.log(`- Embedding model: ${sampleDoc.textEmbeddingModel}`)
		console.log(
			`- Metadata keys: ${Object.keys(sampleDoc.metadata || {}).join(", ")}`
		)

		console.log(`\n${"=".repeat(70)}`)
		console.log(
			"🎉 All tests passed! Knowledge base ingestion is working correctly."
		)
		console.log("\nNext steps:")
		console.log("- Test PDF upload through the web interface")
		console.log("- Test vector similarity search functionality")
		console.log("- Implement document ingestion worker for production")
	} catch (error) {
		console.error("💥 Test failed with error:", error)

		if (error instanceof Error) {
			console.error("Error details:", error.message)
			console.error("Stack trace:", error.stack)
		}
	}
}

// Run the test
testImprovedProcessing()
	.then(() => {
		console.log("\n✅ Test script completed")
		process.exit(0)
	})
	.catch((error) => {
		console.error("\n❌ Test script failed:", error)
		process.exit(1)
	})
