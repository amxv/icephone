import { db_ws } from "@/db"
import { toolCalls } from "@/db/schema"
import { eq, and, gte, desc, count, avg, sql } from "drizzle-orm"

export interface PerformanceMetrics {
	toolName: string
	averageLatency: number
	p95Latency: number
	p99Latency: number
	successRate: number
	errorRate: number
	requestsPerMinute: number
	lastHourCalls: number
	status: "healthy" | "warning" | "critical"
}

export interface SystemAlert {
	id: string
	type: "performance" | "error_rate" | "availability" | "capacity"
	severity: "low" | "medium" | "high" | "critical"
	message: string
	timestamp: Date
	toolName?: string
	metrics: Record<string, unknown>
	resolved: boolean
}

// Real-time performance monitoring
export async function getToolPerformanceMetrics(
	timeRangeMinutes: number = 60
): Promise<PerformanceMetrics[]> {
	try {
		const timeThreshold = new Date(
			Date.now() - timeRangeMinutes * 60 * 1000
		)

		const metricsQuery = await db_ws
			.select({
				toolName: toolCalls.toolName,
				totalCalls: count(toolCalls.id),
				successCount: sql<number>`SUM(CASE WHEN ${toolCalls.result}->>'success' = 'true' THEN 1 ELSE 0 END)`,
				averageLatency: avg(toolCalls.executionTime),
				p95Latency: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${toolCalls.executionTime})`,
				p99Latency: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${toolCalls.executionTime})`,
				maxLatency: sql<number>`MAX(${toolCalls.executionTime})`,
				minLatency: sql<number>`MIN(${toolCalls.executionTime})`
			})
			.from(toolCalls)
			.where(gte(toolCalls.createdAt, timeThreshold))
			.groupBy(toolCalls.toolName)

		return metricsQuery.map((metric) => {
			const totalCalls = Number(metric.totalCalls)
			const successCount = Number(metric.successCount)
			const avgLatency = Number(metric.averageLatency) || 0
			const p95 = Number(metric.p95Latency) || 0
			const p99 = Number(metric.p99Latency) || 0

			const successRate =
				totalCalls > 0 ? (successCount / totalCalls) * 100 : 0
			const errorRate = 100 - successRate
			const requestsPerMinute = totalCalls / timeRangeMinutes

			// Determine health status
			let status: "healthy" | "warning" | "critical" = "healthy"
			if (errorRate > 25 || avgLatency > 10000) {
				status = "critical"
			} else if (errorRate > 10 || avgLatency > 5000) {
				status = "warning"
			}

			return {
				toolName: metric.toolName,
				averageLatency: avgLatency,
				p95Latency: p95,
				p99Latency: p99,
				successRate,
				errorRate,
				requestsPerMinute,
				lastHourCalls: totalCalls,
				status
			}
		})
	} catch (error) {
		console.error("Error getting tool performance metrics:", error)
		return []
	}
}

// Automated alerting system
export async function generateSystemAlerts(): Promise<SystemAlert[]> {
	const alerts: SystemAlert[] = []
	const metrics = await getToolPerformanceMetrics(60) // Last hour

	for (const metric of metrics) {
		const alertId = `${metric.toolName}-${Date.now()}`

		// High error rate alert
		if (metric.errorRate > 25) {
			alerts.push({
				id: `error-${alertId}`,
				type: "error_rate",
				severity: "critical",
				message: `Tool ${metric.toolName} has critical error rate: ${metric.errorRate.toFixed(1)}%`,
				timestamp: new Date(),
				toolName: metric.toolName,
				metrics: {
					errorRate: metric.errorRate,
					totalCalls: metric.lastHourCalls,
					successRate: metric.successRate
				},
				resolved: false
			})
		} else if (metric.errorRate > 10) {
			alerts.push({
				id: `error-${alertId}`,
				type: "error_rate",
				severity: "high",
				message: `Tool ${metric.toolName} has high error rate: ${metric.errorRate.toFixed(1)}%`,
				timestamp: new Date(),
				toolName: metric.toolName,
				metrics: {
					errorRate: metric.errorRate,
					totalCalls: metric.lastHourCalls
				},
				resolved: false
			})
		}

		// High latency alert
		if (metric.p99Latency > 15000) {
			alerts.push({
				id: `latency-${alertId}`,
				type: "performance",
				severity: "critical",
				message: `Tool ${metric.toolName} has critical latency: P99 ${metric.p99Latency}ms`,
				timestamp: new Date(),
				toolName: metric.toolName,
				metrics: {
					p99Latency: metric.p99Latency,
					p95Latency: metric.p95Latency,
					averageLatency: metric.averageLatency
				},
				resolved: false
			})
		} else if (metric.p95Latency > 8000) {
			alerts.push({
				id: `latency-${alertId}`,
				type: "performance",
				severity: "high",
				message: `Tool ${metric.toolName} has high latency: P95 ${metric.p95Latency}ms`,
				timestamp: new Date(),
				toolName: metric.toolName,
				metrics: {
					p95Latency: metric.p95Latency,
					averageLatency: metric.averageLatency
				},
				resolved: false
			})
		}

		// Low availability alert (very few calls when expected)
		if (metric.requestsPerMinute < 0.1 && metric.lastHourCalls === 0) {
			alerts.push({
				id: `availability-${alertId}`,
				type: "availability",
				severity: "medium",
				message: `Tool ${metric.toolName} has received no requests in the last hour`,
				timestamp: new Date(),
				toolName: metric.toolName,
				metrics: {
					requestsPerMinute: metric.requestsPerMinute,
					lastHourCalls: metric.lastHourCalls
				},
				resolved: false
			})
		}
	}

	// System-wide capacity alerts
	const totalRequests = metrics.reduce((sum, m) => sum + m.lastHourCalls, 0)
	const overallErrorRate =
		metrics.length > 0
			? metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
			: 0

	if (totalRequests > 1000) {
		// High load threshold
		alerts.push({
			id: `capacity-${Date.now()}`,
			type: "capacity",
			severity: "medium",
			message: `High system load detected: ${totalRequests} tool calls in the last hour`,
			timestamp: new Date(),
			metrics: {
				totalRequests,
				overallErrorRate,
				activeTools: metrics.length
			},
			resolved: false
		})
	}

	return alerts
}

