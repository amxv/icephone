"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, lte, sql } from "drizzle-orm"

import { db_ws } from "@/db"
import {
	campaigns,
	campaignLeads,
	campaignQueue,
	voiceAgents
} from "@/db/schema"

// Start campaign execution
export async function startCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate campaign ownership and check it can be started
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId,
				campaignSettings: campaigns.campaignSettings
			})
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

		const campaignData = campaign[0]

		// Check if campaign can be started
		if (campaignData.status === "running") {
			return {
				success: false,
				error: "Campaign is already running",
				data: null
			}
		}

		if (campaignData.status === "completed") {
			return {
				success: false,
				error: "Campaign is already completed",
				data: null
			}
		}

		// Validate voice agent is assigned and active
		if (!campaignData.voiceAgentId) {
			return {
				success: false,
				error: "Campaign must have a voice agent assigned",
				data: null
			}
		}

		const voiceAgent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, campaignData.voiceAgentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!voiceAgent || voiceAgent.length === 0) {
			return {
				success: false,
				error: "Voice agent not found",
				data: null
			}
		}

		if (voiceAgent[0].status !== "active") {
			return {
				success: false,
				error: `Voice agent "${voiceAgent[0].name}" is not active`,
				data: null
			}
		}

		// Check if there are leads in the queue
		const queueCount = await db_ws
			.select({ count: sql<number>`COUNT(*)` })
			.from(campaignQueue)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId),
					eq(campaignQueue.status, "queued")
				)
			)

		if (queueCount[0].count === 0) {
			return {
				success: false,
				error: "No leads in queue to call. Please add leads to the campaign first.",
				data: null
			}
		}

		// Update campaign status to running
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "running",
				updatedAt: new Date()
			})
			.where(eq(campaigns.id, campaignId))
			.returning()

		// Process the first batch of calls
		await processNextQueueBatch(campaignId)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error starting campaign:", error)
		return {
			success: false,
			error: "Failed to start campaign",
			data: null
		}
	}
}

// Pause campaign execution
export async function pauseCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status
			})
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

		if (campaign[0].status !== "running") {
			return {
				success: false,
				error: "Campaign is not currently running",
				data: null
			}
		}

		// Update campaign status to paused
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "paused",
				updatedAt: new Date()
			})
			.where(eq(campaigns.id, campaignId))
			.returning()

		// Pause any queued calls
		await db_ws
			.update(campaignQueue)
			.set({
				status: "paused",
				updatedAt: new Date()
			})
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId),
					eq(campaignQueue.status, "queued")
				)
			)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error pausing campaign:", error)
		return {
			success: false,
			error: "Failed to pause campaign",
			data: null
		}
	}
}

// Resume campaign execution
export async function resumeCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status
			})
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

		if (campaign[0].status !== "paused") {
			return {
				success: false,
				error: "Campaign is not currently paused",
				data: null
			}
		}

		// Update campaign status to running
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "running",
				updatedAt: new Date()
			})
			.where(eq(campaigns.id, campaignId))
			.returning()

		// Resume paused calls in queue
		await db_ws
			.update(campaignQueue)
			.set({
				status: "queued",
				updatedAt: new Date()
			})
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId),
					eq(campaignQueue.status, "paused")
				)
			)

		// Process the next batch of calls
		await processNextQueueBatch(campaignId)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error resuming campaign:", error)
		return {
			success: false,
			error: "Failed to resume campaign",
			data: null
		}
	}
}

// Stop campaign execution
export async function stopCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status
			})
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

		if (
			campaign[0].status === "completed" ||
			campaign[0].status === "cancelled"
		) {
			return {
				success: false,
				error: "Campaign is already stopped",
				data: null
			}
		}

		// Update campaign status to completed
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "completed",
				updatedAt: new Date()
			})
			.where(eq(campaigns.id, campaignId))
			.returning()

		// Mark all remaining queued calls as completed
		await db_ws
			.update(campaignQueue)
			.set({
				status: "completed",
				completedAt: new Date(),
				updatedAt: new Date()
			})
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId),
					sql`${campaignQueue.status} IN ('queued', 'paused')`
				)
			)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error stopping campaign:", error)
		return {
			success: false,
			error: "Failed to stop campaign",
			data: null
		}
	}
}

