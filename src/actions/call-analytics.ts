"use server"

import { currentUser } from "@clerk/nextjs/server"
import { db_ws as db } from "@/db"
import { voiceSessions, voiceAgents, calls, leads } from "@/db/schema"
import { eq, and, desc, sql, gte, lte, count, avg, sum } from "drizzle-orm"
import {
	startOfDay,
	endOfDay,
	startOfWeek,
	endOfWeek,
	startOfMonth,
	endOfMonth,
	subDays
} from "date-fns"

// Type definitions for analytics
interface CallAnalytics {
	totalCalls: number
	totalDuration: number
	averageDuration: number
	totalCost: number
	averageCost: number
	successfulCalls: number
	failedCalls: number
	successRate: number
	sentimentBreakdown: {
		positive: number
		negative: number
		neutral: number
	}
	topPerformingAgents: Array<{
		agentId: number
		agentName: string
		callCount: number
		averageDuration: number
		successRate: number
	}>
	dailyCallVolume: Array<{
		date: string
		calls: number
		duration: number
		cost: number
	}>
}

interface CallPerformanceMetrics {
	agentId: number
	agentName: string
	totalCalls: number
	successfulCalls: number
	failedCalls: number
	totalDuration: number
	averageDuration: number
	totalCost: number
	averageCost: number
	sentimentDistribution: {
		positive: number
		negative: number
		neutral: number
	}
	leadsGenerated: number
	conversionsCount: number
	conversionRate: number
}

