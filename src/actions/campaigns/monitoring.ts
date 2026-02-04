"use server"

import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"

import { db_ws } from "@/db"
import {
	campaigns,
	campaignLeads,
	campaignQueue,
	calls,
	leads
} from "@/db/schema"

// Types for monitoring
export interface CampaignHealth {
	campaignId: number
	healthScore: number // 0-100
	status: "healthy" | "warning" | "critical"
	metrics: {
		successRate: number
		queueBacklog: number
		avgResponseTime: number
		stuckCalls: number
	}
	issues: string[]
	recommendations: string[]
}

export interface PerformanceAlert {
	type:
		| "success_rate"
		| "queue_backlog"
		| "stuck_calls"
		| "stalled"
		| "completion"
	severity: "low" | "medium" | "high"
	message: string
	campaignId: number
	threshold: number
	currentValue: number
	timestamp: Date
}

export interface CampaignReport {
	campaignId: number
	name: string
	period: {
		startDate: Date
		endDate: Date
	}
	summary: {
		totalLeads: number
		callsAttempted: number
		callsCompleted: number
		callsSuccessful: number
		successRate: number
		avgCallDuration: number
		conversionRate: number
		totalCallCost: number
		convertedRevenue: number
		costPerLead: number
		costPerConversion: number
		roi: number
	}
	dailyBreakdown: Array<{
		date: string
		callsAttempted: number
		callsCompleted: number
		successRate: number
	}>
	leadProgress: {
		contacted: number
		qualified: number
		converted: number
		failed: number
	}
	health: CampaignHealth
}

