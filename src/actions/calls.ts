"use server"

import { db_ws } from "@/db"
import { calls, callEvents, leads, voiceAgents } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { z } from "zod"

const callTypeValues = ["incoming", "outgoing"] as const

const callFilterSchema = z
	.object({
		search: z.string().trim().min(1).optional(),
		type: z.array(z.enum(callTypeValues)).optional(),
		status: z.array(z.string()).optional(),
		startDate: z.coerce.date().optional(),
		endDate: z.coerce.date().optional(),
		orderBy: z.enum(["startTime", "createdAt", "updatedAt"]).optional(),
		orderDir: z.enum(["asc", "desc"]).optional(),
		campaignId: z.number().int().optional()
	})
	.default({})

const callOutcomeSchema = z.object({
	status: z.string().optional(),
	summary: z.string().nullable().optional(),
	transcript: z.string().nullable().optional(),
	sentiment: z.string().nullable().optional(),
	recordingUrl: z.string().nullable().optional(),
	cost: z.string().nullable().optional(),
	sessionId: z.string().nullable().optional(),
	endTime: z.coerce.date().nullable().optional(),
	duration: z.coerce.number().int().nullable().optional(),
	metadata: z.record(z.unknown()).optional()
})

const callEventSchema = z.object({
	callId: z.number().int().positive(),
	type: z.enum(["transcript", "tool_call", "tool_result", "status"]),
	payload: z.record(z.unknown()).optional()
})

