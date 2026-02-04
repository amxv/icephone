export const telephonyProviderValues = [
	"mock",
	"twilio",
	"telnyx",
	"vonage"
] as const

export type TelephonyProvider = (typeof telephonyProviderValues)[number]

export const telephonyCallLifecycleStatuses = [
	"queued",
	"ringing",
	"in_progress",
	"completed",
	"failed",
	"busy",
	"no_answer",
	"canceled",
	"unknown"
] as const

export type TelephonyCallLifecycleStatus =
	(typeof telephonyCallLifecycleStatuses)[number]

export type QueueEntryForExecution = {
	id: number
	leadId: number
	campaignId: number | null
	agentId: number | null
	voiceAgentId: number | null
	priority: number | null
	scheduledTime: Date | null
	retryCount: number | null
	maxRetries: number | null
	retryInterval: number | null
	instructions: string | null
	phoneNumber: string | null
	userId: string
}

export type TelephonyExecutionInput = {
	teamId: string
	queueEntry: QueueEntryForExecution
	startedAt: Date
}

export type TelephonyExecutionResult =
	| {
			status: "completed"
			provider: TelephonyProvider
			durationSeconds: number
			completedAt?: Date
			callStatus?: TelephonyCallLifecycleStatus
			outcome?: string
			summary?: string
			notes?: string
			providerCallId?: string
			providerSessionId?: string
			recordingEnabled?: boolean
			recordingUrl?: string
			metadata?: Record<string, unknown>
	  }
	| {
			status: "retryable_failure"
			provider: TelephonyProvider
			error: string
			metadata?: Record<string, unknown>
	  }
	| {
			status: "failed"
			provider: TelephonyProvider
			error: string
			metadata?: Record<string, unknown>
	  }

export interface TelephonyExecutionProvider {
	readonly name: TelephonyProvider
	execute(input: TelephonyExecutionInput): Promise<TelephonyExecutionResult>
}

export type TelephonyWebhookRequest = {
	provider: Exclude<TelephonyProvider, "mock">
	rawBody: string
	requestUrl: string
	headers: Headers
}

export type TelephonyNormalizedWebhookEvent = {
	provider: Exclude<TelephonyProvider, "mock">
	eventId: string | null
	eventType: string
	providerCallId: string | null
	providerRecordingId: string | null
	status: string | null
	recordingUrl: string | null
	durationSeconds: number | null
	occurredAt: Date | null
	payload: Record<string, unknown>
	dedupeKey: string
}

export interface TelephonyWebhookAdapter {
	readonly provider: Exclude<TelephonyProvider, "mock">
	verifySignature(input: TelephonyWebhookRequest): boolean
	normalizeEvents(
		input: TelephonyWebhookRequest
	): TelephonyNormalizedWebhookEvent[]
}
