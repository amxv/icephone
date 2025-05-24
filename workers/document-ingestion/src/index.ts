import { Hono } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { DatabaseService } from "./services/DatabaseService"
import { DocumentIngestionService } from "./services/DocumentIngestionService"
import { EmbeddingService } from "./services/EmbeddingService"

export interface Env {
	// Database
	NEON_DATABASE_URL: string

	// AI Services
	VOYAGE_API_KEY: string
	OPENAI_API_KEY: string

	// Authentication
	INGESTION_WORKER_AUTH_TOKEN: string

	// Storage
	DOCUMENTS_R2_BUCKET?: R2Bucket

	// KV for caching
	EMBEDDINGS_CACHE?: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use("*", logger())
app.use(
	"*",
	cors({
		origin: ["http://localhost:3000", "https://icephone.com"],
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"]
	})
)

// Health check
app.get("/health", (c) => {
	return c.json({ status: "healthy", timestamp: new Date().toISOString() })
})

// Authentication middleware for protected routes
app.use("/api/*", async (c, next) => {
	const authHeader = c.req.header("Authorization")
	const expectedToken = c.env.INGESTION_WORKER_AUTH_TOKEN

	if (!authHeader || !expectedToken) {
		return c.json({ error: "Unauthorized" }, 401)
	}

	const token = authHeader.replace("Bearer ", "")
	if (token !== expectedToken) {
		return c.json({ error: "Invalid token" }, 401)
	}

	await next()
})

// Document ingestion endpoint
app.post("/api/ingest", async (c) => {
	try {
		const body = await c.req.json()
		const {
			sourceId,
			sourceName,
			sourceType,
			fileContent,
			processingOptions,
			userId
		} = body

		// Validate required fields
		if (!sourceId || !sourceName || !fileContent || !userId) {
			return c.json(
				{
					error: "Missing required fields: sourceId, sourceName, fileContent, userId"
				},
				400
			)
		}

		// Initialize services
		const dbService = new DatabaseService(c.env.NEON_DATABASE_URL)
		const embeddingService = new EmbeddingService(c.env.VOYAGE_API_KEY)
		const ingestionService = new DocumentIngestionService(
			dbService,
			embeddingService
		)

		// Process the document
		const result = await ingestionService.ingestDocument({
			sourceId,
			sourceName,
			sourceType: sourceType || "unknown",
			fileContent,
			processingOptions: processingOptions || {},
			userId
		})

		return c.json(result)
	} catch (error) {
		console.error("Ingestion error:", error)
		return c.json(
			{
				error: "Internal server error",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			500
		)
	}
})

// Batch ingestion endpoint
app.post("/api/ingest/batch", async (c) => {
	try {
		const body = await c.req.json()
		const { documents, userId } = body

		if (!Array.isArray(documents) || !userId) {
			return c.json(
				{
					error: "Invalid request: documents must be array and userId required"
				},
				400
			)
		}

		// Initialize services
		const dbService = new DatabaseService(c.env.NEON_DATABASE_URL)
		const embeddingService = new EmbeddingService(c.env.VOYAGE_API_KEY)
		const ingestionService = new DocumentIngestionService(
			dbService,
			embeddingService
		)

		// Process documents in parallel (with concurrency limit)
		const results = await ingestionService.ingestBatch(documents, userId)

		return c.json({
			success: true,
			processed: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			results
		})
	} catch (error) {
		console.error("Batch ingestion error:", error)
		return c.json(
			{
				error: "Internal server error",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			500
		)
	}
})

// Query processing status
app.get("/api/status/:jobId", async (c) => {
	const jobId = c.req.param("jobId")

	// For now, return a simple status (can be enhanced with KV storage later)
	return c.json({
		jobId,
		status: "completed", // This would be dynamic in a real implementation
		message: "Document processing completed"
	})
})

export default app
