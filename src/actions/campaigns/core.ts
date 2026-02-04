"use server"

import { db_ws } from "@/db"
import {
	appointments,
	calls,
	callQueue,
	campaignLeads,
	campaigns,
	leads,
	voiceAgents
} from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { teamScope, withTeamId } from "@/lib/team-scope"
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { z } from "zod"

export interface CampaignFilter {
	search?: string
	status?: string[]
	startDate?: Date
	endDate?: Date
	orderBy?: "name" | "startDate" | "status" | "updatedAt"
	orderDir?: "asc" | "desc"
}

const campaignStatusValues = [
	"draft",
	"scheduled",
	"running",
	"paused",
	"completed",
	"cancelled",
	"archived"
] as const

export type CampaignStatus = (typeof campaignStatusValues)[number]

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

export type CampaignTemplate = {
	id: number
	name: string
	description: string | null
	startDate: Date | null
	endDate: Date | null
	status: CampaignStatus | null
	voiceAgentId: number | null
	campaignSettings: Record<string, unknown> | null
	createdAt: Date
	updatedAt: Date
	userId: string
	teamId: string
}

const campaignFilterSchema = z
	.object({
		search: z.string().trim().min(1).optional(),
		status: z.array(z.enum(campaignStatusValues)).optional(),
		startDate: z.coerce.date().optional(),
		endDate: z.coerce.date().optional(),
		orderBy: z
			.enum(["name", "startDate", "status", "updatedAt"])
			.optional(),
		orderDir: z.enum(["asc", "desc"]).optional()
	})
	.default({})

const campaignCreateSchema = z.object({
	name: z.string().trim().min(2),
	description: z.string().trim().optional().nullable(),
	startDate: z.coerce.date().optional().nullable(),
	endDate: z.coerce.date().optional().nullable(),
	status: z.enum(campaignStatusValues).optional(),
	voiceAgentId: z.number().int().optional().nullable(),
	campaignSettings: z.record(z.unknown()).optional()
})

const campaignUpdateSchema = campaignCreateSchema.partial().strict()

