"use server"

import { currentUser, clerkClient } from "@clerk/nextjs/server"
import { count, desc, eq, gte, sql, and, lte } from "drizzle-orm"
import type { User } from "@clerk/nextjs/server"
import { db_ws as db } from "@/db"
import {
	leads,
	calls,
	voiceAgents,
	phoneNumbers,
	appointments,
	campaigns
} from "@/db/schema"

// Add type for Clerk user from API
type ClerkUserType = {
	id: string
	emailAddresses: { emailAddress: string }[]
	firstName: string | null
	lastName: string | null
	imageUrl: string
	createdAt: number
	lastSignInAt: number | null
}

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
	phoneNumbersCount: number
	appointmentsCount: number
	campaignsCount: number
	lastActivityAt: Date | null
	isActive: boolean // Based on recent activity
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

/**
 * Get all platform users with comprehensive activity data
 */
export async function getAllUsers(): Promise<PlatformUser[]> {
	await requireAdmin()

	try {
		// Get all users from Clerk
		const clerk = await clerkClient()
		const clerkUsers = await clerk.users.getUserList({
			limit: 500, // Adjust as needed
			orderBy: "-created_at"
		})

		// Get user activity stats from our database
		const userActivityPromises = clerkUsers.data.map(
			async (clerkUser: ClerkUserType) => {
				const [
					leadsStats,
					callsStats,
					agentsStats,
					phoneStats,
					appointmentsStats,
					campaignsStats,
					lastActivity
				] = await Promise.all([
					// Leads count
					db
						.select({ count: count() })
						.from(leads)
						.where(eq(leads.userId, clerkUser.id)),

					// Calls count
					db
						.select({ count: count() })
						.from(calls)
						.where(eq(calls.userId, clerkUser.id)),

					// Voice agents count
					db
						.select({ count: count() })
						.from(voiceAgents)
						.where(eq(voiceAgents.userId, clerkUser.id)),

					// Phone numbers count
					db
						.select({ count: count() })
						.from(phoneNumbers)
						.where(eq(phoneNumbers.userId, clerkUser.id)),

					// Appointments count
					db
						.select({ count: count() })
						.from(appointments)
						.where(eq(appointments.userId, clerkUser.id)),

					// Campaigns count
					db
						.select({ count: count() })
						.from(campaigns)
						.where(eq(campaigns.userId, clerkUser.id)),

					// Get most recent activity across all tables
					db
						.select({
							lastActivity: sql<Date>`MAX(greatest(
					COALESCE(${leads.updatedAt}, '1970-01-01'::timestamp),
					COALESCE(${calls.createdAt}, '1970-01-01'::timestamp),
					COALESCE(${voiceAgents.updatedAt}, '1970-01-01'::timestamp),
					COALESCE(${appointments.updatedAt}, '1970-01-01'::timestamp),
					COALESCE(${campaigns.updatedAt}, '1970-01-01'::timestamp)
				))`
						})
						.from(leads)
						.leftJoin(calls, eq(calls.userId, clerkUser.id))
						.leftJoin(
							voiceAgents,
							eq(voiceAgents.userId, clerkUser.id)
						)
						.leftJoin(
							appointments,
							eq(appointments.userId, clerkUser.id)
						)
						.leftJoin(campaigns, eq(campaigns.userId, clerkUser.id))
						.where(eq(leads.userId, clerkUser.id))
				])

				const leadsCount = leadsStats[0]?.count || 0
				const callsCount = callsStats[0]?.count || 0
				const voiceAgentsCount = agentsStats[0]?.count || 0
				const phoneNumbersCount = phoneStats[0]?.count || 0
				const appointmentsCount = appointmentsStats[0]?.count || 0
				const campaignsCount = campaignsStats[0]?.count || 0
				const lastActivityAt = lastActivity[0]?.lastActivity || null

				// Consider user active if they have activity in last 30 days
				const thirtyDaysAgo = new Date()
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
				const isActive = lastActivityAt
					? lastActivityAt > thirtyDaysAgo
					: false

				return {
					id: clerkUser.id,
					email: clerkUser.emailAddresses[0]?.emailAddress || null,
					firstName: clerkUser.firstName,
					lastName: clerkUser.lastName,
					imageUrl: clerkUser.imageUrl,
					createdAt: clerkUser.createdAt,
					lastSignInAt: clerkUser.lastSignInAt,
					leadsCount,
					callsCount,
					voiceAgentsCount,
					phoneNumbersCount,
					appointmentsCount,
					campaignsCount,
					lastActivityAt,
					isActive
				}
			}
		)

		const usersWithActivity = await Promise.all(userActivityPromises)

		// Sort by most recent activity
		return usersWithActivity.sort((a: PlatformUser, b: PlatformUser) => {
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
		// Get user from Clerk
		const clerk = await clerkClient()
		const clerkUser = await clerk.users.getUser(userId)

		// Get comprehensive activity stats
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

		const [
			leadsStats,
			callsStats,
			agentsStats,
			phoneStats,
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
				.from(phoneNumbers)
				.where(eq(phoneNumbers.userId, userId)),
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
		const isActive = lastActivityAt ? lastActivityAt > thirtyDaysAgo : false

		return {
			id: clerkUser.id,
			email: clerkUser.emailAddresses[0]?.emailAddress || null,
			firstName: clerkUser.firstName,
			lastName: clerkUser.lastName,
			imageUrl: clerkUser.imageUrl,
			createdAt: clerkUser.createdAt,
			lastSignInAt: clerkUser.lastSignInAt,
			leadsCount: leadsStats[0]?.count || 0,
			callsCount: callsStats[0]?.count || 0,
			voiceAgentsCount: agentsStats[0]?.count || 0,
			phoneNumbersCount: phoneStats[0]?.count || 0,
			appointmentsCount: appointmentsStats[0]?.count || 0,
			campaignsCount: campaignsStats[0]?.count || 0,
			lastActivityAt,
			isActive,
			recentActivity
		}
	} catch (error) {
		console.error("Error fetching user details:", error)
		throw new Error("Failed to fetch user details")
	}
}

/**
 * Update user status in Clerk (ban/unban user)
 */
export async function updateUserStatus(
	userId: string,
	status: "active" | "banned"
): Promise<void> {
	await requireAdmin()

	try {
		const clerk = await clerkClient()
		if (status === "banned") {
			await clerk.users.banUser(userId)
		} else {
			await clerk.users.unbanUser(userId)
		}
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

		// Sort by timestamp (most recent first)
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
		// Get total unique users from our database
		const totalUsersResult = await db
			.select({ count: sql<number>`count(distinct user_id)` })
			.from(leads)

		// Get active users (those with activity in last 30 days)
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

		const activeUsersResult = await db
			.select({ count: sql<number>`count(distinct user_id)` })
			.from(leads)
			.where(gte(leads.updatedAt, thirtyDaysAgo))

		// Get new users this month
		const currentMonthStart = new Date()
		currentMonthStart.setDate(1)
		currentMonthStart.setHours(0, 0, 0, 0)

		const newUsersResult = await db
			.select({ count: sql<number>`count(distinct user_id)` })
			.from(leads)
			.where(gte(leads.createdAt, currentMonthStart))

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
