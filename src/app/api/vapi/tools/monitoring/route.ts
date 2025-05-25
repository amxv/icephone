import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { db_ws } from "@/db"
import { toolCalls, leadInteractions } from "@/db/schema"
import { eq, and, gte, desc, count, avg, sql } from "drizzle-orm"

// Performance monitoring interfaces
interface PerformanceMetrics {
	averageResponseTime: number
	p95ResponseTime: number
	p99ResponseTime: number
	errorRate: number
	throughput: number
	activeConnections: number
}

interface ErrorAnalysis {
	errorType: string
	count: number
	lastOccurrence: Date
	affectedTools: string[]
	severity: "low" | "medium" | "high" | "critical"
}

interface SystemAlerts {
	id: string
	type: "performance" | "error" | "capacity" | "security"
	severity: "low" | "medium" | "high" | "critical"
	message: string
	timestamp: Date
	resolved: boolean
}

// Get real-time performance metrics
async function getPerformanceMetrics(timeRange: {
	from: Date
	to: Date
}): Promise<PerformanceMetrics> {
	try {
		const metrics = await db_ws
			.select({
				avgResponseTime: avg(toolCalls.executionTime),
				totalCalls: count(toolCalls.id),
				errorCount: sql`COUNT(CASE WHEN ${toolCalls.result}->>'success' = 'false' THEN 1 END)`,
				p95ResponseTime: sql`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${toolCalls.executionTime})`,
				p99ResponseTime: sql`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${toolCalls.executionTime})`
			})
			.from(toolCalls)
			.where(
				and(
					gte(toolCalls.createdAt, timeRange.from),
					sql`${toolCalls.createdAt} <= ${timeRange.to}`
				)
			)

		const result = metrics[0]
		const totalCalls = Number(result.totalCalls)
		const errorCount = Number(result.errorCount)

		return {
			averageResponseTime: Number(result.avgResponseTime) || 0,
			p95ResponseTime: Number(result.p95ResponseTime) || 0,
			p99ResponseTime: Number(result.p99ResponseTime) || 0,
			errorRate: totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0,
			throughput:
				totalCalls /
				((timeRange.to.getTime() - timeRange.from.getTime()) /
					(1000 * 60)), // calls per minute
			activeConnections: totalCalls // Simplified - in real implementation would track active connections
		}
	} catch (error) {
		console.error("Error getting performance metrics:", error)
		return {
			averageResponseTime: 0,
			p95ResponseTime: 0,
			p99ResponseTime: 0,
			errorRate: 0,
			throughput: 0,
			activeConnections: 0
		}
	}
}

// Analyze error patterns
async function analyzeErrors(timeRange: { from: Date; to: Date }): Promise<
	ErrorAnalysis[]
> {
	try {
		const errors = await db_ws
			.select({
				toolName: toolCalls.toolName,
				errorMessage: sql`${toolCalls.result}->>'error'`,
				count: count(toolCalls.id),
				lastOccurrence: sql`MAX(${toolCalls.createdAt})`
			})
			.from(toolCalls)
			.where(
				and(
					gte(toolCalls.createdAt, timeRange.from),
					sql`${toolCalls.createdAt} <= ${timeRange.to}`,
					sql`${toolCalls.result}->>'success' = 'false'`
				)
			)
			.groupBy(toolCalls.toolName, sql`${toolCalls.result}->>'error'`)
			.orderBy(desc(count(toolCalls.id)))

		return errors.map((error) => {
			const errorCount = Number(error.count)
			let severity: "low" | "medium" | "high" | "critical" = "low"

			if (errorCount > 100) severity = "critical"
			else if (errorCount > 50) severity = "high"
			else if (errorCount > 10) severity = "medium"

			return {
				errorType: (error.errorMessage as string) || "Unknown error",
				count: errorCount,
				lastOccurrence: new Date(error.lastOccurrence as string),
				affectedTools: [error.toolName],
				severity
			}
		})
	} catch (error) {
		console.error("Error analyzing errors:", error)
		return []
	}
}

