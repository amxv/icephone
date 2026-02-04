export type VoiceProvider = "openai"
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
		sourceIds?: number[]
		files?: string[]
		messages?: string[]
	}
	command_center?: {
		mode?:
			| "support"
			| "outbound_cold_calling"
			| "loan_repayment_collections"
		templateId?:
			| "support"
			| "outbound_cold_calling"
			| "loan_repayment_collections"
			| "appointment_setting"
			| "customer_onboarding"
			| "renewal_retention"
		personality?: string
		scriptDirection?: string
		updatedAt?: string
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
	status: VoiceAgentStatus | null
	configuration: VoiceAgentConfiguration | null
	firstMessage: string | null
	createdAt: string | Date
	updatedAt: string | Date
	userId: string
	agentRoleId?: number | null
	voicePresetId?: number | null
	metrics?: {
		totalCalls: number
	}
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
	sessionId: string
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
	cost: string
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

export interface VoiceAgentCreateRequest {
	name: string
	description?: string
	prompt: string
	voice: VoiceSettings
	language?: string
	status?: VoiceAgentStatus
	configuration?: VoiceAgentConfiguration
	firstMessage?: string | null
}

export interface VoiceAgentUpdateRequest {
	name?: string
	description?: string
	prompt?: string
	voice?: VoiceSettings
	language?: string
	status?: VoiceAgentStatus
	configuration?: VoiceAgentConfiguration
	firstMessage?: string | null
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
