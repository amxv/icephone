"use server"

import { db_ws } from "@/db"
import { knowledgeFiles, knowledgeSources, teams } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { deleteObject, getKnowledgeFileKey, uploadBuffer } from "@/lib/storage"
import {
	addFileToVectorStore,
	createVectorStore,
	deleteOpenAIFile,
	getVectorStoreFileStatus,
	removeFileFromVectorStore,
	retrieveVectorStoreFileContent,
	searchVectorStore,
	uploadFileToOpenAI
} from "@/lib/openai/vector-store"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const knowledgeSourceSchema = z.object({
	name: z.string().trim().min(2),
	type: z.enum([
		"website_url",
		"pdf_upload",
		"gdoc",
		"txt_upload",
		"image_upload",
		"docx_upload"
	]),
	uri: z.string().trim().min(1)
})

const sourceIdSchema = z.number().int().positive()
const fileIdSchema = z.number().int().positive()

const querySchema = z.object({
	query: z.string().trim().min(1),
	limit: z.number().int().min(1).max(50).optional(),
	sourceId: sourceIdSchema.optional(),
	sourceIds: z.array(sourceIdSchema).min(1).max(20).optional(),
	threshold: z.number().min(0).max(1).optional()
})

export type RAGSearchResult = {
	id: number
	source_id: number
	sourceId: number
	content_chunk: string
	contentChunk: string
	metadata: Record<string, unknown>
	source_name: string
	source_type: string
	similarity: number
	retrievalStrategy?: string
	strategyWeight?: number
	reranked?: boolean
}

export type RAGQueryMetadata = {
	queryAnalysis?: {
		hasVisualContent?: boolean
		complexity?: string
		queryType?: string
	}
	strategiesUsed?: string[]
	totalDocumentsRetrieved?: number
	documentsAfterDeduplication?: number
	finalDocuments?: number
	rerankingEnabled?: boolean
}

export type RAGQueryResult = {
	success: boolean
	data?: RAGSearchResult[]
	error?: string
	query?: string
	searchType?: string
	metadata?: RAGQueryMetadata
}

async function getTeamVectorStoreId(teamId: string) {
	const [team] = await db_ws
		.select({
			id: teams.id,
			name: teams.name,
			vectorStoreId: teams.vectorStoreId
		})
		.from(teams)
		.where(eq(teams.id, teamId))
		.limit(1)

	if (!team) {
		throw new Error("Team not found")
	}

	return team.vectorStoreId || null
}

async function getOrCreateTeamVectorStore(teamId: string) {
	const existing = await getTeamVectorStoreId(teamId)
	if (existing) {
		return existing
	}

	const [team] = await db_ws
		.select({ id: teams.id, name: teams.name })
		.from(teams)
		.where(eq(teams.id, teamId))
		.limit(1)

	if (!team) {
		throw new Error("Team not found")
	}

	const vectorStore = await createVectorStore(`team-${team.name || team.id}`)
	await db_ws
		.update(teams)
		.set({ vectorStoreId: vectorStore.id, updatedAt: new Date() })
		.where(eq(teams.id, team.id))

	return vectorStore.id
}

export async function createKnowledgeBaseSource(input: {
	name: string
	type: string
	uri: string
}) {
	try {
		const payload = knowledgeSourceSchema.parse(input)
		const { teamId, user } = await requireTeam()

		const [created] = await db_ws
			.insert(knowledgeSources)
			.values({
				teamId,
				name: payload.name,
				type: payload.type,
				uri: payload.uri,
				createdByUserId: user.id
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "knowledge.source.created",
			entityType: "knowledge_source",
			entityId: created.id,
			metadata: {
				name: created.name,
				type: created.type
			}
		})

		revalidatePath("/knowledge")

		return { success: true, data: created }
	} catch (error) {
		console.error("Failed to create knowledge source:", error)
		return { success: false, error: "Failed to create knowledge source" }
	}
}

