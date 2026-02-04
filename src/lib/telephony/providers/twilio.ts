import {
	buildBasicAuthHeader,
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

type TwilioConfig = {
	accountSid: string
	authToken: string
	fromNumber: string | null
	outboundTwimlUrl: string | null
	statusCallbackUrl: string | null
	recordCalls: boolean
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null
}

function readBoolean(value: unknown) {
	return typeof value === "boolean" ? value : null
}

function getTwilioConfig(
	override?: Record<string, unknown> | null
): TwilioConfig | null {
	const accountSid =
		readString(override?.accountSid) ||
		process.env.TWILIO_ACCOUNT_SID?.trim() ||
		null
	const authToken =
		readString(override?.authToken) ||
		readString(override?.apiKey) ||
		process.env.TWILIO_AUTH_TOKEN?.trim() ||
		null
	const fromNumber =
		readString(override?.fromNumber) ||
		process.env.TWILIO_FROM_NUMBER?.trim() ||
		null

	if (!accountSid || !authToken) {
		return null
	}

	const statusCallbackUrl =
		readString(override?.statusCallbackUrl) ||
		process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
		resolveTelephonyWebhookUrl("twilio")

	return {
		accountSid,
		authToken,
		fromNumber,
		outboundTwimlUrl:
			readString(override?.outboundTwimlUrl) ||
			process.env.TWILIO_OUTBOUND_TWIML_URL?.trim() ||
			null,
		statusCallbackUrl,
		recordCalls:
			readBoolean(override?.recordCalls) ??
			process.env.TWILIO_RECORD_CALLS !== "false"
	}
}

function createMissingConfigurationResult(): TelephonyExecutionResult {
	return {
		status: "retryable_failure",
		provider: "twilio",
		error: "Twilio execution provider is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)."
	}
}

export const twilioTelephonyExecutionProvider: TelephonyExecutionProvider = {
	name: "twilio",
	async execute(input) {
		const toNumber = resolveQueuePhoneNumber(input.queueEntry)
		if (!toNumber) {
			return {
				status: "failed",
				provider: "twilio",
				error: "Queue entry is missing a destination phone number for Twilio execution."
			}
		}

		const config = getTwilioConfig(input.providerConfig)
		if (!config) {
			return createMissingConfigurationResult()
		}
		const fromNumber = input.fromPhoneNumber || config.fromNumber
		if (!fromNumber) {
			return {
				status: "retryable_failure",
				provider: "twilio",
				error: "No outbound caller ID is configured for Twilio. Add a team phone number or set TWILIO_FROM_NUMBER."
			}
		}

		const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`
		const form = new URLSearchParams()
		form.set("To", toNumber)
		form.set("From", fromNumber)

		// Default to inline TwiML if no external instructions URL is configured.
		if (config.outboundTwimlUrl) {
			form.set("Url", config.outboundTwimlUrl)
		} else {
			form.set(
				"Twiml",
				'<Response><Say voice="alice">Please hold while we connect you.</Say><Pause length="1"/></Response>'
			)
		}

		if (config.statusCallbackUrl) {
			form.set("StatusCallback", config.statusCallbackUrl)
			form.set("StatusCallbackMethod", "POST")
			form.append("StatusCallbackEvent", "initiated")
			form.append("StatusCallbackEvent", "ringing")
			form.append("StatusCallbackEvent", "answered")
			form.append("StatusCallbackEvent", "completed")
		}

		if (config.recordCalls) {
			form.set("Record", "true")
		}

		try {
			const response = await performTelephonyRequest("twilio", endpoint, {
				method: "POST",
				headers: {
					Authorization: buildBasicAuthHeader(
						config.accountSid,
						config.authToken
					),
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: form.toString()
			})

			const payload =
				typeof response === "object" && response ? response : {}
			const sid =
				"sid" in payload && typeof payload.sid === "string"
					? payload.sid
					: undefined
			const status =
				"status" in payload && typeof payload.status === "string"
					? payload.status
					: "queued"

			return {
				status: "completed",
				provider: "twilio",
				durationSeconds: 0,
				callStatus: normalizeCallLifecycleStatus(status),
				outcome: "provider_dispatched",
				summary: "Outbound call dispatched to Twilio.",
				notes: "Awaiting Twilio status callbacks for terminal disposition.",
				providerCallId: sid,
				metadata: {
					toNumber,
					fromNumber,
					twilioStatus: status
				}
			}
		} catch (error) {
			if (error instanceof TelephonyProviderError) {
				return {
					status: error.retryable ? "retryable_failure" : "failed",
					provider: "twilio",
					error: error.message,
					metadata: {
						statusCode: error.statusCode,
						details: error.details
					}
				}
			}

			return {
				status: "retryable_failure",
				provider: "twilio",
				error:
					error instanceof Error
						? error.message
						: "Twilio request failed unexpectedly."
			}
		}
	}
}
