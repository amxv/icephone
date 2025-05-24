import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import type { DatabaseService } from "./DatabaseService"
import type { DocumentInsertRequest } from "./DatabaseService"
import type { EmbeddingService } from "./EmbeddingService"

export interface IngestionRequest {
	sourceId: number
	sourceName: string
	sourceType: string
	fileContent: string | ArrayBuffer // Can be text or binary content
	processingOptions: {
		useMultimodal?: boolean
		useHyde?: boolean
		chunkingStrategy?: "adaptive" | "layout-aware" | "standard"
		preserveLayout?: boolean
		generateVisualDescriptions?: boolean
		chunkSize?: number
		chunkOverlap?: number
	}
	userId: string
}

export interface IngestionResult {
	success: boolean
	sourceId: number
	documentsCreated: number
	errors: string[]
	processingTime: number
	metadata?: {
		chunkingStrategy: string
		embeddingModel: string
		totalChunks: number
		failedChunks: number
	}
}

export interface BatchIngestionResult {
	success: boolean
	results: IngestionResult[]
	totalProcessed: number
	totalFailed: number
}

export class DocumentIngestionService {
	private dbService: DatabaseService
	private embeddingService: EmbeddingService

	constructor(
		dbService: DatabaseService,
		embeddingService: EmbeddingService
	) {
		this.dbService = dbService
		this.embeddingService = embeddingService
	}

	async ingestDocument(request: IngestionRequest): Promise<IngestionResult> {
		const startTime = Date.now()
		const errors: string[] = []
		let documentsCreated = 0

		try {
			// Step 1: Extract text content
			const textContent = await this.extractTextContent(
				request.fileContent,
				request.sourceType
			)

			if (!textContent.trim()) {
				return {
					success: false,
					sourceId: request.sourceId,
					documentsCreated: 0,
					errors: [
						"No text content could be extracted from the file"
					],
					processingTime: Date.now() - startTime
				}
			}

			// Step 2: Chunk the content
			const chunks = await this.chunkContent(
				textContent,
				request.processingOptions
			)

			if (chunks.length === 0) {
				return {
					success: false,
					sourceId: request.sourceId,
					documentsCreated: 0,
					errors: ["No content chunks were generated"],
					processingTime: Date.now() - startTime
				}
			}

			// Step 3: Generate embeddings for chunks
			const embeddingModel = "voyage-3"
			const embeddingResults =
				await this.embeddingService.generateEmbeddingsBatch(
					chunks,
					embeddingModel
				)

			// Step 4: Insert documents into database
			const documentInserts: DocumentInsertRequest[] = chunks.map(
				(chunk, index) => ({
					sourceId: request.sourceId,
					contentChunk: chunk,
					chunkType: "text",
					textEmbeddingModel: embeddingModel,
					textEmbedding: embeddingResults.embeddings[index],
					metadata: {
						chunkIndex: index,
						chunkSize: chunk.length,
						processingOptions: request.processingOptions,
						sourceName: request.sourceName,
						sourceType: request.sourceType
					},
					userId: request.userId
				})
			)

			const batchResult =
				await this.dbService.insertDocumentsBatch(documentInserts)
			documentsCreated = batchResult.insertedCount
			errors.push(...batchResult.errors)

			// Step 5: Update source last indexed timestamp
			await this.dbService.updateSourceLastIndexed(request.sourceId)

			const processingTime = Date.now() - startTime

			return {
				success: batchResult.success,
				sourceId: request.sourceId,
				documentsCreated,
				errors,
				processingTime,
				metadata: {
					chunkingStrategy:
						request.processingOptions.chunkingStrategy ||
						"standard",
					embeddingModel,
					totalChunks: chunks.length,
					failedChunks: chunks.length - documentsCreated
				}
			}
		} catch (error) {
			const processingTime = Date.now() - startTime
			console.error("Document ingestion error:", error)

			return {
				success: false,
				sourceId: request.sourceId,
				documentsCreated,
				errors: [
					error instanceof Error
						? error.message
						: "Unknown ingestion error"
				],
				processingTime
			}
		}
	}

	async ingestBatch(
		documents: IngestionRequest[],
		userId: string
	): Promise<IngestionResult[]> {
		const results: IngestionResult[] = []

		// Process documents sequentially to avoid overwhelming the system
		for (const doc of documents) {
			const result = await this.ingestDocument({ ...doc, userId })
			results.push(result)
		}

		return results
	}

	private async extractTextContent(
		content: string | ArrayBuffer,
		sourceType: string
	): Promise<string> {
		try {
			if (typeof content === "string") {
				return content
			}

			// Handle binary content based on source type
			switch (sourceType) {
				case "pdf_upload":
					return await this.extractPdfText(content)
				case "docx_upload":
					return await this.extractDocxText(content)
				default: {
					// Convert ArrayBuffer to string assuming UTF-8 encoding
					const decoder = new TextDecoder("utf-8")
					return decoder.decode(content)
				}
			}
		} catch (error) {
			console.error("Text extraction error:", error)
			throw new Error(
				`Failed to extract text from ${sourceType}: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	private async extractPdfText(content: ArrayBuffer): Promise<string> {
		try {
			// Import pdf-parse dynamically for Cloudflare Workers compatibility
			const pdfParse = (await import("pdf-parse")).default

			// Convert ArrayBuffer to Buffer for pdf-parse
			const buffer = Buffer.from(content)

			// Parse the PDF
			const data = await pdfParse(buffer, {
				// Only extract text, ignore images/formatting for now
				max: 0, // No page limit
				version: "v1.10.100"
			})

			return data.text || ""
		} catch (error) {
			console.error("PDF parsing error:", error)
			throw new Error(
				`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	private async extractDocxText(content: ArrayBuffer): Promise<string> {
		try {
			// Import mammoth dynamically for Cloudflare Workers compatibility
			const mammoth = await import("mammoth")

			// Convert ArrayBuffer to Buffer for mammoth
			const buffer = Buffer.from(content)

			// Extract text from DOCX
			const result = await mammoth.extractRawText({ buffer })

			if (result.messages.length > 0) {
				console.warn("DOCX extraction warnings:", result.messages)
			}

			return result.value || ""
		} catch (error) {
			console.error("DOCX parsing error:", error)
			throw new Error(
				`Failed to extract text from DOCX: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	private async chunkContent(
		content: string,
		options: IngestionRequest["processingOptions"]
	): Promise<string[]> {
		const chunkSize = options.chunkSize || 1000
		const chunkOverlap = options.chunkOverlap || 200

		try {
			const splitter = new RecursiveCharacterTextSplitter({
				chunkSize,
				chunkOverlap,
				separators: ["\n\n", "\n", ". ", " ", ""]
			})

			const chunks = await splitter.splitText(content)

			// Filter out very small chunks (less than 50 characters)
			return chunks.filter((chunk) => chunk.trim().length >= 50)
		} catch (error) {
			console.error("Content chunking error:", error)
			// Fallback to simple chunking
			return this.simpleChunking(content, chunkSize, chunkOverlap)
		}
	}

	private simpleChunking(
		content: string,
		chunkSize: number,
		chunkOverlap: number
	): string[] {
		const chunks: string[] = []
		let start = 0

		while (start < content.length) {
			const end = Math.min(start + chunkSize, content.length)
			const chunk = content.slice(start, end)

			if (chunk.trim().length >= 50) {
				chunks.push(chunk)
			}

			start += chunkSize - chunkOverlap
		}

		return chunks
	}
}
