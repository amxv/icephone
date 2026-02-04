"use server"

import { currentUser } from "@/lib/auth/session"
import { count, desc, eq, gte, sql, and, lte } from "drizzle-orm"
import { db_ws as db } from "@/db"
import {
	leads,
	calls,
	voiceAgents,
	appointments,
	campaigns,
	users,
	sessions
} from "@/db/schema"

// Admin authentication helper
async function requireAdmin() {
	const user = await currentUser()
	const ownerUserId = process.env.OWNER_USER_ID

	if (!user || !ownerUserId || user.id !== ownerUserId) {
		throw new Error("Admin access required")
	}

	return user
}

// Enhanced user information with platform activity
interface PlatformUser {
	id: string
	email: string | null
	firstName: string | null
	lastName: string | null
	imageUrl: string | null
	createdAt: number
	lastSignInAt: number | null
	// Platform activity stats
	leadsCount: number
	callsCount: number
	voiceAgentsCount: number
	appointmentsCount: number
	campaignsCount: number
	lastActivityAt: Date | null
	isActive: boolean // Based on admin status toggle
}

interface UserActivity {
	id: string
	type:
		| "lead_created"
		| "call_made"
		| "agent_created"
		| "appointment_scheduled"
		| "campaign_created"
	description: string
	timestamp: Date
	metadata?: Record<string, unknown>
}

function splitName(name: string | null) {
	if (!name) return { firstName: null, lastName: null }
	const parts = name.trim().split(/\s+/)
	if (parts.length === 1) {
		return { firstName: parts[0], lastName: null }
	}
	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(" ")
	}
}

async function getLastSignInMap() {
	const signIns = await db
		.select({
			userId: sessions.userId,
			lastSignInAt: sql<Date>`max(${sessions.updatedAt})`
		})
		.from(sessions)
		.groupBy(sessions.userId)

	return new Map(
		signIns.map((row) => [row.userId, row.lastSignInAt || null])
	)
}

async function getLastActivityAt(userId: string) {
	const [lastLead, lastCall, lastAgent, lastAppointment, lastCampaign] =
		await Promise.all([
			db
				.select({ last: sql<Date>`max(${leads.updatedAt})` })
				.from(leads)
				.where(eq(leads.userId, userId)),
			db
				.select({ last: sql<Date>`max(${calls.createdAt})` })
				.from(calls)
				.where(eq(calls.userId, userId)),
			db
				.select({ last: sql<Date>`max(${voiceAgents.updatedAt})` })
				.from(voiceAgents)
				.where(eq(voiceAgents.userId, userId)),
			db
				.select({ last: sql<Date>`max(${appointments.updatedAt})` })
				.from(appointments)
				.where(eq(appointments.userId, userId)),
			db
				.select({ last: sql<Date>`max(${campaigns.updatedAt})` })
				.from(campaigns)
				.where(eq(campaigns.userId, userId))
		])

	const candidates = [
		lastLead?.[0]?.last,
		lastCall?.[0]?.last,
		lastAgent?.[0]?.last,
		lastAppointment?.[0]?.last,
		lastCampaign?.[0]?.last
	].filter(Boolean) as Date[]

	if (!candidates.length) return null
	return new Date(Math.max(...candidates.map((date) => date.getTime())))
}

/**
 * Get all platform users with comprehensive activity data
 */
