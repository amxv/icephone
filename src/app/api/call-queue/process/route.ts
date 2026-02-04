import { NextRequest, NextResponse } from "next/server"
import { db_ws } from "@/db"
import { callQueue, calls, leads, telephonyCalls } from "@/db/schema"
import { getTelephonyExecutionProvider } from "@/lib/telephony/providers"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

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
			teamId,
			maxUsers = 10,
			batchSize = 5,
			forceProcessing = false
		} = body as {
			userId?: string
			teamId?: string
			maxUsers?: number
			batchSize?: number
			forceProcessing?: boolean
		}

		console.log("🚀 Starting call queue processing", {
			userId,
			teamId,
			maxUsers,
			batchSize,
			forceProcessing
		})

		// Get teams with pending calls to process
		let teamsToProcess: { teamId: string; userId?: string }[] = []

		if (teamId) {
			// Process specific team (optionally scoped to a user)
			teamsToProcess = [{ teamId, userId }]
		} else if (userId) {
			// Find teams with calls ready to process for a specific user
			const teamsWithCalls = await db_ws
				.selectDistinct({ teamId: callQueue.teamId })
				.from(callQueue)
				.where(
					and(
						eq(callQueue.userId, userId),
						eq(callQueue.status, "pending"),
						forceProcessing
							? sql`true`
							: sql`(${callQueue.scheduledTime} IS NULL OR ${callQueue.scheduledTime} <= NOW())`
					)
				)
				.limit(maxUsers)

			teamsToProcess = teamsWithCalls.map((team) => ({
				teamId: team.teamId,
				userId
			}))
		} else {
			// Find teams with calls ready to process
			const teamsWithCalls = await db_ws
				.selectDistinct({ teamId: callQueue.teamId })
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

			teamsToProcess = teamsWithCalls.map((team) => ({
				teamId: team.teamId
			}))
		}

		if (teamsToProcess.length === 0) {
			return NextResponse.json({
				success: true,
				message: "No teams with calls ready to process",
				processed: 0,
				results: []
			})
		}

		console.log(`📞 Processing calls for ${teamsToProcess.length} teams`)

		const results = []
		let totalProcessed = 0
		let totalSuccessful = 0
		let totalFailed = 0

		// Process each team's call queue
		for (const team of teamsToProcess) {
			try {
				// Check if team has calls ready to process
				const readyCalls = await db_ws
					.select({ count: sql<number>`COUNT(*)` })
					.from(callQueue)
					.where(
						and(
							eq(callQueue.teamId, team.teamId),
							team.userId
								? eq(callQueue.userId, team.userId)
								: sql`true`,
							eq(callQueue.status, "pending"),
							forceProcessing
								? sql`true`
								: sql`(${callQueue.scheduledTime} IS NULL OR ${callQueue.scheduledTime} <= NOW())`
						)
					)

				if (readyCalls[0].count === 0 && !forceProcessing) {
					results.push({
						teamId: team.teamId,
						userId: team.userId,
						status: "skipped",
						reason: "No calls ready for processing",
						processed: 0
					})
					continue
				}

				// Process the team's call queue batch
				const result = await processTeamCallQueueDirect(
					team.teamId,
					team.userId,
					batchSize
				)

				if (result.success && result.data) {
					totalProcessed += result.data.processed || 0
					totalSuccessful += result.data.successful || 0
					totalFailed += result.data.failed || 0

					results.push({
						teamId: team.teamId,
						userId: team.userId,
						status: "processed",
						...result.data
					})
				} else {
					results.push({
						teamId: team.teamId,
						userId: team.userId,
						status: "error",
						error: result.error,
						processed: 0
					})
				}
			} catch (error) {
				console.error(`Error processing team ${team.teamId}:`, error)
				results.push({
					teamId: team.teamId,
					userId: team.userId,
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
async function processTeamCallQueueDirect(
	teamId: string,
	userId?: string,
	batchSize: number = 5
) {
	const callExecutionEnabled = process.env.CALL_EXECUTION_ENABLED === "true"
	const executionProvider = getTelephonyExecutionProvider(
		process.env.CALL_EXECUTION_PROVIDER
	)

	if (!callExecutionEnabled) {
		return {
			success: true,
			data: {
				processed: 0,
				results: [],
				successful: 0,
				failed: 0,
				retries: 0,
				message:
					"Call execution is disabled. Set CALL_EXECUTION_ENABLED=true to process queue entries."
			},
			error: null
		}
	}

	const queueEntries = await db_ws
		.select({
			id: callQueue.id,
			leadId: callQueue.leadId,
			campaignId: callQueue.campaignId,
			agentId: callQueue.agentId,
			voiceAgentId: callQueue.voiceAgentId,
			priority: callQueue.priority,
			scheduledTime: callQueue.scheduledTime,
			retryCount: callQueue.retryCount,
			maxRetries: callQueue.maxRetries,
			retryInterval: callQueue.retryInterval,
			instructions: callQueue.instructions,
			phoneNumber: sql<
				string | null
			>`COALESCE(${callQueue.phoneNumber}, ${leads.phone})`,
			userId: callQueue.userId
		})
		.from(callQueue)
		.leftJoin(leads, eq(callQueue.leadId, leads.id))
		.where(
			and(
				eq(callQueue.teamId, teamId),
				userId ? eq(callQueue.userId, userId) : sql`true`,
				eq(callQueue.status, "pending"),
				sql`(${callQueue.scheduledTime} IS NULL OR ${callQueue.scheduledTime} <= NOW())`
			)
		)
		.orderBy(desc(callQueue.priority), callQueue.scheduledTime)
		.limit(batchSize)

	if (!queueEntries.length) {
		return {
			success: true,
			data: {
				processed: 0,
				results: [],
				successful: 0,
				failed: 0,
				retries: 0,
				message: "No queued calls ready for processing."
			},
			error: null
		}
	}

	const now = new Date()
	const queueIds = queueEntries.map((entry) => entry.id)
	await db_ws
		.update(callQueue)
		.set({
			status: "calling",
			startedAt: now,
			updatedAt: now
		})
		.where(inArray(callQueue.id, queueIds))

	const results: Array<{
		queueId: number
		status: "completed" | "retry_scheduled" | "failed"
		callId?: number
		error?: string
	}> = []

	let successful = 0
	let failed = 0
	let retries = 0

	for (const entry of queueEntries) {
		try {
			const execution = await executionProvider.execute({
				teamId,
				queueEntry: entry,
				startedAt: now
			})

			if (execution.status !== "completed") {
				const retryCount = (entry.retryCount || 0) + 1
				const maxRetries = entry.maxRetries ?? 3

				if (
					execution.status === "retryable_failure" &&
					retryCount <= maxRetries
				) {
					const retryAt = new Date(
						Date.now() + (entry.retryInterval ?? 60) * 60_000
					)
					await updateCallQueueStatus(entry.id, "pending", {
						retryCount,
						scheduledTime: retryAt,
						lastError: execution.error
					})
					retries += 1
					results.push({
						queueId: entry.id,
						status: "retry_scheduled",
						error: execution.error
					})
					continue
				}

				await updateCallQueueStatus(entry.id, "failed", {
					retryCount,
					lastError: execution.error,
					completedAt: new Date()
				})
				failed += 1
				results.push({
					queueId: entry.id,
					status: "failed",
					error: execution.error
				})
				continue
			}

			const isTerminalCallStatus =
				execution.callStatus === "completed" ||
				execution.callStatus === "failed" ||
				execution.callStatus === "busy" ||
				execution.callStatus === "no_answer" ||
				execution.callStatus === "canceled"

			const callDuration = Math.max(
				0,
				Math.round(execution.durationSeconds)
			)
			const callStartTime = entry.scheduledTime || now
			const callEndTime = isTerminalCallStatus
				? execution.completedAt ||
					(callDuration > 0
						? new Date(
								callStartTime.getTime() + callDuration * 1000
							)
						: new Date())
				: null
			const callStatus =
				execution.callStatus && execution.callStatus !== "unknown"
					? execution.callStatus
					: "queued"

			const [createdCall] = await db_ws
				.insert(calls)
				.values({
					leadId: entry.leadId,
					teamId,
					agentId: entry.agentId || entry.voiceAgentId,
					campaignId: entry.campaignId,
					direction: "outgoing",
					type: "outgoing",
					duration: callDuration,
					startTime: callStartTime,
					endTime: callEndTime,
					status: callStatus,
					summary: execution.summary || "Call execution dispatched.",
					recordingUrl: execution.recordingUrl || null,
					metadata: {
						queueId: entry.id,
						executionProvider: execution.provider,
						providerCallId: execution.providerCallId || null,
						providerSessionId: execution.providerSessionId || null,
						callStatus,
						...execution.metadata
					},
					createdAt: now,
					updatedAt: callEndTime || now,
					userId: entry.userId
				})
				.returning({ id: calls.id })

			let telephonyCallId: number | undefined
			if (
				execution.providerCallId ||
				execution.providerSessionId ||
				execution.provider !== "mock"
			) {
				const [telephonyCall] = await db_ws
					.insert(telephonyCalls)
					.values({
						teamId,
						callId: createdCall.id,
						queueEntryId: entry.id,
						provider: execution.provider,
						providerCallId: execution.providerCallId || null,
						providerSessionId: execution.providerSessionId || null,
						direction: "outgoing",
						status: callStatus,
						toNumber: entry.phoneNumber || null,
						startedAt: callStartTime,
						endedAt: callEndTime,
						duration: callDuration,
						recordingStatus: execution.recordingUrl
							? "ready"
							: null,
						recordingUrl: execution.recordingUrl || null,
						lastWebhookAt: null,
						metadata: execution.metadata || {},
						createdAt: now,
						updatedAt: callEndTime || now,
						userId: entry.userId
					})
					.returning({ id: telephonyCalls.id })

				telephonyCallId = telephonyCall?.id
			}

			await updateCallQueueStatus(entry.id, "completed", {
				completedAt: callEndTime || new Date(),
				callResult: {
					callId: String(createdCall.id),
					telephonyCallId: telephonyCallId
						? String(telephonyCallId)
						: undefined,
					sessionId: execution.providerSessionId,
					duration: callDuration,
					outcome: execution.outcome || callStatus,
					notes:
						execution.notes ||
						`Processed by ${execution.provider} execution provider`
				}
			})

			successful += 1
			results.push({
				queueId: entry.id,
				status: "completed",
				callId: createdCall.id
			})
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error"
			const retryCount = (entry.retryCount || 0) + 1
			const maxRetries = entry.maxRetries ?? 3

			if (retryCount <= maxRetries) {
				const retryAt = new Date(
					Date.now() + (entry.retryInterval ?? 60) * 60_000
				)
				await updateCallQueueStatus(entry.id, "pending", {
					retryCount,
					scheduledTime: retryAt,
					lastError: errorMessage
				})
				retries += 1
				results.push({
					queueId: entry.id,
					status: "retry_scheduled",
					error: errorMessage
				})
				continue
			}

			await updateCallQueueStatus(entry.id, "failed", {
				retryCount,
				lastError: errorMessage,
				completedAt: new Date()
			})
			failed += 1
			results.push({
				queueId: entry.id,
				status: "failed",
				error: errorMessage
			})
		}
	}

	return {
		success: true,
		data: {
			processed: queueEntries.length,
			results,
			successful,
			failed,
			retries,
			message: `Calls processed with ${executionProvider.name} execution provider.`
		},
		error: null
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
