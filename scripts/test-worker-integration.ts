#!/usr/bin/env bun

/**
 * Test script for Document Ingestion Worker Integration
 *
 * This script tests:
 * 1. Worker action integration
 * 2. Fallback to local processing
 * 3. End-to-end document processing
 */

import { processAndEmbedFileWithWorker } from "../src/actions/knowledge-base-worker"

// Mock File for testing
function createTestFile(content: string, filename: string): File {
	const blob = new Blob([content], { type: "text/plain" })
	return new File([blob], filename, { type: "text/plain" })
}

async function testWorkerIntegration() {
	console.log("🧪 Testing Document Ingestion Worker Integration")
	console.log("=".repeat(50))

	// Create test document
	const testContent = `
IcePhone Worker Test Document

This is a test document to verify the document ingestion worker system.
The worker should process this content, chunk it appropriately, generate
embeddings, and store it in the knowledge base.

Key features being tested:
1. Document chunking and processing
2. Embedding generation (with fallback)
3. Database storage with user isolation
4. Worker integration with fallback to local processing

This test validates that the complete pipeline works end-to-end.
`

	const testFile = createTestFile(testContent.trim(), "worker-test-doc.txt")

	try {
		console.log("\n📤 Processing test document...")
		console.log(`File: ${testFile.name} (${testFile.size} bytes)`)

		const startTime = Date.now()

		// Test the worker integration
		const result = await processAndEmbedFileWithWorker(
			testFile,
			"Worker Integration Test Document"
		)

		const processingTime = Date.now() - startTime

		console.log(`\n⏱️  Processing completed in ${processingTime}ms`)

		if (result.success) {
			console.log("✅ Document processed successfully!")
			console.log(`- Source ID: ${result.sourceId}`)
			console.log(`- Chunks created: ${result.chunkCount}`)
			if (result.failedChunks && result.failedChunks > 0) {
				console.log(`- Failed chunks: ${result.failedChunks}`)
			}
			if (result.message) {
				console.log(`- Message: ${result.message}`)
			}
		} else {
			console.error("❌ Document processing failed!")
			console.error(`- Error: ${result.error}`)
		}

		// Test summary
		console.log("\n📋 Test Summary:")
		console.log(
			`- Worker integration: ${result.success ? "✅ Working" : "❌ Failed"}`
		)
		console.log(
			`- Processing method: ${result.message?.includes("worker") ? "Worker" : "Local fallback"}`
		)
		console.log(
			`- Performance: ${processingTime < 10000 ? "✅ Good" : "⚠️  Slow"} (${processingTime}ms)`
		)
	} catch (error) {
		console.error("💥 Test failed with exception:")
		console.error(error)
	}
}

// Run the test
testWorkerIntegration()
	.then(() => {
		console.log("\n🎉 Worker integration test completed!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("\n💥 Worker integration test failed:")
		console.error(error)
		process.exit(1)
	})
