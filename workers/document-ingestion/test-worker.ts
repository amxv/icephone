import { DatabaseService } from "./src/services/DatabaseService"
// Simple test script for the document ingestion worker
import { DocumentIngestionService } from "./src/services/DocumentIngestionService"
import { EmbeddingService } from "./src/services/EmbeddingService"

async function testWorker() {
	console.log("🧪 Testing Document Ingestion Worker...")

	// Initialize services with actual development database
	const dbUrl =
		process.env.NEON_DATABASE_URL ||
		"postgresql://neondb_owner:PASSWORD@ep-blue-frog-a6npin6j-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require"
	const dbService = new DatabaseService(dbUrl)
	const embeddingService = new EmbeddingService("mock") // This will use mock embeddings
	const ingestionService = new DocumentIngestionService(
		dbService,
		embeddingService
	)

	// Test with sample text content
	const sampleText = `
    This is a sample document for testing the ingestion pipeline.
    It contains multiple paragraphs and should be properly chunked.

    The system should extract this text, split it into meaningful chunks,
    generate embeddings for each chunk, and prepare them for database insertion.

    This is particularly useful for testing the text extraction and chunking
    functionality without needing to parse complex PDFs or documents.
  `

	try {
		const result = await ingestionService.ingestDocument({
			sourceId: 1,
			sourceName: "test-document",
			sourceType: "txt_upload",
			fileContent: sampleText,
			processingOptions: {
				chunkSize: 100,
				chunkOverlap: 20,
				chunkingStrategy: "standard"
			},
			userId: "test-user"
		})

		console.log("✅ Ingestion test result:", {
			success: result.success,
			documentsCreated: result.documentsCreated,
			errors: result.errors,
			processingTime: result.processingTime,
			metadata: result.metadata
		})

		if (result.success) {
			console.log("🎉 Worker functionality verified!")
		} else {
			console.log("❌ Worker test failed:", result.errors)
		}
	} catch (error) {
		console.error("❌ Worker test error:", error)
	}
}

// Run the test
testWorker().catch(console.error)
