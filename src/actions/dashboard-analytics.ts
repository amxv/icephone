"use server"

import { currentUser } from "@clerk/nextjs/server"
import { db_ws as db } from "@/db"
import { leads, calls, voiceSessions, voiceAgents } from "@/db/schema"
import { eq, and, gte, lte, count, sql, desc, inArray } from "drizzle-orm"
import { startOfDay, endOfDay, subDays, format } from "date-fns"

// Type definitions for dashboard analytics
export interface LeadFunnelData {
	name: string
	value: number
}

export interface LeadAcquisitionData {
	date: string
	newLeads: number
	qualifiedLeads: number
}

export interface CallActivityData {
	date: string
	inbound: number
	outbound: number
}

export interface LeadSourceData {
	name: string
	value: number
}

export interface AgentPerformanceData {
	name: string
	calls: number
	appointments: number
	conversions: number
}

// Get real lead funnel data based on actual lead statuses
export async function getLeadFunnelData(): Promise<LeadFunnelData[]> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const funnelStats = await db
		.select({
			status: leads.status,
			count: count(leads.id)
		})
		.from(leads)
		.where(eq(leads.userId, user.id))
		.groupBy(leads.status)

	// Map to display format
	const statusMap: Record<string, string> = {
		new: "New",
		contacted: "Contacted",
		qualified: "Qualified",
		converted: "Converted",
		lost: "Lost"
	}

	const funnelData: LeadFunnelData[] = []

	// Ensure all statuses are represented
	const allStatuses = ["new", "contacted", "qualified", "converted", "lost"]
	for (const status of allStatuses) {
		const stat = funnelStats.find((s) => s.status === status)
		funnelData.push({
			name: statusMap[status] || status,
			value: stat?.count || 0
		})
	}

	return funnelData
}

// Get real lead acquisition data over time
export async function getLeadAcquisitionData(
	days = 90
): Promise<LeadAcquisitionData[]> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const endDate = new Date()
	const startDate = subDays(endDate, days)

	// Get daily lead creation counts
	const dailyLeads = await db
		.select({
			date: sql<string>`DATE(${leads.createdAt})`,
			total: count(leads.id),
			qualified: count(
				sql`CASE WHEN ${leads.status} IN ('qualified', 'converted') THEN 1 END`
			)
		})
		.from(leads)
		.where(
			and(
				eq(leads.userId, user.id),
				gte(leads.createdAt, startDate),
				lte(leads.createdAt, endDate)
			)
		)
		.groupBy(sql`DATE(${leads.createdAt})`)
		.orderBy(sql`DATE(${leads.createdAt})`)

	// Create complete date range with zero values for missing dates
	const acquisitionData: LeadAcquisitionData[] = []

	for (let i = 0; i < days; i++) {
		const currentDate = subDays(endDate, days - 1 - i)
		const dateStr = format(currentDate, "yyyy-MM-dd")

		const dayData = dailyLeads.find((d) => d.date === dateStr)

		acquisitionData.push({
			date: dateStr,
			newLeads: dayData?.total || 0,
			qualifiedLeads: dayData?.qualified || 0
		})
	}

	return acquisitionData
}

// Get real call activity data combining both calls and voice sessions
export async function getCallActivityData(
	days = 90
): Promise<CallActivityData[]> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const endDate = new Date()
	const startDate = subDays(endDate, days)

	// Get call data from calls table
	const callsData = await db
		.select({
			date: sql<string>`DATE(${calls.startTime})`,
			inbound: count(
				sql`CASE WHEN ${calls.type} = 'incoming' THEN 1 END`
			),
			outbound: count(
				sql`CASE WHEN ${calls.type} = 'outgoing' THEN 1 END`
			)
		})
		.from(calls)
		.where(
			and(
				eq(calls.userId, user.id),
				gte(calls.startTime, startDate),
				lte(calls.startTime, endDate)
			)
		)
		.groupBy(sql`DATE(${calls.startTime})`)

	// Get call data from voice sessions table
	const voiceSessionsData = await db
		.select({
			date: sql<string>`DATE(${voiceSessions.startTime})`,
			inbound: count(
				sql`CASE WHEN ${voiceSessions.direction} = 'incoming' THEN 1 END`
			),
			outbound: count(
				sql`CASE WHEN ${voiceSessions.direction} = 'outgoing' THEN 1 END`
			)
		})
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.userId, user.id),
				gte(voiceSessions.startTime, startDate),
				lte(voiceSessions.startTime, endDate)
			)
		)
		.groupBy(sql`DATE(${voiceSessions.startTime})`)

	// Combine data from both sources
	const activityData: CallActivityData[] = []

	for (let i = 0; i < days; i++) {
		const currentDate = subDays(endDate, days - 1 - i)
		const dateStr = format(currentDate, "yyyy-MM-dd")

		const callDay = callsData.find((d) => d.date === dateStr)
		const voiceDay = voiceSessionsData.find((d) => d.date === dateStr)

		activityData.push({
			date: dateStr,
			inbound: (callDay?.inbound || 0) + (voiceDay?.inbound || 0),
			outbound: (callDay?.outbound || 0) + (voiceDay?.outbound || 0)
		})
	}

	return activityData
}

// Get real lead source distribution
export async function getLeadSourceData(): Promise<LeadSourceData[]> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const sourceStats = await db
		.select({
			source: leads.source,
			count: count(leads.id)
		})
		.from(leads)
		.where(eq(leads.userId, user.id))
		.groupBy(leads.source)
		.orderBy(desc(count(leads.id)))

	return sourceStats.map((stat) => ({
		name: stat.source || "Unknown",
		value: stat.count
	}))
}

// Get real agent performance data
export async function getAgentPerformanceData(): Promise<
	AgentPerformanceData[]
> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	// Get performance metrics from voice sessions
	const agentStats = await db
		.select({
			agentId: voiceSessions.agentId,
			callCount: count(voiceSessions.id),
			// Approximate appointments and conversions based on successful calls
			appointments: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' AND ${voiceSessions.duration} > 300 THEN 1 END`
			),
			conversions: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' AND ${voiceSessions.sentiment} = 'positive' THEN 1 END`
			)
		})
		.from(voiceSessions)
		.where(eq(voiceSessions.userId, user.id))
		.groupBy(voiceSessions.agentId)
		.orderBy(desc(count(voiceSessions.id)))

	// Get agent names
	const agentIds = agentStats
		.map((stat) => stat.agentId)
		.filter((id): id is number => id !== null && typeof id === "number")

	let agents: { id: number; name: string }[] = []

	if (agentIds.length > 0) {
		agents = await db
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.userId, user.id),
					inArray(voiceAgents.id, agentIds)
				)
			)
	}

	// Combine data
	return agentStats.map((stat) => {
		const agent = agents.find((a) => a.id === stat.agentId)
		return {
			name: agent?.name || `Agent ${stat.agentId || "Unknown"}`,
			calls: stat.callCount,
			appointments: stat.appointments,
			conversions: stat.conversions
		}
	})
}

// Get all dashboard data in one call for efficiency
export async function getDashboardData(
	timeRange: "7d" | "30d" | "90d" = "30d"
) {
	const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90

	const [
		leadFunnelData,
		leadAcquisitionData,
		callActivityData,
		leadSourceData,
		agentPerformanceData
	] = await Promise.all([
		getLeadFunnelData(),
		getLeadAcquisitionData(days),
		getCallActivityData(days),
		getLeadSourceData(),
		getAgentPerformanceData()
	])

	return {
		leadFunnelData,
		leadAcquisitionData,
		callActivityData,
		leadSourceData,
		agentPerformanceData
	}
}
