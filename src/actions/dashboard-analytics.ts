"use server"

import { db_ws as db } from "@/db"
import { leads, calls, voiceSessions, voiceAgents } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { eq, and, gte, lte, count, sql, desc, inArray } from "drizzle-orm"
import { subDays, format } from "date-fns"
import { z } from "zod"

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

const daysSchema = z.number().int().min(1).max(365)
const dashboardRangeSchema = z.enum(["7d", "30d", "90d"]).default("30d")

async function logAnalyticsEvent(
	teamId: string,
	actorUserId: string,
	action: string,
	metadata?: Record<string, unknown>
) {
	await logAuditEvent({
		teamId,
		actorUserId,
		action,
		entityType: "analytics",
		entityId: null,
		metadata: metadata ?? {}
	})
}

async function fetchLeadFunnelData(teamId: string): Promise<LeadFunnelData[]> {
	const funnelStats = await db
		.select({
			status: leads.status,
			count: count(leads.id)
		})
		.from(leads)
		.where(teamScope(leads, teamId))
		.groupBy(leads.status)

	const statusMap: Record<string, string> = {
		new: "New",
		contacted: "Contacted",
		qualified: "Qualified",
		converted: "Converted",
		lost: "Lost"
	}

	const funnelData: LeadFunnelData[] = []
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

async function fetchLeadAcquisitionData(
	teamId: string,
	days: number
): Promise<LeadAcquisitionData[]> {
	const endDate = new Date()
	const startDate = subDays(endDate, days)

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
				teamScope(leads, teamId),
				gte(leads.createdAt, startDate),
				lte(leads.createdAt, endDate)
			)
		)
		.groupBy(sql`DATE(${leads.createdAt})`)
		.orderBy(sql`DATE(${leads.createdAt})`)

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

async function fetchCallActivityData(
	teamId: string,
	days: number
): Promise<CallActivityData[]> {
	const endDate = new Date()
	const startDate = subDays(endDate, days)

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
				teamScope(calls, teamId),
				gte(calls.startTime, startDate),
				lte(calls.startTime, endDate)
			)
		)
		.groupBy(sql`DATE(${calls.startTime})`)

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
		.innerJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
		.where(
			and(
				teamScope(voiceAgents, teamId),
				gte(voiceSessions.startTime, startDate),
				lte(voiceSessions.startTime, endDate)
			)
		)
		.groupBy(sql`DATE(${voiceSessions.startTime})`)

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

async function fetchLeadSourceData(
	teamId: string
): Promise<LeadSourceData[]> {
	const sourceStats = await db
		.select({
			source: leads.source,
			count: count(leads.id)
		})
		.from(leads)
		.where(teamScope(leads, teamId))
		.groupBy(leads.source)
		.orderBy(desc(count(leads.id)))

	return sourceStats.map((stat) => ({
		name: stat.source || "Unknown",
		value: stat.count
	}))
}

async function fetchAgentPerformanceData(
	teamId: string
): Promise<AgentPerformanceData[]> {
	const agentStats = await db
		.select({
			agentId: voiceSessions.agentId,
			callCount: count(voiceSessions.id),
			appointments: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' AND ${voiceSessions.duration} > 300 THEN 1 END`
			),
			conversions: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' AND ${voiceSessions.sentiment} = 'positive' THEN 1 END`
			)
		})
		.from(voiceSessions)
		.innerJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
		.where(teamScope(voiceAgents, teamId))
		.groupBy(voiceSessions.agentId)
		.orderBy(desc(count(voiceSessions.id)))

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
				and(teamScope(voiceAgents, teamId), inArray(voiceAgents.id, agentIds))
			)
	}

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

// Get real lead funnel data based on actual lead statuses
export async function getLeadFunnelData(): Promise<LeadFunnelData[]> {
	const { teamId, user } = await requireTeam()
	const data = await fetchLeadFunnelData(teamId)
	await logAnalyticsEvent(teamId, user.id, "analytics.lead_funnel.read")
	return data
}

// Get real lead acquisition data over time
export async function getLeadAcquisitionData(
	rawDays = 90
): Promise<LeadAcquisitionData[]> {
	const { teamId, user } = await requireTeam()
	const days = daysSchema.parse(rawDays)
	const data = await fetchLeadAcquisitionData(teamId, days)
	await logAnalyticsEvent(teamId, user.id, "analytics.lead_acquisition.read", {
		days
	})
	return data
}

// Get real call activity data combining both calls and voice sessions
export async function getCallActivityData(
	rawDays = 90
): Promise<CallActivityData[]> {
	const { teamId, user } = await requireTeam()
	const days = daysSchema.parse(rawDays)
	const data = await fetchCallActivityData(teamId, days)
	await logAnalyticsEvent(teamId, user.id, "analytics.call_activity.read", {
		days
	})
	return data
}

// Get real lead source distribution
export async function getLeadSourceData(): Promise<LeadSourceData[]> {
	const { teamId, user } = await requireTeam()
	const data = await fetchLeadSourceData(teamId)
	await logAnalyticsEvent(teamId, user.id, "analytics.lead_source.read")
	return data
}

// Get real agent performance data
export async function getAgentPerformanceData(): Promise<
	AgentPerformanceData[]
> {
	const { teamId, user } = await requireTeam()
	const data = await fetchAgentPerformanceData(teamId)
	await logAnalyticsEvent(teamId, user.id, "analytics.agent_performance.read")
	return data
}

// Get all dashboard data in one call for efficiency
export async function getDashboardData(
	rawTimeRange: "7d" | "30d" | "90d" = "30d"
) {
	const { teamId, user } = await requireTeam()
	const timeRange = dashboardRangeSchema.parse(rawTimeRange)
	const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90

	const [
		leadFunnelData,
		leadAcquisitionData,
		callActivityData,
		leadSourceData,
		agentPerformanceData
	] = await Promise.all([
		fetchLeadFunnelData(teamId),
		fetchLeadAcquisitionData(teamId, days),
		fetchCallActivityData(teamId, days),
		fetchLeadSourceData(teamId),
		fetchAgentPerformanceData(teamId)
	])

	await logAnalyticsEvent(teamId, user.id, "analytics.dashboard.read", {
		timeRange
	})

	return {
		leadFunnelData,
		leadAcquisitionData,
		callActivityData,
		leadSourceData,
		agentPerformanceData
	}
}
