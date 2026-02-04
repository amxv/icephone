"use server"

import { db_ws as db } from "@/db"
import {
	leads,
	voiceAgents,
	calls,
	voiceSessions,
	appointments,
	campaigns,
	textMessages,
	knowledgeFiles,
	auditLogs,
	teamMembers,
	users
} from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { count, desc, eq, and, gte, lte, ne } from "drizzle-orm"
import { z } from "zod"

interface ActivityMetadata {
	duration?: number
	leadId?: number
	status?: string
	leadName?: string
	score?: number
	agentName?: string
	agentStatus?: string
	title?: string
	startTime?: Date
}

interface ActivityItem {
	id: number
	type: string
	description: string
	userId: string
	metadata: ActivityMetadata
	createdAt: Date
}

const emptySchema = z.object({}).default({})
const adminActivitySchema = z
	.object({
		limit: z.number().int().min(1).max(50).default(10)
	})
	.default({})
const auditLogFilterSchema = z
	.object({
		limit: z.number().int().min(1).max(100).default(50),
		offset: z.number().int().min(0).default(0),
		action: z.string().trim().min(1).optional(),
		entityType: z.string().trim().min(1).optional(),
		actorUserId: z.string().trim().min(1).optional(),
		startDate: z.coerce.date().optional(),
		endDate: z.coerce.date().optional()
	})
	.default({})

async function requireAdmin() {
	const { teamId, user } = await requireTeam()
	const ownerUserId = process.env.OWNER_USER_ID

	if (ownerUserId && user.id !== ownerUserId) {
		throw new Error("Admin access required")
	}

	const [membership] = await db
		.select({ role: teamMembers.role })
		.from(teamMembers)
		.where(
			and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id))
		)
		.limit(1)

	if (!membership || membership.role !== "owner") {
		throw new Error("Admin access required")
	}

	return { teamId, user }
}

export async function getAdminStats(rawInput: Record<string, never> = {}) {
	emptySchema.parse(rawInput)
	const { teamId, user } = await requireAdmin()

	try {
		const currentMonthStart = new Date()
		currentMonthStart.setDate(1)
		currentMonthStart.setHours(0, 0, 0, 0)

		const [
			totalUsersResult,
			thisMonthUsersResult,
			totalVoiceAgentsResult,
			activeVoiceAgentsResult,
			totalCallsResult,
			thisMonthCallsResult,
			totalVoiceSessionsResult,
			thisMonthVoiceSessionsResult,
			totalLeadsResult,
			thisMonthLeadsResult
		] = await Promise.all([
			db
				.select({ count: count() })
				.from(teamMembers)
				.where(eq(teamMembers.teamId, teamId)),

			db
				.select({ count: count() })
				.from(teamMembers)
				.where(
					and(
						eq(teamMembers.teamId, teamId),
						gte(teamMembers.createdAt, currentMonthStart)
					)
				),

			db
				.select({ count: count() })
				.from(voiceAgents)
				.where(teamScope(voiceAgents, teamId)),

			db
				.select({ count: count() })
				.from(voiceAgents)
				.where(
					and(
						teamScope(voiceAgents, teamId),
						eq(voiceAgents.status, "active")
					)
				),

			db
				.select({ count: count() })
				.from(calls)
				.where(teamScope(calls, teamId)),

			db
				.select({ count: count() })
				.from(calls)
				.where(
					and(
						teamScope(calls, teamId),
						gte(calls.startTime, currentMonthStart)
					)
				),

			db
				.select({ count: count(voiceSessions.id) })
				.from(voiceSessions)
				.innerJoin(
					voiceAgents,
					eq(voiceSessions.agentId, voiceAgents.id)
				)
				.where(teamScope(voiceAgents, teamId)),

			db
				.select({ count: count(voiceSessions.id) })
				.from(voiceSessions)
				.innerJoin(
					voiceAgents,
					eq(voiceSessions.agentId, voiceAgents.id)
				)
				.where(
					and(
						teamScope(voiceAgents, teamId),
						gte(voiceSessions.startTime, currentMonthStart)
					)
				),

			db
				.select({ count: count() })
				.from(leads)
				.where(teamScope(leads, teamId)),

			db
				.select({ count: count() })
				.from(leads)
				.where(
					and(
						teamScope(leads, teamId),
						gte(leads.createdAt, currentMonthStart)
					)
				)
		])

		const totalUsers = totalUsersResult[0]?.count || 0
		const newUsersThisMonth = thisMonthUsersResult[0]?.count || 0
		const totalVoiceAgents = totalVoiceAgentsResult[0]?.count || 0
		const activeVoiceAgents = activeVoiceAgentsResult[0]?.count || 0
		const totalCalls =
			(totalCallsResult[0]?.count || 0) +
			(totalVoiceSessionsResult[0]?.count || 0)
		const callsThisMonth =
			(thisMonthCallsResult[0]?.count || 0) +
			(thisMonthVoiceSessionsResult[0]?.count || 0)
		const totalLeads = totalLeadsResult[0]?.count || 0
		const leadsThisMonth = thisMonthLeadsResult[0]?.count || 0

		const stats = {
			totalUsers,
			newUsersThisMonth,
			totalVoiceAgents,
			activeVoiceAgents,
			totalCalls,
			callsThisMonth,
			totalLeads,
			leadsThisMonth
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "admin.stats.read",
			entityType: "admin",
			entityId: null,
			metadata: { periodStart: currentMonthStart.toISOString() }
		})

		return stats
	} catch (error) {
		console.error("Error fetching admin stats:", error)
		throw new Error("Failed to fetch admin statistics")
	}
}