// Process next batch of calls in queue
export async function processNextQueueBatch(
	campaignId: number,
	_batchSize: number = 5
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Get campaign details
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId,
				campaignSettings: campaigns.campaignSettings
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		const campaignData = campaign[0]

		// Only process if campaign is running
		if (campaignData.status !== "running") {
			return {
				success: false,
				error: "Campaign is not running",
				data: null
			}
		}

		// Get voice agent details
		if (!campaignData.voiceAgentId) {
			return {
				success: false,
				error: "Campaign does not have a voice agent assigned",
				data: null
			}
		}

		const voiceAgent = await db_ws
			.select({
				id: voiceAgents.id,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, campaignData.voiceAgentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!voiceAgent || voiceAgent.length === 0) {
			return {
				success: false,
				error: "Voice agent not found",
				data: null
			}
		}

		if (voiceAgent[0].status !== "active") {
			return {
				success: false,
				error: "Voice agent is not active",
				data: null
			}
		}

		const callExecutionEnabled =
			process.env.CALL_EXECUTION_ENABLED === "true"

		if (!callExecutionEnabled) {
			return {
				success: true,
				data: {
					processed: 0,
					results: [],
					successful: 0,
					failed: 0,
					retries: 0,
					message:
						"Call execution is disabled (telephony deferred in this phase)."
				},
				error: null
			}
		}

		return {
			success: false,
			error: "Call execution is not implemented yet.",
			data: null
		}
	} catch (error) {
		console.error("Error processing queue batch:", error)
		return {
			success: false,
			error: "Failed to process queue batch",
			data: null
		}
	}
}

// Helper function to update queue entry status
async function updateQueueEntryStatus(
	queueId: number,
	status: "queued" | "processing" | "paused" | "completed" | "failed",
	updates: {
		startedAt?: Date
		completedAt?: Date
		retryCount?: number
		scheduledTime?: Date
		lastError?: string
		callResult?: Record<string, unknown>
	} = {}
) {
	const updateData: Partial<typeof campaignQueue.$inferInsert> = {
		status,
		updatedAt: new Date(),
		...updates
	}

	return await db_ws
		.update(campaignQueue)
		.set(updateData)
		.where(eq(campaignQueue.id, queueId))
		.returning()
}

// Get campaign execution status
export async function getCampaignExecutionStatus(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Get campaign basic info
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		// Get queue statistics
		const queueStats = await db_ws
			.select({
				status: campaignQueue.status,
				count: sql<number>`COUNT(*)`.as("count")
			})
			.from(campaignQueue)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId)
				)
			)
			.groupBy(campaignQueue.status)

		// Get lead statistics
		const leadStats = await db_ws
			.select({
				status: campaignLeads.status,
				count: sql<number>`COUNT(*)`.as("count")
			})
			.from(campaignLeads)
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					eq(campaignLeads.userId, userId)
				)
			)
			.groupBy(campaignLeads.status)

		// Convert stats to objects for easier access
		const queueStatsObj = queueStats.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = stat.count
				}
				return acc
			},
			{} as Record<string, number>
		)

		const leadStatsObj = leadStats.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = stat.count
				}
				return acc
			},
			{} as Record<string, number>
		)

		// Calculate totals and progress
		const totalLeads = Object.values(leadStatsObj).reduce(
			(sum, count) => sum + count,
			0
		)
		const totalCalls = Object.values(queueStatsObj).reduce(
			(sum, count) => sum + count,
			0
		)
		const completedCalls =
			(queueStatsObj.completed || 0) + (queueStatsObj.failed || 0)
		const progress =
			totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0

		return {
			success: true,
			data: {
				campaign: campaign[0],
				queue: {
					total: totalCalls,
					queued: queueStatsObj.queued || 0,
					processing: queueStatsObj.processing || 0,
					paused: queueStatsObj.paused || 0,
					completed: queueStatsObj.completed || 0,
					failed: queueStatsObj.failed || 0
				},
				leads: {
					total: totalLeads,
					pending: leadStatsObj.pending || 0,
					attempted: leadStatsObj.attempted || 0,
					contacted: leadStatsObj.contacted || 0,
					qualified: leadStatsObj.qualified || 0,
					converted: leadStatsObj.converted || 0,
					failed: leadStatsObj.failed || 0,
					excluded: leadStatsObj.excluded || 0
				},
				progress: Math.round(progress * 100) / 100
			},
			error: null
		}
	} catch (error) {
		console.error("Error getting campaign execution status:", error)
		return {
			success: false,
			error: "Failed to get campaign execution status",
			data: null
		}
	}
}