// Tool availability monitoring
export async function checkToolAvailability(): Promise<
	Record<string, boolean>
> {
	const availability: Record<string, boolean> = {}

	// List of expected tools
	const expectedTools = [
		"updateLeadScore",
		"updateLeadNotes",
		"sendFollowUpEmail",
		"searchCallTranscripts",
		"getLeadHistory",
		"scheduleAppointment",
		"createTask",
		"updateDealStage",
		"analyzeConversation",
		"searchKnowledgeBase"
	]

	try {
		// Check if each tool has been called recently (last 24 hours)
		const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

		const recentCalls = await db_ws
			.select({
				toolName: toolCalls.toolName,
				lastCall: sql<Date>`MAX(${toolCalls.createdAt})`
			})
			.from(toolCalls)
			.where(gte(toolCalls.createdAt, last24Hours))
			.groupBy(toolCalls.toolName)

		const recentToolsMap = new Map(
			recentCalls.map((call) => [call.toolName, call.lastCall])
		)

		for (const tool of expectedTools) {
			availability[tool] = recentToolsMap.has(tool)
		}

		return availability
	} catch (error) {
		console.error("Error checking tool availability:", error)
		// Return all tools as unavailable on error
		return expectedTools.reduce(
			(acc, tool) => {
				acc[tool] = false
				return acc
			},
			{} as Record<string, boolean>
		)
	}
}

// Automated recovery and retry logic
export interface RetryConfig {
	maxRetries: number
	baseDelay: number
	maxDelay: number
	backoffMultiplier: number
}

export async function executeWithRetry<T>(
	operation: () => Promise<T>,
	config: RetryConfig = {
		maxRetries: 3,
		baseDelay: 1000,
		maxDelay: 10000,
		backoffMultiplier: 2
	}
): Promise<T> {
	let lastError: Error | undefined

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			return await operation()
		} catch (error) {
			lastError = error as Error

			if (attempt === config.maxRetries) {
				throw lastError
			}

			// Calculate delay with exponential backoff
			const delay = Math.min(
				config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
				config.maxDelay
			)

			// Add jitter to prevent thundering herd
			const jitter = Math.random() * 0.1 * delay
			const finalDelay = delay + jitter

			console.warn(
				`Operation failed, retrying in ${finalDelay}ms (attempt ${attempt + 1}/${config.maxRetries})`,
				error
			)

			await new Promise((resolve) => setTimeout(resolve, finalDelay))
		}
	}

	throw lastError || new Error("Unknown error occurred during retry")
}

// Graceful degradation helper
export function createFallbackResponse(
	toolCallId: string,
	toolName: string,
	error: Error
): { toolCallId: string; result: string } {
	const fallbackMessages: Record<string, string> = {
		updateLeadScore:
			"Unable to update lead score at this time. Please try again later or update manually.",
		updateLeadNotes:
			"Unable to add notes automatically. Please add your notes manually after the call.",
		sendFollowUpEmail:
			"Email service temporarily unavailable. Please send follow-up email manually.",
		searchCallTranscripts:
			"Search service temporarily unavailable. Please check call history manually.",
		getLeadHistory:
			"Unable to retrieve lead history at this time. Please check lead details manually.",
		scheduleAppointment:
			"Scheduling service unavailable. Please schedule the appointment manually.",
		createTask:
			"Task creation temporarily unavailable. Please create the task manually.",
		analyzeConversation:
			"Analysis service temporarily unavailable. Manual review recommended.",
		searchKnowledgeBase:
			"Knowledge base search unavailable. Please consult documentation manually."
	}

	const fallbackMessage =
		fallbackMessages[toolName] ||
		"This feature is temporarily unavailable. Please complete this action manually."

	console.error(`Tool ${toolName} failed with fallback response:`, error)

	return {
		toolCallId,
		result: fallbackMessage
	}
}

// Performance optimization suggestions
export async function generateOptimizationSuggestions(): Promise<
	Array<{
		type: "performance" | "efficiency" | "reliability"
		suggestion: string
		impact: "low" | "medium" | "high"
		implementation: string
	}>
> {
	const suggestions = []
	const metrics = await getToolPerformanceMetrics(60)

	for (const metric of metrics) {
		if (metric.averageLatency > 5000) {
			suggestions.push({
				type: "performance" as const,
				suggestion: `Optimize ${metric.toolName} - high average latency detected`,
				impact: "high" as const,
				implementation:
					"Consider database query optimization, caching, or connection pooling"
			})
		}

		if (metric.errorRate > 5) {
			suggestions.push({
				type: "reliability" as const,
				suggestion: `Improve error handling for ${metric.toolName}`,
				impact: "high" as const,
				implementation:
					"Add better input validation and error recovery mechanisms"
			})
		}

		if (metric.requestsPerMinute > 10) {
			suggestions.push({
				type: "efficiency" as const,
				suggestion: `Consider rate limiting for ${metric.toolName} - high usage detected`,
				impact: "medium" as const,
				implementation:
					"Implement tool-specific rate limiting to prevent abuse"
			})
		}
	}

	return suggestions
}