function normalizeActivityType(action: string) {
	return action.replace(/\./g, "_")
}

function formatActivityDescription(
	action: string,
	metadata?: ActivityMetadata
) {
	if (metadata?.title) {
		return metadata.title
	}

	const cleaned = action.replace(/[._]/g, " ").trim()
	if (!cleaned) {
		return "Activity update"
	}

	return cleaned
		.split(" ")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")
}

export async function getRecentActivity(rawInput: { limit?: number } = {}) {
	const { teamId, user } = await requireAdmin()
	const { limit } = adminActivitySchema.parse(rawInput)

	try {
		const activityLogs = await db
			.select({
				id: auditLogs.id,
				action: auditLogs.action,
				entityType: auditLogs.entityType,
				metadata: auditLogs.metadata,
				createdAt: auditLogs.createdAt,
				actorUserId: auditLogs.actorUserId,
				actorName: users.name,
				actorEmail: users.email,
				actorImage: users.image
			})
			.from(auditLogs)
			.leftJoin(users, eq(auditLogs.actorUserId, users.id))
			.where(
				and(
					eq(auditLogs.teamId, teamId),
					ne(auditLogs.entityType, "analytics"),
					ne(auditLogs.entityType, "admin")
				)
			)
			.orderBy(desc(auditLogs.createdAt))
			.limit(limit)

		const activities = activityLogs.map((log) => {
			const metadata = (log.metadata || {}) as ActivityMetadata
			return {
				id: log.id,
				type: normalizeActivityType(log.action),
				description: formatActivityDescription(log.action, metadata),
				userId: log.actorUserId || "unknown",
				metadata,
				createdAt: log.createdAt,
				uniqueKey: `audit_${log.id}`,
				user: {
					name: log.actorName || "Unknown User",
					email: log.actorEmail || "unknown@example.com",
					avatar: log.actorImage || null
				},
				timestamp: formatTimeAgo(log.createdAt)
			}
		})

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "admin.activity.read",
			entityType: "admin",
			entityId: null,
			metadata: { limit }
		})

		return activities
	} catch (error) {
		console.error("Error fetching recent activity:", error)
		throw new Error("Failed to fetch recent activity")
	}
}

function formatTimeAgo(date: Date): string {
	const now = new Date()
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

	if (diffInSeconds < 60) {
		return `${diffInSeconds} seconds ago`
	}

	if (diffInSeconds < 3600) {
		const minutes = Math.floor(diffInSeconds / 60)
		return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
	}

	if (diffInSeconds < 86400) {
		const hours = Math.floor(diffInSeconds / 3600)
		return `${hours} hour${hours > 1 ? "s" : ""} ago`
	}

	const days = Math.floor(diffInSeconds / 86400)
	return `${days} day${days > 1 ? "s" : ""} ago`
}

