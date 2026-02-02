#!/usr/bin/env bun

import { initiateOutboundCallForBackgroundProcessor } from "@/actions/voice-agents"

async function testCallInitiation() {
	console.log("🧪 Testing call initiation...")

	try {
		const result = await initiateOutboundCallForBackgroundProcessor(
			"user_2vx9o0H7QqTrKPBERPN4CfZOUxD",
			{
				fromPhoneNumberId: 5, // Phone number ID that exists
				toPhoneNumber: "+917411827511", // Valid phone number
				agentId: 2, // Voice agent ID that exists
				leadId: 1,
				metadata: {
					test: true,
					instructions: "Test call"
				}
			}
		)

		console.log("📞 Call initiation result:")
		console.log("  Success:", result.success)
		console.log("  Error:", result.error)
		console.log("  Data:", JSON.stringify(result.data, null, 2))

		if (!result.success) {
			console.error("❌ Call initiation failed:", result.error)
		} else {
			console.log("✅ Call initiation succeeded!")
		}
	} catch (error) {
		console.error("💥 Exception during call initiation:", error)
	}
}

testCallInitiation().catch(console.error)