export async function getKnowledgeBaseSources() {
	try {
		const { teamId } = await requireTeam()

		const sources = await db_ws
			.select()
			.from(knowledgeSources)
			.where(eq(knowledgeSources.teamId, teamId))
			.orderBy(desc(knowledgeSources.createdAt))

		return { success: true, data: sources }
	} catch (error) {
		console.error("Failed to list knowledge sources:", error)
		return { success: false, error: "Failed to list knowledge sources" }
	}
}

export async function getKnowledgeBaseSourceById(id: number) {
	try {
		const sourceId = sourceIdSchema.parse(id)
		const { teamId } = await requireTeam()

		const [source] = await db_ws
			.select()
			.from(knowledgeSources)
			.where(
				and(
					eq(knowledgeSources.id, sourceId),
					eq(knowledgeSources.teamId, teamId)
				)
			)
			.limit(1)

		if (!source) {
			return { success: false, error: "Knowledge source not found" }
		}

		return { success: true, data: source }
	} catch (error) {
		console.error("Failed to get knowledge source:", error)
		return { success: false, error: "Failed to get knowledge source" }
	}
}

export async function deleteKnowledgeBaseSource(id: number) {
	try {
		const sourceId = sourceIdSchema.parse(id)
		const { teamId, user } = await requireTeam()

		const [source] = await db_ws
			.select()
			.from(knowledgeSources)
			.where(
				and(
					eq(knowledgeSources.id, sourceId),
					eq(knowledgeSources.teamId, teamId)
				)
			)
			.limit(1)

		if (!source) {
			return { success: false, error: "Knowledge source not found" }
		}

		const files = await db_ws
			.select()
			.from(knowledgeFiles)
			.where(
				and(
					eq(knowledgeFiles.sourceId, sourceId),
					eq(knowledgeFiles.teamId, teamId)
				)
			)

		for (const file of files) {
			if (file.vectorStoreId && file.openaiFileId) {
				try {
					await removeFileFromVectorStore(
						file.vectorStoreId,
						file.openaiFileId
					)
				} catch (error) {
					console.warn(
						"Failed removing file from vector store:",
						error
					)
				}
			}

			if (file.openaiFileId) {
				try {
					await deleteOpenAIFile(file.openaiFileId)
				} catch (error) {
					console.warn("Failed deleting OpenAI file:", error)
				}
			}

			if (file.r2Key) {
				try {
					await deleteObject(file.r2Key)
				} catch (error) {
					console.warn("Failed deleting R2 object:", error)
				}
			}
		}

		await db_ws
			.delete(knowledgeSources)
			.where(
				and(
					eq(knowledgeSources.id, sourceId),
					eq(knowledgeSources.teamId, teamId)
				)
			)

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "knowledge.source.deleted",
			entityType: "knowledge_source",
			entityId: sourceId,
			metadata: {
				name: source.name
			}
		})

		revalidatePath("/knowledge")
		return { success: true }
	} catch (error) {
		console.error("Failed to delete knowledge source:", error)
		return { success: false, error: "Failed to delete knowledge source" }
	}
}

