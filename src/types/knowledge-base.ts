export type KnowledgeBaseSourceType =
	| "website_url"
	| "pdf_upload"
	| "gdoc"
	| "txt_upload"
	| "image_upload"
	| "docx_upload"

export type ChunkType = "text" | "image" | "table" | "mixed"

export type ChunkingStrategy = "adaptive" | "layout-aware" | "standard"

export interface ProcessingOptions {
	useMultimodal: boolean
	useHyde: boolean
	chunkingStrategy: ChunkingStrategy
	preserveLayout: boolean
	generateVisualDescriptions: boolean
}

export interface ProcessingMetadata {
	processingTime: number
	chunkingStrategy: string
	embeddingModels: string[]
	visualElementsDetected: boolean
	confidence: number
	retrievalStrategies?: string[]
}

export interface BoundingBox {
	x: number
	y: number
	width: number
	height: number
}

export interface KnowledgeBaseSource {
	id: number
	name: string
	type: KnowledgeBaseSourceType
	uri: string
	processingOptions?: ProcessingOptions
	lastIndexedAt: string | Date | null
	createdAt: string | Date
	updatedAt: string | Date
	teamId?: string
	createdByUserId?: string | null
	status?: string | null
}

export interface KnowledgeBaseDocument {
	id: number
	sourceId: number | null
	contentChunk: string
	chunkType?: ChunkType
	textEmbeddingModel: string
	textEmbedding?: unknown
	multimodalEmbeddingModel?: string | null
	multimodalEmbedding?: unknown | null
	hydeEmbedding?: unknown | null
	hydeQueries?: string[] | null
	visualContext?: string | null
	boundingBox?: BoundingBox | null
	pageNumber?: number | null
	processingMetadata?: ProcessingMetadata | null
	metadata: Record<string, unknown>
	createdAt: string | Date
	updatedAt: string | Date
	teamId?: string
	createdByUserId?: string | null
}

export interface VisualElement {
	id: number
	documentId: number
	elementType: "image" | "table" | "chart" | "diagram"
	description?: string | null
	extractedText?: string | null
	imageData?: string | null
	embedding: unknown
	boundingBox?: BoundingBox | null
	pageNumber?: number | null
	metadata: Record<string, unknown>
	createdAt: string | Date
	userId: string
}

export interface KnowledgeBaseSourceCreateRequest {
	name: string
	type: KnowledgeBaseSourceType
	uri: string
	processingOptions?: ProcessingOptions
}

export interface KnowledgeBaseDocumentCreateRequest {
	sourceId?: number
	contentChunk: string
	chunkType?: ChunkType
	textEmbeddingModel: string
	textEmbedding: number[]
	multimodalEmbeddingModel?: string
	multimodalEmbedding?: number[]
	hydeEmbedding?: number[]
	hydeQueries?: string[]
	visualContext?: string
	boundingBox?: BoundingBox
	pageNumber?: number
	processingMetadata?: ProcessingMetadata
	metadata?: Record<string, unknown>
}

export interface VectorQueryResult {
	id: number
	sourceId: number | null
	contentChunk: string
	chunkType?: ChunkType
	metadata: Record<string, unknown>
	similarity: number
	retrievalStrategy?: string
	strategyWeight?: number
	reranked?: boolean
	[key: string]: unknown
}
