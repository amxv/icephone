import { getPhoneNumbers } from "@/actions/phone-numbers"
import { getVoiceAgents } from "@/actions/voice-agents"
import { PhoneNumbersPageClient } from "@/components/phone-numbers-page-client"

export default async function PhoneNumbersPage() {
	const [numbersResult, agentsResult] = await Promise.all([
		getPhoneNumbers(),
		getVoiceAgents()
	])

	return (
		<PhoneNumbersPageClient
			initialPhoneNumbers={
				numbersResult.success ? numbersResult.data || [] : []
			}
			voiceAgents={agentsResult.success ? agentsResult.data || [] : []}
		/>
	)
}
