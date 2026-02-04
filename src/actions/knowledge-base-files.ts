"use server"

import type { KnowledgeBaseSourceType } from "@/types"
import { createKnowledgeBaseSource, uploadKnowledgeFile } from "@/actions/knowledge-base"

function detectSourceType(filename: string, contentType: string | undefined): KnowledgeBaseSourceType {
	const extension = filename.split(".").pop()?.toLowerCase()

	if (contentType?.includes("pdf") || extension === "pdf") {
		return "pdf_upload"
	}

	if (contentType?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension || "")) {
		return "image_upload"
	}

	if (extension === "docx") {
		return "docx_upload"
	}

	return "txt_upload"
}

export async function processAndEmbedFile(
	file: File,
	sourceName?: string,
	sourceType?: KnowledgeBaseSourceType
): Promise<{
	success: boolean
	sourceId?: number
	chunkCount?: number
	failedChunks?: number
	error?: string
	message?: string
}> {
	try {
		if (!file) {
			return { success: false, error: "File is required" }
		}

		const detectedType = sourceType || detectSourceType(file.name, file.type)
		const name = sourceName || file.name.replace(/\.[^/.]+$/, "")

		const sourceResult = await createKnowledgeBaseSource({
			name,
			type: detectedType,
			uri: file.name
		})

		if (!sourceResult.success || !sourceResult.data) {
			return {
				success: false,
				error: sourceResult.error || "Failed to create knowledge source"
			}
		}

		const uploadResult = await uploadKnowledgeFile(sourceResult.data.id, file)
		if (!uploadResult.success) {
			return {
				success: false,
				sourceId: sourceResult.data.id,
				error: uploadResult.error || "Failed to upload knowledge file"
			}
		}

		return {
			success: true,
			sourceId: sourceResult.data.id,
			chunkCount: 1,
			failedChunks: 0,
			message: "File uploaded. Indexing is processing in the background."
		}
	} catch (error) {
		console.error("Error processing knowledge file:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		}
	}
}

export async function generateQueryEmbedding(_query: string): Promise<number[]> {
	return []
}

export async function generateMultimodalQueryEmbedding(
	_query: string,
	_images?: string[]
): Promise<number[]> {
	return []
}
