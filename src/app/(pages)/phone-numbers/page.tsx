import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Phone Numbers | IcePhone",
	description:
		"Manage your inbound and outbound phone numbers for AI voice agents"
}

import { getPhoneNumbers } from "@/actions/phone-numbers"
import { getVoiceAgents } from "@/actions/voice-agents"
import { CustomerPhoneNumbersPageClient } from "@/components/customer-phone-numbers-page-client"

export default async function PhoneNumbersPage() {
	const [phoneNumbers, voiceAgentsResult] = await Promise.all([
		getPhoneNumbers(),
		getVoiceAgents()
	])

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<CustomerPhoneNumbersPageClient
					initialPhoneNumbers={phoneNumbers}
					voiceAgents={voiceAgentsResult.data || []}
				/>
			</div>
		</div>
	)
}
