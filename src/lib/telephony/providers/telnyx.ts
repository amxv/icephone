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

type TelnyxConfig = {
	apiKey: string
	connectionId: string
	fromNumber: string
	webhookUrl: string | null
}

function getTelnyxConfig(): TelnyxConfig | null {
	const apiKey = process.env.TELNYX_API_KEY?.trim()
	const connectionId = process.env.TELNYX_CONNECTION_ID?.trim()
	const fromNumber = process.env.TELNYX_FROM_NUMBER?.trim()

	if (!apiKey || !connectionId || !fromNumber) {
		return null
	}

	return {
		apiKey,
		connectionId,
		fromNumber,
		webhookUrl:
			process.env.TELNYX_WEBHOOK_URL?.trim() ||
			resolveTelephonyWebhookUrl("telnyx")
	}
}

function createMissingConfigurationResult(): TelephonyExecutionResult {
	return {
		status: "retryable_failure",
		provider: "telnyx",
		error: "Telnyx execution provider is not configured (TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_FROM_NUMBER)."
	}
}

export const telnyxTelephonyExecutionProvider: TelephonyExecutionProvider = {
	name: "telnyx",
	async execute(input) {
		const toNumber = resolveQueuePhoneNumber(input.queueEntry)
		if (!toNumber) {
			return {
				status: "failed",
				provider: "telnyx",
				error: "Queue entry is missing a destination phone number for Telnyx execution."
			}
		}

		const config = getTelnyxConfig()
		if (!config) {
			return createMissingConfigurationResult()
		}

		const body: Record<string, unknown> = {
			connection_id: config.connectionId,
			to: toNumber,
			from: config.fromNumber
		}

		if (config.webhookUrl) {
			body.webhook_url = config.webhookUrl
		}

		try {
			const response = await performTelephonyRequest(
				"telnyx",
				"https://api.telnyx.com/v2/calls",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.apiKey}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body)
				}
			)

			const payload =
				typeof response === "object" && response ? response : {}
			const data =
				"data" in payload &&
				typeof payload.data === "object" &&
				payload.data
					? (payload.data as Record<string, unknown>)
					: {}

			const providerCallId =
				(typeof data.call_control_id === "string" &&
					data.call_control_id) ||
				(typeof data.call_leg_id === "string" && data.call_leg_id) ||
				undefined

			const providerSessionId =
				typeof data.call_session_id === "string"
					? data.call_session_id
					: undefined

			const callStatus =
				typeof data.call_state === "string"
					? data.call_state
					: typeof data.call_status === "string"
						? data.call_status
						: "queued"

			return {
				status: "completed",
				provider: "telnyx",
				durationSeconds: 0,
				callStatus: normalizeCallLifecycleStatus(callStatus),
				outcome: "provider_dispatched",
				summary: "Outbound call dispatched to Telnyx.",
				notes: "Awaiting Telnyx callback events for terminal disposition.",
				providerCallId,
				providerSessionId,
				metadata: {
					toNumber,
					callState: callStatus
				}
			}
		} catch (error) {
			if (error instanceof TelephonyProviderError) {
				return {
					status: error.retryable ? "retryable_failure" : "failed",
					provider: "telnyx",
					error: error.message,
					metadata: {
						statusCode: error.statusCode,
						details: error.details
					}
				}
			}

			return {
				status: "retryable_failure",
				provider: "telnyx",
				error:
					error instanceof Error
						? error.message
						: "Telnyx request failed unexpectedly."
			}
		}
	}
}
