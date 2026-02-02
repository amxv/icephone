import { db_ws } from "../src/db"
import { voiceAgents, phoneNumbers } from "../src/db/schema"
import { eq, and } from "drizzle-orm"

async function checkVoiceAgent() {
	try {
		console.log("🔍 Checking voice agent configuration...")

		// Get voice agent 2 details
		const agent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				phoneNumberId: voiceAgents.phoneNumberId,
				status: voiceAgents.status,
				userId: voiceAgents.userId,
				phoneNumber: {
					id: phoneNumbers.id,
					number: phoneNumbers.number,
					status: phoneNumbers.status
				}
			})
			.from(voiceAgents)
			.leftJoin(
				phoneNumbers,
				eq(voiceAgents.phoneNumberId, phoneNumbers.id)
			)
			.where(eq(voiceAgents.id, 2))
			.limit(1)

		if (!agent.length) {
			console.log("❌ Voice agent ID 2 not found")
			return
		}

		const agentData = agent[0]
		console.log(`\n🤖 Voice Agent Details:`)
		console.log(`   ID: ${agentData.id}`)
		console.log(`   Name: ${agentData.name}`)
		console.log(`   Status: ${agentData.status}`)
		console.log(`   User ID: ${agentData.userId}`)
		console.log(`   Phone Number ID: ${agentData.phoneNumberId || "N/A"}`)

		if (agentData.phoneNumber) {
			console.log(
				`   📞 Assigned Phone Number: ${agentData.phoneNumber.number}`
			)
			console.log(`   📞 Phone Status: ${agentData.phoneNumber.status}`)
		} else {
			console.log(`   ❌ No phone number assigned to this voice agent!`)
		}

		// Get all available phone numbers for this user
		console.log(`\n📞 Available Phone Numbers for User:`)
		const availablePhones = await db_ws
			.select({
				id: phoneNumbers.id,
				number: phoneNumbers.number,
				status: phoneNumbers.status
			})
			.from(phoneNumbers)
			.where(eq(phoneNumbers.userId, agentData.userId))

		if (availablePhones.length === 0) {
			console.log("   ❌ No phone numbers found for this user")
		} else {
			for (const phone of availablePhones) {
				console.log(
					`   📞 ${phone.number} (ID: ${phone.id}, Status: ${phone.status})`
				)
			}
		}
	} catch (error) {
		console.error("❌ Error checking voice agent:", error)
	}
}

checkVoiceAgent()
	.then(() => {
		console.log("\n✅ Voice agent check complete")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ Script failed:", error)
		process.exit(1)
	})