// Trigger next batch processing (can be called manually or via cron/webhook)
export async function triggerCampaignProcessing(campaignId?: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		let campaignsToProcess: number[] = []

		if (campaignId) {
			// Process specific campaign
			campaignsToProcess = [campaignId]
		} else {
			// Find all running campaigns for this user
			const runningCampaigns = await db_ws
				.select({ id: campaigns.id })
				.from(campaigns)
				.where(
					and(
						eq(campaigns.userId, userId),
						eq(campaigns.status, "running")
					)
				)

			campaignsToProcess = runningCampaigns.map((c) => c.id)
		}

		const results = []

		for (const id of campaignsToProcess) {
			const result = await processNextQueueBatch(id)
			results.push({
				campaignId: id,
				result
			})
		}

		return {
			success: true,
			data: {
				processedCampaigns: results.length,
				results
			},
			error: null
		}
	} catch (error) {
		console.error("Error triggering campaign processing:", error)
		return {
			success: false,
			error: "Failed to trigger campaign processing",
			data: null
		}
	}
}

// Schedule campaign to start at a specific time
export async function scheduleCampaign(campaignId: number, startTime: Date) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate campaign ownership
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId
			})
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

		const campaignData = campaign[0]

		// Check if campaign can be scheduled
		if (campaignData.status === "running") {
			return {
				success: false,
				error: "Campaign is already running",
				data: null
			}
		}

		if (campaignData.status === "completed") {
			return {
				success: false,
				error: "Campaign is already completed",
				data: null
			}
		}

		// Validate start time is in the future
		if (startTime <= new Date()) {
			return {
				success: false,
				error: "Scheduled start time must be in the future",
				data: null
			}
		}

		// Update campaign with scheduled start time
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "scheduled",
				startDate: startTime,
				updatedAt: new Date()
			})
			.where(eq(campaigns.id, campaignId))
			.returning()

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error scheduling campaign:", error)
		return {
			success: false,
			error: "Failed to schedule campaign",
			data: null
		}
	}
}

// Check and start scheduled campaigns
export async function processScheduledCampaigns() {
	try {
		// Find all scheduled campaigns that should start now
		const scheduledCampaigns = await db_ws
			.select({
				id: campaigns.id,
				userId: campaigns.userId,
				name: campaigns.name,
				startDate: campaigns.startDate
			})
			.from(campaigns)
			.where(
				and(
					eq(campaigns.status, "scheduled"),
					lte(campaigns.startDate, new Date())
				)
			)

		const results = []

		for (const campaign of scheduledCampaigns) {
			try {
				// Start the campaign using existing start function
				const result = await startCampaignDirect(
					campaign.id,
					campaign.userId
				)

				results.push({
					campaignId: campaign.id,
					name: campaign.name,
					status: result.success ? "started" : "failed",
					error: result.error
				})
			} catch (error) {
				results.push({
					campaignId: campaign.id,
					name: campaign.name,
					status: "failed",
					error:
						error instanceof Error ? error.message : "Unknown error"
				})
			}
		}

		return {
			success: true,
			data: {
				processedCampaigns: results.length,
				results
			},
			error: null
		}
	} catch (error) {
		console.error("Error processing scheduled campaigns:", error)
		return {
			success: false,
			error: "Failed to process scheduled campaigns",
			data: null
		}
	}
}

// Direct campaign start without auth context (for scheduled processing)
async function startCampaignDirect(campaignId: number, userId: string) {
	try {
		// Validate campaign
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		const campaignData = campaign[0]

		// Check if campaign can be started
		if (campaignData.status === "running") {
			return {
				success: false,
				error: "Campaign is already running",
				data: null
			}
		}

		if (campaignData.status === "completed") {
			return {
				success: false,
				error: "Campaign is already completed",
				data: null
			}
		}

		// Validate voice agent
		if (!campaignData.voiceAgentId) {
			return {
				success: false,
				error: "Campaign must have a voice agent assigned",
				data: null
			}
		}

		const voiceAgent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, campaignData.voiceAgentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!voiceAgent || voiceAgent.length === 0) {
			return {
				success: false,
				error: "Voice agent not found",
				data: null
			}
		}

		if (voiceAgent[0].status !== "active") {
			return {
				success: false,
				error: `Voice agent "${voiceAgent[0].name}" is not active`,
				data: null
			}
		}

		// Check if there are leads in the queue
		const queueCount = await db_ws
			.select({ count: sql<number>`COUNT(*)` })
			.from(campaignQueue)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId),
					eq(campaignQueue.status, "queued")
				)
			)

		if (queueCount[0].count === 0) {
			return {
				success: false,
				error: "No leads in queue to call",
				data: null
			}
		}

		// Update campaign status to running
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "running",
				updatedAt: new Date()
			})
			.where(eq(campaigns.id, campaignId))
			.returning()

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error starting campaign directly:", error)
		return {
			success: false,
			error: "Failed to start campaign",
			data: null
		}
	}
}