export async function getAllUsers(): Promise<PlatformUser[]> {
	await requireAdmin()

	try {
		const [dbUsers, lastSignInMap] = await Promise.all([
			db
				.select({
					id: users.id,
					name: users.name,
					email: users.email,
					image: users.image,
					createdAt: users.createdAt,
					isActive: users.isActive
				})
				.from(users)
				.orderBy(desc(users.createdAt))
				.limit(500),
			getLastSignInMap()
		])

		const userActivityPromises = dbUsers.map(async (dbUser) => {
			const [
				leadsStats,
				callsStats,
				agentsStats,
				appointmentsStats,
				campaignsStats,
				lastActivityAt
			] = await Promise.all([
				db
					.select({ count: count() })
					.from(leads)
					.where(eq(leads.userId, dbUser.id)),
				db
					.select({ count: count() })
					.from(calls)
					.where(eq(calls.userId, dbUser.id)),
				db
					.select({ count: count() })
					.from(voiceAgents)
					.where(eq(voiceAgents.userId, dbUser.id)),
				db
					.select({ count: count() })
					.from(appointments)
					.where(eq(appointments.userId, dbUser.id)),
				db
					.select({ count: count() })
					.from(campaigns)
					.where(eq(campaigns.userId, dbUser.id)),
				getLastActivityAt(dbUser.id)
			])

			const { firstName, lastName } = splitName(dbUser.name)
			const lastSignInAt = lastSignInMap.get(dbUser.id)

			return {
				id: dbUser.id,
				email: dbUser.email,
				firstName,
				lastName,
				imageUrl: dbUser.image || null,
				createdAt: dbUser.createdAt.getTime(),
				lastSignInAt: lastSignInAt ? lastSignInAt.getTime() : null,
				leadsCount: leadsStats[0]?.count || 0,
				callsCount: callsStats[0]?.count || 0,
				voiceAgentsCount: agentsStats[0]?.count || 0,
				appointmentsCount: appointmentsStats[0]?.count || 0,
				campaignsCount: campaignsStats[0]?.count || 0,
				lastActivityAt,
				isActive: dbUser.isActive ?? true
			}
		})

		const usersWithActivity = await Promise.all(userActivityPromises)

		return usersWithActivity.sort((a, b) => {
			if (!a.lastActivityAt && !b.lastActivityAt) return 0
			if (!a.lastActivityAt) return 1
			if (!b.lastActivityAt) return -1
			return b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
		})
	} catch (error) {
		console.error("Error fetching all users:", error)
		throw new Error("Failed to fetch users")
	}
}

/**
 * Get detailed information for a specific user
 */
export async function getUserDetails(userId: string): Promise<
	PlatformUser & {
		recentActivity: UserActivity[]
	}
