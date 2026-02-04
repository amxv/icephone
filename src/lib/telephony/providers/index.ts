import { mockTelephonyExecutionProvider } from "@/lib/telephony/providers/mock"
import { telnyxTelephonyExecutionProvider } from "@/lib/telephony/providers/telnyx"
import { twilioTelephonyExecutionProvider } from "@/lib/telephony/providers/twilio"
import { vonageTelephonyExecutionProvider } from "@/lib/telephony/providers/vonage"
import type {
	TelephonyExecutionProvider,
	TelephonyProvider
} from "@/lib/telephony/types"

const executionProviders: Record<
	TelephonyProvider,
	TelephonyExecutionProvider
> = {
	mock: mockTelephonyExecutionProvider,
	twilio: twilioTelephonyExecutionProvider,
	telnyx: telnyxTelephonyExecutionProvider,
	vonage: vonageTelephonyExecutionProvider
}

export function resolveTelephonyProvider(
	value: string | null | undefined
): TelephonyProvider {
	switch ((value || "").trim().toLowerCase()) {
		case "twilio":
			return "twilio"
		case "telnyx":
			return "telnyx"
		case "vonage":
			return "vonage"
		default:
			return "mock"
	}
}

export function getTelephonyExecutionProvider(
	value: string | null | undefined
) {
	const provider = resolveTelephonyProvider(value)
	return executionProviders[provider]
}
