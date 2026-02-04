import { db_ws } from "@/db"
import { callQueue, voiceAgents } from "@/db/schema"
import { eq } from "drizzle-orm"

async function checkVoiceAgentAssignments() {
	try {
		console.log("🔍 Checking Voice Agent Assignments...")
		console.log("=".repeat(60))

		const agents = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status,
				teamId: voiceAgents.teamId,
				userId: voiceAgents.userId,
				updatedAt: voiceAgents.updatedAt
			})
			.from(voiceAgents)

		console.log(`\n📊 Found ${agents.length} voice agents:\n`)

		for (const agent of agents) {
			console.log(`Agent ID: ${agent.id}`)
			console.log(`  Name: ${agent.name}`)
			console.log(`  Status: ${agent.status}`)
			console.log(`  Team ID: ${agent.teamId}`)
			console.log(`  User ID: ${agent.userId}`)
			console.log(`  Updated: ${agent.updatedAt}`)
			console.log(`  ${"=".repeat(50)}`)
		}

		console.log("\n📋 Pending Calls in Queue:")
		const pendingCalls = await db_ws
			.select()
			.from(callQueue)
			.where(eq(callQueue.status, "pending"))

		const missingAgentCalls = [] as typeof pendingCalls
		const inactiveAgentCalls = [] as typeof pendingCalls

		for (const call of pendingCalls) {
			const agentId = call.voiceAgentId ?? call.agentId
			const agent = agents.find((item) => item.id === agentId)

			if (!agent) {
				missingAgentCalls.push(call)
			} else if (agent.status !== "active") {
				inactiveAgentCalls.push(call)
			}

			console.log(`Queue ID: ${call.id}`)
			console.log(`  Lead ID: ${call.leadId}`)
			console.log(`  Voice Agent ID: ${agentId || "N/A"}`)
			console.log(`  Voice Agent Name: ${agent?.name || "❌ NOT FOUND"}`)
			console.log(`  Voice Agent Status: ${agent?.status || "N/A"}`)
			console.log(`  Team ID: ${call.teamId}`)
			console.log(`  User ID: ${call.userId}`)
			console.log(`  Created: ${call.createdAt}`)
			console.log(`  ${"=".repeat(40)}`)
		}

		console.log("\n📈 SUMMARY:")
		console.log(`  Total Agents: ${agents.length}`)
		console.log(`  Pending Calls: ${pendingCalls.length}`)
		console.log(
			`  Pending Calls w/ Missing Agent: ${missingAgentCalls.length}`
		)
		console.log(
			`  Pending Calls w/ Inactive Agent: ${inactiveAgentCalls.length}`
		)

		if (missingAgentCalls.length > 0) {
			console.log("\n⚠️  PENDING CALLS WITH MISSING AGENT:")
			for (const call of missingAgentCalls) {
				console.log(
					`    - Queue ID ${call.id} (Agent ${call.voiceAgentId ?? call.agentId ?? "N/A"})`
				)
			}
		}

		if (inactiveAgentCalls.length > 0) {
			console.log("\n⚠️  PENDING CALLS WITH INACTIVE AGENT:")
			for (const call of inactiveAgentCalls) {
				console.log(
					`    - Queue ID ${call.id} (Agent ${call.voiceAgentId ?? call.agentId ?? "N/A"})`
				)
			}
		}
	} catch (error) {
		console.error("❌ Error checking voice agent assignments:", error)
	}
}

checkVoiceAgentAssignments()
	.then(() => {
		console.log("\n✅ Voice agent assignment check completed")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ Script failed:", error)
		process.exit(1)
	})
