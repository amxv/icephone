"use server"

import { auth } from "@/lib/auth/session"
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, calls, leads, voiceAgents } from "@/db/schema"

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
	| "archived"

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

// Add archive and cleanup functionality

// Archive a campaign (soft delete)
export async function archiveCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const [updatedCampaign] = await db_ws
			.update(campaigns)
			.set({
				status: "archived",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!updatedCampaign) {
			return { success: false, error: "Campaign not found" }
		}

		return { success: true, data: updatedCampaign }
	} catch (error) {
		console.error("Error archiving campaign:", error)
		return { success: false, error: "Failed to archive campaign" }
	}
}

// Unarchive a campaign
export async function unarchiveCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const [updatedCampaign] = await db_ws
			.update(campaigns)
			.set({
				status: "draft",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!updatedCampaign) {
			return { success: false, error: "Campaign not found" }
		}

		return { success: true, data: updatedCampaign }
	} catch (error) {
		console.error("Error unarchiving campaign:", error)
		return { success: false, error: "Failed to unarchive campaign" }
	}
}

// Bulk archive campaigns
export async function bulkArchiveCampaigns(campaignIds: number[]) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const result = await db_ws
			.update(campaigns)
			.set({
				status: "archived",
				updatedAt: new Date()
			})
			.where(
				and(
					sql`${campaigns.id} = ANY(${campaignIds})`,
					eq(campaigns.userId, userId)
				)
			)
			.returning({ id: campaigns.id })

		return { success: true, data: result }
	} catch (error) {
		console.error("Error bulk archiving campaigns:", error)
		return { success: false, error: "Failed to archive campaigns" }
	}
}

// Get archived campaigns
export async function getArchivedCampaigns(filter: CampaignFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [
			eq(campaigns.userId, userId),
			eq(campaigns.status, "archived")
		]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${campaigns.name} ILIKE ${searchPattern} OR ${campaigns.description} ILIKE ${searchPattern})`
			)
		}

		const condition = and(...whereConditions)

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
		console.error("Error fetching archived campaigns:", error)
		return { success: false, error: "Failed to fetch archived campaigns" }
	}
}

// Permanently delete an archived campaign and all related data
export async function permanentlyDeleteCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Verify campaign is archived and belongs to user
		const campaignCheck = await db_ws
			.select({ id: campaigns.id, status: campaigns.status })
			.from(campaigns)
			.where(
				and(
					eq(campaigns.id, campaignId),
					eq(campaigns.userId, userId),
					eq(campaigns.status, "archived")
				)
			)
			.limit(1)

		if (!campaignCheck.length) {
			return {
				success: false,
				error: "Campaign not found or not archived"
			}
		}

		// Delete related data in transaction
		await db_ws.transaction(async (tx) => {
			// Delete calls associated with this campaign
			await tx
				.delete(calls)
				.where(
					and(
						eq(calls.campaignId, campaignId),
						eq(calls.userId, userId)
					)
				)

			// Delete the campaign
			await tx
				.delete(campaigns)
				.where(
					and(
						eq(campaigns.id, campaignId),
						eq(campaigns.userId, userId)
					)
				)
		})

		return { success: true }
	} catch (error) {
		console.error("Error permanently deleting campaign:", error)
		return { success: false, error: "Failed to delete campaign" }
	}
}

// Duplicate a campaign with modified name
export async function duplicateCampaign(campaignId: number, newName?: string) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Get the original campaign
		const originalResult = await db_ws
			.select()
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!originalResult || originalResult.length === 0) {
			return { success: false, error: "Campaign not found" }
		}

		const original = originalResult[0]

		// Create the duplicate with modified data
		const duplicateData = {
			name: newName || `${original.name} (Copy)`,
			description: original.description
				? `${original.description} (Duplicated)`
				: null,
			startDate: null, // Reset dates for new campaign
			endDate: null,
			status: "draft" as CampaignStatus, // Always start as draft
			voiceAgentId: original.voiceAgentId,
			campaignSettings: original.campaignSettings,
			userId: userId
		}

		const [newCampaign] = await db_ws
			.insert(campaigns)
			.values(duplicateData)
			.returning()

		return { success: true, data: newCampaign }
	} catch (error) {
		console.error("Error duplicating campaign:", error)
		return { success: false, error: "Failed to duplicate campaign" }
	}
}

// Create campaign template from existing campaign
export async function createCampaignTemplate(
	campaignId: number,
	templateName: string,
	templateDescription?: string
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Get the original campaign
		const originalResult = await db_ws
			.select()
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!originalResult || originalResult.length === 0) {
			return { success: false, error: "Campaign not found" }
		}

		const original = originalResult[0]

		// Create template with cleaned data
		const templateData = {
			name: templateName,
			description:
				templateDescription || `Template based on ${original.name}`,
			startDate: null,
			endDate: null,
			status: "draft" as CampaignStatus,
			voiceAgentId: original.voiceAgentId,
			campaignSettings: {
				...original.campaignSettings,
				// Mark as template in settings
				isTemplate: true,
				originalCampaignId: campaignId
			},
			userId: userId
		}

		const [template] = await db_ws
			.insert(campaigns)
			.values(templateData)
			.returning()

		return { success: true, data: template }
	} catch (error) {
		console.error("Error creating campaign template:", error)
		return { success: false, error: "Failed to create campaign template" }
	}
}

// Get campaign templates for user
export async function getCampaignTemplates() {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const templates = await db_ws
			.select()
			.from(campaigns)
			.where(
				and(
					eq(campaigns.userId, userId),
					sql`${campaigns.campaignSettings}->>'isTemplate' = 'true'`
				)
			)
			.orderBy(desc(campaigns.updatedAt))

		return { success: true, data: templates }
	} catch (error) {
		console.error("Error fetching campaign templates:", error)
		return { success: false, error: "Failed to fetch campaign templates" }
	}
}

// Create campaign from template
export async function createCampaignFromTemplate(
	templateId: number,
	campaignData: {
		name: string
		description?: string
		startDate?: Date
		endDate?: Date
	}
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Get the template
		const templateResult = await db_ws
			.select()
			.from(campaigns)
			.where(
				and(
					eq(campaigns.id, templateId),
					eq(campaigns.userId, userId),
					sql`${campaigns.campaignSettings}->>'isTemplate' = 'true'`
				)
			)
			.limit(1)

		if (!templateResult || templateResult.length === 0) {
			return { success: false, error: "Template not found" }
		}

		const template = templateResult[0]

		// Create new campaign from template
		const newCampaignData = {
			name: campaignData.name,
			description: campaignData.description || template.description,
			startDate: campaignData.startDate || null,
			endDate: campaignData.endDate || null,
			status: "draft" as CampaignStatus,
			voiceAgentId: template.voiceAgentId,
			campaignSettings: {
				...template.campaignSettings,
				// Remove template markers
				isTemplate: false,
				originalCampaignId: undefined,
				createdFromTemplate: templateId
			},
			userId: userId
		}

		const [newCampaign] = await db_ws
			.insert(campaigns)
			.values(newCampaignData)
			.returning()

		return { success: true, data: newCampaign }
	} catch (error) {
		console.error("Error creating campaign from template:", error)
		return {
			success: false,
			error: "Failed to create campaign from template"
		}
	}
}
