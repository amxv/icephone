import { db_ws } from "../src/db"
import { voiceAgents } from "../src/db/schema"
import { eq } from "drizzle-orm"

async function checkVoiceAgent() {
	try {
		console.log("🔍 Checking voice agent configuration...")

		const agent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status,
				teamId: voiceAgents.teamId,
				userId: voiceAgents.userId,
				updatedAt: voiceAgents.updatedAt
			})
			.from(voiceAgents)
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
		console.log(`   Team ID: ${agentData.teamId}`)
		console.log(`   User ID: ${agentData.userId}`)
		console.log(`   Updated: ${agentData.updatedAt}`)
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
