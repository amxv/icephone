import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Voice Agents | IcePhone",
	description: "Manage your AI voice agents for inbound and outbound calls"
}

import { getPhoneNumbers } from "@/actions/phone-numbers"
import { getVoiceAgents } from "@/actions/voice-agents"
import { VoiceAgentsPageClient } from "@/components/voice-agents-page-client"

export default async function VoiceAgentsPage() {
	const [voiceAgentsResult, phoneNumbersResult] = await Promise.all([
		getVoiceAgents(),
		getPhoneNumbers()
	])

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<VoiceAgentsPageClient
					initialVoiceAgents={voiceAgentsResult}
					phoneNumbers={phoneNumbersResult}
				/>
			</div>
		</div>
	)
}
