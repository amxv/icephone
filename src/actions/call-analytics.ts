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

	// Get basic call statistics from voice sessions
	const voiceSessionStats = await db
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

	// Get legacy call statistics (from calls table)
	const legacyCallStats = await db
		.select({
			totalCalls: count(calls.id),
			totalDuration: sum(calls.duration),
			averageDuration: avg(calls.duration),
			successfulCalls: count(
				sql`CASE WHEN ${calls.status} = 'completed' THEN 1 END`
			),
			failedCalls: count(
				sql`CASE WHEN ${calls.status} = 'failed' THEN 1 END`
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

	// Combine statistics from both tables
	const voiceStats = voiceSessionStats[0]
	const legacyStats = legacyCallStats[0]

	const combinedStats = {
		totalCalls: voiceStats.totalCalls + legacyStats.totalCalls,
		totalDuration:
			(Number(voiceStats.totalDuration) || 0) +
			(Number(legacyStats.totalDuration) || 0),
		averageDuration:
			((Number(voiceStats.averageDuration) || 0) +
				(Number(legacyStats.averageDuration) || 0)) /
			2,
		totalCost: Number(voiceStats.totalCost) || 0, // Only voice sessions have cost data
		averageCost: Number(voiceStats.averageCost) || 0,
		successfulCalls:
			voiceStats.successfulCalls + legacyStats.successfulCalls,
		failedCalls: voiceStats.failedCalls + legacyStats.failedCalls
	}

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

	// Get daily call volume from voice sessions
	const dailyVoiceStats = await db
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

	// Get daily call volume from legacy calls table
	const dailyLegacyStats = await db
		.select({
			date: sql<string>`DATE(${calls.startTime})`,
			calls: count(calls.id),
			duration: sum(calls.duration)
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
		.orderBy(sql`DATE(${calls.startTime})`)

	// Combine daily stats from both sources
	const dailyStatsMap = new Map<
		string,
		{ calls: number; duration: number; cost: number }
	>()

	// Add voice session data
	for (const day of dailyVoiceStats) {
		dailyStatsMap.set(day.date, {
			calls: day.calls,
			duration: Number(day.duration) || 0,
			cost: Number(day.cost) || 0
		})
	}

	// Add legacy call data
	for (const day of dailyLegacyStats) {
		const existing = dailyStatsMap.get(day.date) || {
			calls: 0,
			duration: 0,
			cost: 0
		}
		dailyStatsMap.set(day.date, {
			calls: existing.calls + day.calls,
			duration: existing.duration + (Number(day.duration) || 0),
			cost: existing.cost // Only voice sessions have cost data
		})
	}

	const dailyCallVolume = Array.from(dailyStatsMap.entries())
		.map(([date, stats]) => ({
			date,
			calls: stats.calls,
			duration: stats.duration,
			cost: stats.cost
		}))
		.sort((a, b) => a.date.localeCompare(b.date))

	return {
		totalCalls: combinedStats.totalCalls,
		totalDuration: combinedStats.totalDuration,
		averageDuration: Math.round(combinedStats.averageDuration),
		totalCost: combinedStats.totalCost,
		averageCost: combinedStats.averageCost,
		successfulCalls: combinedStats.successfulCalls,
		failedCalls: combinedStats.failedCalls,
		successRate:
			combinedStats.totalCalls > 0
				? Math.round(
						(combinedStats.successfulCalls /
							combinedStats.totalCalls) *
							100
					)
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

// Get comprehensive performance trends and predictions
export async function getPerformanceTrends(
	timeRange: "month" | "quarter" | "year" = "quarter"
) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const now = new Date()
	let startDate: Date
	let endDate: Date

	switch (timeRange) {
		case "month":
			startDate = startOfMonth(subDays(now, 30))
			endDate = endOfMonth(now)
			break
		case "quarter":
			startDate = startOfMonth(subDays(now, 90))
			endDate = endOfMonth(now)
			break
		case "year":
			startDate = startOfMonth(subDays(now, 365))
			endDate = endOfMonth(now)
			break
	}

	// Get weekly performance data for trend analysis
	const weeklyTrends = await db
		.select({
			week: sql<string>`date_trunc('week', ${voiceSessions.startTime})`,
			totalCalls: count(voiceSessions.id),
			successfulCalls: count(
				sql`CASE WHEN ${voiceSessions.status} = 'completed' THEN 1 END`
			),
			averageDuration: avg(voiceSessions.duration),
			totalCost: sum(voiceSessions.cost),
			positiveCallsPercent: sql<number>`
				ROUND(
					(COUNT(CASE WHEN ${voiceSessions.sentiment} = 'positive' THEN 1 END) * 100.0) /
					NULLIF(COUNT(${voiceSessions.id}), 0),
					2
				)
			`
		})
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.userId, user.id),
				gte(voiceSessions.startTime, startDate),
				lte(voiceSessions.startTime, endDate)
			)
		)
		.groupBy(sql`date_trunc('week', ${voiceSessions.startTime})`)
		.orderBy(sql`date_trunc('week', ${voiceSessions.startTime})`)

	// Calculate growth rates and trends
	const trends = weeklyTrends.map((week, index) => {
		const previousWeek = weeklyTrends[index - 1]
		let callGrowthRate = 0
		let costGrowthRate = 0
		let durationGrowthRate = 0

		if (previousWeek && previousWeek.totalCalls > 0) {
			callGrowthRate =
				((week.totalCalls - previousWeek.totalCalls) /
					previousWeek.totalCalls) *
				100
		}

		if (previousWeek && Number(previousWeek.totalCost) > 0) {
			const currentCost = Number(week.totalCost) || 0
			const prevCost = Number(previousWeek.totalCost) || 0
			costGrowthRate = ((currentCost - prevCost) / prevCost) * 100
		}

		if (previousWeek && Number(previousWeek.averageDuration) > 0) {
			const currentDuration = Number(week.averageDuration) || 0
			const prevDuration = Number(previousWeek.averageDuration) || 0
			durationGrowthRate =
				((currentDuration - prevDuration) / prevDuration) * 100
		}

		return {
			week: week.week,
			totalCalls: week.totalCalls,
			successRate:
				week.totalCalls > 0
					? (week.successfulCalls / week.totalCalls) * 100
					: 0,
			averageDuration: Math.round(Number(week.averageDuration) || 0),
			totalCost: Number(week.totalCost) || 0,
			positiveCallsPercent: week.positiveCallsPercent || 0,
			growthRates: {
				calls: Math.round(callGrowthRate * 100) / 100,
				cost: Math.round(costGrowthRate * 100) / 100,
				duration: Math.round(durationGrowthRate * 100) / 100
			}
		}
	})

	return {
		timeRange,
		weeklyTrends: trends,
		overallTrend: {
			totalPeriodCalls: trends.reduce(
				(sum, week) => sum + week.totalCalls,
				0
			),
			averageSuccessRate:
				trends.length > 0
					? trends.reduce((sum, week) => sum + week.successRate, 0) /
						trends.length
					: 0,
			totalPeriodCost: trends.reduce(
				(sum, week) => sum + week.totalCost,
				0
			),
			averagePositiveSentiment:
				trends.length > 0
					? trends.reduce(
							(sum, week) => sum + week.positiveCallsPercent,
							0
						) / trends.length
					: 0
		}
	}
}

// Get cost breakdown and budget analytics
export async function getCostAnalytics(
	timeRange: "today" | "week" | "month" | "quarter" = "month"
) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

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
	}

	// Get cost breakdown by agent
	const agentCosts = await db
		.select({
			agentId: voiceSessions.agentId,
			agentName: voiceAgents.name,
			totalCost: sum(voiceSessions.cost),
			callCount: count(voiceSessions.id),
			averageCostPerCall: avg(voiceSessions.cost),
			totalDuration: sum(voiceSessions.duration)
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
		.orderBy(desc(sum(voiceSessions.cost)))

	// Get cost breakdown by call direction
	const directionCosts = await db
		.select({
			direction: voiceSessions.direction,
			totalCost: sum(voiceSessions.cost),
			callCount: count(voiceSessions.id),
			averageCostPerCall: avg(voiceSessions.cost)
		})
		.from(voiceSessions)
		.where(
			and(
				eq(voiceSessions.userId, user.id),
				gte(voiceSessions.startTime, startDate),
				lte(voiceSessions.startTime, endDate)
			)
		)
		.groupBy(voiceSessions.direction)

	// Calculate cost efficiency metrics
	const totalCost = agentCosts.reduce(
		(sum, agent) => sum + (Number(agent.totalCost) || 0),
		0
	)
	const totalCalls = agentCosts.reduce(
		(sum, agent) => sum + agent.callCount,
		0
	)
	const totalDuration = agentCosts.reduce(
		(sum, agent) => sum + (Number(agent.totalDuration) || 0),
		0
	)

	return {
		timeRange,
		summary: {
			totalCost,
			totalCalls,
			averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
			costPerMinute:
				totalDuration > 0 ? (totalCost / totalDuration) * 60 : 0
		},
		agentBreakdown: agentCosts.map((agent) => ({
			agentId: agent.agentId,
			agentName: agent.agentName,
			totalCost: Number(agent.totalCost) || 0,
			callCount: agent.callCount,
			averageCostPerCall: Number(agent.averageCostPerCall) || 0,
			totalDuration: Number(agent.totalDuration) || 0,
			costShare:
				totalCost > 0
					? ((Number(agent.totalCost) || 0) / totalCost) * 100
					: 0
		})),
		directionBreakdown: directionCosts.map((direction) => ({
			direction: direction.direction,
			totalCost: Number(direction.totalCost) || 0,
			callCount: direction.callCount,
			averageCostPerCall: Number(direction.averageCostPerCall) || 0
		}))
	}
}