// Generate system alerts based on metrics
async function generateSystemAlerts(
	metrics: PerformanceMetrics,
	errors: ErrorAnalysis[]
): Promise<SystemAlerts[]> {
	const alerts: SystemAlerts[] = []

	// Performance alerts
	if (metrics.averageResponseTime > 5000) {
		alerts.push({
			id: `perf-${Date.now()}`,
			type: "performance",
			severity: metrics.averageResponseTime > 10000 ? "critical" : "high",
			message: `High average response time: ${metrics.averageResponseTime.toFixed(0)}ms`,
			timestamp: new Date(),
			resolved: false
		})
	}

	if (metrics.errorRate > 10) {
		alerts.push({
			id: `error-${Date.now()}`,
			type: "error",
			severity: metrics.errorRate > 25 ? "critical" : "high",
			message: `High error rate: ${metrics.errorRate.toFixed(1)}%`,
			timestamp: new Date(),
			resolved: false
		})
	}

	// Capacity alerts
	if (metrics.throughput > 1000) {
		alerts.push({
			id: `capacity-${Date.now()}`,
			type: "capacity",
			severity: "medium",
			message: `High throughput detected: ${metrics.throughput.toFixed(0)} calls/min`,
			timestamp: new Date(),
			resolved: false
		})
	}

	// Critical error alerts
	const criticalErrors = errors.filter((e) => e.severity === "critical")
	if (criticalErrors.length > 0) {
		alerts.push({
			id: `critical-${Date.now()}`,
			type: "error",
			severity: "critical",
			message: `${criticalErrors.length} critical error types detected`,
			timestamp: new Date(),
			resolved: false
		})
	}

	return alerts
}

export async function GET(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Only allow admin users to access monitoring data
		if (
			!user.publicMetadata?.role ||
			user.publicMetadata.role !== "admin"
		) {
			return NextResponse.json(
				{ error: "Admin access required" },
				{ status: 403 }
			)
		}

		const { searchParams } = new URL(request.url)
		const timeRangeParam = searchParams.get("timeRange") || "1h"
		const metricType = searchParams.get("type") || "all"

		// Calculate time range
		const now = new Date()
		const timeRanges = {
			"5m": 5 * 60 * 1000,
			"15m": 15 * 60 * 1000,
			"1h": 60 * 60 * 1000,
			"6h": 6 * 60 * 60 * 1000,
			"24h": 24 * 60 * 60 * 1000,
			"7d": 7 * 24 * 60 * 60 * 1000
		}

		const timeRange = {
			from: new Date(
				now.getTime() -
					(timeRanges[timeRangeParam as keyof typeof timeRanges] ||
						timeRanges["1h"])
			),
			to: now
		}

		const response: Record<string, unknown> = {}

		if (metricType === "all" || metricType === "performance") {
			response.performance = await getPerformanceMetrics(timeRange)
		}

		if (metricType === "all" || metricType === "errors") {
			response.errors = await analyzeErrors(timeRange)
		}

		if (metricType === "all" || metricType === "alerts") {
			const performance =
				(response.performance as PerformanceMetrics) ||
				(await getPerformanceMetrics(timeRange))
			const errors =
				(response.errors as ErrorAnalysis[]) ||
				(await analyzeErrors(timeRange))
			response.alerts = await generateSystemAlerts(performance, errors)
		}

		return NextResponse.json({
			success: true,
			data: response,
			timeRange: {
				from: timeRange.from.toISOString(),
				to: timeRange.to.toISOString()
			},
			timestamp: new Date().toISOString()
		})
	} catch (error) {
		console.error("Error in monitoring endpoint:", error)
		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			{ status: 500 }
		)
	}
}

// POST endpoint for manual alert resolution
export async function POST(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		if (
			!user.publicMetadata?.role ||
			user.publicMetadata.role !== "admin"
		) {
			return NextResponse.json(
				{ error: "Admin access required" },
				{ status: 403 }
			)
		}

		const body = (await request.json()) as {
			action?: string
			alertId?: string
		}
		const { action, alertId } = body

		if (action === "resolve" && alertId) {
			// In a real implementation, you would update the alert status in the database
			// For now, we'll just return success
			return NextResponse.json({
				success: true,
				message: `Alert ${alertId} marked as resolved`,
				timestamp: new Date().toISOString()
			})
		}

		if (action === "test_alert") {
			// Generate a test alert for testing purposes
			const testAlert: SystemAlerts = {
				id: `test-${Date.now()}`,
				type: "performance",
				severity: "medium",
				message:
					"Test alert generated for monitoring system validation",
				timestamp: new Date(),
				resolved: false
			}

			return NextResponse.json({
				success: true,
				alert: testAlert,
				message: "Test alert generated successfully"
			})
		}

		return NextResponse.json({ error: "Invalid action" }, { status: 400 })
	} catch (error) {
		console.error("Error in monitoring POST endpoint:", error)
		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			{ status: 500 }
		)
	}
}
