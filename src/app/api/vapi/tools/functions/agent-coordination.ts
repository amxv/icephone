import { db_ws } from "@/db"
import { leads, calls } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { logLeadInteraction } from "../utils"
import { z } from "zod"

// Schema for transfer parameters
const TransferToSpecialistSchema = z.object({
	leadId: z.string(),
	specialistType: z.enum([
		"sales",
		"support",
		"technical",
		"billing",
		"manager"
	]),
	reason: z.string(),
	urgency: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
	notes: z.string().optional(),
	transferNow: z.boolean().default(false) // If true, immediately transfer the call
})

// Schema for warm transfer (with context)
const WarmTransferSchema = z.object({
	leadId: z.string(),
	specialistPhone: z.string(),
	context: z.string(),
	introduction: z.string().optional(),
	stayOnCall: z.boolean().default(false) // Whether the original agent stays on the call
})

// Schema for recording agent handoff information
const AgentHandoffSchema = z.object({
	leadId: z.string(),
	fromAgent: z.string(),
	toAgent: z.string(),
	handoffReason: z.string(),
	conversationSummary: z.string(),
	nextSteps: z.string().optional(),
	followUpRequired: z.boolean().default(false)
})

// Transfer to specialist function - creates a task and optionally transfers immediately
export async function transferToSpecialist(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, specialistType, reason, urgency, notes, transferNow } =
			TransferToSpecialistSchema.parse(parameters)

		// Verify lead exists and belongs to user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Define specialist contact information (in real implementation, this would come from a database)
		const specialistContacts: Record<
			string,
			{ phone: string; name: string }
		> = {
			sales: { phone: "+1-555-SALES-01", name: "Sales Specialist" },
			support: { phone: "+1-555-SUPPORT-01", name: "Customer Support" },
			technical: { phone: "+1-555-TECH-01", name: "Technical Support" },
			billing: { phone: "+1-555-BILLING-01", name: "Billing Department" },
			manager: { phone: "+1-555-MANAGER-01", name: "Manager" }
		}

		const specialist = specialistContacts[specialistType]
		if (!specialist) {
			return {
				toolCallId,
				result: `Unknown specialist type: ${specialistType}`
			}
		}

		// Create a task for the specialist
		const { tasks } = await import("@/db/schema")

		const task = await db_ws
			.insert(tasks)
			.values({
				leadId: Number.parseInt(leadId),
				title: `${specialist.name} transfer required for ${lead.name}`,
				description: `Transfer requested: ${reason}${notes ? `\n\nAdditional notes: ${notes}` : ""}`,
				priority: urgency === "urgent" ? "high" : urgency,
				taskType: "call",
				assignedTo: specialist.phone, // In real implementation, this would be a user ID
				createdBy: userId,
				userId,
				status: "pending",
				dueDate:
					urgency === "urgent"
						? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
						: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		// Update lead notes with transfer information
		const transferNote = `[TRANSFER REQUEST] ${new Date().toISOString()} - Transfer to ${specialist.name} requested. Reason: ${reason}. Urgency: ${urgency}.${notes ? ` Notes: ${notes}` : ""}`

		await db_ws
			.update(leads)
			.set({
				notes: lead.notes
					? `${lead.notes}\n\n${transferNote}`
					: transferNote,
				updatedAt: new Date()
			})
			.where(eq(leads.id, Number.parseInt(leadId)))

		// Log the transfer request
		await logLeadInteraction(
			Number.parseInt(leadId),
			"transfer_requested",
			"vapi_tool",
			toolCallId,
			null,
			{
				specialistType,
				specialistPhone: specialist.phone,
				taskId: task[0].id,
				urgency,
				transferNow
			},
			{
				reason,
				notes,
				toolCall: "transferToSpecialist"
			},
			userId
		)

		let resultMessage = `Transfer request created for ${lead.name} to ${specialist.name}. Task #${task[0].id} has been assigned.`

		if (transferNow) {
			// In a real Vapi implementation, this would use the transferCall tool
			// For now, we'll just indicate that transfer should happen
			resultMessage += ` IMMEDIATE TRANSFER: Please transfer this call to ${specialist.phone} (${specialist.name}) now.`

			// In real implementation, you would call Vapi's transfer function here:
			// await vapiClient.transferCall(callId, specialist.phone)
		} else {
			resultMessage += ` The specialist will be contacted within ${urgency === "urgent" ? "15 minutes" : "2 hours"}.`
		}

		return {
			toolCallId,
			result: resultMessage
		}
	} catch (error) {
		console.error("Error transferring to specialist:", error)
		return {
			toolCallId,
			result: `Failed to transfer to specialist: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}

// Warm transfer function - transfers with full context
export async function warmTransfer(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, specialistPhone, context, introduction, stayOnCall } =
			WarmTransferSchema.parse(parameters)

		// Verify lead exists and belongs to user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Create a detailed context summary
		const contextSummary = `
		Lead: ${lead.name}
		Email: ${lead.email || "Not provided"}
		Phone: ${lead.phone || "Not provided"}
		Status: ${lead.status}
		Score: ${lead.score || 0}/100

		Conversation Context: ${context}

		${introduction ? `Introduction to provide: ${introduction}` : ""}
		`

		// Log the warm transfer
		await logLeadInteraction(
			Number.parseInt(leadId),
			"warm_transfer_initiated",
			"vapi_tool",
			toolCallId,
			null,
			{
				specialistPhone,
				stayOnCall,
				contextProvided: true
			},
			{
				context,
				introduction,
				toolCall: "warmTransfer"
			},
			userId
		)

		// Update lead notes with transfer context
		const transferNote = `[WARM TRANSFER] ${new Date().toISOString()} - Warm transfer to ${specialistPhone}. Context: ${context}`

		await db_ws
			.update(leads)
			.set({
				notes: lead.notes
					? `${lead.notes}\n\n${transferNote}`
					: transferNote,
				updatedAt: new Date()
			})
			.where(eq(leads.id, Number.parseInt(leadId)))

		// In a real implementation, this would call Vapi's transfer API
		let resultMessage = `Initiating warm transfer to ${specialistPhone} for ${lead.name}.`

		if (introduction) {
			resultMessage += ` Introduction: "${introduction}"`
		}

		if (stayOnCall) {
			resultMessage += ` You will remain on the call to facilitate the handoff.`
		} else {
			resultMessage += ` You will be disconnected after the transfer is complete.`
		}

		// In real implementation: await vapiClient.warmTransfer(callId, specialistPhone, contextSummary)

		return {
			toolCallId,
			result: resultMessage
		}
	} catch (error) {
		console.error("Error performing warm transfer:", error)
		return {
			toolCallId,
			result: `Failed to perform warm transfer: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}

// Record agent handoff for tracking and analytics
export async function recordAgentHandoff(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const {
			leadId,
			fromAgent,
			toAgent,
			handoffReason,
			conversationSummary,
			nextSteps,
			followUpRequired
		} = AgentHandoffSchema.parse(parameters)

		// Verify lead exists and belongs to user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Create handoff record in lead notes
		const handoffNote = `[AGENT HANDOFF] ${new Date().toISOString()}
		From: ${fromAgent}
		To: ${toAgent}
		Reason: ${handoffReason}

		Conversation Summary: ${conversationSummary}

		${nextSteps ? `Next Steps: ${nextSteps}` : ""}
		Follow-up Required: ${followUpRequired ? "Yes" : "No"}
		`

		await db_ws
			.update(leads)
			.set({
				notes: lead.notes
					? `${lead.notes}\n\n${handoffNote}`
					: handoffNote,
				updatedAt: new Date()
			})
			.where(eq(leads.id, Number.parseInt(leadId)))

		// Create follow-up task if required
		if (followUpRequired && nextSteps) {
			const { tasks } = await import("@/db/schema")

			await db_ws.insert(tasks).values({
				leadId: Number.parseInt(leadId),
				title: `Follow-up required after handoff to ${toAgent}`,
				description: nextSteps,
				priority: "medium",
				taskType: "follow_up",
				assignedTo: userId,
				createdBy: userId,
				userId,
				status: "pending",
				dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
				createdAt: new Date(),
				updatedAt: new Date()
			})
		}

		// Log the handoff
		await logLeadInteraction(
			Number.parseInt(leadId),
			"agent_handoff_recorded",
			"vapi_tool",
			toolCallId,
			null,
			{
				fromAgent,
				toAgent,
				followUpRequired,
				handoffTime: new Date().toISOString()
			},
			{
				handoffReason,
				conversationSummary,
				nextSteps,
				toolCall: "recordAgentHandoff"
			},
			userId
		)

		let resultMessage = `Agent handoff from ${fromAgent} to ${toAgent} has been recorded for ${lead.name}.`

		if (followUpRequired) {
			resultMessage += ` A follow-up task has been created for tomorrow.`
		}

		return {
			toolCallId,
			result: resultMessage
		}
	} catch (error) {
		console.error("Error recording agent handoff:", error)
		return {
			toolCallId,
			result: `Failed to record agent handoff: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}
