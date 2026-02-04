"use server"

import { db_ws } from "@/db"
import {
	appointments,
	calls,
	leadNotes,
	leadStatusEnum,
	leads,
	textMessages
} from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { teamScope, withTeamId } from "@/lib/team-scope"
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { z } from "zod"

type LeadStatus = (typeof leadStatusEnum.enumValues)[number]
const leadStatusValues = leadStatusEnum.enumValues as [
	LeadStatus,
	...LeadStatus[]
]
const leadSortFields = [
	"createdAt",
	"updatedAt",
	"score",
	"name",
	"status"
] as const

const leadFilterSchema = z
	.object({
		search: z.string().trim().min(1).optional(),
		status: z.array(z.enum(leadStatusValues)).optional(),
		minScore: z.coerce.number().min(0).max(100).optional(),
		maxScore: z.coerce.number().min(0).max(100).optional(),
		orderBy: z.enum(leadSortFields).optional(),
		orderDir: z.enum(["asc", "desc"]).optional()
	})
	.default({})

const createLeadSchema = z.object({
	name: z.string().trim().min(2),
	email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
	phone: z.union([z.string(), z.null()]).optional(),
	score: z.coerce.number().min(0).max(100).optional(),
	status: z.enum(leadStatusValues).optional(),
	source: z.union([z.string(), z.null()]).optional(),
	notes: z.union([z.string(), z.null()]).optional()
})

const updateLeadSchema = z
	.object({
		name: z.string().trim().min(2).optional(),
		email: z
			.union([z.string().email(), z.literal(""), z.null()])
			.optional(),
		phone: z.union([z.string(), z.null()]).optional(),
		score: z.coerce.number().min(0).max(100).optional(),
		status: z.enum(leadStatusValues).optional(),
		source: z.union([z.string(), z.null()]).optional(),
		notes: z.union([z.string(), z.null()]).optional(),
		assignedUserId: z.string().optional().nullable()
	})
	.strict()

const leadIdSchema = z.number().int().positive()

const leadNoteSchema = z.object({
	leadId: leadIdSchema,
	body: z.string().trim().min(1)
})

function toOptionalString(value: string | null | undefined) {
	if (value === undefined) return undefined
	if (value === null) return null
	const trimmed = value.trim()
	return trimmed.length ? trimmed : null
}

