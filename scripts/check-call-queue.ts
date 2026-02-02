import { db_ws } from "../src/db"
import { callQueue, leads, voiceAgents } from "../src/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"

async function checkCallQueue() {
	try {
		console.log("🔍 Checking call queue entries...")

		// Get all call queue entries
		const queueEntries = await db_ws
			.select({
				id: callQueue.id,
				leadId: callQueue.leadId,
				voiceAgentId: callQueue.voiceAgentId,
				status: callQueue.status,
				priority: callQueue.priority,
				scheduledTime: callQueue.scheduledTime,
				instructions: callQueue.instructions,
				phoneNumber: callQueue.phoneNumber,
				retryCount: callQueue.retryCount,
				startedAt: callQueue.startedAt,
				completedAt: callQueue.completedAt,
				lastError: callQueue.lastError,
				createdAt: callQueue.createdAt,
				userId: callQueue.userId,
				lead: {
					id: leads.id,
					name: leads.name,
					phone: leads.phone
				}
			})
			.from(callQueue)
			.leftJoin(leads, eq(callQueue.leadId, leads.id))
			.orderBy(desc(callQueue.createdAt))
			.limit(10)

		console.log(
			`📞 Found ${queueEntries.length} call queue entries (last 10):`
		)

		if (queueEntries.length === 0) {
			console.log("❌ No calls found in queue")
			return
		}

		for (const entry of queueEntries) {
			console.log(`\n🔸 Queue ID: ${entry.id}`)
			console.log(
				`   Lead: ${entry.lead?.name || "Unknown"} (ID: ${entry.leadId})`
			)
			console.log(
				`   Phone: ${entry.lead?.phone || entry.phoneNumber || "N/A"}`
			)
			console.log(`   Status: ${entry.status}`)
			console.log(`   Voice Agent ID: ${entry.voiceAgentId || "N/A"}`)
			console.log(`   Priority: ${entry.priority}`)
			console.log(
				`   Scheduled: ${entry.scheduledTime ? entry.scheduledTime.toISOString() : "Immediate"}`
			)
			console.log(`   Instructions: ${entry.instructions || "None"}`)
			console.log(`   Retry Count: ${entry.retryCount || 0}`)
			console.log(`   User ID: ${entry.userId}`)
			console.log(`   Created: ${entry.createdAt.toISOString()}`)

			if (entry.lastError) {
				console.log(`   ❌ Last Error: ${entry.lastError}`)
			}

			if (entry.startedAt) {
				console.log(`   🚀 Started: ${entry.startedAt.toISOString()}`)
			}

			if (entry.completedAt) {
				console.log(
					`   ✅ Completed: ${entry.completedAt.toISOString()}`
				)
			}
		}

		// Get summary stats
		const stats = await db_ws
			.select({
				status: callQueue.status,
				count: sql<number>`COUNT(*)`
			})
			.from(callQueue)
			.groupBy(callQueue.status)

		console.log("\n📊 Queue Status Summary:")
		for (const stat of stats) {
			console.log(`   ${stat.status}: ${stat.count}`)
		}
	} catch (error) {
		console.error("❌ Error checking call queue:", error)
	}
}

checkCallQueue()
	.then(() => {
		console.log("\n✅ Call queue check complete")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ Script failed:", error)
		process.exit(1)
	})
