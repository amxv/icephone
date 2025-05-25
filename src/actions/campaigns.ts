"use server"

import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, lte, sql, type SQL, inArray } from "drizzle-orm"

import { db_ws } from "@/db"
import {
	campaigns,
	calls,
	leads,
	campaignLeads,
	campaignQueue,
	voiceAgents
} from "@/db/schema"

// Define the campaign filter interface
export interface CampaignFilter {
	search?: string
	status?: string[]
	startDate?: Date
	endDate?: Date
	orderBy?: "name" | "startDate" | "status" | "updatedAt"
	orderDir?: "asc" | "desc"
}

// Define campaign status type
export type CampaignStatus =
	| "draft"
	| "scheduled"
	| "running"
	| "paused"
	| "completed"
	| "cancelled"

// Enhanced campaign data interface for creation with voice agent assignment
export interface EnhancedCampaignData {
	name: string
	description?: string
	startDate?: Date
	endDate?: Date
	status?: CampaignStatus
	voiceAgentId?: number
	campaignSettings?: {
		callTiming?: {
			businessHours?: {
				enabled: boolean
				timezone: string
				schedule: {
					[key: string]: { start: string; end: string } | null
				}
			}
			maxCallsPerDay?: number
			callInterval?: number
		}
		retryLogic?: {
			maxAttempts: number
			retryIntervals: number[]
			retryConditions: string[]
		}
		successCriteria?: {
			convertedStatuses: string[]
			qualifiedStatuses: string[]
		}
		goals?: {
			targetLeads?: number
			targetConversions?: number
			targetCallsPerDay?: number
		}
		automation?: {
			autoProgressLeads: boolean
			autoScheduleFollowups: boolean
			autoUpdateScores: boolean
		}
	}
}

// Get all campaigns with optional filtering
export async function getCampaigns(filter: CampaignFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [eq(campaigns.userId, userId)]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${campaigns.name} ILIKE ${searchPattern} OR ${campaigns.description} ILIKE ${searchPattern})`
			)
		}

		if (filter.status && filter.status.length > 0) {
			whereConditions.push(
				sql`${campaigns.status} = ANY(${filter.status})`
			)
		}

		if (filter.startDate) {
			whereConditions.push(gte(campaigns.startDate, filter.startDate))
		}

		if (filter.endDate) {
			whereConditions.push(lte(campaigns.endDate, filter.endDate))
		}

		const condition = and(...whereConditions)

		// Get campaigns with aggregated lead counts
		const campaignsData = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				description: campaigns.description,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate,
				createdAt: campaigns.createdAt,
				updatedAt: campaigns.updatedAt,
				leadsCount: sql<number>`COUNT(DISTINCT ${calls.leadId})`.as(
					"leadsCount"
				),
				leadsConverted:
					sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} = 'converted' THEN ${calls.leadId} END)`.as(
						"leadsConverted"
					)
			})
			.from(campaigns)
			.leftJoin(calls, eq(calls.campaignId, campaigns.id))
			.leftJoin(leads, eq(leads.id, calls.leadId))
			.where(condition)
			.groupBy(campaigns.id)
			.orderBy(desc(campaigns.updatedAt))

		return { success: true, data: campaignsData }
	} catch (error) {
		console.error("Error fetching campaigns:", error)
		return { success: false, error: "Failed to fetch campaigns" }
	}
}

