"use server"

import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { addMinutes } from "date-fns"
import { and, eq, inArray } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, campaignLeads, campaignQueue, leads } from "@/db/schema"

// Add leads to campaign queue
export async function addLeadsToQueue(
	campaignId: number,
	leadIds: number[],
	scheduledTime?: Date,
	priority: number = 0
) {
	try {
		const { teamId, user } = await requireTeam()

		const campaign = await db_ws
			.select({ campaignSettings: campaigns.campaignSettings })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		const callInterval =
			(
				campaign[0]?.campaignSettings as {
					callTiming?: { callInterval?: number }
				} | null
			)?.callTiming?.callInterval ?? 0

		// Get campaign lead assignments
		const campaignLeadIds = await db_ws
			.select({
				id: campaignLeads.id,
				leadId: campaignLeads.leadId
			})
			.from(campaignLeads)
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					inArray(campaignLeads.leadId, leadIds),
					eq(campaignLeads.teamId, teamId)
				)
			)

		if (campaignLeadIds.length === 0) {
			return {
				success: false,
				error: "No valid campaign lead assignments found",
				data: null
			}
		}

		// Create queue entries
		const baseScheduledTime = scheduledTime || new Date()
		const intervalMinutes = Number(callInterval) > 0 ? Number(callInterval) : 0

		const queueData = campaignLeadIds.map((campaignLead, index) => ({
			campaignId,
			campaignLeadId: campaignLead.id,
			scheduledTime:
				intervalMinutes > 0
					? addMinutes(baseScheduledTime, index * intervalMinutes)
					: baseScheduledTime,
			priority,
			userId: user.id
		}))

		const queueEntries = await db_ws
			.insert(campaignQueue)
			.values(queueData)
			.returning()

		return { success: true, data: queueEntries, error: null }
	} catch (error) {
		console.error("Error adding leads to queue:", error)
		return {
			success: false,
			error: "Failed to add leads to queue",
			data: null
		}
	}
}

// Remove lead from campaign queue
export async function removeLeadFromQueue(queueId: number) {
	try {
		const { teamId } = await requireTeam()

		const queueEntry = await db_ws
			.select({ id: campaignQueue.id })
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.id, queueId),
					eq(campaignLeads.teamId, teamId)
				)
			)
			.limit(1)

		if (!queueEntry || queueEntry.length === 0) {
			return {
				success: false,
				error: "Queue entry not found or unauthorized"
			}
		}

		await db_ws.delete(campaignQueue).where(eq(campaignQueue.id, queueId))

		return { success: true, error: null }
	} catch (error) {
		console.error("Error removing lead from queue:", error)
		return { success: false, error: "Failed to remove lead from queue" }
	}
}

// Get campaign queue status
export async function getCampaignQueue(campaignId: number) {
	try {
		const { teamId } = await requireTeam()

		const queueData = await db_ws
			.select({
				id: campaignQueue.id,
				status: campaignQueue.status,
				priority: campaignQueue.priority,
				scheduledTime: campaignQueue.scheduledTime,
				startedAt: campaignQueue.startedAt,
				completedAt: campaignQueue.completedAt,
				retryCount: campaignQueue.retryCount,
				maxRetries: campaignQueue.maxRetries,
				lastError: campaignQueue.lastError,
				callResult: campaignQueue.callResult,
				campaignLead: {
					id: campaignLeads.id,
					leadId: campaignLeads.leadId,
					status: campaignLeads.status
				},
				lead: {
					id: leads.id,
					name: leads.name,
					phone: leads.phone
				}
			})
			.from(campaignQueue)
			.leftJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.leftJoin(leads, eq(campaignLeads.leadId, leads.id))
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignLeads.teamId, teamId)
				)
			)
			.orderBy(campaignQueue.scheduledTime)

		return { success: true, data: queueData, error: null }
	} catch (error) {
		console.error("Error getting campaign queue:", error)
		return {
			success: false,
			error: "Failed to get campaign queue",
			data: null
		}
	}
}

// Reorder queue entries for priority management
export async function reorderQueue(
	campaignId: number,
	queueUpdates: Array<{
		queueId: number
		priority: number
		scheduledTime?: Date
	}>
) {
	try {
		const { teamId } = await requireTeam()

		// Validate campaign ownership
		const campaign = await db_ws
			.select({ id: campaigns.id })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		// Validate all queue entries belong to this campaign and user
		const queueIds = queueUpdates.map((update) => update.queueId)
		const validQueueEntries = await db_ws
			.select({ id: campaignQueue.id })
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					inArray(campaignQueue.id, queueIds),
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignLeads.teamId, teamId)
				)
			)

		if (validQueueEntries?.length !== queueIds.length) {
			return {
				success: false,
				error: "Some queue entries not found or unauthorized",
				data: null
			}
		}

		// Update queue entries with new priorities and scheduled times
		const updatePromises = queueUpdates.map((update) => {
			const updateData: Partial<typeof campaignQueue.$inferInsert> = {
				priority: update.priority,
				updatedAt: new Date()
			}

			if (update.scheduledTime) {
				updateData.scheduledTime = update.scheduledTime
			}

			return db_ws
				.update(campaignQueue)
				.set(updateData)
				.where(eq(campaignQueue.id, update.queueId))
				.returning()
		})

		const results = await Promise.all(updatePromises)
		const updatedEntries = results.flat()

		return { success: true, data: updatedEntries, error: null }
	} catch (error) {
		console.error("Error reordering queue:", error)
		return {
			success: false,
			error: "Failed to reorder queue",
			data: null
		}
	}
}
