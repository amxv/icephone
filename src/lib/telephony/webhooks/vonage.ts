import { createHmac, createHash } from "node:crypto"
import type {
	TelephonyNormalizedWebhookEvent,
	TelephonyWebhookAdapter
} from "@/lib/telephony/types"
import {
	base64UrlDecode,
	computeWebhookDedupeKey,
	constantTimeEqual,
	parseJsonObject,
	safeParseDate,
	safeParseNumber
} from "@/lib/telephony/webhooks/shared"

function base64UrlEncode(input: Buffer) {
	return input
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "")
}

function verifyVonageJwt(rawToken: string, rawBody: string) {
	const secret =
		process.env.VONAGE_WEBHOOK_SIGNATURE_SECRET?.trim() ||
		process.env.VONAGE_API_SIGNATURE_SECRET?.trim() ||
		process.env.VONAGE_APPLICATION_SECRET?.trim()

	if (!secret) {
		return false
	}

	const parts = rawToken.split(".")
	if (parts.length !== 3) {
		return false
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts
	const expectedSignature = base64UrlEncode(
		createHmac("sha256", secret)
			.update(`${encodedHeader}.${encodedPayload}`)
			.digest()
	)

	if (!constantTimeEqual(expectedSignature, encodedSignature)) {
		return false
	}

	try {
		const payload = JSON.parse(
			base64UrlDecode(encodedPayload).toString("utf8")
		) as Record<string, unknown>

		if (
			typeof payload.exp === "number" &&
			payload.exp < Math.floor(Date.now() / 1000)
		) {
			return false
		}

		if (typeof payload.payload_hash === "string") {
			const expectedHash = createHash("sha256")
				.update(rawBody)
				.digest("hex")
			if (expectedHash !== payload.payload_hash.toLowerCase()) {
				return false
			}
		}
	} catch {
		return false
	}

	return true
}

export const vonageWebhookAdapter: TelephonyWebhookAdapter = {
	provider: "vonage",
	verifySignature(input) {
		const authHeader = input.headers.get("authorization")
		if (!authHeader?.startsWith("Bearer ")) {
			return false
		}
		const token = authHeader.slice("Bearer ".length).trim()
		return verifyVonageJwt(token, input.rawBody)
	},
	normalizeEvents(input) {
		const payload = parseJsonObject(input.rawBody)

		const providerCallId =
			(typeof payload.uuid === "string" && payload.uuid) ||
			(typeof payload.call_uuid === "string" && payload.call_uuid) ||
			null
		const status =
			typeof payload.status === "string"
				? payload.status.toLowerCase()
				: null
		const providerRecordingId =
			(typeof payload.recording_uuid === "string" &&
				payload.recording_uuid) ||
			(typeof payload.recording_id === "string" &&
				payload.recording_id) ||
			null
		const recordingUrl =
			typeof payload.recording_url === "string"
				? payload.recording_url
				: null
		const eventType =
			(typeof payload.type === "string" && payload.type) ||
			(recordingUrl ? "recording.available" : "call.status")
		const eventId =
			(typeof payload.timestamp === "string" &&
				providerCallId &&
				`${providerCallId}:${status || eventType}:${payload.timestamp}`) ||
			(providerRecordingId
				? `${providerRecordingId}:${eventType}`
				: providerCallId)

		const normalized: TelephonyNormalizedWebhookEvent = {
			provider: "vonage",
			eventId,
			eventType,
			providerCallId,
			providerRecordingId,
			status,
			recordingUrl,
			durationSeconds:
				safeParseNumber(payload.duration) ||
				safeParseNumber(payload.conversation_duration),
			occurredAt:
				safeParseDate(payload.timestamp) || safeParseDate(payload.time),
			payload,
			dedupeKey: computeWebhookDedupeKey(
				"vonage",
				eventId,
				eventType,
				input.rawBody
			)
		}

		return [normalized]
	}
}