// Get campaigns with basic lead metrics
export async function getCampaigns(rawFilter: unknown = {}) {
	try {
		const filter = campaignFilterSchema.parse(rawFilter)
		const { teamId } = await requireTeam()

		const whereConditions = [teamScope(campaigns, teamId)]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${campaigns.name} ILIKE ${searchPattern} OR ${campaigns.description} ILIKE ${searchPattern})`
			)
		}

		if (filter.status && filter.status.length > 0) {
			whereConditions.push(inArray(campaigns.status, filter.status))
		}

		if (filter.startDate) {
			whereConditions.push(gte(campaigns.startDate, filter.startDate))
		}

		if (filter.endDate) {
			whereConditions.push(lte(campaigns.endDate, filter.endDate))
		}

		const leadMetrics = db_ws
			.select({
				campaignId: campaignLeads.campaignId,
				leadsCount:
					sql<number>`COUNT(DISTINCT ${campaignLeads.leadId})`.as(
						"leadsCount"
					),
				leadsConverted:
					sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} = 'converted' THEN ${campaignLeads.leadId} END)`.as(
						"leadsConverted"
					),
				leadsContacted:
					sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} IN ('contacted','qualified','converted') THEN ${campaignLeads.leadId} END)`.as(
						"leadsContacted"
					)
			})
			.from(campaignLeads)
			.leftJoin(leads, eq(campaignLeads.leadId, leads.id))
			.where(teamScope(campaignLeads, teamId))
			.groupBy(campaignLeads.campaignId)
			.as("lead_metrics")

		const callMetrics = db_ws
			.select({
				campaignId: calls.campaignId,
				callsCompleted:
					sql<number>`COUNT(CASE WHEN ${calls.status} IN ('completed', 'answered') THEN 1 END)`.as(
						"callsCompleted"
					),
				avgCallDuration:
					sql<number>`COALESCE(ROUND(AVG(CASE WHEN ${calls.duration} > 0 THEN ${calls.duration} END)), 0)::int`.as(
						"avgCallDuration"
					)
			})
			.from(calls)
			.where(
				and(
					teamScope(calls, teamId),
					sql`${calls.campaignId} IS NOT NULL`
				)
			)
			.groupBy(calls.campaignId)
			.as("call_metrics")

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
				leadsCount: sql<number>`COALESCE(${leadMetrics.leadsCount}, 0)`,
				leadsConverted: sql<number>`COALESCE(${leadMetrics.leadsConverted}, 0)`,
				leadsContacted: sql<number>`COALESCE(${leadMetrics.leadsContacted}, 0)`,
				callsCompleted: sql<number>`COALESCE(${callMetrics.callsCompleted}, 0)`,
				avgCallDuration: sql<number>`COALESCE(${callMetrics.avgCallDuration}, 0)`,
				voiceAgentName: voiceAgents.name
			})
			.from(campaigns)
			.leftJoin(leadMetrics, eq(leadMetrics.campaignId, campaigns.id))
			.leftJoin(callMetrics, eq(callMetrics.campaignId, campaigns.id))
			.leftJoin(voiceAgents, eq(campaigns.voiceAgentId, voiceAgents.id))
			.where(and(...whereConditions))
			.orderBy(desc(campaigns.updatedAt))

		return { success: true, data: campaignsData, error: null }
	} catch (error) {
		console.error("Error fetching campaigns:", error)
		return { success: false, error: "Failed to fetch campaigns" }
	}
}

// Get a single campaign by ID
export async function getCampaignById(campaignId: number) {
	try {
		const { teamId } = await requireTeam()

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
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaignResult.length) {
			return { success: false, error: "Campaign not found", data: null }
		}

		return { success: true, data: campaignResult[0], error: null }
	} catch (error) {
		console.error("Error fetching campaign by ID:", error)
		return { success: false, error: "Failed to fetch campaign", data: null }
	}
}

export async function createCampaign(campaignData: EnhancedCampaignData) {
	return createEnhancedCampaign(campaignData)
}

// Create enhanced campaign (full settings)
export async function createEnhancedCampaign(
	campaignData: EnhancedCampaignData
) {
	try {
		const { teamId, user } = await requireTeam()
		const parsed = campaignCreateSchema.parse(campaignData)

		const [newCampaign] = await db_ws
			.insert(campaigns)
			.values(
				withTeamId(
					{
						name: parsed.name,
						description: parsed.description || null,
						startDate: parsed.startDate ?? null,
						endDate: parsed.endDate ?? null,
						status: (parsed.status || "draft") as CampaignStatus,
						voiceAgentId: parsed.voiceAgentId || null,
						campaignSettings: parsed.campaignSettings || {},
						createdAt: new Date(),
						updatedAt: new Date(),
						createdByUserId: user.id,
						userId: user.id
					},
					teamId
				)
			)
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "campaign_created",
			entityType: "campaign",
			entityId: newCampaign.id,
			metadata: { name: newCampaign.name }
		})

		return { success: true, data: newCampaign, error: null }
	} catch (error) {
		console.error("Error creating campaign:", error)
		return {
			success: false,
			error: "Failed to create campaign",
			data: null
		}
	}
}

export async function updateCampaign(
	campaignId: number,
	campaignData: Partial<EnhancedCampaignData>
) {
	try {
		const { teamId, user } = await requireTeam()
		const parsed = campaignUpdateSchema.parse(campaignData)

		const [updatedCampaign] = await db_ws
			.update(campaigns)
			.set({
				...parsed,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		if (!updatedCampaign) {
			return { success: false, error: "Campaign not found", data: null }
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "campaign_updated",
			entityType: "campaign",
			entityId: updatedCampaign.id,
			metadata: { updatedFields: Object.keys(parsed) }
		})

		return { success: true, data: updatedCampaign, error: null }
	} catch (error) {
		console.error("Error updating campaign:", error)
		return {
			success: false,
			error: "Failed to update campaign",
			data: null
		}
	}
}

export async function deleteCampaign(campaignId: number) {
	try {
		const { teamId, user } = await requireTeam()

		const [deletedCampaign] = await db_ws
			.delete(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		if (!deletedCampaign) {
			return { success: false, error: "Campaign not found", data: null }
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "campaign_deleted",
			entityType: "campaign",
			entityId: deletedCampaign.id
		})

		return { success: true, data: deletedCampaign, error: null }
	} catch (error) {
		console.error("Error deleting campaign:", error)
		return {
			success: false,
			error: "Failed to delete campaign",
			data: null
		}
	}
}

export async function getCampaignTemplates() {
	return { success: true, data: [] as CampaignTemplate[] }
}

export async function createCampaignFromTemplate(
	templateId: number,
	overrides?: Partial<EnhancedCampaignData>
) {
	try {
		const templates = await getCampaignTemplates()
		const template = templates.data.find((item) => item.id === templateId)

		if (!template) {
			return { success: false, error: "Template not found", data: null }
		}

		const templateData = template as CampaignTemplate
		const campaignData: EnhancedCampaignData = {
			name: String(templateData.name || "New Campaign"),
			description: templateData.description as string | undefined,
			startDate: templateData.startDate as Date | undefined,
			endDate: templateData.endDate as Date | undefined,
			status: (templateData.status as CampaignStatus) || "draft",
			voiceAgentId: templateData.voiceAgentId as number | undefined,
			campaignSettings: templateData.campaignSettings as
				| EnhancedCampaignData["campaignSettings"]
				| undefined,
			...overrides
		}

		return createEnhancedCampaign(campaignData)
	} catch (error) {
		console.error("Error creating campaign from template:", error)
		return {
			success: false,
			error: "Failed to create campaign from template",
			data: null
		}
	}
}

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
		const { teamId, user } = await requireTeam()

		const campaign = await db_ws
			.select({ id: campaigns.id })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign.length) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		const validLeads = await db_ws
			.select({ id: leads.id })
			.from(leads)
			.where(and(inArray(leads.id, leadIds), teamScope(leads, teamId)))

		if (validLeads.length !== leadIds.length) {
			return {
				success: false,
				error: "Some leads not found",
				data: null
			}
		}

		const existingAssignments = await db_ws
			.select({ leadId: campaignLeads.leadId })
			.from(campaignLeads)
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					inArray(campaignLeads.leadId, leadIds),
					teamScope(campaignLeads, teamId)
				)
			)

		const existingLeadIds = new Set(
			existingAssignments.map((item) => item.leadId)
		)

		const newLeadIds = leadIds.filter((id) => !existingLeadIds.has(id))

		if (!newLeadIds.length) {
			return { success: true, data: [], error: null }
		}

		const assignmentData = newLeadIds.map((leadId) => ({
			campaignId,
			leadId,
			teamId,
			priority: options?.priority || 0,
			maxAttempts: options?.maxAttempts || 3,
			notes: options?.notes || null,
			assignedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
			userId: user.id
		}))

		const assignments = await db_ws
			.insert(campaignLeads)
			.values(assignmentData)
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "campaign_leads_assigned",
			entityType: "campaign",
			entityId: campaignId,
			metadata: { count: assignments.length }
		})

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

export async function removeLeadFromCampaign(
	campaignId: number,
	leadId: number
) {
	try {
		const { teamId, user } = await requireTeam()

		const deletedAssignment = await db_ws
			.delete(campaignLeads)
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					eq(campaignLeads.leadId, leadId),
					teamScope(campaignLeads, teamId)
				)
			)
			.returning()

		if (!deletedAssignment.length) {
			return {
				success: false,
				error: "Lead assignment not found"
			}
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "campaign_lead_removed",
			entityType: "campaign",
			entityId: campaignId,
			metadata: { leadId }
		})

		return { success: true, error: null }
	} catch (error) {
		console.error("Error removing lead from campaign:", error)
		return { success: false, error: "Failed to remove lead from campaign" }
	}
}

export async function getCampaignLeads(campaignId: number) {
	try {
		const { teamId } = await requireTeam()

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
					teamScope(campaignLeads, teamId)
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
		const { teamId, user } = await requireTeam()

		const [newLead] = await db_ws
			.insert(leads)
			.values(
				withTeamId(
					{
						name: leadData.name,
						email: leadData.email || null,
						phone: leadData.phone || null,
						source: leadData.source || "Campaign",
						notes: leadData.notes || null,
						status: "new",
						score: 0,
						createdAt: new Date(),
						updatedAt: new Date(),
						createdByUserId: user.id,
						userId: user.id
					},
					teamId
				)
			)
			.returning()

		if (campaignId) {
			await assignLeadsToCampaign(campaignId, [newLead.id])
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "lead_created",
			entityType: "lead",
			entityId: newLead.id,
			metadata: { source: "campaign" }
		})

		return { success: true, leadId: newLead.id }
	} catch (error) {
		console.error("Error creating lead and assigning to campaign:", error)
		return { success: false, error: "Failed to create lead" }
	}
}

export async function startCampaign(campaignId: number) {
	try {
		const { teamId } = await requireTeam()
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign.length) {
			return { success: false, error: "Campaign not found", data: null }
		}

		if (!campaign[0].voiceAgentId) {
			return {
				success: false,
				error: "Campaign must have a voice agent assigned",
				data: null
			}
		}

		return updateCampaignStatus(campaignId, "running")
	} catch (error) {
		console.error("Error starting campaign:", error)
		return { success: false, error: "Failed to start campaign", data: null }
	}
}

export async function pauseCampaign(campaignId: number) {
	return updateCampaignStatus(campaignId, "paused")
}

export async function resumeCampaign(campaignId: number) {
	return updateCampaignStatus(campaignId, "running")
}

export async function stopCampaign(campaignId: number) {
	return updateCampaignStatus(campaignId, "cancelled")
}

async function updateCampaignStatus(
	campaignId: number,
	status: CampaignStatus
) {
	try {
		const { teamId, user } = await requireTeam()

		const [updatedCampaign] = await db_ws
			.update(campaigns)
			.set({
				status,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		if (!updatedCampaign) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "campaign_status_updated",
			entityType: "campaign",
			entityId: updatedCampaign.id,
			metadata: { status }
		})

		return { success: true, data: updatedCampaign, error: null }
	} catch (error) {
		console.error("Error updating campaign status:", error)
		return {
			success: false,
			error: "Failed to update campaign",
			data: null
		}
	}
}

export async function getCampaignExecutionStatus(campaignId: number) {
	try {
		const { teamId } = await requireTeam()

		const campaignResult = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate,
				campaignSettings: campaigns.campaignSettings
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaignResult.length) {
			return { success: false, error: "Campaign not found", data: null }
		}

		const [leadStats, queueStats, appointmentStats] = await Promise.all([
			db_ws
				.select({
					total: sql<number>`COUNT(*)`.as("total"),
					converted:
						sql<number>`COUNT(CASE WHEN ${leads.status} = 'converted' THEN 1 END)`.as(
							"converted"
						)
				})
				.from(campaignLeads)
				.leftJoin(leads, eq(campaignLeads.leadId, leads.id))
				.where(
					and(
						eq(campaignLeads.campaignId, campaignId),
						teamScope(campaignLeads, teamId)
					)
				),
			db_ws
				.select({
					total: sql<number>`COUNT(*)`.as("total"),
					queued: sql<number>`COUNT(CASE WHEN ${callQueue.status} = 'queued' THEN 1 END)`.as(
						"queued"
					),
					completed:
						sql<number>`COUNT(CASE WHEN ${callQueue.status} = 'completed' THEN 1 END)`.as(
							"completed"
						)
				})
				.from(callQueue)
				.where(
					and(
						eq(callQueue.campaignId, campaignId),
						teamScope(callQueue, teamId)
					)
				),
			db_ws
				.select({
					booked: sql<number>`COUNT(CASE WHEN ${appointments.status} IN ('scheduled', 'completed') THEN 1 END)`.as(
						"booked"
					),
					completed:
						sql<number>`COUNT(CASE WHEN ${appointments.status} = 'completed' THEN 1 END)`.as(
							"completed"
						)
				})
				.from(campaignLeads)
				.innerJoin(
					appointments,
					and(
						eq(appointments.leadId, campaignLeads.leadId),
						eq(appointments.teamId, campaignLeads.teamId)
					)
				)
				.where(
					and(
						eq(campaignLeads.campaignId, campaignId),
						teamScope(campaignLeads, teamId)
					)
				)
		])

		return {
			success: true,
			data: {
				campaign: campaignResult[0],
				leads: {
					total: leadStats?.[0]?.total || 0,
					converted: leadStats?.[0]?.converted || 0
				},
				queue: {
					total: queueStats?.[0]?.total || 0,
					queued: queueStats?.[0]?.queued || 0,
					completed: queueStats?.[0]?.completed || 0
				},
				appointments: {
					booked: appointmentStats?.[0]?.booked || 0,
					completed: appointmentStats?.[0]?.completed || 0
				}
			},
			error: null
		}
	} catch (error) {
		console.error("Error fetching campaign execution status:", error)
		return { success: false, error: "Failed to fetch status", data: null }
	}
}
