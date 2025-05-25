import { db_ws } from "@/db"
import { toolCalls, leadInteractions, leads, calls } from "@/db/schema"
import { eq, and, gte, desc, count, avg, sum, sql } from "drizzle-orm"

export interface ToolUsageStats {
	toolName: string
	totalCalls: number
	successRate: number
	averageExecutionTime: number
	totalExecutionTime: number
	errorCount: number
	lastUsed: Date | null
}

export interface UserToolStats {
	userId: string
	totalToolCalls: number
	successfulCalls: number
	failedCalls: number
	averageExecutionTime: number
	mostUsedTools: Array<{ toolName: string; count: number }>
	lastActivity: Date | null
}

export interface SystemHealth {
	totalToolCalls: number
	overallSuccessRate: number
	averageResponseTime: number
	errorRate: number
	activeUsers: number
	slowQueries: Array<{
		toolName: string
		averageTime: number
		count: number
	}>
}

// Get tool usage statistics
export async function getToolUsageStats(
	userId?: string,
	timeRange?: { from: Date; to: Date }
): Promise<ToolUsageStats[]> {
	try {
		const whereClause = []

		if (userId) {
			whereClause.push(eq(toolCalls.userId, userId))
		}

		if (timeRange) {
			whereClause.push(gte(toolCalls.createdAt, timeRange.from))
			whereClause.push(sql`${toolCalls.createdAt} <= ${timeRange.to}`)
		}

		const stats = await db_ws
			.select({
				toolName: toolCalls.toolName,
				totalCalls: count(toolCalls.id),
				successCount: sum(
					sql`CASE WHEN ${toolCalls.result}->>'success' = 'true' THEN 1 ELSE 0 END`
				),
				averageExecutionTime: avg(toolCalls.executionTime),
				totalExecutionTime: sum(toolCalls.executionTime),
				lastUsed: sql`MAX(${toolCalls.createdAt})`
			})
			.from(toolCalls)
			.where(whereClause.length > 0 ? and(...whereClause) : undefined)
			.groupBy(toolCalls.toolName)
			.orderBy(desc(count(toolCalls.id)))

		return stats.map((stat) => ({
			toolName: stat.toolName,
			totalCalls: Number(stat.totalCalls),
			successRate: stat.totalCalls
				? (Number(stat.successCount) / Number(stat.totalCalls)) * 100
				: 0,
			averageExecutionTime: Number(stat.averageExecutionTime) || 0,
			totalExecutionTime: Number(stat.totalExecutionTime) || 0,
			errorCount: Number(stat.totalCalls) - Number(stat.successCount),
			lastUsed: stat.lastUsed ? new Date(stat.lastUsed as string) : null
		}))
	} catch (error) {
		console.error("Error getting tool usage stats:", error)
		return []
	}
}

// Get user-specific tool statistics
export async function getUserToolStats(
	userId: string,
	timeRange?: { from: Date; to: Date }
): Promise<UserToolStats | null> {
	try {
		const whereClause = [eq(toolCalls.userId, userId)]

		if (timeRange) {
			whereClause.push(gte(toolCalls.createdAt, timeRange.from))
			whereClause.push(sql`${toolCalls.createdAt} <= ${timeRange.to}`)
		}

		// Get overall user stats
		const overallStats = await db_ws
			.select({
				totalCalls: count(toolCalls.id),
				successfulCalls: sum(
					sql`CASE WHEN ${toolCalls.result}->>'success' = 'true' THEN 1 ELSE 0 END`
				),
				averageExecutionTime: avg(toolCalls.executionTime),
				lastActivity: sql`MAX(${toolCalls.createdAt})`
			})
			.from(toolCalls)
			.where(and(...whereClause))

		if (!overallStats[0] || Number(overallStats[0].totalCalls) === 0) {
			return null
		}

		// Get most used tools
		const mostUsedTools = await db_ws
			.select({
				toolName: toolCalls.toolName,
				count: count(toolCalls.id)
			})
			.from(toolCalls)
			.where(and(...whereClause))
			.groupBy(toolCalls.toolName)
			.orderBy(desc(count(toolCalls.id)))
			.limit(5)

		const stat = overallStats[0]
		return {
			userId,
			totalToolCalls: Number(stat.totalCalls),
			successfulCalls: Number(stat.successfulCalls),
			failedCalls: Number(stat.totalCalls) - Number(stat.successfulCalls),
			averageExecutionTime: Number(stat.averageExecutionTime) || 0,
			mostUsedTools: mostUsedTools.map((tool) => ({
				toolName: tool.toolName,
				count: Number(tool.count)
			})),
			lastActivity: stat.lastActivity
				? new Date(stat.lastActivity as string)
				: null
		}
	} catch (error) {
		console.error("Error getting user tool stats:", error)
		return null
	}
}