> {
	await requireAdmin()

	try {
		const dbUser = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				createdAt: users.createdAt,
				isActive: users.isActive
			})
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		if (!dbUser.length) {
			throw new Error("User not found")
		}

		const userRecord = dbUser[0]
		const { firstName, lastName } = splitName(userRecord.name)
		const [lastSignInMap] = await Promise.all([getLastSignInMap()])
		const lastSignInAt = lastSignInMap.get(userId)

		// Get comprehensive activity stats
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

		const [
			leadsStats,
			callsStats,
			agentsStats,
			appointmentsStats,
			campaignsStats,
			recentLeads,
			recentCalls,
			recentAgents,
			recentAppointments,
			recentCampaigns
		] = await Promise.all([
			// Counts
			db
				.select({ count: count() })
				.from(leads)
				.where(eq(leads.userId, userId)),
			db
				.select({ count: count() })
				.from(calls)
				.where(eq(calls.userId, userId)),
			db
				.select({ count: count() })
				.from(voiceAgents)
				.where(eq(voiceAgents.userId, userId)),
			db
				.select({ count: count() })
				.from(appointments)
				.where(eq(appointments.userId, userId)),
			db
				.select({ count: count() })
				.from(campaigns)
				.where(eq(campaigns.userId, userId)),

			// Recent activity (last 30 days)
			db
				.select({
					id: leads.id,
					name: leads.name,
					createdAt: leads.createdAt
				})
				.from(leads)
				.where(
					and(
						eq(leads.userId, userId),
						gte(leads.createdAt, thirtyDaysAgo)
					)
				)
				.orderBy(desc(leads.createdAt))
				.limit(10),

			db
				.select({
					id: calls.id,
					summary: calls.summary,
					createdAt: calls.createdAt
				})
				.from(calls)
				.where(
					and(
						eq(calls.userId, userId),
						gte(calls.createdAt, thirtyDaysAgo)
					)
				)
				.orderBy(desc(calls.createdAt))
				.limit(10),

			db
				.select({
					id: voiceAgents.id,
					name: voiceAgents.name,
					createdAt: voiceAgents.createdAt
				})
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.userId, userId),
						gte(voiceAgents.createdAt, thirtyDaysAgo)
					)
				)
				.orderBy(desc(voiceAgents.createdAt))
				.limit(10),

			db
				.select({
					id: appointments.id,
					title: appointments.title,
					createdAt: appointments.createdAt
				})
				.from(appointments)
				.where(
					and(
						eq(appointments.userId, userId),
						gte(appointments.createdAt, thirtyDaysAgo)
					)
				)
				.orderBy(desc(appointments.createdAt))
				.limit(10),

			db
				.select({
					id: campaigns.id,
					name: campaigns.name,
					createdAt: campaigns.createdAt
				})
				.from(campaigns)
				.where(
					and(
						eq(campaigns.userId, userId),
						gte(campaigns.createdAt, thirtyDaysAgo)
					)
				)
				.orderBy(desc(campaigns.createdAt))
				.limit(10)
		])

		// Compile recent activity
		const recentActivity: UserActivity[] = [
			...recentLeads.map((lead) => ({
				id: lead.id.toString(),
				type: "lead_created" as const,
				description: `Created lead: ${lead.name}`,
				timestamp: lead.createdAt
			})),
			...recentCalls.map((call) => ({
				id: call.id.toString(),
				type: "call_made" as const,
				description: `Made call: ${call.summary?.substring(0, 50) || "No summary"}...`,
				timestamp: call.createdAt
			})),
			...recentAgents.map((agent) => ({
				id: agent.id.toString(),
				type: "agent_created" as const,
				description: `Created voice agent: ${agent.name}`,
				timestamp: agent.createdAt
			})),
			...recentAppointments.map((appointment) => ({
				id: appointment.id.toString(),
				type: "appointment_scheduled" as const,
				description: `Scheduled appointment: ${appointment.title}`,
				timestamp: appointment.createdAt
			})),
			...recentCampaigns.map((campaign) => ({
				id: campaign.id.toString(),
				type: "campaign_created" as const,
				description: `Created campaign: ${campaign.name}`,
				timestamp: campaign.createdAt
			}))
		]
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
			.slice(0, 20)

		const lastActivityAt =
			recentActivity.length > 0 ? recentActivity[0].timestamp : null

		return {
			id: userRecord.id,
			email: userRecord.email,
			firstName,
			lastName,
			imageUrl: userRecord.image || null,
			createdAt: userRecord.createdAt.getTime(),
			lastSignInAt: lastSignInAt ? lastSignInAt.getTime() : null,
			leadsCount: leadsStats[0]?.count || 0,
			callsCount: callsStats[0]?.count || 0,
			voiceAgentsCount: agentsStats[0]?.count || 0,
			appointmentsCount: appointmentsStats[0]?.count || 0,
			campaignsCount: campaignsStats[0]?.count || 0,
			lastActivityAt,
			isActive: userRecord.isActive ?? true,
			recentActivity
		}
	} catch (error) {
		console.error("Error fetching user details:", error)
		throw new Error("Failed to fetch user details")
	}
}

/**
 * Update user status (active/banned)
 */
export async function updateUserStatus(
	userId: string,
	status: "active" | "banned"
): Promise<void> {
	await requireAdmin()

	try {
		await db
			.update(users)
			.set({ isActive: status === "active", updatedAt: new Date() })
			.where(eq(users.id, userId))
	} catch (error) {
		console.error("Error updating user status:", error)
		throw new Error("Failed to update user status")
	}
}

/**
 * Get user activity logs for a specific time range
 */
