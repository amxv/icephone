"use server"

import { currentUser } from "@/lib/auth/session"
import { db } from "@/db/db"
import {
	leads,
	voiceAgents,
	calls,
	appointments,
	campaigns,
	textMessages,
	knowledgeBaseDocuments,
	adminActivityLogs
} from "@/db/schema"
import { count, desc, sql, eq, and, gte } from "drizzle-orm"

const OWNER_USER_ID =
	process.env.OWNER_USER_ID || "user_2qLYyeRu1ub7x0CWajTJOe01a6r"

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

async function requireAdmin() {
	const user = await currentUser()
	if (!user || user.id !== OWNER_USER_ID) {
		throw new Error("Admin access required")
	}
	return user
}

export async function getAdminStats() {
	await requireAdmin()

	try {
		// Get current month start
		const currentMonthStart = new Date()
		currentMonthStart.setDate(1)
		currentMonthStart.setHours(0, 0, 0, 0)

		// Get total counts across all users
		const [
			totalUsersResult,
			totalVoiceAgentsResult,
			activeVoiceAgentsResult,
			totalCallsResult,
			thisMonthCallsResult,
			thisMonthUsersResult,
			totalLeadsResult,
			thisMonthLeadsResult
		] = await Promise.all([
			// Total unique users
			db
				.select({ count: sql<number>`count(distinct user_id)` })
				.from(leads),

			// Voice agents
			db
				.select({ count: count() })
				.from(voiceAgents),
			db
				.select({ count: count() })
				.from(voiceAgents)
				.where(eq(voiceAgents.status, "active")),

			// Calls
			db
				.select({ count: count() })
				.from(calls),
			db
				.select({ count: count() })
				.from(calls)
				.where(gte(calls.createdAt, currentMonthStart)),

			// Users this month (based on leads created)
			db
				.select({ count: sql<number>`count(distinct user_id)` })
				.from(leads)
				.where(gte(leads.createdAt, currentMonthStart)),

			// Leads
			db
				.select({ count: count() })
				.from(leads),
			db
				.select({ count: count() })
				.from(leads)
				.where(gte(leads.createdAt, currentMonthStart))
		])

		const totalUsers = totalUsersResult[0]?.count || 0
		const totalVoiceAgents = totalVoiceAgentsResult[0]?.count || 0
		const activeVoiceAgents = activeVoiceAgentsResult[0]?.count || 0
		const totalCalls = totalCallsResult[0]?.count || 0
		const thisMonthCalls = thisMonthCallsResult[0]?.count || 0
		const thisMonthUsers = thisMonthUsersResult[0]?.count || 0
		const totalLeads = totalLeadsResult[0]?.count || 0
		const thisMonthLeads = thisMonthLeadsResult[0]?.count || 0

		return {
			totalUsers,
			newUsersThisMonth: thisMonthUsers,
			totalVoiceAgents,
			activeVoiceAgents,
			totalCalls,
			callsThisMonth: thisMonthCalls,
			totalLeads,
			leadsThisMonth: thisMonthLeads
		}
	} catch (error) {
		console.error("Error fetching admin stats:", error)
		throw new Error("Failed to fetch admin statistics")
	}
}

