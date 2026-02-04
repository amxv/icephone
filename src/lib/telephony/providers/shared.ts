import type {
	QueueEntryForExecution,
	TelephonyCallLifecycleStatus
} from "@/lib/telephony/types"

function trimToNull(value: string | null | undefined) {
	if (!value) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length ? trimmed : null
}

export function normalizePhoneNumber(raw: string | null | undefined) {
	const value = trimToNull(raw)
	if (!value) {
		return null
	}
	return value.replace(/[()\s-]/g, "")
}

export function resolveQueuePhoneNumber(queueEntry: QueueEntryForExecution) {
	return normalizePhoneNumber(queueEntry.phoneNumber)
}

export function resolvePublicBaseUrl() {
	return (
		trimToNull(process.env.APP_BASE_URL) ||
		trimToNull(process.env.NEXT_PUBLIC_APP_URL) ||
		null
	)
}

export function resolveTelephonyWebhookUrl(provider: string) {
	const baseUrl = resolvePublicBaseUrl()
	if (!baseUrl) {
		return null
	}
	return `${baseUrl.replace(/\/+$/, "")}/api/telephony/webhooks/${provider}`
}

export function normalizeCallLifecycleStatus(
	status: string | null | undefined
): TelephonyCallLifecycleStatus {
	const normalized = (status || "").toLowerCase()
	switch (normalized) {
		case "queued":
		case "ringing":
		case "in_progress":
		case "completed":
		case "failed":
		case "busy":
		case "no_answer":
		case "canceled":
			return normalized
		case "in-progress":
			return "in_progress"
		case "no-answer":
			return "no_answer"
		case "cancelled":
			return "canceled"
		default:
			return "unknown"
	}
}

export function getRetryableErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error) {
		return error.message
	}
	return fallback
}
