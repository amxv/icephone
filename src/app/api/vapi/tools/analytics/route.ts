import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import {
	getToolUsageStats,
	getUserToolStats,
	getSystemHealth,
	cleanupOldLogs,
	detectPerformanceIssues
} from "../analytics"
import { calculateScoringAccuracy } from "../functions/lead-management"

export async function GET(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const action = searchParams.get("action") || "usage"
		const userId = searchParams.get("userId") || user.id
		const days = parseInt(searchParams.get("days") || "30")
		const metricType = searchParams.get("type") || "all"

		// Calculate time range
		const timeRange = {
			from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
			to: new Date()
		}

		const analytics: Record<string, unknown> = {}

		switch (action) {
			case "usage": {
				const stats = await getToolUsageStats(userId, timeRange)
				analytics.usage = stats
				break
			}

			case "user": {
				const userStats = await getUserToolStats(userId, timeRange)
				analytics.user = userStats
				break
			}

			case "health": {
				const health = await getSystemHealth(timeRange)
				analytics.health = health
				break
			}

			case "issues": {
				const issues = await detectPerformanceIssues()
				analytics.issues = issues
				break
			}

			case "cleanup": {
				// Only allow admin users to trigger cleanup
				const isAdmin = process.env.OWNER_USER_ID === user.id
				if (!isAdmin) {
					return NextResponse.json(
						{ error: "Admin access required" },
						{ status: 403 }
					)
				}

				const retentionDays = parseInt(
					searchParams.get("retentionDays") || "90"
				)
				const cleanup = await cleanupOldLogs(retentionDays)
				analytics.cleanup = cleanup
				break
			}

			case "scoring": {
				analytics.scoringAccuracy = await calculateScoringAccuracy(
					user.id
				)
				break
			}

			case "overview": {
				analytics.overview = {
					message:
						"Analytics overview - additional metrics can be added here",
					generatedAt: new Date().toISOString()
				}
				break
			}

			default:
				return NextResponse.json(
					{ error: "Invalid action" },
					{ status: 400 }
				)
		}

		return NextResponse.json({
			success: true,
			data: analytics,
			timestamp: new Date().toISOString()
		})
	} catch (error) {
		console.error("Analytics API error:", error)
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

export async function POST(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Only allow admin users to perform POST operations
		const isAdmin = process.env.OWNER_USER_ID === user.id
		if (!isAdmin) {
			return NextResponse.json(
				{ error: "Admin access required" },
				{ status: 403 }
			)
		}

		const body = (await request.json()) as {
			action?: string
			retentionDays?: number
		}
		const { action } = body

		switch (action) {
			case "cleanup": {
				const retentionDays = body.retentionDays || 90
				const cleanup = await cleanupOldLogs(retentionDays)
				return NextResponse.json({ success: true, cleanup })
			}

			default:
				return NextResponse.json(
					{ error: "Invalid action" },
					{ status: 400 }
				)
		}
	} catch (error) {
		console.error("Analytics POST API error:", error)
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		)
	}
}