// Get campaign health analysis
export async function getCampaignHealth(campaignId: number): Promise<{
	success: boolean
	data: CampaignHealth | null
	error: string | null
}> {
	try {
		const { teamId } = await requireTeam()

		// Get campaign basic info
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		// Get queue metrics
		const queueMetrics = await db_ws
			.select({
				status: campaignQueue.status,
				count: sql<number>`COUNT(*)`.as("count"),
				avgProcessingTime:
					sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))`.as(
						"avgProcessingTime"
					)
			})
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignLeads.teamId, teamId)
				)
			)
			.groupBy(campaignQueue.status)

		// Get call success metrics (last 24 hours)
		const oneDayAgo = new Date()
		oneDayAgo.setDate(oneDayAgo.getDate() - 1)

		const callMetrics = await db_ws
			.select({
				status: calls.status,
				count: sql<number>`COUNT(*)`.as("count"),
				avgDuration: sql<number>`AVG(duration)`.as("avgDuration")
			})
			.from(calls)
			.where(
				and(
					eq(calls.campaignId, campaignId),
					teamScope(calls, teamId),
					gte(calls.createdAt, oneDayAgo)
				)
			)
			.groupBy(calls.status)

		// Check for stuck calls (processing > 30 minutes)
		const thirtyMinutesAgo = new Date()
		thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)

		const stuckCalls = await db_ws
			.select({ count: sql<number>`COUNT(*)` })
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignLeads.teamId, teamId),
					eq(campaignQueue.status, "processing"),
					lte(campaignQueue.startedAt, thirtyMinutesAgo)
				)
			)

		// Calculate metrics
		const queueStatsObj = queueMetrics.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = {
						count: stat.count,
						avgProcessingTime: stat.avgProcessingTime || 0
					}
				}
				return acc
			},
			{} as Record<string, { count: number; avgProcessingTime: number }>
		)

		const callStatsObj = callMetrics.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = {
						count: stat.count,
						avgDuration: stat.avgDuration || 0
					}
				}
				return acc
			},
			{} as Record<string, { count: number; avgDuration: number }>
		)

		const totalCalls = Object.values(callStatsObj).reduce(
			(sum, stat) => sum + stat.count,
			0
		)
		const successfulCalls =
			(callStatsObj.completed?.count || 0) +
			(callStatsObj.answered?.count || 0)
		const successRate =
			totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0

		const queueBacklog = queueStatsObj.queued?.count || 0
		const stuckCallsCount = stuckCalls[0].count
		const avgResponseTime = queueStatsObj.completed?.avgProcessingTime || 0

		// Health scoring (0-100)
		let healthScore = 100
		const issues: string[] = []
		const recommendations: string[] = []

		// Success rate scoring (40 points max)
		if (successRate < 20) {
			healthScore -= 40
			issues.push("Very low success rate")
			recommendations.push("Review voice agent scripts and lead quality")
		} else if (successRate < 50) {
			healthScore -= 20
			issues.push("Below average success rate")
			recommendations.push("Optimize call timing and agent approach")
		} else if (successRate < 70) {
			healthScore -= 10
			issues.push("Room for improvement in success rate")
		}

		// Queue backlog scoring (25 points max)
		if (queueBacklog > 100) {
			healthScore -= 25
			issues.push("Large queue backlog")
			recommendations.push(
				"Increase processing frequency or reduce batch size"
			)
		} else if (queueBacklog > 50) {
			healthScore -= 15
			issues.push("Moderate queue backlog")
			recommendations.push("Monitor queue processing rate")
		} else if (queueBacklog > 20) {
			healthScore -= 5
			issues.push("Small queue backlog")
		}

		// Stuck calls scoring (20 points max)
		if (stuckCallsCount > 10) {
			healthScore -= 20
			issues.push("Many stuck calls")
			recommendations.push("Check voice integration and error handling")
		} else if (stuckCallsCount > 5) {
			healthScore -= 10
			issues.push("Some stuck calls")
			recommendations.push("Monitor call processing pipeline")
		} else if (stuckCallsCount > 0) {
			healthScore -= 5
			issues.push("Few stuck calls detected")
		}

		// Response time scoring (15 points max)
		if (avgResponseTime > 300) {
			// > 5 minutes
			healthScore -= 15
			issues.push("Slow call processing")
			recommendations.push(
				"Optimize queue processing or increase resources"
			)
		} else if (avgResponseTime > 180) {
			// > 3 minutes
			healthScore -= 10
			issues.push("Moderate call processing delays")
		} else if (avgResponseTime > 60) {
			// > 1 minute
			healthScore -= 5
			issues.push("Minor processing delays")
		}

		// Determine status
		let status: "healthy" | "warning" | "critical"
		if (healthScore >= 80) {
			status = "healthy"
		} else if (healthScore >= 60) {
			status = "warning"
		} else {
			status = "critical"
		}

		// Add general recommendations
		if (status === "healthy" && issues.length === 0) {
			recommendations.push(
				"Campaign is performing well - continue monitoring"
			)
		}

		const health: CampaignHealth = {
			campaignId,
			healthScore: Math.max(0, healthScore),
			status,
			metrics: {
				successRate,
				queueBacklog,
				avgResponseTime,
				stuckCalls: stuckCallsCount
			},
			issues,
			recommendations
		}

		return {
			success: true,
			data: health,
			error: null
		}
	} catch (error) {
		console.error("Error getting campaign health:", error)
		return {
			success: false,
			error: "Failed to get campaign health",
			data: null
		}
	}
}

// Check for performance alerts
export async function checkPerformanceAlerts(campaignId: number): Promise<{
	success: boolean
	data: PerformanceAlert[] | null
	error: string | null
}> {
	try {
		const { teamId } = await requireTeam()

		const alerts: PerformanceAlert[] = []
		const timestamp = new Date()

		// Get campaign health first
		const healthResult = await getCampaignHealth(campaignId)
		if (!healthResult.success || !healthResult.data) {
			return {
				success: false,
				error: "Failed to get campaign health for alerts",
				data: null
			}
		}

		const health = healthResult.data

		// Success rate alerts
		if (health.metrics.successRate < 20) {
			alerts.push({
				type: "success_rate",
				severity: "high",
				message: `Critical: Success rate is only ${health.metrics.successRate.toFixed(1)}% (threshold: 20%)`,
				campaignId,
				threshold: 20,
				currentValue: health.metrics.successRate,
				timestamp
			})
		} else if (health.metrics.successRate < 40) {
			alerts.push({
				type: "success_rate",
				severity: "medium",
				message: `Warning: Success rate is ${health.metrics.successRate.toFixed(1)}% (threshold: 40%)`,
				campaignId,
				threshold: 40,
				currentValue: health.metrics.successRate,
				timestamp
			})
		}

		// Queue backlog alerts
		if (health.metrics.queueBacklog > 100) {
			alerts.push({
				type: "queue_backlog",
				severity: "high",
				message: `Critical: Queue backlog is ${health.metrics.queueBacklog} calls (threshold: 100)`,
				campaignId,
				threshold: 100,
				currentValue: health.metrics.queueBacklog,
				timestamp
			})
		} else if (health.metrics.queueBacklog > 50) {
			alerts.push({
				type: "queue_backlog",
				severity: "medium",
				message: `Warning: Queue backlog is ${health.metrics.queueBacklog} calls (threshold: 50)`,
				campaignId,
				threshold: 50,
				currentValue: health.metrics.queueBacklog,
				timestamp
			})
		}

		// Stuck calls alerts
		if (health.metrics.stuckCalls > 10) {
			alerts.push({
				type: "stuck_calls",
				severity: "high",
				message: `Critical: ${health.metrics.stuckCalls} calls are stuck in processing (threshold: 10)`,
				campaignId,
				threshold: 10,
				currentValue: health.metrics.stuckCalls,
				timestamp
			})
		} else if (health.metrics.stuckCalls > 5) {
			alerts.push({
				type: "stuck_calls",
				severity: "medium",
				message: `Warning: ${health.metrics.stuckCalls} calls are stuck in processing (threshold: 5)`,
				campaignId,
				threshold: 5,
				currentValue: health.metrics.stuckCalls,
				timestamp
			})
		} else if (health.metrics.stuckCalls > 0) {
			alerts.push({
				type: "stuck_calls",
				severity: "low",
				message: `Notice: ${health.metrics.stuckCalls} calls are stuck in processing`,
				campaignId,
				threshold: 0,
				currentValue: health.metrics.stuckCalls,
				timestamp
			})
		}

		// Check for stalled campaigns (no activity in last hour)
		const oneHourAgo = new Date()
		oneHourAgo.setHours(oneHourAgo.getHours() - 1)

		const recentActivity = await db_ws
			.select({ count: sql<number>`COUNT(*)` })
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignLeads.teamId, teamId),
					gte(campaignQueue.updatedAt, oneHourAgo)
				)
			)

		if (recentActivity[0].count === 0 && health.metrics.queueBacklog > 0) {
			alerts.push({
				type: "stalled",
				severity: "medium",
				message:
					"Campaign appears stalled - no queue activity in the last hour",
				campaignId,
				threshold: 1,
				currentValue: 0,
				timestamp
			})
		}

		// Check campaign completion status
		const campaign = await db_ws
			.select({ status: campaigns.status })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (
			campaign[0]?.status === "running" &&
			health.metrics.queueBacklog === 0
		) {
			// Campaign might be complete
			const totalLeads = await db_ws
				.select({ count: sql<number>`COUNT(*)` })
				.from(campaignLeads)
				.where(
					and(
						eq(campaignLeads.campaignId, campaignId),
						eq(campaignLeads.teamId, teamId)
					)
				)

			const processedLeads = await db_ws
				.select({ count: sql<number>`COUNT(*)` })
				.from(campaignLeads)
				.where(
					and(
						eq(campaignLeads.campaignId, campaignId),
						eq(campaignLeads.teamId, teamId),
						sql`${campaignLeads.status} IN ('attempted', 'contacted', 'qualified', 'converted', 'failed')`
					)
				)

			if (processedLeads[0].count === totalLeads[0].count) {
				alerts.push({
					type: "completion",
					severity: "low",
					message:
						"Campaign appears to be complete - all leads have been processed",
					campaignId,
					threshold: totalLeads[0].count,
					currentValue: processedLeads[0].count,
					timestamp
				})
			}
		}

		return {
			success: true,
			data: alerts,
			error: null
		}
	} catch (error) {
		console.error("Error checking performance alerts:", error)
		return {
			success: false,
			error: "Failed to check performance alerts",
			data: null
		}
	}
}

// Get health status for all user campaigns
export async function getAllCampaignsHealth(): Promise<{
	success: boolean
	data: CampaignHealth[] | null
	error: string | null
}> {
	try {
		const { teamId } = await requireTeam()

		// Get all campaigns for the user
		const userCampaigns = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status
			})
			.from(campaigns)
			.where(teamScope(campaigns, teamId))
			.orderBy(desc(campaigns.updatedAt))

		if (userCampaigns.length === 0) {
			return {
				success: true,
				data: [],
				error: null
			}
		}

		// Get health for each campaign
		const healthResults = await Promise.all(
			userCampaigns.map(async (campaign) => {
				const healthResult = await getCampaignHealth(campaign.id)
				return healthResult.data
			})
		)

		// Filter out any null results
		const validHealthResults = healthResults.filter(
			(health): health is CampaignHealth => health !== null
		)

		return {
			success: true,
			data: validHealthResults,
			error: null
		}
	} catch (error) {
		console.error("Error getting all campaigns health:", error)
		return {
			success: false,
			error: "Failed to get campaigns health",
			data: null
		}
	}
}

// Generate comprehensive campaign report
export async function generateCampaignReport(
	campaignId: number,
	startDate?: Date,
	endDate?: Date
): Promise<{
	success: boolean
	data: CampaignReport | null
	error: string | null
}> {
	try {
		const { teamId } = await requireTeam()

		// Default to last 30 days if no dates provided
		const reportEndDate = endDate || new Date()
		const reportStartDate =
			startDate ||
			(() => {
				const thirtyDaysAgo = new Date()
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
				return thirtyDaysAgo
			})()

		// Get campaign info
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				createdAt: campaigns.createdAt
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		// Get lead statistics
		const leadStats = await db_ws
			.select({
				total: sql<number>`COUNT(*)`.as("total"),
				contacted:
					sql<number>`COUNT(CASE WHEN ${leads.status} IN ('contacted', 'qualified', 'converted') THEN 1 END)`.as(
						"contacted"
					),
				qualified:
					sql<number>`COUNT(CASE WHEN ${leads.status} IN ('qualified', 'converted') THEN 1 END)`.as(
						"qualified"
					),
				converted:
					sql<number>`COUNT(CASE WHEN ${leads.status} = 'converted' THEN 1 END)`.as(
						"converted"
					),
				convertedRevenue:
					sql<number>`COALESCE(SUM(CASE WHEN ${leads.status} = 'converted' THEN ${leads.dealValue}::numeric ELSE 0 END), 0)`.as(
						"convertedRevenue"
					),
				failed: sql<number>`COUNT(CASE WHEN ${campaignLeads.status} = 'failed' THEN 1 END)`.as(
					"failed"
				)
			})
			.from(campaignLeads)
			.leftJoin(leads, eq(campaignLeads.leadId, leads.id))
			.where(
				and(
					eq(campaignLeads.campaignId, campaignId),
					eq(campaignLeads.teamId, teamId)
				)
			)

		// Get call statistics for the period
		const callStats = await db_ws
			.select({
				total: sql<number>`COUNT(*)`.as("total"),
				completed:
					sql<number>`COUNT(CASE WHEN status IN ('completed', 'answered') THEN 1 END)`.as(
						"completed"
					),
				successful:
					sql<number>`COUNT(CASE WHEN status = 'answered' THEN 1 END)`.as(
						"successful"
					),
				avgDuration: sql<number>`AVG(duration)`.as("avgDuration"),
				totalCost:
					sql<number>`COALESCE(SUM(${calls.cost}::numeric), 0)`.as(
						"totalCost"
					)
			})
			.from(calls)
			.where(
				and(
					eq(calls.campaignId, campaignId),
					teamScope(calls, teamId),
					gte(calls.createdAt, reportStartDate),
					lte(calls.createdAt, reportEndDate)
				)
			)

		// Get daily breakdown
		const dailyStats = await db_ws
			.select({
				date: sql<string>`DATE(created_at)`.as("date"),
				attempted: sql<number>`COUNT(*)`.as("attempted"),
				completed:
					sql<number>`COUNT(CASE WHEN status IN ('completed', 'answered') THEN 1 END)`.as(
						"completed"
					),
				successful:
					sql<number>`COUNT(CASE WHEN status = 'answered' THEN 1 END)`.as(
						"successful"
					)
			})
			.from(calls)
			.where(
				and(
					eq(calls.campaignId, campaignId),
					teamScope(calls, teamId),
					gte(calls.createdAt, reportStartDate),
					lte(calls.createdAt, reportEndDate)
				)
			)
			.groupBy(sql`DATE(created_at)`)
			.orderBy(sql`DATE(created_at)`)

		// Get health data
		const healthResult = await getCampaignHealth(campaignId)
		const health = healthResult.data || {
			campaignId,
			healthScore: 0,
			status: "critical" as const,
			metrics: {
				successRate: 0,
				queueBacklog: 0,
				avgResponseTime: 0,
				stuckCalls: 0
			},
			issues: ["Failed to calculate health"],
			recommendations: []
		}

		// Calculate metrics
		const leadData = leadStats[0]
		const callData = callStats[0]

		const successRate =
			callData.total > 0
				? (callData.successful / callData.total) * 100
				: 0
		const conversionRate =
			leadData.total > 0 ? (leadData.converted / leadData.total) * 100 : 0
		const totalCallCost = Number(callData.totalCost || 0)
		const convertedRevenue = Number(leadData.convertedRevenue || 0)
		const costPerLead =
			callData.total > 0 ? totalCallCost / callData.total : 0
		const costPerConversion =
			leadData.converted > 0 ? totalCallCost / leadData.converted : 0
		const roi =
			totalCallCost > 0
				? ((convertedRevenue - totalCallCost) / totalCallCost) * 100
				: 0

		const report: CampaignReport = {
			campaignId,
			name: campaign[0].name,
			period: {
				startDate: reportStartDate,
				endDate: reportEndDate
			},
			summary: {
				totalLeads: leadData.total,
				callsAttempted: callData.total,
				callsCompleted: callData.completed,
				callsSuccessful: callData.successful,
				successRate,
				avgCallDuration: callData.avgDuration || 0,
				conversionRate,
				totalCallCost,
				convertedRevenue,
				costPerLead,
				costPerConversion,
				roi
			},
			dailyBreakdown: dailyStats.map((day) => ({
				date: day.date,
				callsAttempted: day.attempted,
				callsCompleted: day.completed,
				successRate:
					day.attempted > 0
						? (day.successful / day.attempted) * 100
						: 0
			})),
			leadProgress: {
				contacted: leadData.contacted,
				qualified: leadData.qualified,
				converted: leadData.converted,
				failed: leadData.failed
			},
			health
		}

		return {
			success: true,
			data: report,
			error: null
		}
	} catch (error) {
		console.error("Error generating campaign report:", error)
		return {
			success: false,
			error: "Failed to generate campaign report",
			data: null
		}
	}
}
