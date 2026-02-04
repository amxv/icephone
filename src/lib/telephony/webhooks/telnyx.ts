import { createPublicKey, verify } from "node:crypto"
import type {
	TelephonyNormalizedWebhookEvent,
	TelephonyWebhookAdapter
} from "@/lib/telephony/types"
import {
	computeWebhookDedupeKey,
	parseJsonObject,
	safeParseDate,
	safeParseNumber
} from "@/lib/telephony/webhooks/shared"

function resolveTelnyxPublicKey() {
	const rawKey =
		process.env.TELNYX_PUBLIC_KEY?.trim() ||
		process.env.TELNYX_API_PUBLIC_KEY?.trim()

	if (!rawKey) {
		return null
	}

	if (rawKey.includes("BEGIN PUBLIC KEY")) {
		return rawKey
	}

	// Support base64-encoded PEM body values from env var stores.
	const wrapped = rawKey.match(/.{1,64}/g)?.join("\n") || rawKey
	return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`
}

export const telnyxWebhookAdapter: TelephonyWebhookAdapter = {
	provider: "telnyx",
	verifySignature(input) {
		const signature = input.headers.get("telnyx-signature-ed25519")
		const timestamp = input.headers.get("telnyx-timestamp")
		const publicKeyPem = resolveTelnyxPublicKey()

		if (!signature || !timestamp || !publicKeyPem) {
			return false
		}

		try {
			const key = createPublicKey(publicKeyPem)
			const message = Buffer.from(`${timestamp}|${input.rawBody}`)
			const signatureBuffer = Buffer.from(signature, "base64")
			return verify(null, message, key, signatureBuffer)
		} catch {
			return false
		}
	},
	normalizeEvents(input) {
		const payload = parseJsonObject(input.rawBody)
		const data =
			typeof payload.data === "object" && payload.data
				? (payload.data as Record<string, unknown>)
				: {}
		const nestedPayload =
			typeof data.payload === "object" && data.payload
				? (data.payload as Record<string, unknown>)
				: {}
		const recordingUrls =
			typeof nestedPayload.recording_urls === "object" &&
			nestedPayload.recording_urls
				? (nestedPayload.recording_urls as Record<string, unknown>)
				: {}

		const providerCallId =
			(typeof nestedPayload.call_control_id === "string" &&
				nestedPayload.call_control_id) ||
			(typeof nestedPayload.call_leg_id === "string" &&
				nestedPayload.call_leg_id) ||
			null

		const providerRecordingId =
			(typeof nestedPayload.recording_id === "string" &&
				nestedPayload.recording_id) ||
			(typeof nestedPayload.recording_sid === "string" &&
				nestedPayload.recording_sid) ||
			null

		const status =
			(typeof nestedPayload.call_state === "string" &&
				nestedPayload.call_state.toLowerCase()) ||
			(typeof nestedPayload.call_status === "string" &&
				nestedPayload.call_status.toLowerCase()) ||
			(typeof nestedPayload.recording_status === "string" &&
				nestedPayload.recording_status.toLowerCase()) ||
			null

		const recordingUrl =
			(typeof recordingUrls.mp3 === "string" && recordingUrls.mp3) ||
			(typeof recordingUrls.wav === "string" && recordingUrls.wav) ||
			(typeof nestedPayload.recording_url === "string" &&
				nestedPayload.recording_url) ||
			null

		const eventType =
			(typeof data.event_type === "string" && data.event_type) ||
			(typeof nestedPayload.event_type === "string" &&
				nestedPayload.event_type) ||
			"telnyx.event"
		const eventId =
			(typeof data.id === "string" && data.id) ||
			(providerCallId
				? `${providerCallId}:${eventType}:${data.occurred_at || "0"}`
				: null)

		const normalized: TelephonyNormalizedWebhookEvent = {
			provider: "telnyx",
			eventId,
			eventType,
			providerCallId,
			providerRecordingId,
			status,
			recordingUrl,
			durationSeconds:
				safeParseNumber(nestedPayload.duration_secs) ||
				safeParseNumber(nestedPayload.duration),
			occurredAt:
				safeParseDate(data.occurred_at) ||
				safeParseDate(nestedPayload.occurred_at),
			payload,
			dedupeKey: computeWebhookDedupeKey(
				"telnyx",
				eventId,
				eventType,
				input.rawBody
			)
		}

		return [normalized]
	}
}
