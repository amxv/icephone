import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { and, eq, lte, sql } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, campaignQueue } from "@/db/schema"
import {
	processNextQueueBatchDirect,
	processScheduledCampaigns
} from "@/actions/campaigns/execution"

// Type for the request body
interface ProcessCampaignRequest {
	userId?: string
	campaignId?: number
	maxCampaigns?: number
	batchSize?: number
	forceProcessing?: boolean
	processScheduled?: boolean
}

// This endpoint handles automated campaign queue processing
// Can be called by external cron services like GitHub Actions, Vercel Cron, or other schedulers
export async function POST(request: NextRequest) {
	try {
		// Validate the request is authorized (basic security)
		const authHeader = (await headers()).get("authorization")
		const providedSecret = authHeader?.replace("Bearer ", "")
		const expectedSecret = process.env.CAMPAIGN_PROCESSOR_SECRET

		if (!expectedSecret || providedSecret !== expectedSecret) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const body = (await request.json()) as ProcessCampaignRequest
		const {
			userId,
			campaignId,
			maxCampaigns = 10,
			batchSize = 5,
			forceProcessing = false,
			processScheduled = true
		} = body

		console.log("🚀 Campaign processor triggered", {
			userId,
			campaignId,
			maxCampaigns,
			batchSize,
			processScheduled
		})

		// First, process any scheduled campaigns that should start
		if (processScheduled) {
			console.log("📅 Processing scheduled campaigns...")
			try {
				const scheduledResult = await processScheduledCampaigns()
				if (scheduledResult.success && scheduledResult.data) {
					console.log(
						`✅ Processed ${scheduledResult.data.processedCampaigns} scheduled campaigns`
					)
				}
			} catch (error) {
				console.error("Error processing scheduled campaigns:", error)
			}
		}

		let campaignsToProcess: Array<{
			id: number
			userId: string
			teamId: string
		}> = []

		if (campaignId && userId) {
			// Process specific campaign for specific user
			const campaign = await db_ws
				.select({
					id: campaigns.id,
					userId: campaigns.userId,
					teamId: campaigns.teamId
				})
				.from(campaigns)
				.where(
					and(
						eq(campaigns.id, campaignId),
						userId ? eq(campaigns.userId, userId) : sql`true`,
						eq(campaigns.status, "running")
					)
				)
				.limit(1)

			if (campaign.length > 0) {
				campaignsToProcess = campaign
			}
		} else if (userId) {
			// Process all running campaigns for a specific user
			const userCampaigns = await db_ws
				.select({
					id: campaigns.id,
					userId: campaigns.userId,
					teamId: campaigns.teamId
				})
				.from(campaigns)
				.where(
					and(
						eq(campaigns.userId, userId),
						eq(campaigns.status, "running")
					)
				)
				.limit(maxCampaigns)

			campaignsToProcess = userCampaigns
		} else {
			// Process all running campaigns across all users (system-wide processing)
			const runningCampaigns = await db_ws
				.select({
					id: campaigns.id,
					userId: campaigns.userId,
					teamId: campaigns.teamId
				})
				.from(campaigns)
				.where(eq(campaigns.status, "running"))
				.limit(maxCampaigns)

			campaignsToProcess = runningCampaigns
		}

		if (campaignsToProcess.length === 0) {
			return NextResponse.json({
				success: true,
				message: "No running campaigns found to process",
				processedCampaigns: 0,
				results: []
			})
		}

		const results = []
		let totalProcessed = 0
		let totalSuccessful = 0
		let totalFailed = 0

		// Process each campaign
		for (const campaign of campaignsToProcess) {
			try {
				// Check if campaign has queued calls ready to process
				const readyCalls = await db_ws
					.select({ count: sql<number>`COUNT(*)` })
					.from(campaignQueue)
					.where(
						and(
							eq(campaignQueue.campaignId, campaign.id),
							eq(campaignQueue.status, "queued"),
							forceProcessing
								? sql`true`
								: lte(campaignQueue.scheduledTime, new Date())
						)
					)

				if (readyCalls[0].count === 0 && !forceProcessing) {
					results.push({
						campaignId: campaign.id,
						userId: campaign.userId,
						status: "skipped",
						reason: "No calls ready for processing",
						processed: 0
					})
					continue
				}

				// Process the campaign queue batch
				// Note: We need to temporarily set the auth context for the campaign owner
				// Since this is a background service, we'll process as the campaign owner

				// For now, we'll use a direct approach that doesn't require auth context
				const result = await processQueueBatchDirect(
					campaign.id,
					campaign.teamId,
					campaign.userId,
					batchSize
				)

				if (result.success && result.data) {
					totalProcessed += result.data.processed || 0
					totalSuccessful += result.data.successful || 0
					totalFailed += result.data.failed || 0

					results.push({
						campaignId: campaign.id,
						userId: campaign.userId,
						status: "processed",
						...result.data
					})
				} else {
					results.push({
						campaignId: campaign.id,
						userId: campaign.userId,
						status: "error",
						error: result.error,
						processed: 0
					})
				}
			} catch (error) {
				console.error(
					`Error processing campaign ${campaign.id}:`,
					error
				)
				results.push({
					campaignId: campaign.id,
					userId: campaign.userId,
					status: "error",
					error:
						error instanceof Error
							? error.message
							: "Unknown error",
					processed: 0
				})
			}
		}

		console.log("✅ Campaign processing completed", {
			totalCampaigns: campaignsToProcess.length,
			totalProcessed,
			totalSuccessful,
			totalFailed
		})

		return NextResponse.json({
			success: true,
			processedCampaigns: campaignsToProcess.length,
			totalCallsProcessed: totalProcessed,
			totalSuccessful,
			totalFailed,
			results
		})
	} catch (error) {
		console.error("Campaign processor error:", error)
		return NextResponse.json(
			{
				error: "Campaign processing failed",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			{ status: 500 }
		)
	}
}

// Direct queue processing function that doesn't require auth context
async function processQueueBatchDirect(
	campaignId: number,
	teamId: string,
	userId: string,
	batchSize: number = 5
) {
	try {
		// Get campaign details
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId,
				campaignSettings: campaigns.campaignSettings
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found",
				data: null
			}
		}

		const campaignData = campaign[0]

		// Only process if campaign is running
		if (campaignData.status !== "running") {
			return {
				success: false,
				error: "Campaign is not running",
				data: null
			}
		}

		// Get next batch of queued calls
		const queueEntries = await db_ws
			.select({
				id: campaignQueue.id,
				campaignLeadId: campaignQueue.campaignLeadId,
				priority: campaignQueue.priority,
				scheduledTime: campaignQueue.scheduledTime,
				retryCount: campaignQueue.retryCount,
				maxRetries: campaignQueue.maxRetries
			})
			.from(campaignQueue)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.userId, userId),
					eq(campaignQueue.status, "queued"),
					lte(campaignQueue.scheduledTime, new Date())
				)
			)
			.orderBy(
				sql`${campaignQueue.priority} DESC`,
				campaignQueue.scheduledTime
			)
			.limit(batchSize)

		if (queueEntries.length === 0) {
			return {
				success: true,
				data: { processed: 0, message: "No calls ready to process" },
				error: null
			}
		}

		// Process calls using the existing campaign execution system
		console.log(
			`📞 Processing ${queueEntries.length} calls for campaign ${campaignId}`
		)

		// Import the existing queue processing function
		const { processNextQueueBatch } = await import(
			"@/actions/campaigns/execution"
		)

		// Process the queue batch using existing infrastructure
		const result = await processNextQueueBatchDirect(
			campaignId,
			teamId,
			userId,
			batchSize
		)

		if (result.success && result.data) {
			return {
				success: true,
				data: {
					processed: result.data.processed || 0,
					successful: result.data.successful || 0,
					failed: result.data.failed || 0,
					message: `Successfully processed ${result.data.processed} calls`,
					details: result.data.results
				},
				error: null
			}
		}

		return {
			success: false,
			error: result.error || "Failed to process queue batch",
			data: null
		}
	} catch (error) {
		console.error("Error in direct queue processing:", error)
		return {
			success: false,
			error: "Failed to process queue batch",
			data: null
		}
	}
}

// GET endpoint for health check
export async function GET() {
	return NextResponse.json({
		status: "Campaign processor is running",
		timestamp: new Date().toISOString()
	})
}