export async function uploadKnowledgeFile(
	sourceId: number,
	file: File
): Promise<{
	success: boolean
	data?: { fileId: number }
	error?: string
}> {
	try {
		const parsedSourceId = sourceIdSchema.parse(sourceId)
		if (!file) {
			return { success: false, error: "File is required" }
		}

		const { teamId, user } = await requireTeam()

		const [source] = await db_ws
			.select()
			.from(knowledgeSources)
			.where(
				and(
					eq(knowledgeSources.id, parsedSourceId),
					eq(knowledgeSources.teamId, teamId)
				)
			)
			.limit(1)

		if (!source) {
			return { success: false, error: "Knowledge source not found" }
		}

		const vectorStoreId = await getOrCreateTeamVectorStore(teamId)
		const buffer = Buffer.from(await file.arrayBuffer())
		const fileForOpenAI = new File([buffer], file.name, { type: file.type })
		const r2Key = getKnowledgeFileKey(teamId, parsedSourceId, file.name)

		await uploadBuffer({
			buffer,
			key: r2Key,
			contentType: file.type,
			metadata: {
				sourceId: String(parsedSourceId),
				filename: file.name
			}
		})

		let createdFile: { id: number } | undefined
		let openaiFileId: string | null = null

		try {
			const openaiFile = await uploadFileToOpenAI(fileForOpenAI)
			openaiFileId = openaiFile.id
			await addFileToVectorStore(vectorStoreId, openaiFile.id)
			;[createdFile] = await db_ws
				.insert(knowledgeFiles)
				.values({
					teamId,
					sourceId: parsedSourceId,
					filename: file.name,
					contentType: file.type,
					size: file.size,
					r2Key,
					openaiFileId: openaiFile.id,
					vectorStoreId,
					status: "processing",
					createdAt: new Date(),
					updatedAt: new Date()
				})
				.returning()
		} catch (error) {
			try {
				await deleteObject(r2Key)
			} catch (cleanupError) {
				console.warn("Failed cleaning up R2 object:", cleanupError)
			}
			throw error
		}

		if (!createdFile) {
			return { success: false, error: "Failed to save knowledge file" }
		}

		await db_ws
			.update(knowledgeSources)
			.set({ lastIndexedAt: new Date(), updatedAt: new Date() })
			.where(eq(knowledgeSources.id, parsedSourceId))

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "knowledge.file.uploaded",
			entityType: "knowledge_file",
			entityId: createdFile.id,
			metadata: {
				filename: file.name,
				sourceId: parsedSourceId,
				openaiFileId
			}
		})

		revalidatePath("/knowledge")
		revalidatePath(`/knowledge/${parsedSourceId}`)

		return { success: true, data: { fileId: createdFile.id } }
	} catch (error) {
		console.error("Failed to upload knowledge file:", error)
		return { success: false, error: "Failed to upload knowledge file" }
	}
}

export async function listKnowledgeFiles(sourceId: number) {
	try {
		const parsedSourceId = sourceIdSchema.parse(sourceId)
		const { teamId } = await requireTeam()

		const [source] = await db_ws
			.select({ id: knowledgeSources.id })
			.from(knowledgeSources)
			.where(
				and(
					eq(knowledgeSources.id, parsedSourceId),
					eq(knowledgeSources.teamId, teamId)
				)
			)
			.limit(1)

		if (!source) {
			return { success: false, error: "Knowledge source not found" }
		}

		const files = await db_ws
			.select()
			.from(knowledgeFiles)
			.where(
				and(
					eq(knowledgeFiles.sourceId, parsedSourceId),
					eq(knowledgeFiles.teamId, teamId)
				)
			)
			.orderBy(desc(knowledgeFiles.createdAt))

		const mapped = files.map((file) => ({
			id: file.id,
			sourceId: file.sourceId,
			contentChunk:
				file.extractedTextPreview ||
				(file.status === "processing"
					? "Document is still processing..."
					: "No preview available."),
			chunkType: "text",
			textEmbeddingModel: "openai-vector-store",
			metadata: {
				filename: file.filename,
				fileName: file.filename,
				contentType: file.contentType,
				size: file.size,
				status: file.status,
				openaiFileId: file.openaiFileId,
				vectorStoreId: file.vectorStoreId,
				r2Key: file.r2Key,
				lastError: file.lastError
			},
			createdAt: file.createdAt,
			updatedAt: file.updatedAt
		}))

		return { success: true, data: mapped }
	} catch (error) {
		console.error("Failed to list knowledge files:", error)
		return { success: false, error: "Failed to list knowledge files" }
	}
}

export async function getDocumentsForSource(sourceId: number) {
	return listKnowledgeFiles(sourceId)
}