// Get a single campaign by ID with detailed metrics
export async function getCampaignById(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaignResult = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				description: campaigns.description,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate,
				createdAt: campaigns.createdAt,
				updatedAt: campaigns.updatedAt,
				userId: campaigns.userId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaignResult || campaignResult.length === 0) {
			return { success: false, error: "Campaign not found", data: null }
		}

		const campaign = campaignResult[0]

		// Get campaign metrics
		const metricsResult = await db_ws
			.select({
				totalCalls: sql<number>`COUNT(*)`.as("totalCalls"),
				totalLeads: sql<number>`COUNT(DISTINCT ${calls.leadId})`.as(
					"totalLeads"
				),
				convertedLeads:
					sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} = 'converted' THEN ${calls.leadId} END)`.as(
						"convertedLeads"
					),
				avgDuration: sql<number>`AVG(${calls.duration})`.as(
					"avgDuration"
				)
			})
			.from(calls)
			.leftJoin(leads, eq(leads.id, calls.leadId))
			.where(
				and(eq(calls.campaignId, campaignId), eq(calls.userId, userId))
			)

		const metrics = metricsResult[0] || {
			totalCalls: 0,
			totalLeads: 0,
			convertedLeads: 0,
			avgDuration: 0
		}

		return {
			success: true,
			data: {
				...campaign,
				metrics
			},
			error: null
		}
	} catch (error) {
		console.error("Error fetching campaign by ID:", error)
		return { success: false, error: "Failed to fetch campaign", data: null }
	}
}

// Create a new campaign
export async function createCampaign(campaignData: {
	name: string
	description?: string
	startDate?: Date
	endDate?: Date
	status?: CampaignStatus
}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const newCampaign = await db_ws
			.insert(campaigns)
			.values({
				...campaignData,
				userId,
				status: (campaignData.status || "draft") as CampaignStatus
			})
			.returning()

		return { success: true, data: newCampaign[0], error: null }
	} catch (error) {
		console.error("Error creating campaign:", error)
		return {
			success: false,
			error: "Failed to create campaign",
			data: null
		}
	}
}

// Update an existing campaign
export async function updateCampaign(
	campaignId: number,
	campaignData: {
		name?: string
		description?: string
		startDate?: Date
		endDate?: Date
		status?: CampaignStatus
	}
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				...campaignData,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!updatedCampaign || updatedCampaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		return { success: true, data: updatedCampaign[0], error: null }
	} catch (error) {
		console.error("Error updating campaign:", error)
		return {
			success: false,
			error: "Failed to update campaign",
			data: null
		}
	}
}

// Delete a campaign
export async function deleteCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const deletedCampaign = await db_ws
			.delete(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!deletedCampaign || deletedCampaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized"
			}
		}

		return { success: true, error: null }
	} catch (error) {
		console.error("Error deleting campaign:", error)
		return { success: false, error: "Failed to delete campaign" }
	}
}

// Enhanced campaign creation with voice agent assignment and settings
export async function createEnhancedCampaign(
	campaignData: EnhancedCampaignData
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate voice agent if provided
		if (campaignData.voiceAgentId) {
			const agentExists = await db_ws
				.select({ id: voiceAgents.id })
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, campaignData.voiceAgentId),
						eq(voiceAgents.userId, userId)
					)
				)
				.limit(1)

			if (!agentExists || agentExists.length === 0) {
				return {
					success: false,
					error: "Voice agent not found or unauthorized",
					data: null
				}
			}
		}

		const newCampaign = await db_ws
			.insert(campaigns)
			.values({
				name: campaignData.name,
				description: campaignData.description,
				startDate: campaignData.startDate,
				endDate: campaignData.endDate,
				status: (campaignData.status || "draft") as CampaignStatus,
				voiceAgentId: campaignData.voiceAgentId,
				campaignSettings: campaignData.campaignSettings || {},
				userId
			})
			.returning()

		return { success: true, data: newCampaign[0], error: null }
	} catch (error) {
		console.error("Error creating enhanced campaign:", error)
		return {
			success: false,
			error: "Failed to create campaign",
			data: null
		}
	}
}

// Assign voice agent to existing campaign
export async function assignVoiceAgentToCampaign(
	campaignId: number,
	voiceAgentId: number
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

		// Validate voice agent ownership
		const voiceAgent = await db_ws
			.select({ id: voiceAgents.id })
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, voiceAgentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!voiceAgent || voiceAgent.length === 0) {
			return {
				success: false,
				error: "Voice agent not found or unauthorized",
				data: null
			}
		}

		// Update campaign with voice agent
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				voiceAgentId,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		return { success: true, data: updatedCampaign[0], error: null }
	} catch (error) {
		console.error("Error assigning voice agent to campaign:", error)
		return {
			success: false,
			error: "Failed to assign voice agent",
			data: null
		}
	}
}

// Configure campaign settings
export async function configureCampaignSettings(
	campaignId: number,
	settings: EnhancedCampaignData["campaignSettings"]
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				campaignSettings: settings || {},
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!updatedCampaign || updatedCampaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		return { success: true, data: updatedCampaign[0], error: null }
	} catch (error) {
		console.error("Error configuring campaign settings:", error)
		return {
			success: false,
			error: "Failed to configure campaign settings",
			data: null
		}
	}
}

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

// Add leads to campaign queue
export async function addLeadsToQueue(
	campaignId: number,
	leadIds: number[],
	scheduledTime?: Date,
	priority: number = 0
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

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
					eq(campaignLeads.userId, userId)
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
		const queueData = campaignLeadIds.map((campaignLead) => ({
			campaignId,
			campaignLeadId: campaignLead.id,
			scheduledTime: scheduledTime || new Date(),
			priority,
			userId
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
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const deletedQueueEntry = await db_ws
			.delete(campaignQueue)
			.where(
				and(
					eq(campaignQueue.id, queueId),
					eq(campaignQueue.userId, userId)
				)
			)
			.returning()

		if (!deletedQueueEntry || deletedQueueEntry.length === 0) {
			return {
				success: false,
				error: "Queue entry not found or unauthorized"
			}
		}

		return { success: true, error: null }
	} catch (error) {
		console.error("Error removing lead from queue:", error)
		return { success: false, error: "Failed to remove lead from queue" }
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

// Get campaign queue status
export async function getCampaignQueue(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

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
					eq(campaignQueue.userId, userId)
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

		// Validate all queue entries belong to this campaign and user
		const queueIds = queueUpdates.map((update) => update.queueId)
		const validQueueEntries = await db_ws
			.select({ id: campaignQueue.id })
			.from(campaignQueue)
			.where(
				and(
					inArray(campaignQueue.id, queueIds),
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId)
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

// Validate campaign configuration and check for conflicts
export async function validateCampaignConfiguration(
	campaignData: EnhancedCampaignData,
	campaignId?: number
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, conflicts: [] }
		}

		const conflicts: string[] = []

		// Validate voice agent assignment
		if (campaignData.voiceAgentId) {
			const voiceAgent = await db_ws
				.select({
					id: voiceAgents.id,
					name: voiceAgents.name,
					status: voiceAgents.status,
					phoneNumberId: voiceAgents.phoneNumberId
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
				conflicts.push("Selected voice agent not found or unauthorized")
			} else {
				const agent = voiceAgent[0]

				// Check if voice agent is active
				if (agent.status !== "active") {
					conflicts.push(
						`Voice agent "${agent.name}" is not active (current status: ${agent.status})`
					)
				}

				// Check if voice agent has a phone number assigned
				if (!agent.phoneNumberId) {
					conflicts.push(
						`Voice agent "${agent.name}" does not have a phone number assigned`
					)
				}

				// Check for conflicting campaigns using the same voice agent at the same time
				if (campaignData.startDate && campaignData.endDate) {
					const conflictingCampaigns = await db_ws
						.select({
							id: campaigns.id,
							name: campaigns.name,
							startDate: campaigns.startDate,
							endDate: campaigns.endDate
						})
						.from(campaigns)
						.where(
							and(
								eq(
									campaigns.voiceAgentId,
									campaignData.voiceAgentId
								),
								eq(campaigns.userId, userId),
								eq(campaigns.status, "running"),
								campaignId
									? sql`${campaigns.id} != ${campaignId}`
									: sql`true`,
								// Check for date overlap
								sql`(
									(${campaigns.startDate} <= ${campaignData.endDate} AND ${campaigns.endDate} >= ${campaignData.startDate})
									OR (${campaigns.startDate} IS NULL OR ${campaigns.endDate} IS NULL)
								)`
							)
						)

					if (conflictingCampaigns.length > 0) {
						const conflictNames = conflictingCampaigns
							.map((c) => c.name)
							.join(", ")
						conflicts.push(
							`Voice agent "${agent.name}" is already assigned to active campaigns: ${conflictNames}`
						)
					}
				}
			}
		}

		// Validate campaign timing settings
		if (campaignData.campaignSettings?.callTiming?.businessHours?.enabled) {
			const schedule =
				campaignData.campaignSettings.callTiming.businessHours.schedule
			let hasValidSchedule = false

			// Check if at least one day is enabled with valid times
			for (const [day, times] of Object.entries(schedule)) {
				if (times?.start && times.end) {
					hasValidSchedule = true
					// Validate time format
					const startTime = new Date(`2000-01-01T${times.start}:00`)
					const endTime = new Date(`2000-01-01T${times.end}:00`)
					if (startTime >= endTime) {
						conflicts.push(
							`Invalid time range for ${day}: start time must be before end time`
						)
					}
				}
			}

			if (!hasValidSchedule) {
				conflicts.push(
					"Business hours are enabled but no valid schedule is defined"
				)
			}
		}

		// Validate retry logic
		if (campaignData.campaignSettings?.retryLogic) {
			const retryLogic = campaignData.campaignSettings.retryLogic
			if (retryLogic.maxAttempts < 1 || retryLogic.maxAttempts > 10) {
				conflicts.push("Max attempts must be between 1 and 10")
			}

			if (retryLogic.retryIntervals.length < retryLogic.maxAttempts - 1) {
				conflicts.push(
					"Number of retry intervals must be at least (max attempts - 1)"
				)
			}

			if (retryLogic.retryIntervals.some((interval) => interval < 1)) {
				conflicts.push("All retry intervals must be at least 1 hour")
			}
		}

		// Validate date ranges
		if (campaignData.startDate && campaignData.endDate) {
			if (campaignData.startDate >= campaignData.endDate) {
				conflicts.push("Start date must be before end date")
			}

			// Check if start date is in the past (for new campaigns)
			if (!campaignId && campaignData.startDate < new Date()) {
				conflicts.push("Start date cannot be in the past")
			}
		}

		return {
			success: true,
			conflicts,
			error: null
		}
	} catch (error) {
		console.error("Error validating campaign configuration:", error)
		return {
			success: false,
			error: "Failed to validate campaign configuration",
			conflicts: []
		}
	}
}

// CSV Import and Processing Functions

export interface CSVLeadData {
	name: string
	email?: string
	phone?: string
	source?: string
	notes?: string
	dealValue?: number
	expectedCloseDate?: string
}

export interface CSVImportResult {
	success: boolean
	totalRows: number
	successCount: number
	errorCount: number
	errors: Array<{
		row: number
		field?: string
		message: string
		data?: Partial<CSVLeadData>
	}>
	createdLeads: Array<{ id: number; name: string }>
	duplicatesFound: number
}

// Validate individual lead data from CSV
function validateCSVLeadData(
	data: Record<string, unknown>,
	rowIndex: number
): {
	isValid: boolean
	errors: Array<{ row: number; field?: string; message: string }>
	cleanData?: CSVLeadData
} {
	const errors: Array<{ row: number; field?: string; message: string }> = []

	// Required fields validation
	if (
		!data.name ||
		typeof data.name !== "string" ||
		data.name.trim().length === 0
	) {
		errors.push({
			row: rowIndex,
			field: "name",
			message: "Name is required and cannot be empty"
		})
	}

	// Phone validation - at least one contact method required
	const hasPhone =
		data.phone &&
		typeof data.phone === "string" &&
		data.phone.trim().length > 0
	const hasEmail =
		data.email &&
		typeof data.email === "string" &&
		data.email.trim().length > 0

	if (!hasPhone && !hasEmail) {
		errors.push({
			row: rowIndex,
			field: "contact",
			message: "At least one contact method (phone or email) is required"
		})
	}

	// Phone format validation
	if (hasPhone && typeof data.phone === "string") {
		const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
		const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, "")
		if (!phoneRegex.test(cleanPhone)) {
			errors.push({
				row: rowIndex,
				field: "phone",
				message: "Invalid phone number format"
			})
		}
	}

	// Email validation
	if (hasEmail && typeof data.email === "string") {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(data.email.trim())) {
			errors.push({
				row: rowIndex,
				field: "email",
				message: "Invalid email address format"
			})
		}
	}

	// Deal value validation
	if (
		data.dealValue !== undefined &&
		data.dealValue !== null &&
		data.dealValue !== ""
	) {
		const dealValue = Number(data.dealValue)
		if (Number.isNaN(dealValue) || dealValue < 0) {
			errors.push({
				row: rowIndex,
				field: "dealValue",
				message: "Deal value must be a non-negative number"
			})
		}
	}

	// Date validation
	if (
		data.expectedCloseDate &&
		typeof data.expectedCloseDate === "string" &&
		data.expectedCloseDate.trim().length > 0
	) {
		const date = new Date(data.expectedCloseDate.trim())
		if (Number.isNaN(date.getTime())) {
			errors.push({
				row: rowIndex,
				field: "expectedCloseDate",
				message: "Invalid date format for expected close date"
			})
		}
	}

	if (errors.length > 0) {
		return { isValid: false, errors }
	}

	// Return clean data
	const cleanData: CSVLeadData = {
		name: typeof data.name === "string" ? data.name.trim() : "",
		email:
			hasEmail && typeof data.email === "string"
				? data.email.trim()
				: undefined,
		phone:
			hasPhone && typeof data.phone === "string"
				? data.phone.replace(/[\s\-\(\)]/g, "")
				: undefined,
		source:
			data.source && typeof data.source === "string"
				? data.source.trim()
				: undefined,
		notes:
			data.notes && typeof data.notes === "string"
				? data.notes.trim()
				: undefined,
		dealValue:
			data.dealValue !== undefined &&
			data.dealValue !== null &&
			data.dealValue !== ""
				? Number(data.dealValue)
				: undefined,
		expectedCloseDate:
			data.expectedCloseDate &&
			typeof data.expectedCloseDate === "string" &&
			data.expectedCloseDate.trim().length > 0
				? data.expectedCloseDate.trim()
				: undefined
	}

	return { isValid: true, errors: [], cleanData }
}

// Detect and handle duplicate leads
async function findDuplicateLeads(
	leadData: CSVLeadData[],
	userId: string
): Promise<{
	duplicates: Array<{
		csvIndex: number
		existingLeadId: number
		field: string
	}>
	uniqueLeads: Array<{ csvIndex: number; data: CSVLeadData }>
}> {
	const duplicates: Array<{
		csvIndex: number
		existingLeadId: number
		field: string
	}> = []
	const uniqueLeads: Array<{ csvIndex: number; data: CSVLeadData }> = []

	for (let i = 0; i < leadData.length; i++) {
		const lead = leadData[i]
		let isDuplicate = false

		// Check for email duplicates
		if (lead.email) {
			const existingLead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(eq(leads.email, lead.email), eq(leads.userId, userId))
				)
				.limit(1)

			if (existingLead.length > 0) {
				duplicates.push({
					csvIndex: i,
					existingLeadId: existingLead[0].id,
					field: "email"
				})
				isDuplicate = true
			}
		}

		// Check for phone duplicates (only if not already duplicate by email)
		if (!isDuplicate && lead.phone) {
			const existingLead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(eq(leads.phone, lead.phone), eq(leads.userId, userId))
				)
				.limit(1)

			if (existingLead.length > 0) {
				duplicates.push({
					csvIndex: i,
					existingLeadId: existingLead[0].id,
					field: "phone"
				})
				isDuplicate = true
			}
		}

		if (!isDuplicate) {
			uniqueLeads.push({ csvIndex: i, data: lead })
		}
	}

	return { duplicates, uniqueLeads }
}

// Main CSV processing function
export async function processCSVImport(
	csvData: string,
	campaignId?: number,
	options?: {
		skipDuplicates?: boolean
		validateOnly?: boolean
	}
): Promise<CSVImportResult> {
	try {
		const { userId } = await auth()
		if (!userId) {
			throw new Error("Unauthorized")
		}

		// Parse CSV data (using papaparse)
		const Papa = await import("papaparse")
		const parseResult = Papa.parse(csvData, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header: string) => {
				// Normalize common header variations
				const normalized = header.toLowerCase().trim()
				const headerMap: Record<string, string> = {
					"full name": "name",
					fullname: "name",
					"lead name": "name",
					"customer name": "name",
					"contact name": "name",
					"phone number": "phone",
					telephone: "phone",
					mobile: "phone",
					cell: "phone",
					"email address": "email",
					"e-mail": "email",
					mail: "email",
					"lead source": "source",
					comments: "notes",
					description: "notes",
					"deal amount": "dealValue",
					value: "dealValue",
					amount: "dealValue",
					"close date": "expectedCloseDate",
					"expected close": "expectedCloseDate"
				}
				return headerMap[normalized] || normalized
			}
		})

		if (parseResult.errors.length > 0) {
			return {
				success: false,
				totalRows: 0,
				successCount: 0,
				errorCount: 1,
				errors: [
					{
						row: 0,
						message: `CSV parsing error: ${parseResult.errors[0].message}`
					}
				],
				createdLeads: [],
				duplicatesFound: 0
			}
		}

		const rawData = parseResult.data as Record<string, unknown>[]
		const totalRows = rawData.length
		const errors: CSVImportResult["errors"] = []
		const validLeads: CSVLeadData[] = []

		// Validate each row
		for (let i = 0; i < rawData.length; i++) {
			const validation = validateCSVLeadData(rawData[i], i + 1)
			if (validation.isValid && validation.cleanData) {
				validLeads.push(validation.cleanData)
			} else {
				errors.push(
					...validation.errors.map((error) => ({
						...error,
						data: rawData[i]
					}))
				)
			}
		}

		// If validation only, return early
		if (options?.validateOnly) {
			return {
				success: true,
				totalRows,
				successCount: validLeads.length,
				errorCount: errors.length,
				errors,
				createdLeads: [],
				duplicatesFound: 0
			}
		}

		// Check for duplicates
		const { duplicates, uniqueLeads } = await findDuplicateLeads(
			validLeads,
			userId
		)

		// Filter out duplicates if skipDuplicates is true
		const leadsToCreate = options?.skipDuplicates
			? uniqueLeads.map((item) => item.data)
			: validLeads

		// Add duplicate errors if not skipping
		if (!options?.skipDuplicates) {
			for (const dup of duplicates) {
				errors.push({
					row: dup.csvIndex + 1,
					field: dup.field,
					message: `Duplicate ${dup.field} found (existing lead ID: ${dup.existingLeadId})`
				})
			}
		}

		// Create leads in database
		const createdLeads: Array<{ id: number; name: string }> = []

		if (leadsToCreate.length > 0) {
			const leadInsertData = leadsToCreate.map((lead) => ({
				name: lead.name,
				email: lead.email || null,
				phone: lead.phone || null,
				source: lead.source || "CSV Import",
				notes: lead.notes || null,
				dealValue: lead.dealValue ? lead.dealValue.toString() : null,
				expectedCloseDate: lead.expectedCloseDate
					? new Date(lead.expectedCloseDate)
					: null,
				status: "new" as const,
				userId
			}))

			const insertedLeads = await db_ws
				.insert(leads)
				.values(leadInsertData)
				.returning({ id: leads.id, name: leads.name })

			createdLeads.push(...insertedLeads)

			// If campaignId is provided, assign leads to the campaign
			if (campaignId && insertedLeads.length > 0) {
				const leadIds = insertedLeads.map((lead) => lead.id)
				await assignLeadsToCampaign(campaignId, leadIds, {
					priority: 0,
					notes: "Added via CSV import"
				})
			}
		}

		return {
			success: true,
			totalRows,
			successCount: createdLeads.length,
			errorCount: errors.length,
			errors,
			createdLeads,
			duplicatesFound: duplicates.length
		}
	} catch (error) {
		console.error("Error processing CSV import:", error)
		return {
			success: false,
			totalRows: 0,
			successCount: 0,
			errorCount: 1,
			errors: [
				{
					row: 0,
					message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			],
			createdLeads: [],
			duplicatesFound: 0
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
