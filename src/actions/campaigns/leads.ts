"use server"

import { auth } from "@/lib/auth/session"
import { and, desc, eq, inArray } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, campaignLeads, leads } from "@/db/schema"

// Assign leads to campaign
export async function assignLeadsToCampaign(
	campaignId: number,
	leadIds: number[],
	options?: {
		priority?: number
		maxAttempts?: number
		notes?: string
	}
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate campaign ownership
		const campaign = await db_ws
			.select({ id: campaigns.id })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		// Validate leads ownership
		const validLeads = await db_ws
			.select({ id: leads.id })
			.from(leads)
			.where(and(inArray(leads.id, leadIds), eq(leads.userId, userId)))

		if (validLeads.length !== leadIds.length) {
			return {
				success: false,
				error: "Some leads not found or unauthorized",
				data: null
			}
		}

		// Create campaign lead assignments
		const assignmentData = leadIds.map((leadId) => ({
			campaignId,
			leadId,
			priority: options?.priority || 0,
			maxAttempts: options?.maxAttempts || 3,
			notes: options?.notes || null,
			userId
		}))

		const assignments = await db_ws
			.insert(campaignLeads)
			.values(assignmentData)
			.returning()

		return { success: true, data: assignments, error: null }
	} catch (error) {
		console.error("Error assigning leads to campaign:", error)
		return {
			success: false,
			error: "Failed to assign leads to campaign",
			data: null
		}
	}
}

// Remove lead from campaign
export async function removeLeadFromCampaign(
	campaignId: number,
	leadId: number
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const deletedAssignment = await db_ws
			.delete(campaignLeads)
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					eq(campaignLeads.leadId, leadId),
					eq(campaignLeads.userId, userId)
				)
			)
			.returning()

		if (!deletedAssignment || deletedAssignment.length === 0) {
			return {
				success: false,
				error: "Lead assignment not found or unauthorized"
			}
		}

		return { success: true, error: null }
	} catch (error) {
		console.error("Error removing lead from campaign:", error)
		return { success: false, error: "Failed to remove lead from campaign" }
	}
}

// Bulk assign leads (for CSV import integration)
export async function bulkAssignLeads(
	campaignId: number,
	leadData: Array<{
		leadId: number
		priority?: number
		maxAttempts?: number
		notes?: string
	}>
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate campaign ownership
		const campaign = await db_ws
			.select({ id: campaigns.id })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		// Prepare assignment data
		const assignmentData = leadData.map((lead) => ({
			campaignId,
			leadId: lead.leadId,
			priority: lead.priority || 0,
			maxAttempts: lead.maxAttempts || 3,
			notes: lead.notes || null,
			userId
		}))

		const assignments = await db_ws
			.insert(campaignLeads)
			.values(assignmentData)
			.returning()

		return { success: true, data: assignments, error: null }
	} catch (error) {
		console.error("Error bulk assigning leads:", error)
		return {
			success: false,
			error: "Failed to bulk assign leads",
			data: null
		}
	}
}

// Get campaign leads with their queue status
export async function getCampaignLeads(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaignLeadsData = await db_ws
			.select({
				id: campaignLeads.id,
				campaignId: campaignLeads.campaignId,
				leadId: campaignLeads.leadId,
				status: campaignLeads.status,
				priority: campaignLeads.priority,
				assignedAt: campaignLeads.assignedAt,
				lastAttemptAt: campaignLeads.lastAttemptAt,
				nextAttemptAt: campaignLeads.nextAttemptAt,
				attemptCount: campaignLeads.attemptCount,
				maxAttempts: campaignLeads.maxAttempts,
				notes: campaignLeads.notes,
				completedAt: campaignLeads.completedAt,
				lead: {
					id: leads.id,
					name: leads.name,
					email: leads.email,
					phone: leads.phone,
					status: leads.status,
					score: leads.score
				}
			})
			.from(campaignLeads)
			.leftJoin(leads, eq(campaignLeads.leadId, leads.id))
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					eq(campaignLeads.userId, userId)
				)
			)
			.orderBy(desc(campaignLeads.assignedAt))

		return { success: true, data: campaignLeadsData, error: null }
	} catch (error) {
		console.error("Error getting campaign leads:", error)
		return {
			success: false,
			error: "Failed to get campaign leads",
			data: null
		}
	}
}

// Batch lead creation function for UI
export async function createLeadAndAssignToCampaign(
	leadData: {
		name: string
		email?: string
		phone?: string
		notes?: string
		source?: string
	},
	campaignId?: number
): Promise<{ success: boolean; leadId?: number; error?: string }> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized" }
		}

		// Validate required fields
		if (!leadData.name?.trim()) {
			return { success: false, error: "Name is required" }
		}

		if (!leadData.phone?.trim() && !leadData.email?.trim()) {
			return {
				success: false,
				error: "Either phone or email is required"
			}
		}

		// Check for duplicates
		let existingLead = null
		if (leadData.email?.trim()) {
			existingLead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(
						eq(leads.email, leadData.email.trim()),
						eq(leads.userId, userId)
					)
				)
				.limit(1)
		}

		if (!existingLead && leadData.phone?.trim()) {
			existingLead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(
						eq(leads.phone, leadData.phone.trim()),
						eq(leads.userId, userId)
					)
				)
				.limit(1)
		}

		if (existingLead && existingLead.length > 0) {
			return {
				success: false,
				error: "Lead with this email or phone already exists"
			}
		}

		// Create the lead
		const [newLead] = await db_ws
			.insert(leads)
			.values({
				name: leadData.name.trim(),
				email: leadData.email?.trim() || null,
				phone: leadData.phone?.trim() || null,
				notes: leadData.notes?.trim() || null,
				source: leadData.source?.trim() || "Manual Entry",
				status: "new",
				userId
			})
			.returning({ id: leads.id })

		// Assign to campaign if provided
		if (campaignId && newLead.id) {
			await assignLeadsToCampaign(campaignId, [newLead.id], {
				priority: 0,
				notes: "Added manually"
			})
		}

		return { success: true, leadId: newLead.id }
	} catch (error) {
		console.error("Error creating lead:", error)
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to create lead"
		}
	}
}