// Get comprehensive call analytics for user
export async function getCallAnalytics(
	timeRange: "today" | "week" | "month" | "quarter" = "week"
): Promise<CallAnalytics> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	// Calculate date range
	const now = new Date()
	let startDate: Date
	let endDate: Date

	switch (timeRange) {
		case "today":
			startDate = startOfDay(now)
			endDate = endOfDay(now)
			break
		case "week":
			startDate = startOfWeek(now)
			endDate = endOfWeek(now)
			break
		case "month":
			startDate = startOfMonth(now)
			endDate = endOfMonth(now)
			break
		case "quarter":
			startDate = startOfMonth(subDays(now, 90))
			endDate = endOfMonth(now)
			break
		default:
			startDate = startOfWeek(now)
			endDate = endOfWeek(now)
	}

	// Get basic call statistics
	const callStats = await db
		.select({
			totalCalls: count(voiceSessions.id),
			totalDuration: sum(voiceSessions.duration),
			averageDuration: avg(voiceSessions.duration),
			totalCost: sum(voiceSessions.cost),
			averageCost: avg(voiceSessions.cost),
			successfulCalls: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' THEN 1 END`
			),
			failedCalls: count(
				sql`CASE WHEN ${voiceSessions.status} = 'failed' THEN 1 END`
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

	const stats = callStats[0]

	// Get sentiment breakdown
	const sentimentStats = await db
		.select({
			sentiment: voiceSessions.sentiment,
			count: count(voiceSessions.id)
		})
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.userId, user.id),
				gte(voiceSessions.startTime, startDate),
				lte(voiceSessions.startTime, endDate)
			)
		)
		.groupBy(voiceSessions.sentiment)

	const sentimentBreakdown = {
		positive: 0,
		negative: 0,
		neutral: 0
	}

	for (const item of sentimentStats) {
		if (item.sentiment === "positive")
			sentimentBreakdown.positive = item.count
		else if (item.sentiment === "negative")
			sentimentBreakdown.negative = item.count
		else sentimentBreakdown.neutral = item.count
	}

	// Get top performing agents
	const agentStats = await db
		.select({
			agentId: voiceSessions.agentId,
			agentName: voiceAgents.name,
			callCount: count(voiceSessions.id),
			averageDuration: avg(voiceSessions.duration),
			successfulCalls: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' THEN 1 END`
			),
			totalCalls: count(voiceSessions.id)
		})
		.from(voiceSessions)
		.innerJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
		.where(
			and(
				eq(voiceSessions.userId, user.id),
				gte(voiceSessions.startTime, startDate),
				lte(voiceSessions.startTime, endDate)
			)
		)
		.groupBy(voiceSessions.agentId, voiceAgents.name)
		.orderBy(desc(count(voiceSessions.id)))
		.limit(5)

	const topPerformingAgents = agentStats.map((agent) => ({
		agentId: agent.agentId,
		agentName: agent.agentName,
		callCount: agent.callCount,
		averageDuration: Math.round(Number(agent.averageDuration) || 0),
		successRate:
			agent.totalCalls > 0
				? Math.round((agent.successfulCalls / agent.totalCalls) * 100)
				: 0
	}))

	// Get daily call volume (last 7 days for week view, etc.)
	const dailyStats = await db
		.select({
			date: sql<string>`DATE(${voiceSessions.startTime})`,
			calls: count(voiceSessions.id),
			duration: sum(voiceSessions.duration),
			cost: sum(voiceSessions.cost)
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
		.orderBy(sql`DATE(${voiceSessions.startTime})`)

	const dailyCallVolume = dailyStats.map((day) => ({
		date: day.date,
		calls: day.calls,
		duration: Number(day.duration) || 0,
		cost: Number(day.cost) || 0
	}))

	return {
		totalCalls: stats.totalCalls,
		totalDuration: Number(stats.totalDuration) || 0,
		averageDuration: Math.round(Number(stats.averageDuration) || 0),
		totalCost: Number(stats.totalCost) || 0,
		averageCost: Number(stats.averageCost) || 0,
		successfulCalls: stats.successfulCalls,
		failedCalls: stats.failedCalls,
		successRate:
			stats.totalCalls > 0
				? Math.round((stats.successfulCalls / stats.totalCalls) * 100)
				: 0,
		sentimentBreakdown,
		topPerformingAgents,
		dailyCallVolume
	}
}

// Get detailed performance metrics for a specific voice agent
export async function getAgentPerformanceMetrics(
	agentId: number
): Promise<CallPerformanceMetrics> {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	// Get agent details
	const agent = await db
		.select()
		.from(voiceAgents)
		.where(
			and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, user.id))
		)
		.limit(1)

	if (agent.length === 0) {
		throw new Error("Agent not found or access denied")
	}

	// Get call statistics for this agent
	const callStats = await db
		.select({
			totalCalls: count(voiceSessions.id),
			successfulCalls: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' THEN 1 END`
			),
			failedCalls: count(
				sql`CASE WHEN ${voiceSessions.status} = 'failed' THEN 1 END`
			),
			totalDuration: sum(voiceSessions.duration),
			averageDuration: avg(voiceSessions.duration),
			totalCost: sum(voiceSessions.cost),
			averageCost: avg(voiceSessions.cost)
		})
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.agentId, agentId),
				eq(voiceSessions.userId, user.id)
			)
		)

	const stats = callStats[0]

	// Get sentiment distribution
	const sentimentStats = await db
		.select({
			sentiment: voiceSessions.sentiment,
			count: count(voiceSessions.id)
		})
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.agentId, agentId),
				eq(voiceSessions.userId, user.id)
			)
		)
		.groupBy(voiceSessions.sentiment)

	const sentimentDistribution = {
		positive: 0,
		negative: 0,
		neutral: 0
	}

	for (const item of sentimentStats) {
		if (item.sentiment === "positive")
			sentimentDistribution.positive = item.count
		else if (item.sentiment === "negative")
			sentimentDistribution.negative = item.count
		else sentimentDistribution.neutral = item.count
	}

	// Get leads generated and conversions
	const leadStats = await db
		.select({
			leadsGenerated: count(sql`DISTINCT ${voiceSessions.leadId}`),
			conversions: count(
				sql`CASE WHEN ${leads.status} = 'converted' THEN 1 END`
			)
		})
		.from(voiceSessions)
		.leftJoin(leads, eq(voiceSessions.leadId, leads.id))
		.where(
			and(
				eq(voiceSessions.agentId, agentId),
				eq(voiceSessions.userId, user.id)
			)
		)

	const leadData = leadStats[0]

	return {
		agentId,
		agentName: agent[0].name,
		totalCalls: stats.totalCalls,
		successfulCalls: stats.successfulCalls,
		failedCalls: stats.failedCalls,
		totalDuration: Number(stats.totalDuration) || 0,
		averageDuration: Math.round(Number(stats.averageDuration) || 0),
		totalCost: Number(stats.totalCost) || 0,
		averageCost: Number(stats.averageCost) || 0,
		sentimentDistribution,
		leadsGenerated: leadData.leadsGenerated,
		conversionsCount: leadData.conversions,
		conversionRate:
			leadData.leadsGenerated > 0
				? Math.round(
						(leadData.conversions / leadData.leadsGenerated) * 100
					)
				: 0
	}
}

