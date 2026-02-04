"use server"

import type { KnowledgeBaseSourceType } from "@/types"
import { currentUser } from "@/lib/auth/session"

export interface WorkerIngestionRequest {
	sourceId: number
	sourceName: string
	sourceType: string
	fileContent: string
	processingOptions?: {
		chunkSize?: number
		chunkOverlap?: number
		chunkingStrategy?: "standard" | "adaptive" | "layout-aware"
	}
}

export interface WorkerIngestionResponse {
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

/**
 * Submit a document to the ingestion worker for processing
 */
export async function submitToIngestionWorker(
	request: WorkerIngestionRequest
): Promise<{
	success: boolean
	data?: WorkerIngestionResponse
	error?: string
}> {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Get worker URL from environment
		const workerUrl = process.env.DOCUMENT_INGESTION_WORKER_URL
		const authToken = process.env.INGESTION_WORKER_AUTH_TOKEN

		if (!workerUrl) {
			// Fallback to existing local processing if worker is not available
			console.warn(
				"Document ingestion worker URL not configured, falling back to local processing"
			)
			return {
				success: false,
				error: "Document ingestion worker not available"
			}
		}

		// Prepare request payload
		const payload = {
			...request,
			userId: user.id
		}

		// Send request to worker
		const response = await fetch(`${workerUrl}/api/ingest`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${authToken || ""}`
			},
			body: JSON.stringify(payload)
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error("Worker ingestion error:", errorText)
			return {
				success: false,
				error: `Worker error: ${response.status} ${errorText}`
			}
		}

		const result = (await response.json()) as WorkerIngestionResponse
		return { success: true, data: result }
	} catch (error) {
		console.error("Error calling ingestion worker:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		}
	}
}

/**
 * Check the status of a processing job
 */
export async function checkIngestionStatus(jobId: string): Promise<{
	success: boolean
	status?: string
	message?: string
	error?: string
}> {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		const workerUrl = process.env.DOCUMENT_INGESTION_WORKER_URL
		const authToken = process.env.INGESTION_WORKER_AUTH_TOKEN

		if (!workerUrl) {
			return {
				success: false,
				error: "Document ingestion worker not available"
			}
		}

		const response = await fetch(`${workerUrl}/api/status/${jobId}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${authToken || ""}`
			}
		})

		if (!response.ok) {
			const errorText = await response.text()
			return {
				success: false,
				error: `Worker error: ${response.status} ${errorText}`
			}
		}

		const result = (await response.json()) as {
			status: string
			message: string
		}
		return {
			success: true,
			status: result.status,
			message: result.message
		}
	} catch (error) {
		console.error("Error checking ingestion status:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		}
	}
}

/**
 * Enhanced file processing that tries worker first, falls back to local processing
 */
export async function processAndEmbedFileWithWorker(
	file: File,
	sourceName?: string,
	sourceType?:
		| "website_url"
		| "pdf_upload"
		| "gdoc"
		| "txt_upload"
		| "image_upload"
		| "docx_upload"
): Promise<{
	success: boolean
	sourceId?: number
	chunkCount?: number
	failedChunks?: number
	error?: string
	message?: string
}> {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Authentication required" }
		}

		// Create a knowledge base source first
		const { createKnowledgeBaseSource } = await import("./knowledge-base")

		const sourceResult = await createKnowledgeBaseSource({
			name: sourceName || file.name.replace(/\.[^/.]+$/, ""),
			type: sourceType || "txt_upload",
			uri: file.name
		})

		if (!sourceResult.success || !sourceResult.data) {
			return {
				success: false,
				error:
					sourceResult.error ||
					"Failed to create knowledge base source"
			}
		}

		const sourceId = sourceResult.data.id

		try {
			// Convert file to base64 for worker
			const fileBuffer = await file.arrayBuffer()
			const fileContent = Buffer.from(fileBuffer).toString("base64")

			// Try worker ingestion first
			const workerResult = await submitToIngestionWorker({
				sourceId,
				sourceName: sourceName || file.name,
				sourceType: sourceType || "txt_upload",
				fileContent,
				processingOptions: {
					chunkSize: 1000,
					chunkOverlap: 200,
					chunkingStrategy: "standard"
				}
			})

			if (workerResult.success && workerResult.data) {
				return {
					success: true,
					sourceId,
					chunkCount: workerResult.data.documentsCreated,
					failedChunks: workerResult.data.metadata?.failedChunks || 0,
					message: `Successfully processed document using worker. Created ${workerResult.data.documentsCreated} chunks.`
				}
			}

			console.warn(
				"Worker processing failed, falling back to local processing:",
				workerResult.error
			)

			// Fallback to existing local processing
			const { processAndEmbedFile } = await import(
				"./knowledge-base-files"
			)
			const localResult = await processAndEmbedFile(
				file,
				sourceName,
				sourceType
			)

			if (localResult.success) {
				return {
					success: true,
					sourceId,
					chunkCount: localResult.chunkCount,
					failedChunks: localResult.failedChunks,
					message: `Successfully processed document using local processing. Created ${localResult.chunkCount} chunks.`
				}
			}

			return {
				success: false,
				error:
					localResult.error ||
					"Both worker and local processing failed"
			}
		} catch (processingError) {
			console.error("Document processing error:", processingError)
			return {
				success: false,
				error:
					processingError instanceof Error
						? processingError.message
						: "Unknown processing error"
			}
		}
	} catch (error) {
		console.error("File processing error:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		}
	}
}