// Get system health metrics
export async function getSystemHealth(timeRange?: {
	from: Date
	to: Date
}): Promise<SystemHealth> {
	try {
		const whereClause = []

		if (timeRange) {
			whereClause.push(gte(toolCalls.createdAt, timeRange.from))
			whereClause.push(sql`${toolCalls.createdAt} <= ${timeRange.to}`)
		}

		// Get overall system stats
		const systemStats = await db_ws
			.select({
				totalCalls: count(toolCalls.id),
				successfulCalls: sum(
					sql`CASE WHEN ${toolCalls.result}->>'success' = 'true' THEN 1 ELSE 0 END`
				),
				averageResponseTime: avg(toolCalls.executionTime),
				activeUsers: sql`COUNT(DISTINCT ${toolCalls.userId})`
			})
			.from(toolCalls)
			.where(whereClause.length > 0 ? and(...whereClause) : undefined)

		// Get slow queries (tools with high execution times)
		const slowQueries = await db_ws
			.select({
				toolName: toolCalls.toolName,
				averageTime: avg(toolCalls.executionTime),
				count: count(toolCalls.id)
			})
			.from(toolCalls)
			.where(
				whereClause.length > 0
					? and(...whereClause, gte(toolCalls.executionTime, 5000))
					: gte(toolCalls.executionTime, 5000)
			)
			.groupBy(toolCalls.toolName)
			.orderBy(desc(avg(toolCalls.executionTime)))
			.limit(10)

		const stat = systemStats[0]
		const totalCalls = Number(stat.totalCalls)
		const successfulCalls = Number(stat.successfulCalls)

		return {
			totalToolCalls: totalCalls,
			overallSuccessRate:
				totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
			averageResponseTime: Number(stat.averageResponseTime) || 0,
			errorRate:
				totalCalls > 0
					? ((totalCalls - successfulCalls) / totalCalls) * 100
					: 0,
			activeUsers: Number(stat.activeUsers),
			slowQueries: slowQueries.map((query) => ({
				toolName: query.toolName,
				averageTime: Number(query.averageTime) || 0,
				count: Number(query.count)
			}))
		}
	} catch (error) {
		console.error("Error getting system health:", error)
		return {
			totalToolCalls: 0,
			overallSuccessRate: 0,
			averageResponseTime: 0,
			errorRate: 0,
			activeUsers: 0,
			slowQueries: []
		}
	}
}

// Clean up old logs (to be called periodically)
export async function cleanupOldLogs(
	retentionDays: number = 90
): Promise<{ deletedToolCalls: number; deletedInteractions: number }> {
	try {
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

		// Delete old tool calls
		const deletedToolCalls = await db_ws
			.delete(toolCalls)
			.where(sql`${toolCalls.createdAt} < ${cutoffDate}`)

		// Delete old lead interactions (keep more recent ones)
		const deletedInteractions = await db_ws
			.delete(leadInteractions)
			.where(sql`${leadInteractions.createdAt} < ${cutoffDate}`)

		console.log(
			`Cleaned up ${deletedToolCalls.rowCount} tool calls and ${deletedInteractions.rowCount} lead interactions older than ${retentionDays} days`
		)

		return {
			deletedToolCalls: deletedToolCalls.rowCount || 0,
			deletedInteractions: deletedInteractions.rowCount || 0
		}
	} catch (error) {
		console.error("Error cleaning up old logs:", error)
		return { deletedToolCalls: 0, deletedInteractions: 0 }
	}
}

// Detect performance issues and generate alerts
export async function detectPerformanceIssues(): Promise<
	Array<{
		type: string
		severity: "low" | "medium" | "high"
		message: string
		data: Record<string, unknown>
	}>
> {
	const issues = [] as Array<{
		type: string
		severity: "low" | "medium" | "high"
		message: string
		data: Record<string, unknown>
	}>

	try {
		// Check for tools with high failure rates
		const toolStats = await getToolUsageStats()
		for (const tool of toolStats) {
			if (tool.totalCalls >= 10 && tool.successRate < 80) {
				issues.push({
					type: "high_failure_rate",
					severity: tool.successRate < 60 ? "high" : "medium",
					message: `Tool ${tool.toolName} has a ${tool.successRate.toFixed(1)}% success rate`,
					data: {
						toolName: tool.toolName,
						successRate: tool.successRate,
						totalCalls: tool.totalCalls
					}
				})
			}

			if (tool.averageExecutionTime > 10000) {
				issues.push({
					type: "slow_execution",
					severity:
						tool.averageExecutionTime > 20000
							? "high"
							: ("medium" as const),
					message: `Tool ${tool.toolName} has slow execution time (${tool.averageExecutionTime}ms avg)`,
					data: {
						toolName: tool.toolName,
						averageExecutionTime: tool.averageExecutionTime
					}
				})
			}
		}

		// Check system health
		const health = await getSystemHealth()
		if (health.errorRate > 15) {
			issues.push({
				type: "high_error_rate",
				severity: health.errorRate > 25 ? "high" : ("medium" as const),
				message: `System has high error rate: ${health.errorRate.toFixed(1)}%`,
				data: {
					errorRate: health.errorRate,
					totalCalls: health.totalToolCalls
				}
			})
		}

		return issues
	} catch (error) {
		console.error("Error detecting performance issues:", error)
		return []
	}
}