// Get recent call history with enhanced details
export async function getRecentCalls(limit = 20) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const recentCalls = await db
		.select({
			id: voiceSessions.id,
			sessionId: voiceSessions.sessionId,
			agentName: voiceAgents.name,
			leadName: leads.name,
			phoneNumber: voiceSessions.phoneNumber,
			direction: voiceSessions.direction,
			status: voiceSessions.status,
			startTime: voiceSessions.startTime,
			endTime: voiceSessions.endTime,
			duration: voiceSessions.duration,
			sentiment: voiceSessions.sentiment,
			summary: voiceSessions.summary,
			cost: voiceSessions.cost
		})
		.from(voiceSessions)
		.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
		.leftJoin(leads, eq(voiceSessions.leadId, leads.id))
		.where(eq(voiceSessions.userId, user.id))
		.orderBy(desc(voiceSessions.startTime))
		.limit(limit)

	return recentCalls
}

// Get call quality scoring based on various metrics
export async function getCallQualityScore(sessionId: string) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const session = await db
		.select()
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.sessionId, sessionId),
				eq(voiceSessions.userId, user.id)
			)
		)
		.limit(1)

	if (session.length === 0) {
		throw new Error("Call session not found")
	}

	const call = session[0]
	let qualityScore = 0
	const factors = []

	// Duration score (longer calls generally indicate better engagement)
	if (call.duration) {
		if (call.duration > 300) {
			// 5+ minutes
			qualityScore += 30
			factors.push({
				factor: "Call Duration",
				score: 30,
				description: "Long engagement (5+ minutes)"
			})
		} else if (call.duration > 120) {
			// 2+ minutes
			qualityScore += 20
			factors.push({
				factor: "Call Duration",
				score: 20,
				description: "Good engagement (2+ minutes)"
			})
		} else if (call.duration > 30) {
			// 30+ seconds
			qualityScore += 10
			factors.push({
				factor: "Call Duration",
				score: 10,
				description: "Brief engagement (30+ seconds)"
			})
		} else {
			factors.push({
				factor: "Call Duration",
				score: 0,
				description: "Very short call (<30 seconds)"
			})
		}
	}

	// Completion status
	if (call.status === "completed") {
		qualityScore += 25
		factors.push({
			factor: "Call Completion",
			score: 25,
			description: "Call completed successfully"
		})
	} else {
		factors.push({
			factor: "Call Completion",
			score: 0,
			description: "Call did not complete normally"
		})
	}

	// Sentiment score
	if (call.sentiment === "positive") {
		qualityScore += 30
		factors.push({
			factor: "Sentiment Analysis",
			score: 30,
			description: "Positive customer sentiment"
		})
	} else if (call.sentiment === "neutral") {
		qualityScore += 15
		factors.push({
			factor: "Sentiment Analysis",
			score: 15,
			description: "Neutral customer sentiment"
		})
	} else if (call.sentiment === "negative") {
		qualityScore += 5
		factors.push({
			factor: "Sentiment Analysis",
			score: 5,
			description: "Negative customer sentiment"
		})
	} else {
		qualityScore += 10
		factors.push({
			factor: "Sentiment Analysis",
			score: 10,
			description: "Sentiment not determined"
		})
	}

	// Lead association (indicates call was with known prospect)
	if (call.leadId) {
		qualityScore += 15
		factors.push({
			factor: "Lead Association",
			score: 15,
			description: "Call associated with known lead"
		})
	} else {
		factors.push({
			factor: "Lead Association",
			score: 0,
			description: "Unknown caller"
		})
	}

	// Normalize score to 0-100 range
	qualityScore = Math.min(100, qualityScore)

	return {
		sessionId,
		qualityScore,
		qualityGrade:
			qualityScore >= 80
				? "Excellent"
				: qualityScore >= 60
					? "Good"
					: qualityScore >= 40
						? "Fair"
						: "Poor",
		factors
	}
}

// Real-time call status update (for live dashboard)
export async function getActiveCallsStatus() {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const activeCalls = await db
		.select({
			sessionId: voiceSessions.sessionId,
			agentName: voiceAgents.name,
			phoneNumber: voiceSessions.phoneNumber,
			direction: voiceSessions.direction,
			startTime: voiceSessions.startTime,
			duration: sql<number>`EXTRACT(epoch FROM (NOW() - ${voiceSessions.startTime}))`
		})
		.from(voiceSessions)
		.innerJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
		.where(
			and(
				eq(voiceSessions.userId, user.id),
				eq(voiceSessions.status, "active")
			)
		)
		.orderBy(desc(voiceSessions.startTime))

	return activeCalls.map((call) => ({
		...call,
		duration: Math.round(call.duration)
	}))
}
