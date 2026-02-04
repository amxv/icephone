import { telnyxWebhookAdapter } from "@/lib/telephony/webhooks/telnyx"
import { twilioWebhookAdapter } from "@/lib/telephony/webhooks/twilio"
import { vonageWebhookAdapter } from "@/lib/telephony/webhooks/vonage"
import type { TelephonyWebhookAdapter } from "@/lib/telephony/types"

const adapters: Record<string, TelephonyWebhookAdapter> = {
	twilio: twilioWebhookAdapter,
	telnyx: telnyxWebhookAdapter,
	vonage: vonageWebhookAdapter
}

export function getTelephonyWebhookAdapter(
	rawProvider: string | null | undefined
) {
	if (!rawProvider) {
		return null
	}
	return adapters[rawProvider.toLowerCase()] || null
}
