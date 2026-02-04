"use server"

import type { KnowledgeBaseSourceType } from "@/types"
import { processAndEmbedFile } from "@/actions/knowledge-base-files"

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

export async function submitToIngestionWorker(): Promise<{
	success: boolean
	error?: string
}> {
	return {
		success: false,
		error: "Document ingestion worker is not configured"
	}
}

export async function checkIngestionStatus(): Promise<{
	success: boolean
	error?: string
}> {
	return {
		success: false,
		error: "Document ingestion worker is not configured"
	}
}

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
	return processAndEmbedFile(
		file,
		sourceName,
		sourceType as KnowledgeBaseSourceType
	)
}
