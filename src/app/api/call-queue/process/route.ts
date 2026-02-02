import { NextRequest, NextResponse } from "next/server"
import { db_ws } from "@/db"
import { callQueue, leads, voiceAgents } from "@/db/schema"
import { eq, and, lte, sql } from "drizzle-orm"

// Simple authentication for background processing
async function authenticateRequest(request: NextRequest): Promise<boolean> {
	const authHeader = request.headers.get("authorization")
	const secret = process.env.CALL_QUEUE_PROCESSOR_SECRET

	if (!secret) {
		console.error("CALL_QUEUE_PROCESSOR_SECRET not configured")
		return false
	}

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		console.error("Missing or invalid authorization header")
		return false
	}

	const token = authHeader.split(" ")[1]
	return token === secret
}

// Main processing endpoint
export async function POST(request: NextRequest) {
	try {
		// Authenticate the request
		const isAuthenticated = await authenticateRequest(request)
		if (!isAuthenticated) {
			return NextResponse.json(
				{ error: "Unauthorized - Invalid or missing authentication" },
				{ status: 401 }
			)
		}

		const body = await request.json()
		const {
			userId,
			maxUsers = 10,
			batchSize = 5,
			forceProcessing = false
		} = body as {
			userId?: string
			maxUsers?: number
			batchSize?: number
			forceProcessing?: boolean
		}

		console.log("🚀 Starting call queue processing", {
			userId,
			maxUsers,
			batchSize,
			forceProcessing
		})

		// Get users with pending calls to process
		let usersToProcess: { userId: string }[] = []

		if (userId) {
			// Process specific user
			usersToProcess = [{ userId }]
		} else {
			// Find users with calls ready to process
			const usersWithCalls = await db_ws
				.selectDistinct({ userId: callQueue.userId })
				.from(callQueue)
				.where(
					and(
						eq(callQueue.status, "pending"),
						forceProcessing
							? sql`true`
							: sql`(${callQueue.scheduledTime} IS NULL OR ${callQueue.scheduledTime} <= NOW())`
					)
				)
				.limit(maxUsers)

			usersToProcess = usersWithCalls
		}

		if (usersToProcess.length === 0) {
			return NextResponse.json({
				success: true,
				message: "No users with calls ready to process",
				processed: 0,
				results: []
			})
		}

		console.log(`📞 Processing calls for ${usersToProcess.length} users`)

		const results = []
		let totalProcessed = 0
		let totalSuccessful = 0
		let totalFailed = 0

		// Process each user's call queue
		for (const user of usersToProcess) {
			try {
				// Check if user has calls ready to process
				const readyCalls = await db_ws
					.select({ count: sql<number>`COUNT(*)` })
					.from(callQueue)
					.where(
						and(
							eq(callQueue.userId, user.userId),
							eq(callQueue.status, "pending"),
							forceProcessing
								? sql`true`
								: sql`(${callQueue.scheduledTime} IS NULL OR ${callQueue.scheduledTime} <= NOW())`
						)
					)

				if (readyCalls[0].count === 0 && !forceProcessing) {
					results.push({
						userId: user.userId,
						status: "skipped",
						reason: "No calls ready for processing",
						processed: 0
					})
					continue
				}

				// Process the user's call queue batch
				const result = await processUserCallQueueDirect(
					user.userId,
					batchSize
				)

				if (result.success && result.data) {
					totalProcessed += result.data.processed || 0
					totalSuccessful += result.data.successful || 0
					totalFailed += result.data.failed || 0

					results.push({
						userId: user.userId,
						status: "processed",
						...result.data
					})
				} else {
					results.push({
						userId: user.userId,
						status: "error",
						error: result.error,
						processed: 0
					})
				}
			} catch (error) {
				console.error(`Error processing user ${user.userId}:`, error)
				results.push({
					userId: user.userId,
					status: "error",
					error:
						error instanceof Error
							? error.message
							: "Unknown error",
					processed: 0
				})
			}
		}

		console.log("✅ Call queue processing complete", {
			totalProcessed,
			totalSuccessful,
			totalFailed
		})

		return NextResponse.json({
			success: true,
			processed: totalProcessed,
			successful: totalSuccessful,
			failed: totalFailed,
			results
		})
	} catch (error) {
		console.error("Error in call queue processing:", error)
		return NextResponse.json(
			{
				error: "Internal server error",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			{ status: 500 }
		)
	}
}

// Health check endpoint
export async function GET(request: NextRequest) {
	try {
		const isAuthenticated = await authenticateRequest(request)
		if (!isAuthenticated) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get queue statistics
		const stats = await db_ws
			.select({
				status: callQueue.status,
				count: sql<number>`COUNT(*)`
			})
			.from(callQueue)
			.groupBy(callQueue.status)

		const queueStats: Record<string, number> = {}
		for (const stat of stats) {
			if (stat.status) {
				queueStats[stat.status] = stat.count
			}
		}

		return NextResponse.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			queueStats
		})
	} catch (error) {
		console.error("Error in health check:", error)
		return NextResponse.json(
			{
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error"
			},
			{ status: 500 }
		)
	}
}

