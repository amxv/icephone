// Knowledge Base types
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
	userId: string
}

export interface KnowledgeBaseDocument {
	id: number
	sourceId: number | null
	contentChunk: string
	chunkType: ChunkType

	// Text embedding
	textEmbeddingModel: string
	textEmbedding: unknown // Vector type will be handled specially

	// Multimodal embedding
	multimodalEmbeddingModel?: string | null
	multimodalEmbedding?: unknown | null

	// HyDE embedding
	hydeEmbedding?: unknown | null
	hydeQueries?: string[] | null

	// Visual context
	visualContext?: string | null
	boundingBox?: BoundingBox | null
	pageNumber?: number | null
	processingMetadata?: ProcessingMetadata | null

	metadata: Record<string, unknown>
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
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

// API types for Knowledge Base
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

	// Text embedding
	textEmbeddingModel: string
	textEmbedding: number[] // Array of embedding values

	// Multimodal embedding
	multimodalEmbeddingModel?: string
	multimodalEmbedding?: number[]

	// HyDE embedding
	hydeEmbedding?: number[]
	hydeQueries?: string[]

	// Visual context
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

// Lead types
export interface Lead {
	id: number
	name: string
	email: string | null
	phone: string | null
	score: number
	status: "new" | "contacted" | "qualified" | "converted" | "lost"
	source: string | null
	notes: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// Appointment types
export interface Appointment {
	id: number
	leadId: number
	title: string
	description: string | null
	startTime: string | Date
	endTime: string | Date
	location: string | null
	completed: boolean
	notes: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// Call types
export interface Call {
	id: number
	leadId: number
	type: "incoming" | "outgoing"
	duration: number | null
	startTime: string | Date
	summary: string | null
	transcript: string | null
	recordingUrl: string | null
	status: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// Phone Number types
export type PhoneNumberType = "inbound" | "outbound" | "both"
export type PhoneNumberStatus = "active" | "inactive" | "pending" | "suspended"

export interface PhoneNumberCapabilities {
	voice: boolean
	sms: boolean
	mms: boolean
	fax: boolean
}

export interface PhoneNumberConfiguration {
	routingRules?: {
		businessHours?: {
			enabled: boolean
			timezone: string
			schedule: {
				[key: string]: { start: string; end: string } | null
			}
		}
		voicemail?: {
			enabled: boolean
			greeting: string
		}
		fallback?: {
			enabled: boolean
			forwardTo: string
		}
	}
	callerIdName?: string
	recordCalls?: boolean
}

export interface PhoneNumber {
	id: number
	number: string // E.164 format
	friendlyName: string
	type: PhoneNumberType
	status: PhoneNumberStatus
	isDefault: boolean
	provider: string | null
	providerSid: string | null
	capabilities: PhoneNumberCapabilities
	configuration: PhoneNumberConfiguration
	costPerMinute: string // decimal as string
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface PhoneNumberUsage {
	id: number
	phoneNumberId: number
	date: string | Date
	inboundCalls: number
	outboundCalls: number
	totalMinutes: number
	totalCost: string // decimal as string
	createdAt: string | Date
	userId: string
}

// API request types for phone numbers
export interface PhoneNumberCreateRequest {
	number: string
	friendlyName: string
	type: PhoneNumberType
	status?: PhoneNumberStatus
	isDefault?: boolean
	provider?: string
	providerSid?: string
	capabilities?: PhoneNumberCapabilities
	configuration?: PhoneNumberConfiguration
	costPerMinute?: string
}

export interface PhoneNumberUpdateRequest {
	friendlyName?: string
	type?: PhoneNumberType
	status?: PhoneNumberStatus
	isDefault?: boolean
	configuration?: PhoneNumberConfiguration
	costPerMinute?: string
}

// Text message types
export interface TextMessage {
	id: number
	leadId: number
	type: "incoming" | "outgoing"
	content: string
	sentAt: string | Date
	deliveredAt: string | Date | null
	readAt: string | Date | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// Email types
export interface Email {
	id: number
	leadId: number
	type: "incoming" | "outgoing"
	subject: string
	content: string
	sentAt: string | Date
	openedAt: string | Date | null
	clickedAt: string | Date | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// Email thread types
export interface EmailThreadMessage {
	content: string
	role: "user" | "assistant"
	timestamp: string | Date
}

export interface EmailThread {
	thread_id: string
	name: string | null
	email: string | null
	messages: EmailThreadMessage[]
}

// Lead detail data
export interface LeadDetailData {
	lead: Lead
	appointments: Appointment[]
	calls: Call[]
	textMessages: TextMessage[]
	emails: Email[]
}

// Chat message types
export interface ChatMessage {
	id: number
	chatId: number
	content: string
	role: "user" | "assistant"
	timestamp: string | Date
	userId?: string
}

// Chat types
export interface Chat {
	id: number
	leadId: number | null
	leadName: string | null
	summary: string | null
	timestamp: string | Date
	createdAt?: string | Date
	updatedAt?: string | Date
	userId?: string
	messages?: ChatMessage[]
}

// RAG types
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
	text?: string // For image captions or descriptions
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
	images?: string[] // Base64 encoded images
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

// Voice Agent types
export type VoiceProvider = "elevenlabs" | "playht" | "cartesia"
export type VoiceAgentStatus = "active" | "inactive" | "training" | "error"
export type VoiceSessionStatus = "active" | "completed" | "failed" | "timeout"

export interface VoiceSettings {
	provider: VoiceProvider
	voice_id: string
	model?: string
	settings?: Record<string, unknown>
}

export interface VoiceAgentConfiguration {
	flow?: {
		user_start_first?: boolean
		interruption?: {
			allowed?: boolean
			keep_interruption_message?: boolean
			first_message?: boolean
		}
		response_delay?: number
		auto_fill_responses?: {
			response_gap_threshold?: number
			messages?: string[]
		}
		agent_terminate_call?: {
			enabled?: boolean
			instruction?: string
			messages?: string[]
		}
		voicemail?: {
			action?: "hangup" | "continue"
			message?: string
			continue_on_voice_activity?: boolean
		}
		call_transfer?: {
			phone?: string
			phones?: Array<{ phone: string; description: string }>
			instruction?: string
			messages?: string[]
		}
		inactivity_handling?: {
			idle_time?: number
			message?: string
		}
		dtmf_dial?: {
			enabled?: boolean
			instruction?: string
		}
	}
	llm?: {
		model?: string
		temperature?: number
		history_settings?: {
			history_message_limit?: number
			history_tool_result_limit?: number
		}
	}
	session_timeout?: {
		max_duration?: number
		max_idle?: number
		message?: string
	}
	privacy_settings?: {
		opt_out_data_collection?: boolean
		do_not_call_detection?: boolean
	}
	custom_vocabulary?: {
		keywords?: Record<string, unknown>
	}
	knowledge_base?: {
		files?: string[]
		messages?: string[]
	}
	speech_to_text?: {
		provider?: "deepgram"
		multilingual?: boolean
		model?: string
	}
	call_settings?: {
		enable_recording?: boolean
	}
	memory?: {
		user_identifier_key?: string
	}
	timezone?: string
}

export interface VoiceAgent {
	id: number
	name: string
	description: string | null
	prompt: string
	voice: VoiceSettings
	language: string | null
	phoneNumberId: number | null
	status: VoiceAgentStatus | null
	configuration: VoiceAgentConfiguration | null
	firstMessage: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// Partial phone number type for voice agent queries
export interface VoiceAgentPhoneNumber {
	id: number
	number: string
	friendlyName: string
	type: PhoneNumberType
	status: PhoneNumberStatus | null
}

// Voice agent with phone number for list views
export interface VoiceAgentWithPhoneNumber extends VoiceAgent {
	phoneNumber?: VoiceAgentPhoneNumber | null
}

export interface VoiceAgentFunction {
	id: number
	agentId: number
	name: string
	description: string
	webhook: string
	method: string
	headers: Record<string, string>
	parameters: Array<{
		name: string
		type: "string" | "number" | "boolean" | "object" | "array"
		description: string
		required: boolean
	}>
	timeout: number
	runAfterCall: boolean
	responseMode: string
	executeAfterMessage: boolean
	excludeSessionId: boolean
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface VoiceSession {
	id: number
	sessionId: string // Millis AI session ID
	agentId: number
	leadId: number | null
	phoneNumber: string | null
	direction: "incoming" | "outgoing"
	status: VoiceSessionStatus
	startTime: string | Date
	endTime: string | Date | null
	duration: number | null
	metadata: {
		user_agent?: string
		ip_address?: string
		custom_data?: Record<string, unknown>
	}
	transcript: string | null
	summary: string | null
	sentiment: string | null
	recordingUrl: string | null
	cost: string // decimal as string
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

export interface VoiceRecording {
	id: number
	sessionId: number
	recordingUrl: string
	duration: number | null
	fileSize: number | null
	format: string
	transcript: string | null
	processingStatus: "pending" | "processing" | "completed" | "failed"
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
}

// API request types for Voice Agents
export interface VoiceAgentCreateRequest {
	name: string
	description?: string
	prompt: string
	voice: VoiceSettings
	language?: string
	phoneNumberId?: number
	status?: VoiceAgentStatus
	configuration?: VoiceAgentConfiguration
	firstMessage?: string
}

export interface VoiceAgentUpdateRequest {
	name?: string
	description?: string
	prompt?: string
	voice?: VoiceSettings
	language?: string
	phoneNumberId?: number
	status?: VoiceAgentStatus
	configuration?: VoiceAgentConfiguration
	firstMessage?: string
}

export interface VoiceAgentFunctionCreateRequest {
	agentId: number
	name: string
	description: string
	webhook: string
	method?: string
	headers?: Record<string, string>
	parameters?: Array<{
		name: string
		type: "string" | "number" | "boolean" | "object" | "array"
		description: string
		required: boolean
	}>
	timeout?: number
	runAfterCall?: boolean
	responseMode?: string
	executeAfterMessage?: boolean
	excludeSessionId?: boolean
}

export interface VoiceSessionCreateRequest {
	agentId: number
	leadId?: number
	phoneNumber?: string
	direction: "incoming" | "outgoing"
	metadata?: {
		user_agent?: string
		ip_address?: string
		custom_data?: Record<string, unknown>
	}
}

// Millis AI Web SDK types
export interface MillisClientOptions {
	publicKey: string
	endPoint?: string
}

export interface MillisAgentConfig {
	agent_id?: string
	agent_config?: {
		prompt?: string
		voice?: VoiceSettings
		language?: string
		tools?: VoiceAgentFunction[]
		custom_llm_websocket?: string
		llm?: string
	}
}

export interface MillisStartOptions {
	agent: MillisAgentConfig
	metadata?: Record<string, unknown>
	include_metadata_in_prompt?: boolean
	session_continuation?: {
		session_id: string
	}
}

export interface MillisEventHandlers {
	onopen?: () => void
	onready?: () => void
	onsessionended?: () => void
	onaudio?: (audio: Uint8Array) => void
	onresponsetext?: (text: string, payload: { is_final?: boolean }) => void
	ontranscript?: (text: string, payload: { is_final?: boolean }) => void
	onfunction?: (
		text: string,
		payload: { name: string; params: object }
	) => void
	analyzer?: (analyzer: AnalyserNode) => void
	useraudioready?: (data: {
		analyser: AnalyserNode
		stream: MediaStream
	}) => void
	onlatency?: (latency: number) => void
	onclose?: (event: CloseEvent) => void
	onerror?: (error: Event) => void
}
