import { neon } from "@neondatabase/serverless"
import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"

// Define simplified schema types for the worker
export interface KnowledgeBaseSource {
	id: number
	name: string
	type: string
	uri: string
	userId: string
	lastIndexedAt?: Date | null
	createdAt: Date
	updatedAt: Date
}

export interface KnowledgeBaseDocument {
	id: number
	sourceId: number | null
	contentChunk: string
	chunkType: string
	textEmbeddingModel: string
	textEmbedding: number[]
	metadata: Record<string, unknown>
	userId: string
	createdAt: Date
	updatedAt: Date
}

export interface DocumentInsertRequest {
	sourceId: number
	contentChunk: string
	chunkType?: string
	textEmbeddingModel: string
	textEmbedding: number[]
	metadata?: Record<string, unknown>
	userId: string
}

export class DatabaseService {
	private db: ReturnType<typeof drizzle>

	constructor(databaseUrl: string) {
		const sql = neon(databaseUrl)
		this.db = drizzle(sql)
	}

	async insertDocument(
		document: DocumentInsertRequest
	): Promise<{ success: boolean; id?: number; error?: string }> {
		try {
			// Convert embedding array to PostgreSQL vector format
			const vectorValues = document.textEmbedding.join(",")

			// Use raw SQL for vector insertion since we don't have full schema access
			const result = await this.db.execute(sql`
          INSERT INTO knowledge_base_documents
          (source_id, content_chunk, chunk_type, text_embedding_model, text_embedding, metadata, user_id, created_at, updated_at)
          VALUES
          (${document.sourceId}, ${document.contentChunk}, ${document.chunkType || "text"}, ${document.textEmbeddingModel}, ${`[${vectorValues}]`}::vector, ${JSON.stringify(document.metadata || {})}, ${document.userId}, NOW(), NOW())
          RETURNING id
        `)

			if (result.rows && result.rows.length > 0) {
				return {
					success: true,
					id: result.rows[0].id as number
				}
			}

			return {
				success: false,
				error: "No rows returned from insert"
			}
		} catch (error) {
			console.error("Database insert error:", error)
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Unknown database error"
			}
		}
	}

	async updateSourceLastIndexed(
		sourceId: number
	): Promise<{ success: boolean; error?: string }> {
		try {
			await this.db.execute(sql`
          UPDATE knowledge_base_sources
          SET last_indexed_at = NOW(), updated_at = NOW()
          WHERE id = ${sourceId}
        `)

			return { success: true }
		} catch (error) {
			console.error("Database update error:", error)
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Unknown database error"
			}
		}
	}

	async getSourceById(sourceId: number): Promise<KnowledgeBaseSource | null> {
		try {
			const result = await this.db.execute(sql`
          SELECT id, name, type, uri, user_id, last_indexed_at, created_at, updated_at
          FROM knowledge_base_sources
          WHERE id = ${sourceId}
        `)

			if (result.rows && result.rows.length > 0) {
				const row = result.rows[0]
				return {
					id: row.id as number,
					name: row.name as string,
					type: row.type as string,
					uri: row.uri as string,
					userId: row.user_id as string,
					lastIndexedAt: row.last_indexed_at as Date | null,
					createdAt: row.created_at as Date,
					updatedAt: row.updated_at as Date
				}
			}

			return null
		} catch (error) {
			console.error("Database select error:", error)
			return null
		}
	}

	async insertDocumentsBatch(
		documents: DocumentInsertRequest[]
	): Promise<{ success: boolean; insertedCount: number; errors: string[] }> {
		const errors: string[] = []
		let insertedCount = 0

		// Process in batches of 10 to avoid overwhelming the database
		const batchSize = 10
		for (let i = 0; i < documents.length; i += batchSize) {
			const batch = documents.slice(i, i + batchSize)

			for (const doc of batch) {
				const result = await this.insertDocument(doc)
				if (result.success) {
					insertedCount++
				} else {
					errors.push(
						`Document ${i + batch.indexOf(doc)}: ${result.error}`
					)
				}
			}
		}

		return {
			success: errors.length === 0,
			insertedCount,
			errors
		}
	}
}