export async function getRecentActivity() {
	await requireAdmin()

	try {
		// Get recent activity from multiple sources
		const [recentCalls, recentLeads, recentAgents, recentAppointments] =
			await Promise.all([
				// Recent calls
				db
					.select({
						id: calls.id,
						type: sql<string>`'call_completed'`,
						description: sql<string>`'Voice call completed'`,
						userId: calls.userId,
						metadata: sql<ActivityMetadata>`json_build_object(
					'duration', ${calls.duration},
					'leadId', ${calls.leadId},
					'status', ${calls.status}
				)`,
						createdAt: calls.createdAt
					})
					.from(calls)
					.orderBy(desc(calls.createdAt))
					.limit(5),

				// Recent leads
				db
					.select({
						id: leads.id,
						type: sql<string>`'lead_created'`,
						description: sql<string>`'New lead created'`,
						userId: leads.userId,
						metadata: sql<ActivityMetadata>`json_build_object(
					'leadName', ${leads.name},
					'status', ${leads.status},
					'score', ${leads.score}
				)`,
						createdAt: leads.createdAt
					})
					.from(leads)
					.orderBy(desc(leads.createdAt))
					.limit(5),

				// Recent voice agents
				db
					.select({
						id: voiceAgents.id,
						type: sql<string>`'agent_created'`,
						description: sql<string>`'Voice agent created'`,
						userId: voiceAgents.userId,
						metadata: sql<ActivityMetadata>`json_build_object(
					'agentName', ${voiceAgents.name},
					'agentStatus', ${voiceAgents.status}
				)`,
						createdAt: voiceAgents.createdAt
					})
					.from(voiceAgents)
					.orderBy(desc(voiceAgents.createdAt))
					.limit(3),

				// Recent appointments
				db
					.select({
						id: appointments.id,
						type: sql<string>`'appointment_scheduled'`,
						description: sql<string>`'Appointment scheduled'`,
						userId: appointments.userId,
						metadata: sql<ActivityMetadata>`json_build_object(
					'title', ${appointments.title},
					'startTime', ${appointments.startTime}
				)`,
						createdAt: appointments.createdAt
					})
					.from(appointments)
					.orderBy(desc(appointments.createdAt))
					.limit(3)
			])

		// Combine and sort all activities with unique keys
		const allActivities = [
			...recentCalls.map((activity) => ({
				...activity,
				uniqueKey: `call_${activity.id}`
			})),
			...recentLeads.map((activity) => ({
				...activity,
				uniqueKey: `lead_${activity.id}`
			})),
			...recentAgents.map((activity) => ({
				...activity,
				uniqueKey: `agent_${activity.id}`
			})),
			...recentAppointments.map((activity) => ({
				...activity,
				uniqueKey: `appointment_${activity.id}`
			}))
		]
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() -
					new Date(a.createdAt).getTime()
			)
			.slice(0, 10) // Take top 10 most recent

		// Get user information for each activity (simplified - in real app you'd batch this)
		const activitiesWithUsers = allActivities.map((activity) => ({
			...activity,
			user: {
				name: `User ${activity.userId.slice(-4)}`, // Simplified - you could fetch real user names from auth DB
				email: `user-${activity.userId.slice(-4)}@example.com`,
				avatar: null
			},
			timestamp: formatTimeAgo(activity.createdAt)
		}))

		return activitiesWithUsers
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

export async function getDatabaseOverview() {
	await requireAdmin()

	try {
		// Get counts for all major tables
		const [
			leadsCount,
			callsCount,
			appointmentsCount,
			campaignsCount,
			voiceAgentsCount,
			textMessagesCount,
			knowledgeDocsCount
		] = await Promise.all([
			db.select({ count: count() }).from(leads),
			db.select({ count: count() }).from(calls),
			db.select({ count: count() }).from(appointments),
			db.select({ count: count() }).from(campaigns),
			db.select({ count: count() }).from(voiceAgents),
			db.select({ count: count() }).from(textMessages),
			db.select({ count: count() }).from(knowledgeBaseDocuments)
		])

		return {
			leads: leadsCount[0]?.count || 0,
			calls: callsCount[0]?.count || 0,
			appointments: appointmentsCount[0]?.count || 0,
			campaigns: campaignsCount[0]?.count || 0,
			voiceAgents: voiceAgentsCount[0]?.count || 0,
			textMessages: textMessagesCount[0]?.count || 0,
			knowledgeDocuments: knowledgeDocsCount[0]?.count || 0
		}
	} catch (error) {
		console.error("Error fetching database overview:", error)
		throw new Error("Failed to fetch database overview")
	}
}