// Direct queue processing function that doesn't require auth context
async function processUserCallQueueDirect(
	userId: string,
	batchSize: number = 5
) {
	try {
		// Get next batch of calls ready to process
		const queueEntries = await db_ws
			.select({
				id: callQueue.id,
				leadId: callQueue.leadId,
				voiceAgentId: callQueue.voiceAgentId,
				priority: callQueue.priority,
				scheduledTime: callQueue.scheduledTime,
				instructions: callQueue.instructions,
				phoneNumber: callQueue.phoneNumber,
				retryCount: callQueue.retryCount,
				maxRetries: callQueue.maxRetries,
				lead: {
					id: leads.id,
					name: leads.name,
					phone: leads.phone
				}
			})
			.from(callQueue)
			.leftJoin(leads, eq(callQueue.leadId, leads.id))
			.where(
				and(
					eq(callQueue.userId, userId),
					eq(callQueue.status, "pending"),
					sql`(${callQueue.scheduledTime} IS NULL OR ${callQueue.scheduledTime} <= NOW())`
				)
			)
			.orderBy(
				sql`${callQueue.priority} DESC NULLS LAST`,
				sql`${callQueue.scheduledTime} ASC NULLS FIRST`,
				callQueue.createdAt
			)
			.limit(batchSize)

		if (queueEntries.length === 0) {
			return {
				success: true,
				data: { processed: 0, message: "No calls ready to process" },
				error: null
			}
		}

		console.log(
			`📞 Processing ${queueEntries.length} calls for user ${userId}`
		)

		const results = []

		// Process each queue entry
		for (const entry of queueEntries) {
			if (!entry.lead || !entry.lead.phone) {
				// Mark as failed - no phone number
				await updateCallQueueStatus(entry.id, "failed", {
					lastError: "No phone number available",
					completedAt: new Date()
				})
				results.push({
					queueId: entry.id,
					status: "failed",
					reason: "No phone number"
				})
				continue
			}

			try {
				// Mark as calling (processing)
				await updateCallQueueStatus(entry.id, "calling", {
					startedAt: new Date()
				})

				// Get voice agent details - required for calls
				if (!entry.voiceAgentId) {
					throw new Error("No voice agent specified for call")
				}

				const voiceAgent = await db_ws
					.select({
						id: voiceAgents.id,
						phoneNumberId: voiceAgents.phoneNumberId,
						status: voiceAgents.status
					})
					.from(voiceAgents)
					.where(
						and(
							eq(voiceAgents.id, entry.voiceAgentId),
							eq(voiceAgents.userId, userId)
						)
					)
					.limit(1)

				if (!voiceAgent.length || voiceAgent[0].status !== "active") {
					throw new Error("Voice agent not found or inactive")
				}

				const phoneNumberId = voiceAgent[0].phoneNumberId
				if (!phoneNumberId) {
					throw new Error("Voice agent has no phone number assigned")
				}

				// Import and use the voice agent system (background processor version)
				const { initiateOutboundCallForBackgroundProcessor } =
					await import("@/actions/voice-agents")

				// Determine phone number to use
				const callPhoneNumber = entry.phoneNumber || entry.lead.phone

				// Initiate the outbound call
				const callResult =
					await initiateOutboundCallForBackgroundProcessor(userId, {
						fromPhoneNumberId: phoneNumberId,
						toPhoneNumber: callPhoneNumber,
						agentId: entry.voiceAgentId,
						leadId: entry.leadId,
						metadata: {
							queueId: entry.id,
							instructions: entry.instructions,
							leadCommunicationContext: true
						}
					})

				if (callResult.success && callResult.data) {
					// Call initiated successfully
					const sessionId =
						"session" in callResult.data
							? callResult.data.session?.id
							: callResult.data.id

					await updateCallQueueStatus(entry.id, "completed", {
						completedAt: new Date(),
						callResult: {
							sessionId,
							status: "initiated",
							outcome: "call_started"
						}
					})

					results.push({
						queueId: entry.id,
						status: "success",
						sessionId
					})
				} else {
					// Call failed to initiate
					const retryCount = entry.retryCount ?? 0
					const maxRetries = entry.maxRetries ?? 3
					const shouldRetry = retryCount < maxRetries

					if (shouldRetry) {
						// Schedule retry with exponential backoff
						const retryTime = new Date()
						retryTime.setMinutes(
							retryTime.getMinutes() + (retryCount + 1) * 30
						)

						await updateCallQueueStatus(entry.id, "pending", {
							retryCount: retryCount + 1,
							scheduledTime: retryTime,
							lastError:
								callResult.error || "Call initiation failed"
						})

						results.push({
							queueId: entry.id,
							status: "retry_scheduled",
							retryTime,
							error: callResult.error
						})
					} else {
						// Max retries exceeded
						await updateCallQueueStatus(entry.id, "failed", {
							completedAt: new Date(),
							lastError:
								callResult.error || "Max retries exceeded"
						})

						results.push({
							queueId: entry.id,
							status: "failed",
							reason: callResult.error || "Max retries exceeded"
						})
					}
				}
			} catch (error) {
				console.error(
					`Error processing queue entry ${entry.id}:`,
					error
				)

				// Mark as failed
				await updateCallQueueStatus(entry.id, "failed", {
					completedAt: new Date(),
					lastError:
						error instanceof Error ? error.message : "Unknown error"
				})

				results.push({
					queueId: entry.id,
					status: "failed",
					reason:
						error instanceof Error ? error.message : "Unknown error"
				})
			}
		}

		return {
			success: true,
			data: {
				processed: results.length,
				results,
				successful: results.filter((r) => r.status === "success")
					.length,
				failed: results.filter((r) => r.status === "failed").length,
				retries: results.filter((r) => r.status === "retry_scheduled")
					.length
			},
			error: null
		}
	} catch (error) {
		console.error("Error processing user call queue:", error)
		return {
			success: false,
			error: "Failed to process call queue",
			data: null
		}
	}
}

// Helper function to update call queue entry status
async function updateCallQueueStatus(
	queueId: number,
	status:
		| "pending"
		| "queued"
		| "calling"
		| "completed"
		| "failed"
		| "cancelled",
	updates: {
		startedAt?: Date
		completedAt?: Date
		retryCount?: number
		scheduledTime?: Date
		lastError?: string
		callResult?: Record<string, unknown>
	} = {}
) {
	const updateData: Partial<typeof callQueue.$inferInsert> = {
		status,
		updatedAt: new Date(),
		...updates
	}

	return await db_ws
		.update(callQueue)
		.set(updateData)
		.where(eq(callQueue.id, queueId))
		.returning()
}
