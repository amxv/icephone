import { db_ws } from "@/db"
import { voiceAgents, phoneNumbers, callQueue } from "@/db/schema"
import { eq, and } from "drizzle-orm"

async function checkVoiceAgentPhoneAssignments() {
	try {
		console.log("🔍 Checking Voice Agent Phone Number Assignments...")
		console.log("=".repeat(60))

		// Get all voice agents with their phone number assignments
		const agents = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status,
				phoneNumberId: voiceAgents.phoneNumberId,
				userId: voiceAgents.userId,
				phoneNumber: {
					id: phoneNumbers.id,
					number: phoneNumbers.number,
					friendlyName: phoneNumbers.friendlyName,
					status: phoneNumbers.status
				}
			})
			.from(voiceAgents)
			.leftJoin(
				phoneNumbers,
				eq(voiceAgents.phoneNumberId, phoneNumbers.id)
			)

		console.log(`\n📊 Found ${agents.length} voice agents:\n`)

		for (const agent of agents) {
			console.log(`Agent ID: ${agent.id}`)
			console.log(`  Name: ${agent.name}`)
			console.log(`  Status: ${agent.status}`)
			console.log(`  User ID: ${agent.userId}`)
			console.log(`  Phone Number ID: ${agent.phoneNumberId || "NULL"}`)

			if (agent.phoneNumber) {
				console.log(
					`  Phone Number: ${agent.phoneNumber.number} (${agent.phoneNumber.friendlyName})`
				)
				console.log(`  Phone Status: ${agent.phoneNumber.status}`)
			} else {
				console.log(`  Phone Number: ❌ NOT ASSIGNED`)
			}
			console.log(`  ${"=".repeat(50)}`)
		}

		// Check specifically agent ID 2 that was mentioned in the error
		console.log("\n🎯 Checking Agent ID 2 (from error logs):")
		const agent2 = agents.find((a) => a.id === 2)
		if (agent2) {
			console.log(`  Agent 2 found: ${agent2.name}`)
			console.log(
				`  Phone Number ID: ${agent2.phoneNumberId || "❌ NULL"}`
			)
			console.log(
				`  Phone Number: ${agent2.phoneNumber?.number || "❌ NOT ASSIGNED"}`
			)
		} else {
			console.log("  ❌ Agent ID 2 not found!")
		}

		// Get all available phone numbers for the users
		console.log("\n📞 Available Phone Numbers:")
		const allPhoneNumbers = await db_ws.select().from(phoneNumbers)

		for (const phone of allPhoneNumbers) {
			const assignedAgent = agents.find(
				(a) => a.phoneNumberId === phone.id
			)
			console.log(`Phone ID: ${phone.id}`)
			console.log(`  Number: ${phone.number}`)
			console.log(`  Name: ${phone.friendlyName}`)
			console.log(`  Status: ${phone.status}`)
			console.log(`  User ID: ${phone.userId}`)
			console.log(
				`  Assigned to Agent: ${assignedAgent ? `${assignedAgent.name} (ID: ${assignedAgent.id})` : "❌ UNASSIGNED"}`
			)
			console.log(`  ${"=".repeat(40)}`)
		}

		// Check pending calls in queue to see what voice agents they're trying to use
		console.log("\n📋 Pending Calls in Queue:")
		const pendingCalls = await db_ws
			.select()
			.from(callQueue)
			.where(eq(callQueue.status, "pending"))

		for (const call of pendingCalls) {
			const agent = agents.find((a) => a.id === call.voiceAgentId)
			console.log(`Queue ID: ${call.id}`)
			console.log(`  Lead ID: ${call.leadId}`)
			console.log(`  Voice Agent ID: ${call.voiceAgentId}`)
			console.log(`  Voice Agent Name: ${agent?.name || "❌ NOT FOUND"}`)
			console.log(
				`  Voice Agent Phone: ${agent?.phoneNumber?.number || "❌ NO PHONE"}`
			)
			console.log(`  User ID: ${call.userId}`)
			console.log(`  Created: ${call.createdAt}`)
			console.log(`  ${"=".repeat(40)}`)
		}

		// Summary
		console.log("\n📈 SUMMARY:")
		const agentsWithoutPhone = agents.filter((a) => !a.phoneNumberId)
		const phoneNumbersUnassigned = allPhoneNumbers.filter(
			(p) => !agents.some((a) => a.phoneNumberId === p.id)
		)

		console.log(`  Total Agents: ${agents.length}`)
		console.log(
			`  Agents without phone numbers: ${agentsWithoutPhone.length}`
		)
		console.log(`  Total Phone Numbers: ${allPhoneNumbers.length}`)
		console.log(
			`  Unassigned Phone Numbers: ${phoneNumbersUnassigned.length}`
		)
		console.log(`  Pending Calls: ${pendingCalls.length}`)

		if (agentsWithoutPhone.length > 0) {
			console.log("\n⚠️  AGENTS WITHOUT PHONE NUMBERS:")
			for (const agent of agentsWithoutPhone) {
				console.log(`    - ${agent.name} (ID: ${agent.id})`)
			}
		}

		if (phoneNumbersUnassigned.length > 0) {
			console.log("\n📞 UNASSIGNED PHONE NUMBERS:")
			for (const phone of phoneNumbersUnassigned) {
				console.log(
					`    - ${phone.number} (${phone.friendlyName}) - ID: ${phone.id}`
				)
			}
		}
	} catch (error) {
		console.error("❌ Error checking voice agent assignments:", error)
	}
}

checkVoiceAgentPhoneAssignments()
	.then(() => {
		console.log("\n✅ Voice agent check completed")
		process.exit(0)
	})
	.catch((error) => {
		console.error("❌ Script failed:", error)
		process.exit(1)
	})
