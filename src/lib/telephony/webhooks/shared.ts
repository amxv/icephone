import { createHash, timingSafeEqual } from "node:crypto"

export function parseJsonObject(rawBody: string) {
	if (!rawBody.trim()) {
		return {}
	}
	try {
		const parsed = JSON.parse(rawBody)
		return typeof parsed === "object" && parsed ? parsed : {}
	} catch {
		return {}
	}
}

export function parseFormObject(rawBody: string) {
	const params = new URLSearchParams(rawBody)
	const result: Record<string, string> = {}
	for (const [key, value] of params.entries()) {
		result[key] = value
	}
	return result
}

export function computeWebhookDedupeKey(
	provider: string,
	eventId: string | null,
	eventType: string,
	rawBody: string
) {
	const raw = `${provider}:${eventId || "unknown"}:${eventType}:${rawBody}`
	return createHash("sha256").update(raw).digest("hex")
}

export function safeParseDate(value: unknown): Date | null {
	if (typeof value !== "string" || !value.trim()) {
		return null
	}
	const parsed = new Date(value)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function safeParseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) {
			return parsed
		}
	}
	return null
}

export function base64UrlDecode(value: string) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
	return Buffer.from(padded, "base64")
}

export function constantTimeEqual(a: string, b: string) {
	const aBuffer = Buffer.from(a)
	const bBuffer = Buffer.from(b)
	if (aBuffer.length !== bBuffer.length) {
		return false
	}
	return timingSafeEqual(aBuffer, bBuffer)
}
