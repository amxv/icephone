export type QueryType =
	| "factual"
	| "analytical"
	| "contextual"
	| "procedural"
	| "multimodal"

export type QueryComplexity = "simple" | "moderate" | "complex"

export interface QueryAnalysis {
	queryType: QueryType
	complexity: QueryComplexity
	rewrittenQueries: string[]
	originalQuery: string
	hasVisualContent: boolean
}

export interface MultimodalInput {
	type: "text" | "image" | "mixed"
	content: string | ArrayBuffer
	text?: string
}

export interface HydeResult {
	hypotheticalAnswer: string
	embedding: number[]
	originalQuery: string
	queryType: string
}

export interface EmbeddingStrategy {
	type: "text" | "multimodal" | "hyde" | "rewritten"
	embedding: number[]
	weight: number
}

export interface QualityMetrics {
	averageScore: number
	topDocumentScore: number
	scoreDistribution: number[]
	rerankingImprovement?: number
	coherenceScore?: number
	diversityScore?: number
}

export interface PerformanceMetrics {
	embeddingTime: number
	retrievalTime: number
	rerankingTime: number
	llmTime: number
	totalTime: number
}

export interface RetrievalMetadata {
	strategiesUsed: string[]
	totalDocumentsRetrieved: number
	documentsAfterDeduplication: number
	finalContextDocuments: number
	hydeEnabled: boolean
	rerankingEnabled: boolean
}

export interface RAGQueryRequest {
	query: string
	images?: string[]
	topK?: number
	similarityThreshold?: number
	modelProvider?: "openai" | "google" | "anthropic"
	modelName?: string
	stream?: boolean
	includeSources?: boolean
	enableQueryRewriting?: boolean
	enableHyde?: boolean
	enableReranking?: boolean
	filters?: Record<string, unknown>
}

export interface RAGQueryResponse {
	answer: string
	queryAnalysis?: {
		type: QueryType
		complexity: QueryComplexity
		hasVisualContent: boolean
		rewrittenQueriesUsed: number
	}
	retrievalMetadata?: RetrievalMetadata
	performanceMetrics?: PerformanceMetrics
	qualityMetrics?: QualityMetrics
	sources?: Array<{
		id: number
		sourceId: number | null
		score: number
		contentChunkPreview: string
		metadata: Record<string, unknown>
		retrievalStrategy?: string
		reranked?: boolean
	}>
}

export interface RAGResponse {
	answer: string
	query: string
	sources: Array<{
		id: number
		sourceId: number | null
		sourceName: string
		sourceType: string
		similarity: number
		contentPreview: string
		citationIndex: number
		metadata: Record<string, unknown>
	}>
	metadata?: {
		modelProvider: string
		modelName: string
		contextDocumentsUsed: number
		searchType: string
		usage: Record<string, unknown> | null
	}
}