export async function getDatabaseOverview(
	rawInput: Record<string, never> = {}
) {
	emptySchema.parse(rawInput)
	const { teamId, user } = await requireAdmin()

	try {
		const [
			leadsCount,
			callsCount,
			voiceSessionsCount,
			appointmentsCount,
			campaignsCount,
			voiceAgentsCount,
			textMessagesCount,
			knowledgeDocsCount
		] = await Promise.all([
			db
				.select({ count: count() })
				.from(leads)
				.where(teamScope(leads, teamId)),
			db
				.select({ count: count() })
				.from(calls)
				.where(teamScope(calls, teamId)),
			db
				.select({ count: count(voiceSessions.id) })
				.from(voiceSessions)
				.innerJoin(
					voiceAgents,
					eq(voiceSessions.agentId, voiceAgents.id)
				)
				.where(teamScope(voiceAgents, teamId)),
			db
				.select({ count: count() })
				.from(appointments)
				.where(teamScope(appointments, teamId)),
			db
				.select({ count: count() })
				.from(campaigns)
				.where(teamScope(campaigns, teamId)),
			db
				.select({ count: count() })
				.from(voiceAgents)
				.where(teamScope(voiceAgents, teamId)),
			db
				.select({ count: count() })
				.from(textMessages)
				.innerJoin(leads, eq(textMessages.leadId, leads.id))
				.where(teamScope(leads, teamId)),
			db
				.select({ count: count() })
				.from(knowledgeFiles)
				.where(teamScope(knowledgeFiles, teamId))
		])

		const overview = {
			leads: leadsCount[0]?.count || 0,
			calls:
				(callsCount[0]?.count || 0) +
				(voiceSessionsCount[0]?.count || 0),
			appointments: appointmentsCount[0]?.count || 0,
			campaigns: campaignsCount[0]?.count || 0,
			voiceAgents: voiceAgentsCount[0]?.count || 0,
			textMessages: textMessagesCount[0]?.count || 0,
			knowledgeDocuments: knowledgeDocsCount[0]?.count || 0
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "admin.database_overview.read",
			entityType: "admin",
			entityId: null,
			metadata: {}
		})

		return overview
	} catch (error) {
		console.error("Error fetching database overview:", error)
		throw new Error("Failed to fetch database overview")
	}
}

export async function getAuditLogs(
	rawInput: {
		limit?: number
		offset?: number
		action?: string
		entityType?: string
		actorUserId?: string
		startDate?: Date
		endDate?: Date
	} = {}
) {
	const { teamId, user } = await requireAdmin()
	const filters = auditLogFilterSchema.parse(rawInput)

	try {
		const conditions = [eq(auditLogs.teamId, teamId)]

		if (filters.action) {
			conditions.push(eq(auditLogs.action, filters.action))
		}
		if (filters.entityType) {
			conditions.push(eq(auditLogs.entityType, filters.entityType))
		}
		if (filters.actorUserId) {
			conditions.push(eq(auditLogs.actorUserId, filters.actorUserId))
		}
		if (filters.startDate) {
			conditions.push(gte(auditLogs.createdAt, filters.startDate))
		}
		if (filters.endDate) {
			conditions.push(lte(auditLogs.createdAt, filters.endDate))
		}

		const whereClause =
			conditions.length === 1 ? conditions[0] : and(...conditions)

		const [totalResult, rows] = await Promise.all([
			db.select({ count: count() }).from(auditLogs).where(whereClause),
			db
				.select({
					id: auditLogs.id,
					action: auditLogs.action,
					entityType: auditLogs.entityType,
					entityId: auditLogs.entityId,
					metadata: auditLogs.metadata,
					createdAt: auditLogs.createdAt,
					actorUserId: auditLogs.actorUserId,
					actorName: users.name,
					actorEmail: users.email,
					actorImage: users.image
				})
				.from(auditLogs)
				.leftJoin(users, eq(auditLogs.actorUserId, users.id))
				.where(whereClause)
				.orderBy(desc(auditLogs.createdAt))
				.limit(filters.limit)
				.offset(filters.offset)
		])

		const total = totalResult[0]?.count || 0

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "admin.audit_logs.read",
			entityType: "admin",
			entityId: null,
			metadata: {
				limit: filters.limit,
				offset: filters.offset,
				action: filters.action ?? null,
				entityType: filters.entityType ?? null
			}
		})

		return {
			total,
			limit: filters.limit,
			offset: filters.offset,
			logs: rows.map((row) => ({
				id: row.id,
				action: row.action,
				entityType: row.entityType,
				entityId: row.entityId,
				metadata: row.metadata || {},
				createdAt: row.createdAt,
				actor: {
					id: row.actorUserId,
					name: row.actorName || "Unknown User",
					email: row.actorEmail || "unknown@example.com",
					avatar: row.actorImage || null
				}
			}))
		}
	} catch (error) {
		console.error("Error fetching audit logs:", error)
		throw new Error("Failed to fetch audit logs")
	}
}
