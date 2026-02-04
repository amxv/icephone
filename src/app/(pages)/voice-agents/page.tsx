import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Voice Agents | IcePhone",
	description: "Manage your AI voice agents for inbound and outbound calls"
}

// Force dynamic rendering for this page
export const dynamic = "force-dynamic"

import { getVoiceAgents } from "@/actions/voice-agents"
import { VoiceAgentsPageClient } from "@/components/voice-agents-page-client"

export default async function VoiceAgentsPage() {
	const voiceAgentsResult = await getVoiceAgents()

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<VoiceAgentsPageClient initialVoiceAgents={voiceAgentsResult} />
			</div>
		</div>
	)
}
