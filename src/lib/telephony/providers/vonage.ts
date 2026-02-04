import { createSign, randomUUID } from "node:crypto"
import {
	performTelephonyRequest,
	TelephonyProviderError
} from "@/lib/telephony/providers/http"
import {
	normalizeCallLifecycleStatus,
	resolveQueuePhoneNumber,
	resolveTelephonyWebhookUrl
} from "@/lib/telephony/providers/shared"
import type {
	TelephonyExecutionProvider,
	TelephonyExecutionResult
} from "@/lib/telephony/types"

type VonageConfig = {
	applicationId: string
	privateKey: string
	fromNumber: string
	answerUrl: string
	eventUrl: string
}

function base64url(input: Buffer | string) {
	const asBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
	return asBuffer
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "")
}

function createVonageJwt(config: VonageConfig) {
	const nowInSeconds = Math.floor(Date.now() / 1000)
	const header = {
		alg: "RS256",
		typ: "JWT"
	}
	const payload = {
		application_id: config.applicationId,
		iat: nowInSeconds,
		exp: nowInSeconds + 60 * 60,
		jti: randomUUID()
	}

	const encodedHeader = base64url(JSON.stringify(header))
	const encodedPayload = base64url(JSON.stringify(payload))
	const toSign = `${encodedHeader}.${encodedPayload}`

	const signer = createSign("RSA-SHA256")
	signer.update(toSign)
	signer.end()

	const signature = signer.sign(config.privateKey)
	return `${toSign}.${base64url(signature)}`
}

function getVonageConfig(): VonageConfig | null {
	const applicationId = process.env.VONAGE_APPLICATION_ID?.trim()
	const privateKey = process.env.VONAGE_PRIVATE_KEY?.replace(/\\n/g, "\n")
	const fromNumber = process.env.VONAGE_FROM_NUMBER?.trim()
	const answerUrl = process.env.VONAGE_ANSWER_URL?.trim()
	const eventUrl =
		process.env.VONAGE_EVENT_URL?.trim() ||
		resolveTelephonyWebhookUrl("vonage")

	if (
		!applicationId ||
		!privateKey ||
		!fromNumber ||
		!answerUrl ||
		!eventUrl
	) {
		return null
	}

	return {
		applicationId,
		privateKey,
		fromNumber,
		answerUrl,
		eventUrl
	}
}

function createMissingConfigurationResult(): TelephonyExecutionResult {
	return {
		status: "retryable_failure",
		provider: "vonage",
		error: "Vonage execution provider is not configured (VONAGE_APPLICATION_ID, VONAGE_PRIVATE_KEY, VONAGE_FROM_NUMBER, VONAGE_ANSWER_URL)."
	}
}

export const vonageTelephonyExecutionProvider: TelephonyExecutionProvider = {
	name: "vonage",
	async execute(input) {
		const toNumber = resolveQueuePhoneNumber(input.queueEntry)
		if (!toNumber) {
			return {
				status: "failed",
				provider: "vonage",
				error: "Queue entry is missing a destination phone number for Vonage execution."
			}
		}

		const config = getVonageConfig()
		if (!config) {
			return createMissingConfigurationResult()
		}

		const jwt = createVonageJwt(config)
		const body = {
			to: [{ type: "phone", number: toNumber }],
			from: { type: "phone", number: config.fromNumber },
			answer_url: [config.answerUrl],
			event_url: [config.eventUrl]
		}

		try {
			const response = await performTelephonyRequest(
				"vonage",
				"https://api.nexmo.com/v1/calls",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${jwt}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			)

			const payload =
				typeof response === "object" && response ? response : {}
			const uuid =
				"uuid" in payload && typeof payload.uuid === "string"
					? payload.uuid
					: undefined
			const status =
				"status" in payload && typeof payload.status === "string"
					? payload.status
					: "queued"

			return {
				status: "completed",
				provider: "vonage",
				durationSeconds: 0,
				callStatus: normalizeCallLifecycleStatus(status),
				outcome: "provider_dispatched",
				summary: "Outbound call dispatched to Vonage.",
				notes: "Awaiting Vonage webhook events for terminal disposition.",
				providerCallId: uuid,
				metadata: {
					toNumber,
					status
				}
			}
		} catch (error) {
			if (error instanceof TelephonyProviderError) {
				return {
					status: error.retryable ? "retryable_failure" : "failed",
					provider: "vonage",
					error: error.message,
					metadata: {
						statusCode: error.statusCode,
						details: error.details
					}
				}
			}

			return {
				status: "retryable_failure",
				provider: "vonage",
				error:
					error instanceof Error
						? error.message
						: "Vonage request failed unexpectedly."
			}
		}
	}
}