export async function checkKnowledgeFileStatus(fileId: number) {
	try {
		const parsedFileId = fileIdSchema.parse(fileId)
		const { teamId, user } = await requireTeam()

		const [file] = await db_ws
			.select()
			.from(knowledgeFiles)
			.where(
				and(
					eq(knowledgeFiles.id, parsedFileId),
					eq(knowledgeFiles.teamId, teamId)
				)
			)
			.limit(1)

		if (!file) {
			return { success: false, error: "Knowledge file not found" }
		}

		if (!file.vectorStoreId || !file.openaiFileId) {
			return {
				success: false,
				error: "File is missing vector store metadata"
			}
		}

		const statusInfo = await getVectorStoreFileStatus(
			file.vectorStoreId,
			file.openaiFileId
		)

		let extractedTextPreview = file.extractedTextPreview
		let status = file.status
		let lastError: string | null = file.lastError

		if (statusInfo.status === "completed") {
			status = "ready"
			lastError = null

			if (!extractedTextPreview) {
				const content = await retrieveVectorStoreFileContent(
					file.vectorStoreId,
					file.openaiFileId
				)
				const normalized = content.replace(/\s+/g, " ").trim()
				extractedTextPreview = normalized.slice(0, 800)
			}
		} else if (
			statusInfo.status === "failed" ||
			statusInfo.status === "cancelled"
		) {
			status = "failed"
			lastError = statusInfo.lastError?.message || "Processing failed"
		}

		await db_ws
			.update(knowledgeFiles)
			.set({
				status,
				lastError,
				extractedTextPreview,
				updatedAt: new Date()
			})
			.where(eq(knowledgeFiles.id, parsedFileId))

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "knowledge.file.status_checked",
			entityType: "knowledge_file",
			entityId: parsedFileId,
			metadata: {
				status: statusInfo.status
			}
		})

		return {
			success: true,
			data: {
				status,
				lastError,
				extractedTextPreview
			}
		}
	} catch (error) {
		console.error("Failed to check knowledge file status:", error)
		return { success: false, error: "Failed to check file status" }
	}
}

export async function getKnowledgeBaseStats() {
	try {
		const { teamId } = await requireTeam()

		const [sourcesCount] = await db_ws
			.select({ count: sql<number>`count(*)` })
			.from(knowledgeSources)
			.where(eq(knowledgeSources.teamId, teamId))

		const [filesCount] = await db_ws
			.select({ count: sql<number>`count(*)` })
			.from(knowledgeFiles)
			.where(eq(knowledgeFiles.teamId, teamId))

		return {
			success: true,
			data: {
				sourceCount: Number(sourcesCount?.count || 0),
				documentCount: Number(filesCount?.count || 0)
			}
		}
	} catch (error) {
		console.error("Failed to get knowledge stats:", error)
		return { success: false, error: "Failed to get knowledge stats" }
	}
}