export async function getUserActivity(
	userId: string,
	timeRange: {
		startDate: Date
		endDate: Date
	}
): Promise<UserActivity[]> {
	await requireAdmin()

	try {
		const { startDate, endDate } = timeRange

		// Get activity from all relevant tables
		const [
			leadsActivity,
			callsActivity,
			agentsActivity,
			appointmentsActivity,
			campaignsActivity
		] = await Promise.all([
			db
				.select({
					id: leads.id,
					name: leads.name,
					createdAt: leads.createdAt,
					updatedAt: leads.updatedAt
				})
				.from(leads)
				.where(
					and(
						eq(leads.userId, userId),
						gte(leads.createdAt, startDate),
						lte(leads.createdAt, endDate)
					)
				),

			db
				.select({
					id: calls.id,
					summary: calls.summary,
					createdAt: calls.createdAt
				})
				.from(calls)
				.where(
					and(
						eq(calls.userId, userId),
						gte(calls.createdAt, startDate),
						lte(calls.createdAt, endDate)
					)
				),

			db
				.select({
					id: voiceAgents.id,
					name: voiceAgents.name,
					createdAt: voiceAgents.createdAt,
					updatedAt: voiceAgents.updatedAt
				})
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.userId, userId),
						gte(voiceAgents.createdAt, startDate),
						lte(voiceAgents.createdAt, endDate)
					)
				),

			db
				.select({
					id: appointments.id,
					title: appointments.title,
					createdAt: appointments.createdAt,
					updatedAt: appointments.updatedAt
				})
				.from(appointments)
				.where(
					and(
						eq(appointments.userId, userId),
						gte(appointments.createdAt, startDate),
						lte(appointments.createdAt, endDate)
					)
				),

			db
				.select({
					id: campaigns.id,
					name: campaigns.name,
					createdAt: campaigns.createdAt,
					updatedAt: campaigns.updatedAt
				})
				.from(campaigns)
				.where(
					and(
						eq(campaigns.userId, userId),
						gte(campaigns.createdAt, startDate),
						lte(campaigns.createdAt, endDate)
					)
				)
		])

		// Combine all activities
		const activities: UserActivity[] = [
			...leadsActivity.map((lead) => ({
				id: lead.id.toString(),
				type: "lead_created" as const,
				description: `Created lead: ${lead.name}`,
				timestamp: lead.createdAt,
				metadata: { leadId: lead.id, leadName: lead.name }
			})),
			...callsActivity.map((call) => ({
				id: call.id.toString(),
				type: "call_made" as const,
				description: `Made call: ${call.summary?.substring(0, 50) || "No summary"}...`,
				timestamp: call.createdAt,
				metadata: { callId: call.id, summary: call.summary }
			})),
			...agentsActivity.map((agent) => ({
				id: agent.id.toString(),
				type: "agent_created" as const,
				description: `Created voice agent: ${agent.name}`,
				timestamp: agent.createdAt,
				metadata: { agentId: agent.id, agentName: agent.name }
			})),
			...appointmentsActivity.map((appointment) => ({
				id: appointment.id.toString(),
				type: "appointment_scheduled" as const,
				description: `Scheduled appointment: ${appointment.title}`,
				timestamp: appointment.createdAt,
				metadata: {
					appointmentId: appointment.id,
					title: appointment.title
				}
			})),
			...campaignsActivity.map((campaign) => ({
				id: campaign.id.toString(),
				type: "campaign_created" as const,
				description: `Created campaign: ${campaign.name}`,
				timestamp: campaign.createdAt,
				metadata: {
					campaignId: campaign.id,
					campaignName: campaign.name
				}
			}))
		]

		return activities.sort(
			(a, b) => b.timestamp.getTime() - a.timestamp.getTime()
		)
	} catch (error) {
		console.error("Error fetching user activity:", error)
		throw new Error("Failed to fetch user activity")
	}
}

/**
 * Get platform user statistics
 */
export async function getUserStats() {
	await requireAdmin()

	try {
		const totalUsersResult = await db
			.select({ count: count() })
			.from(users)

		const activeUsersResult = await db
			.select({ count: count() })
			.from(users)
			.where(eq(users.isActive, true))

		const currentMonthStart = new Date()
		currentMonthStart.setDate(1)
		currentMonthStart.setHours(0, 0, 0, 0)

		const newUsersResult = await db
			.select({ count: count() })
			.from(users)
			.where(gte(users.createdAt, currentMonthStart))

		return {
			totalUsers: totalUsersResult[0]?.count || 0,
			activeUsers: activeUsersResult[0]?.count || 0,
			newUsersThisMonth: newUsersResult[0]?.count || 0
		}
	} catch (error) {
		console.error("Error fetching user stats:", error)
		throw new Error("Failed to fetch user statistics")
	}
}