// Get all leads with optional filtering
export async function listLeads(rawFilter: unknown = {}) {
	try {
		const filter = leadFilterSchema.parse(rawFilter)
		const { teamId } = await requireTeam()

		const whereConditions = [teamScope(leads, teamId)]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${leads.name} ILIKE ${searchPattern} OR ${leads.email} ILIKE ${searchPattern} OR ${leads.phone} ILIKE ${searchPattern})`
			)
		}

		if (filter.status && filter.status.length > 0) {
			whereConditions.push(inArray(leads.status, filter.status))
		}

		if (filter.minScore !== undefined) {
			whereConditions.push(gte(leads.score, filter.minScore))
		}

		if (filter.maxScore !== undefined) {
			whereConditions.push(lte(leads.score, filter.maxScore))
		}

		const orderDir = filter.orderDir === "asc" ? asc : desc
		const orderColumn = filter.orderBy
			? {
					createdAt: leads.createdAt,
					updatedAt: leads.updatedAt,
					score: leads.score,
					name: leads.name,
					status: leads.status
				}[filter.orderBy]
			: leads.updatedAt

		const leadsData = await db_ws
			.select()
			.from(leads)
			.where(and(...whereConditions))
			.orderBy(orderDir(orderColumn))

		return { data: leadsData, success: true, error: null }
	} catch (error) {
		console.error("Error getting leads:", error)
		return { error: "Failed to get leads", success: false, data: null }
	}
}

// Get a single lead by ID
export async function getLead(leadId: number) {
	try {
		const parsedLeadId = leadIdSchema.parse(leadId)
		const { teamId } = await requireTeam()

		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, parsedLeadId), teamScope(leads, teamId)))
			.limit(1)

		if (!lead.length) {
			return { success: false, error: "Lead not found" }
		}

		const [leadAppointments, leadCalls, leadTextMessages] =
			await Promise.all([
				db_ws
					.select()
					.from(appointments)
					.where(
						and(
							eq(appointments.leadId, parsedLeadId),
							teamScope(appointments, teamId)
						)
					)
					.orderBy(desc(appointments.startTime)),
				db_ws
					.select()
					.from(calls)
					.where(
						and(
							eq(calls.leadId, parsedLeadId),
							teamScope(calls, teamId)
						)
					)
					.orderBy(desc(calls.startTime)),
				db_ws
					.select()
					.from(textMessages)
					.where(eq(textMessages.leadId, parsedLeadId))
					.orderBy(desc(textMessages.sentAt))
			])

		return {
			success: true,
			data: {
				lead: lead[0],
				appointments: leadAppointments,
				calls: leadCalls,
				textMessages: leadTextMessages
			}
		}
	} catch (error) {
		console.error("Error getting lead details:", error)
		return { success: false, error: "Failed to retrieve lead details" }
	}
}

// Create a new lead
export async function createLead(rawData: unknown) {
	try {
		const data = createLeadSchema.parse(rawData)
		const { teamId, user } = await requireTeam()

		const result = await db_ws
			.insert(leads)
			.values(
				withTeamId(
					{
						name: data.name.trim(),
						email: toOptionalString(data.email),
						phone: toOptionalString(data.phone),
						score: data.score ?? 0,
						status: data.status ?? "new",
						source: toOptionalString(data.source),
						notes: toOptionalString(data.notes),
						createdByUserId: user.id,
						userId: user.id,
						createdAt: new Date(),
						updatedAt: new Date()
					},
					teamId
				)
			)
			.returning()

		const createdLead = result[0]
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "lead_created",
			entityType: "lead",
			entityId: createdLead?.id,
			metadata: {
				name: createdLead?.name,
				status: createdLead?.status
			}
		})

		return { data: createdLead, success: true, error: null }
	} catch (error) {
		console.error("Error creating lead:", error)
		return { error: "Failed to create lead", success: false, data: null }
	}
}

// Update an existing lead
export async function updateLead(id: number, rawData: unknown) {
	try {
		const parsedId = leadIdSchema.parse(id)
		const data = updateLeadSchema.parse(rawData)
		const { teamId, user } = await requireTeam()

		const updateData: Record<string, unknown> = {
			updatedAt: new Date()
		}

		if (data.name !== undefined) updateData.name = data.name.trim()
		if (data.email !== undefined)
			updateData.email = toOptionalString(data.email)
		if (data.phone !== undefined)
			updateData.phone = toOptionalString(data.phone)
		if (data.score !== undefined) updateData.score = data.score
		if (data.status !== undefined) updateData.status = data.status
		if (data.source !== undefined)
			updateData.source = toOptionalString(data.source)
		if (data.notes !== undefined)
			updateData.notes = toOptionalString(data.notes)
		if (data.assignedUserId !== undefined)
			updateData.assignedUserId = data.assignedUserId

		const updatedFields = Object.keys(updateData).filter(
			(field) => field !== "updatedAt"
		)

		if (updatedFields.length === 0) {
			return {
				error: "No updates provided",
				success: false,
				data: null
			}
		}

		const result = await db_ws
			.update(leads)
			.set(updateData)
			.where(and(eq(leads.id, parsedId), teamScope(leads, teamId)))
			.returning()

		if (!result.length) {
			return {
				error: "Lead not found or update failed",
				success: false,
				data: null
			}
		}

		const updatedLead = result[0]
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "lead_updated",
			entityType: "lead",
			entityId: updatedLead.id,
			metadata: {
				updatedFields
			}
		})

		return { data: updatedLead, success: true, error: null }
	} catch (error) {
		console.error("Error updating lead:", error)
		return { error: "Failed to update lead", success: false, data: null }
	}
}

export async function updateLeadStatus(leadId: number, status: string) {
	try {
		const parsedLeadId = leadIdSchema.parse(leadId)
		const parsedStatus = z.enum(leadStatusValues).parse(status)
		const { teamId, user } = await requireTeam()

		const result = await db_ws
			.update(leads)
			.set({
				status: parsedStatus,
				updatedAt: new Date()
			})
			.where(and(eq(leads.id, parsedLeadId), teamScope(leads, teamId)))
			.returning()

		if (!result.length) {
			return {
				error: "Lead not found or update failed",
				success: false,
				data: null
			}
		}

		const updatedLead = result[0]
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "lead_status_updated",
			entityType: "lead",
			entityId: updatedLead.id,
			metadata: {
				status: parsedStatus
			}
		})

		return { data: updatedLead, success: true, error: null }
	} catch (error) {
		console.error("Error updating lead status:", error)
		return {
			error: "Failed to update lead status",
			success: false,
			data: null
		}
	}
}

export async function createLeadNote(rawData: unknown) {
	try {
		const data = leadNoteSchema.parse(rawData)
		const { teamId, user } = await requireTeam()

		const existingLead = await db_ws
			.select({ id: leads.id })
			.from(leads)
			.where(and(eq(leads.id, data.leadId), teamScope(leads, teamId)))
			.limit(1)

		if (!existingLead.length) {
			return { error: "Lead not found", success: false, data: null }
		}

		const result = await db_ws
			.insert(leadNotes)
			.values({
				teamId,
				leadId: data.leadId,
				body: data.body,
				createdByUserId: user.id,
				createdAt: new Date()
			})
			.returning()

		const note = result[0]
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "lead_note_created",
			entityType: "lead_note",
			entityId: note?.id,
			metadata: {
				leadId: data.leadId
			}
		})

		return { data: note, success: true, error: null }
	} catch (error) {
		console.error("Error creating lead note:", error)
		return {
			error: "Failed to create lead note",
			success: false,
			data: null
		}
	}
}

// Delete a lead
export async function deleteLead(id: number) {
	try {
		const parsedId = leadIdSchema.parse(id)
		const { teamId, user } = await requireTeam()

		const result = await db_ws
			.delete(leads)
			.where(and(eq(leads.id, parsedId), teamScope(leads, teamId)))
			.returning()

		if (!result.length) {
			return {
				error: "Lead not found or delete failed",
				success: false,
				data: null
			}
		}

		const deletedLead = result[0]
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "lead_deleted",
			entityType: "lead",
			entityId: deletedLead.id,
			metadata: {
				name: deletedLead.name
			}
		})

		return { data: deletedLead, success: true, error: null }
	} catch (error) {
		console.error("Error deleting lead:", error)
		return { error: "Failed to delete lead", success: false, data: null }
	}
}

// Backwards-compatible exports
export const getLeads = listLeads
export const getLeadById = getLead
