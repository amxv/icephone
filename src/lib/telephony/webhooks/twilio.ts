import { createHash, createHmac } from "node:crypto"
import type {
	TelephonyNormalizedWebhookEvent,
	TelephonyWebhookAdapter,
	TelephonyWebhookRequest
} from "@/lib/telephony/types"
import {
	constantTimeEqual,
	computeWebhookDedupeKey,
	parseFormObject,
	parseJsonObject,
	safeParseDate,
	safeParseNumber
} from "@/lib/telephony/webhooks/shared"

function parsePayload(rawBody: string, headers: Headers) {
	const contentType = headers.get("content-type") || ""
	if (contentType.includes("application/x-www-form-urlencoded")) {
		return parseFormObject(rawBody)
	}
	return parseJsonObject(rawBody)
}

function buildTwilioSignatureBase(
	requestUrl: string,
	rawBody: string,
	headers: Headers
) {
	const contentType = headers.get("content-type") || ""
	if (contentType.includes("application/x-www-form-urlencoded")) {
		const params = new URLSearchParams(rawBody)
		const sorted = [...params.entries()].sort(([a], [b]) =>
			a.localeCompare(b)
		)

		return `${requestUrl}${sorted
			.map(([key, value]) => `${key}${value}`)
			.join("")}`
	}

	return requestUrl
}

function hasValidTwilioJsonBodyHash(requestUrl: string, rawBody: string) {
	try {
		const parsedUrl = new URL(requestUrl)
		const bodyHash = parsedUrl.searchParams.get("bodySHA256")
		if (!bodyHash) {
			return false
		}

		const computedHash = createHash("sha256").update(rawBody).digest("hex")
		return constantTimeEqual(computedHash.toLowerCase(), bodyHash.toLowerCase())
	} catch {
		return false
	}
}

export const twilioWebhookAdapter: TelephonyWebhookAdapter = {
	provider: "twilio",
	verifySignature(input) {
		const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
		const signature = input.headers.get("x-twilio-signature")
		if (!authToken || !signature) {
			return false
		}

		const contentType = input.headers.get("content-type") || ""
		if (contentType.includes("application/json")) {
			if (!hasValidTwilioJsonBodyHash(input.requestUrl, input.rawBody)) {
				return false
			}
		}

		const signatureBase = buildTwilioSignatureBase(
			input.requestUrl,
			input.rawBody,
			input.headers
		)
		const expectedSignature = createHmac("sha1", authToken)
			.update(signatureBase)
			.digest("base64")

		return constantTimeEqual(expectedSignature, signature)
	},
	normalizeEvents(input) {
		const payload = parsePayload(input.rawBody, input.headers)
		const providerCallId =
			typeof payload.CallSid === "string" ? payload.CallSid : null
		const providerRecordingId =
			typeof payload.RecordingSid === "string"
				? payload.RecordingSid
				: null
		const status =
			typeof payload.CallStatus === "string"
				? payload.CallStatus.toLowerCase()
				: typeof payload.RecordingStatus === "string"
					? payload.RecordingStatus.toLowerCase()
					: null
		const eventType =
			typeof payload.CallbackSource === "string"
				? payload.CallbackSource
				: providerRecordingId
					? "recording.status"
					: status
						? `call.${status}`
						: "call.status"
		const occurredAt =
			safeParseDate(payload.Timestamp) || safeParseDate(payload.EventDate)

		const recordingUrl =
			typeof payload.RecordingUrl === "string"
				? payload.RecordingUrl
				: null
		const durationSeconds =
			safeParseNumber(payload.CallDuration) ||
			safeParseNumber(payload.RecordingDuration)

		const eventId =
			(typeof payload.EventSid === "string" && payload.EventSid) ||
			(providerCallId
				? `${providerCallId}:${status || eventType}:${payload.SequenceNumber || payload.Timestamp || "0"}`
				: null)

		const normalized: TelephonyNormalizedWebhookEvent = {
			provider: "twilio",
			eventId,
			eventType,
			providerCallId,
			providerRecordingId,
			status,
			recordingUrl,
			durationSeconds,
			occurredAt,
			payload,
			dedupeKey: computeWebhookDedupeKey(
				"twilio",
				eventId,
				eventType,
				input.rawBody
			)
		}

		return [normalized]
	}
}

export function isTwilioWebhookRequest(
	request: TelephonyWebhookRequest
): request is TelephonyWebhookRequest & { provider: "twilio" } {
	return request.provider === "twilio"
}