// Get all calls with optional filtering
export async function getCalls(rawFilter: unknown = {}) {
	try {
		const filter = callFilterSchema.parse(rawFilter)
		const { teamId } = await requireTeam()

		const whereConditions = [teamScope(calls, teamId)]

		if (filter.campaignId !== undefined) {
			whereConditions.push(eq(calls.campaignId, filter.campaignId))
		}

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${calls.summary} ILIKE ${searchPattern} OR ${calls.transcript} ILIKE ${searchPattern})`
			)
		}

		if (filter.status && filter.status.length > 0) {
			whereConditions.push(inArray(calls.status, filter.status))
		}

		if (filter.type && filter.type.length > 0) {
			whereConditions.push(inArray(calls.type, filter.type))
		}

		if (filter.startDate) {
			whereConditions.push(gte(calls.startTime, filter.startDate))
		}

		if (filter.endDate) {
			whereConditions.push(lte(calls.startTime, filter.endDate))
		}

		const orderDir = filter.orderDir === "asc" ? asc : desc
		const orderColumn = filter.orderBy
			? {
					startTime: calls.startTime,
					createdAt: calls.createdAt,
					updatedAt: calls.updatedAt
				}[filter.orderBy]
			: calls.startTime

		const callsData = await db_ws
			.select({
				id: sql<string>`'call_' || ${calls.id}`,
				leadId: calls.leadId,
				leadName: leads.name,
				type: calls.type,
				duration: calls.duration,
				startTime: calls.startTime,
				summary: calls.summary,
				transcript: calls.transcript,
				recordingUrl: calls.recordingUrl,
				status: calls.status,
				createdAt: calls.createdAt,
				updatedAt: calls.updatedAt,
				source: sql<string>`'calls'`,
				campaignId: calls.campaignId,
				agentId: calls.agentId,
				agentName: voiceAgents.name,
				sessionId: calls.sessionId,
				cost: calls.cost,
				sentiment: calls.sentiment
			})
			.from(calls)
			.leftJoin(leads, eq(calls.leadId, leads.id))
			.leftJoin(voiceAgents, eq(calls.agentId, voiceAgents.id))
			.where(and(...whereConditions))
			.orderBy(orderDir(orderColumn))

		return { data: callsData, success: true, error: null }
	} catch (error) {
		console.error("Error getting calls:", error)
		return { error: "Failed to get calls", success: false, data: null }
	}
}

// Get a single call by ID
export async function getCallById(callId: string) {
	try {
		const { teamId } = await requireTeam()

		const actualId = callId.replace(/^call_/, "")
		const parsedId = Number(actualId)
		if (!Number.isFinite(parsedId)) {
			return { success: false, error: "Invalid call ID", data: null }
		}

		const callData = await db_ws
			.select({
				id: sql<string>`'call_' || ${calls.id}`,
				leadId: calls.leadId,
				leadName: leads.name,
				type: calls.type,
				duration: calls.duration,
				startTime: calls.startTime,
				summary: calls.summary,
				transcript: calls.transcript,
				recordingUrl: calls.recordingUrl,
				status: calls.status,
				createdAt: calls.createdAt,
				updatedAt: calls.updatedAt,
				source: sql<string>`'calls'`,
				campaignId: calls.campaignId,
				agentId: calls.agentId,
				agentName: voiceAgents.name,
				sessionId: calls.sessionId,
				cost: calls.cost,
				sentiment: calls.sentiment
			})
			.from(calls)
			.leftJoin(leads, eq(calls.leadId, leads.id))
			.leftJoin(voiceAgents, eq(calls.agentId, voiceAgents.id))
			.where(and(eq(calls.id, parsedId), teamScope(calls, teamId)))
			.limit(1)

		if (!callData.length) {
			return { success: false, error: "Call not found", data: null }
		}

		return { success: true, data: callData[0], error: null }
	} catch (error) {
		console.error("Error getting call details:", error)
		return {
			success: false,
			error: "Failed to retrieve call details",
			data: null
		}
	}
}

export async function updateCallOutcome(callId: number, rawData: unknown) {
	try {
		const data = callOutcomeSchema.parse(rawData)
		const { teamId, user } = await requireTeam()

		const updateData: Record<string, unknown> = {
			updatedAt: new Date()
		}

		if (data.status !== undefined) updateData.status = data.status
		if (data.summary !== undefined) updateData.summary = data.summary
		if (data.transcript !== undefined)
			updateData.transcript = data.transcript
		if (data.sentiment !== undefined) updateData.sentiment = data.sentiment
		if (data.recordingUrl !== undefined)
			updateData.recordingUrl = data.recordingUrl
		if (data.cost !== undefined) updateData.cost = data.cost
		if (data.sessionId !== undefined) updateData.sessionId = data.sessionId
		if (data.endTime !== undefined) updateData.endTime = data.endTime
		if (data.duration !== undefined) updateData.duration = data.duration
		if (data.metadata !== undefined) updateData.metadata = data.metadata

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
			.update(calls)
			.set(updateData)
			.where(and(eq(calls.id, callId), teamScope(calls, teamId)))
			.returning()

		if (!result.length) {
			return {
				error: "Call not found or update failed",
				success: false,
				data: null
			}
		}

		const updatedCall = result[0]
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "call_updated",
			entityType: "call",
			entityId: updatedCall.id,
			metadata: {
				updatedFields
			}
		})

		return { data: updatedCall, success: true, error: null }
	} catch (error) {
		console.error("Error updating call:", error)
		return { error: "Failed to update call", success: false, data: null }
	}
}

export async function attachCallToLead(callId: number, leadId: number) {
	try {
		const { teamId, user } = await requireTeam()

		const result = await db_ws
			.update(calls)
			.set({
				leadId,
				updatedAt: new Date()
			})
			.where(and(eq(calls.id, callId), teamScope(calls, teamId)))
			.returning()

		if (!result.length) {
			return { error: "Call not found", success: false, data: null }
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "call_attached_to_lead",
			entityType: "call",
			entityId: callId,
			metadata: {
				leadId
			}
		})

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error attaching call to lead:", error)
		return { error: "Failed to attach call", success: false, data: null }
	}
}

export async function createCallEvent(rawData: unknown) {
	try {
		const data = callEventSchema.parse(rawData)
		const { teamId, user } = await requireTeam()

		const callRow = await db_ws
			.select({ id: calls.id })
			.from(calls)
			.where(and(eq(calls.id, data.callId), teamScope(calls, teamId)))
			.limit(1)

		if (!callRow.length) {
			return { error: "Call not found", success: false, data: null }
		}

		const [event] = await db_ws
			.insert(callEvents)
			.values({
				callId: data.callId,
				type: data.type,
				payload: data.payload ?? {},
				createdAt: new Date()
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "call_event_created",
			entityType: "call_event",
			entityId: event.id,
			metadata: {
				callId: data.callId,
				type: data.type
			}
		})

		return { data: event, success: true, error: null }
	} catch (error) {
		console.error("Error creating call event:", error)
		return {
			error: "Failed to create call event",
			success: false,
			data: null
		}
	}
}