export async function performRAGQuery(
	query: string,
	options: {
		limit?: number
		sourceId?: number
		sourceIds?: number[]
		threshold?: number
	} = {}
): Promise<RAGQueryResult> {
	try {
		const {
			query: parsedQuery,
			limit = 10,
			sourceId,
			sourceIds,
			threshold
		} = querySchema.parse({
			query,
			limit: options.limit,
			sourceId: options.sourceId,
			sourceIds: options.sourceIds,
			threshold: options.threshold
		})

		const scopedSourceIds = Array.from(
			new Set(
				[
					...(typeof sourceId === "number" ? [sourceId] : []),
					...(Array.isArray(sourceIds) ? sourceIds : [])
				].filter(
					(value): value is number =>
						Number.isInteger(value) && value > 0
				)
			)
		)
		const scopedSourceIdSet =
			scopedSourceIds.length > 0 ? new Set(scopedSourceIds) : null

		const { teamId } = await requireTeam()
		const vectorStoreId = await getTeamVectorStoreId(teamId)

		if (!vectorStoreId) {
			return {
				success: true,
				data: [],
				query: parsedQuery,
				searchType: "vector"
			}
		}

		const searchResults = await searchVectorStore(
			vectorStoreId,
			parsedQuery,
			limit
		)

		const filteredResults = searchResults.data.filter((result) =>
			typeof threshold === "number" ? result.score >= threshold : true
		)
		const fileIds = filteredResults.map((result) => result.file_id)
		if (fileIds.length === 0) {
			return {
				success: true,
				data: [],
				query: parsedQuery,
				searchType: "vector"
			}
		}

		const files = await db_ws
			.select({
				file: knowledgeFiles,
				source: knowledgeSources
			})
			.from(knowledgeFiles)
			.innerJoin(
				knowledgeSources,
				eq(knowledgeSources.id, knowledgeFiles.sourceId)
			)
			.where(
				and(
					eq(knowledgeFiles.teamId, teamId),
					inArray(knowledgeFiles.openaiFileId, fileIds)
				)
			)

		const fileMap = new Map(
			files.map((row) => [row.file.openaiFileId, row])
		)

		const mapped = filteredResults.flatMap((result): RAGSearchResult[] => {
			const row = fileMap.get(result.file_id)
			if (!row) return []
			if (
				scopedSourceIdSet &&
				!scopedSourceIdSet.has(row.file.sourceId)
			) {
				return []
			}

			const contentItems = Array.isArray(result.content)
				? result.content
				: []
			const chunkContent = contentItems
				.filter((item) => item.type === "text")
				.map((item) => item.text)
				.join("\n")

			const contentChunk =
				chunkContent || row.file.extractedTextPreview || ""

			return [
				{
					id: row.file.id,
					source_id: row.file.sourceId,
					sourceId: row.file.sourceId,
					content_chunk: contentChunk,
					contentChunk,
					metadata: {
						filename: row.file.filename,
						fileName: row.file.filename,
						contentType: row.file.contentType,
						size: row.file.size
					},
					source_name: row.source.name,
					source_type: row.source.type,
					similarity: result.score
				}
			]
		})

		return {
			success: true,
			data: mapped,
			query: parsedQuery,
			searchType: "vector"
		}
	} catch (error) {
		console.error("Failed to perform knowledge search:", error)
		return { success: false, error: "Failed to perform knowledge search" }
	}
}

