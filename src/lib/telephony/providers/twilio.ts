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
	fromNumber: string
	outboundTwimlUrl: string | null
	statusCallbackUrl: string | null
	recordCalls: boolean
}

function getTwilioConfig(): TwilioConfig | null {
	const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
	const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
	const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim()

	if (!accountSid || !authToken || !fromNumber) {
		return null
	}

	const statusCallbackUrl =
		process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
		resolveTelephonyWebhookUrl("twilio")

	return {
		accountSid,
		authToken,
		fromNumber,
		outboundTwimlUrl: process.env.TWILIO_OUTBOUND_TWIML_URL?.trim() || null,
		statusCallbackUrl,
		recordCalls: process.env.TWILIO_RECORD_CALLS !== "false"
	}
}

function createMissingConfigurationResult(): TelephonyExecutionResult {
	return {
		status: "retryable_failure",
		provider: "twilio",
		error: "Twilio execution provider is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)."
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

		const config = getTwilioConfig()
		if (!config) {
			return createMissingConfigurationResult()
		}

		const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`
		const form = new URLSearchParams()
		form.set("To", toNumber)
		form.set("From", config.fromNumber)

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
			form.set(
				"StatusCallbackEvent",
				"initiated ringing answered completed"
			)
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