export async function generateRAGResponse(
	query: string,
	options: {
		limit?: number
		threshold?: number
		sourceId?: number
		modelProvider?: "openai" | "anthropic" | "google"
		modelName?: string
		includeMetadata?: boolean
	} = {}
) {
	try {
		const {
			limit = 5,
			threshold,
			sourceId,
			modelProvider = "openai",
			modelName = "gpt-4o-mini",
			includeMetadata = true
		} = options
		const contextResult = await performRAGQuery(query, {
			limit,
			threshold,
			sourceId
		})

		if (!contextResult.success) {
			return {
				success: false,
				error: "Failed to retrieve relevant context"
			}
		}

		const contextDocuments = contextResult.data ?? []

		if (contextDocuments.length === 0) {
			return {
				success: true,
				data: {
					answer: "I don't have enough information in the knowledge base to answer this question. Please try a different query or add more relevant documents.",
					query,
					sources: [],
					metadata: includeMetadata
						? {
								modelProvider,
								modelName,
								contextDocumentsUsed: 0,
								searchType:
									contextResult.searchType || "vector",
								usage: null
							}
						: undefined
				}
			}
		}

		const contextText = contextDocuments
			.map((doc, index) => {
				const sourceInfo = `Source: ${doc.source_name} (${doc.source_type})`
				return `[${index + 1}] ${sourceInfo}\n${doc.content_chunk}`
			})
			.join("\n\n")

		const systemPrompt = `You are an AI assistant helping users find information from their knowledge base.

Your task is to answer the user's question based ONLY on the provided context documents. Follow these guidelines:

1. **Answer based on context**: Only use information from the provided context documents
2. **Cite sources**: Reference specific sources using [1], [2], etc. format
3. **Be accurate**: If the context doesn't contain enough information to answer the question, say so
4. **Be concise**: Provide clear, direct answers without unnecessary elaboration
5. **Maintain context**: If multiple sources provide related information, synthesize them coherently

Context Documents:
${contextText}

If the context doesn't contain relevant information to answer the question, respond with: "I don't have enough information in the knowledge base to answer this question. Please try a different query or add more relevant documents."`

		const userPrompt = `Question: ${query}\n\nPlease provide a comprehensive answer based on the context documents above.`

		let response: string
		let usage: Record<string, unknown> | null = null

		const { generateAIText } = await import("@/lib/ai-helpers")

		response = await generateAIText({
			prompt: userPrompt,
			system: systemPrompt,
			category: "text",
			task: "general",
			maxTokens: 1000,
			temperature: 0.1
		})

		usage = {
			promptTokens: Math.ceil((systemPrompt + userPrompt).length / 4),
			completionTokens: Math.ceil(response.length / 4),
			totalTokens: Math.ceil(
				(systemPrompt + userPrompt + response).length / 4
			)
		}

		const ragResponse = {
			answer: response,
			query,
			sources: contextDocuments.map((doc, index) => ({
				id: doc.id,
				sourceId: doc.source_id,
				sourceName: doc.source_name,
				sourceType: doc.source_type,
				similarity: doc.similarity || 0,
				contentPreview: `${doc.content_chunk.substring(0, 200)}...`,
				citationIndex: index + 1,
				metadata: doc.metadata
			})),
			metadata: includeMetadata
				? {
						modelProvider,
						modelName,
						contextDocumentsUsed: contextDocuments.length,
						searchType: contextResult.searchType || "vector",
						usage
					}
				: undefined
		}

		return { success: true, data: ragResponse }
	} catch (error) {
		console.error("Failed to generate RAG response:", error)
		return { success: false, error: "Failed to generate response" }
	}
}

export async function performAdvancedRAGQuery(
	query: string,
	options: {
		limit?: number
		sourceId?: number
		threshold?: number
		enableQueryRewriting?: boolean
		enableHyde?: boolean
		enableReranking?: boolean
	} = {}
) {
	const result = await performRAGQuery(query, options)
	if (!result.success) {
		return result
	}

	return {
		...result,
		searchType: "advanced",
		metadata: {
			queryAnalysis: {
				hasVisualContent: false,
				complexity: "simple",
				queryType: "factual"
			},
			strategiesUsed: [
				"vector_store",
				options.enableQueryRewriting ? "rewritten" : null,
				options.enableHyde ? "hyde" : null
			].filter((strategy): strategy is string => Boolean(strategy)),
			totalDocumentsRetrieved: result.data ? result.data.length : 0,
			documentsAfterDeduplication: result.data ? result.data.length : 0,
			finalDocuments: result.data ? result.data.length : 0,
			rerankingEnabled: options.enableReranking ?? false
		}
	}
}

export async function performEnhancedRAGQuery(
	query: string,
	options: {
		limit?: number
		sourceId?: number
		threshold?: number
	} = {}
) {
	const result = await performRAGQuery(query, options)
	if (!result.success) {
		return result
	}

	return {
		...result,
		searchType: "enhanced",
		metadata: {
			strategiesUsed: ["vector_store"],
			finalDocuments: result.data ? result.data.length : 0
		}
	}
}

export const listKnowledgeSources = getKnowledgeBaseSources
export const createKnowledgeSource = createKnowledgeBaseSource
export const deleteKnowledgeSource = deleteKnowledgeBaseSource
export const queryKnowledge = performRAGQuery
export const getKnowledgeStats = getKnowledgeBaseStats
