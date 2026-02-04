"use server"

import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { addMinutes, endOfDay, startOfDay } from "date-fns"
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm"

import { db_ws } from "@/db"
import {
	campaigns,
	campaignLeads,
	campaignQueue,
	campaignRuns,
	callQueue,
	leads,
	teamPhoneNumbers,
	voiceAgents
} from "@/db/schema"

function isWithinBusinessHours(
	campaignSettings: Record<string, unknown> | null | undefined,
	now: Date = new Date()
) {
	const callTiming = (campaignSettings as { callTiming?: unknown } | null)
		?.callTiming as
		| {
				businessHours?: {
					enabled?: boolean
					timezone?: string
					schedule?: Record<
						string,
						{
							start?: string
							end?: string
						} | null
					>
				}
		  }
		| undefined

	const businessHours = callTiming?.businessHours
	if (!businessHours?.enabled) return true

	try {
		const schedule = businessHours.schedule || {}
		const timezone = businessHours.timezone || "UTC"

		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			weekday: "long",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false
		})

		const parts = formatter.formatToParts(now)
		const weekday = parts
			.find((part) => part.type === "weekday")
			?.value.toLowerCase()
		const hour = Number(
			parts.find((part) => part.type === "hour")?.value ?? "0"
		)
		const minute = Number(
			parts.find((part) => part.type === "minute")?.value ?? "0"
		)

		if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) {
			return true
		}

		const daySchedule = schedule[weekday]
		if (!daySchedule?.start || !daySchedule?.end) {
			return false
		}

		const [startHour, startMinute] = daySchedule.start
			.split(":")
			.map((value) => Number(value))
		const [endHour, endMinute] = daySchedule.end
			.split(":")
			.map((value) => Number(value))

		if (
			Number.isNaN(startHour) ||
			Number.isNaN(startMinute) ||
			Number.isNaN(endHour) ||
			Number.isNaN(endMinute)
		) {
			return false
		}

		const nowMinutes = hour * 60 + minute
		const startMinutes = startHour * 60 + startMinute
		const endMinutes = endHour * 60 + endMinute

		return nowMinutes >= startMinutes && nowMinutes <= endMinutes
	} catch (error) {
		console.warn("Failed to evaluate business hours:", error)
		return true
	}
}

function getCampaignOutboundPhoneNumberId(
	campaignSettings: Record<string, unknown> | null | undefined
) {
	const voiceConfiguration = (
		campaignSettings as
			| {
					voiceConfiguration?: {
						outboundPhoneNumberId?: unknown
					}
			  }
			| null
	)?.voiceConfiguration
	const outboundPhoneNumberId = voiceConfiguration?.outboundPhoneNumberId
	return typeof outboundPhoneNumberId === "number" &&
		Number.isInteger(outboundPhoneNumberId) &&
		outboundPhoneNumberId > 0
		? outboundPhoneNumberId
		: null
}

async function requeueFailedCampaignEntries(
	campaignId: number,
	teamId: string,
	now: Date
) {
	const retryableEntries = await db_ws
		.select({
			id: campaignQueue.id,
			retryCount: campaignQueue.retryCount,
			retryInterval: campaignQueue.retryInterval,
			maxRetries: campaignQueue.maxRetries
		})
		.from(campaignQueue)
		.innerJoin(
			campaignLeads,
			eq(campaignQueue.campaignLeadId, campaignLeads.id)
		)
		.where(
			and(
				eq(campaignQueue.campaignId, campaignId),
				eq(campaignQueue.status, "failed"),
				eq(campaignLeads.teamId, teamId),
				sql`${campaignQueue.retryCount} < ${campaignQueue.maxRetries}`
			)
		)

	for (const entry of retryableEntries) {
		const nextTime = addMinutes(now, entry.retryInterval ?? 60)
		await db_ws
			.update(campaignQueue)
			.set({
				status: "queued",
				retryCount: (entry.retryCount ?? 0) + 1,
				scheduledTime: nextTime,
				lastError: null,
				updatedAt: now
			})
			.where(eq(campaignQueue.id, entry.id))
	}
}

async function getExecutionContext() {
	const { teamId, user } = await requireTeam()
	return { teamId, userId: user.id }
}

async function ensureCampaignRun(campaignId: number) {
	const [existing] = await db_ws
		.select({ id: campaignRuns.id })
		.from(campaignRuns)
		.where(
			and(
				eq(campaignRuns.campaignId, campaignId),
				eq(campaignRuns.status, "running")
			)
		)
		.limit(1)

	if (existing) return existing

	const [created] = await db_ws
		.insert(campaignRuns)
		.values({
			campaignId,
			status: "running",
			startedAt: new Date()
		})
		.returning({ id: campaignRuns.id })

	return created
}

async function updateCampaignRunStatus(
	campaignId: number,
	status: string,
	updates: { endedAt?: Date } = {}
) {
	await db_ws
		.update(campaignRuns)
		.set({
			status,
			endedAt: updates.endedAt,
			stats: sql`COALESCE(${campaignRuns.stats}, '{}')`
		})
		.where(
			and(
				eq(campaignRuns.campaignId, campaignId),
				eq(campaignRuns.status, "running")
			)
		)
}

// Start campaign execution
export async function startCampaign(campaignId: number) {
	try {
		const { teamId } = await getExecutionContext()

		// Validate campaign ownership and check it can be started
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId,
				campaignSettings: campaigns.campaignSettings
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		const campaignData = campaign[0]

		// Check if campaign can be started
		if (campaignData.status === "running") {
			return {
				success: false,
				error: "Campaign is already running",
				data: null
			}
		}

		if (campaignData.status === "completed") {
			return {
				success: false,
				error: "Campaign is already completed",
				data: null
			}
		}

		// Validate voice agent is assigned and active
		if (!campaignData.voiceAgentId) {
			return {
				success: false,
				error: "Campaign must have a voice agent assigned",
				data: null
			}
		}

		const voiceAgent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, campaignData.voiceAgentId),
					teamScope(voiceAgents, teamId)
				)
			)
			.limit(1)

		if (!voiceAgent || voiceAgent.length === 0) {
			return {
				success: false,
				error: "Voice agent not found",
				data: null
			}
		}

		if (voiceAgent[0].status !== "active") {
			return {
				success: false,
				error: `Voice agent "${voiceAgent[0].name}" is not active`,
				data: null
			}
		}

		// Check if there are leads in the queue
		const queueCount = await db_ws
			.select({ count: sql<number>`COUNT(*)` })
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.status, "queued"),
					eq(campaignLeads.teamId, teamId)
				)
			)

		if (queueCount[0].count === 0) {
			return {
				success: false,
				error: "No leads in queue to call. Please add leads to the campaign first.",
				data: null
			}
		}

		// Update campaign status to running
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "running",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		await ensureCampaignRun(campaignId)

		// Process the first batch of calls
		await processNextQueueBatch(campaignId)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error starting campaign:", error)
		return {
			success: false,
			error: "Failed to start campaign",
			data: null
		}
	}
}

// Pause campaign execution
export async function pauseCampaign(campaignId: number) {
	try {
		const { teamId } = await getExecutionContext()

		const campaign = await db_ws
			.select({
				id: campaigns.id,
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
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		if (campaign[0].status !== "running") {
			return {
				success: false,
				error: "Campaign is not currently running",
				data: null
			}
		}

		// Update campaign status to paused
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "paused",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		// Pause any queued calls
		await db_ws
			.update(campaignQueue)
			.set({
				status: "paused",
				updatedAt: new Date()
			})
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.status, "queued")
				)
			)

		await updateCampaignRunStatus(campaignId, "paused")

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error pausing campaign:", error)
		return {
			success: false,
			error: "Failed to pause campaign",
			data: null
		}
	}
}

// Resume campaign execution
export async function resumeCampaign(campaignId: number) {
	try {
		const { teamId } = await getExecutionContext()

		const campaign = await db_ws
			.select({
				id: campaigns.id,
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
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		if (campaign[0].status !== "paused") {
			return {
				success: false,
				error: "Campaign is not currently paused",
				data: null
			}
		}

		// Update campaign status to running
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "running",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		// Resume paused calls in queue
		await db_ws
			.update(campaignQueue)
			.set({
				status: "queued",
				updatedAt: new Date()
			})
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.status, "paused")
				)
			)

		await updateCampaignRunStatus(campaignId, "running")

		// Process the next batch of calls
		await processNextQueueBatch(campaignId)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error resuming campaign:", error)
		return {
			success: false,
			error: "Failed to resume campaign",
			data: null
		}
	}
}

// Stop campaign execution
export async function stopCampaign(campaignId: number) {
	try {
		const { teamId } = await getExecutionContext()

		const campaign = await db_ws
			.select({
				id: campaigns.id,
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
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		if (
			campaign[0].status === "completed" ||
			campaign[0].status === "cancelled"
		) {
			return {
				success: false,
				error: "Campaign is already stopped",
				data: null
			}
		}

		// Update campaign status to completed
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "completed",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		// Mark all remaining queued calls as completed
		await db_ws
			.update(campaignQueue)
			.set({
				status: "completed",
				completedAt: new Date(),
				updatedAt: new Date()
			})
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					sql`${campaignQueue.status} IN ('queued', 'paused')`
				)
			)

		await updateCampaignRunStatus(campaignId, "completed", {
			endedAt: new Date()
		})

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error stopping campaign:", error)
		return {
			success: false,
			error: "Failed to stop campaign",
			data: null
		}
	}
}

// Process next batch of calls in queue
export async function processNextQueueBatch(
	campaignId: number,
	batchSize: number = 5
) {
	try {
		const { teamId, userId } = await getExecutionContext()
		return await processNextQueueBatchDirect(
			campaignId,
			teamId,
			userId,
			batchSize
		)
	} catch (error) {
		console.error("Error processing queue batch:", error)
		return {
			success: false,
			error: "Failed to process queue batch",
			data: null
		}
	}
}

export async function processNextQueueBatchDirect(
	campaignId: number,
	teamId: string,
	userId: string,
	batchSize: number = 5
) {
	try {
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId,
				campaignSettings: campaigns.campaignSettings
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.teamId, teamId))
			)
			.limit(1)

		if (!campaign.length) {
			return { success: false, error: "Campaign not found", data: null }
		}

		const campaignData = campaign[0]
		if (campaignData.status !== "running") {
			return {
				success: false,
				error: "Campaign is not running",
				data: null
			}
		}

		const now = new Date()

		await requeueFailedCampaignEntries(campaignId, teamId, now)

		if (
			!isWithinBusinessHours(
				campaignData.campaignSettings as Record<string, unknown>,
				now
			)
		) {
			return {
				success: true,
				data: {
					processed: 0,
					results: [],
					successful: 0,
					failed: 0,
					retries: 0,
					message: "Outside configured business hours"
				},
				error: null
			}
		}

		let effectiveBatchSize = batchSize
		const callTiming = (
			campaignData.campaignSettings as { callTiming?: unknown } | null
		)?.callTiming as
			| {
					maxCallsPerDay?: number
			  }
			| undefined

		if (callTiming?.maxCallsPerDay) {
			const [dailyCalls] = await db_ws
				.select({ count: sql<number>`COUNT(*)` })
				.from(callQueue)
				.where(
					and(
						eq(callQueue.campaignId, campaignId),
						eq(callQueue.teamId, teamId),
						gte(callQueue.createdAt, startOfDay(now)),
						lte(callQueue.createdAt, endOfDay(now))
					)
				)

			const remaining = Math.max(
				0,
				callTiming.maxCallsPerDay - (dailyCalls?.count ?? 0)
			)

			if (remaining === 0) {
				return {
					success: true,
					data: {
						processed: 0,
						results: [],
						successful: 0,
						failed: 0,
						retries: 0,
						message: "Daily call limit reached"
					},
					error: null
				}
			}

			effectiveBatchSize = Math.min(batchSize, remaining)
		}

		if (!campaignData.voiceAgentId) {
			return {
				success: false,
				error: "Campaign does not have a voice agent assigned",
				data: null
			}
		}

		const voiceAgent = await db_ws
			.select({
				id: voiceAgents.id,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, campaignData.voiceAgentId),
					eq(voiceAgents.teamId, teamId)
				)
			)
			.limit(1)

		if (!voiceAgent.length) {
			return {
				success: false,
				error: "Voice agent not found",
				data: null
			}
		}

		if (voiceAgent[0].status !== "active") {
			return {
				success: false,
				error: "Voice agent is not active",
				data: null
			}
		}

		const configuredOutboundPhoneNumberId = getCampaignOutboundPhoneNumberId(
			campaignData.campaignSettings as Record<string, unknown> | null
		)
		let configuredOutboundPhoneNumber: {
			id: number
			phoneNumber: string
			provider: "mock" | "twilio" | "telnyx" | "vonage"
		} | null = null

		if (configuredOutboundPhoneNumberId) {
			const selectedOutboundNumbers = await db_ws
				.select({
					id: teamPhoneNumbers.id,
					phoneNumber: teamPhoneNumbers.phoneNumber,
					provider: teamPhoneNumbers.provider
				})
				.from(teamPhoneNumbers)
				.where(
					and(
						eq(teamPhoneNumbers.id, configuredOutboundPhoneNumberId),
						eq(teamPhoneNumbers.teamId, teamId),
						eq(teamPhoneNumbers.status, "active")
					)
				)
				.limit(1)

			configuredOutboundPhoneNumber = selectedOutboundNumbers[0] || null
		}

		const queueEntries = await db_ws
			.select({
				queueId: campaignQueue.id,
				campaignLeadId: campaignQueue.campaignLeadId,
				leadId: campaignLeads.leadId,
				priority: campaignQueue.priority,
				scheduledTime: campaignQueue.scheduledTime
			})
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.status, "queued"),
					lte(campaignQueue.scheduledTime, new Date()),
					eq(campaignLeads.teamId, teamId)
				)
			)
			.orderBy(
				sql`${campaignQueue.priority} DESC`,
				campaignQueue.scheduledTime
			)
			.limit(effectiveBatchSize)

		if (!queueEntries.length) {
			return {
				success: true,
				data: {
					processed: 0,
					results: [],
					successful: 0,
					failed: 0,
					retries: 0,
					message: "No calls ready to process"
				},
				error: null
			}
		}

		const queueIds = queueEntries.map((entry) => entry.queueId)
		const campaignLeadIds = queueEntries.map(
			(entry) => entry.campaignLeadId
		)
		const results: Array<{ queueId: number; callQueueId?: number }> = []

		await db_ws.transaction(async (tx) => {
			await tx
				.update(campaignQueue)
				.set({
					status: "processing",
					startedAt: now,
					updatedAt: now
				})
				.where(inArray(campaignQueue.id, queueIds))

			const queuedCalls = await tx
				.insert(callQueue)
				.values(
					queueEntries.map((entry) => ({
						leadId: entry.leadId,
						teamId,
						campaignId,
						voiceAgentId: campaignData.voiceAgentId,
						priority: entry.priority ?? 0,
						scheduledTime: entry.scheduledTime,
						status: "pending" as const,
						metadata: configuredOutboundPhoneNumber
							? {
									callConfiguration: {
										outboundPhoneNumberId:
											configuredOutboundPhoneNumber.id,
										outboundPhoneNumber:
											configuredOutboundPhoneNumber.phoneNumber,
										outboundProvider:
											configuredOutboundPhoneNumber.provider
									}
								}
							: {},
						userId
					}))
				)
				.returning({ id: callQueue.id })

			const callIdMap = queueEntries.map((entry, index) => ({
				queueId: entry.queueId,
				callQueueId: queuedCalls[index]?.id
			}))

			const callResultCase = sql`case ${campaignQueue.id} ${sql.join(
				callIdMap.map((row) => {
					if (!row.callQueueId) {
						return sql`when ${row.queueId} then ${campaignQueue.callResult}`
					}
					return sql`when ${row.queueId} then ${sql`jsonb_build_object('callId', ${String(
						row.callQueueId
					)})`}`
				}),
				sql` `
			)} else ${campaignQueue.callResult} end`

			await tx
				.update(campaignQueue)
				.set({
					status: "completed",
					completedAt: now,
					updatedAt: now,
					callResult: callResultCase
				})
				.where(inArray(campaignQueue.id, queueIds))

			await tx
				.update(campaignLeads)
				.set({
					status: "attempted",
					lastAttemptAt: now,
					attemptCount: sql`${campaignLeads.attemptCount} + 1`,
					updatedAt: now
				})
				.where(inArray(campaignLeads.id, campaignLeadIds))

			results.push(
				...callIdMap.map((row) => ({
					queueId: row.queueId,
					callQueueId: row.callQueueId
				}))
			)
		})

		return {
			success: true,
			data: {
				processed: results.length,
				results,
				successful: results.length,
				failed: 0,
				retries: 0,
				message: "Queued calls for processing"
			},
			error: null
		}
	} catch (error) {
		console.error("Error processing queue batch:", error)
		return {
			success: false,
			error: "Failed to process queue batch",
			data: null
		}
	}
}

// Helper function to update queue entry status
async function updateQueueEntryStatus(
	queueId: number,
	status: "queued" | "processing" | "paused" | "completed" | "failed",
	updates: {
		startedAt?: Date
		completedAt?: Date
		retryCount?: number
		scheduledTime?: Date
		lastError?: string
		callResult?: Record<string, unknown>
	} = {}
) {
	const updateData: Partial<typeof campaignQueue.$inferInsert> = {
		status,
		updatedAt: new Date(),
		...updates
	}

	return await db_ws
		.update(campaignQueue)
		.set(updateData)
		.where(eq(campaignQueue.id, queueId))
		.returning()
}

// Get campaign execution status
export async function getCampaignExecutionStatus(campaignId: number) {
	try {
		const { teamId } = await getExecutionContext()

		// Get campaign basic info
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate
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

		// Get queue statistics
		const queueStats = await db_ws
			.select({
				status: campaignQueue.status,
				count: sql<number>`COUNT(*)`.as("count")
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

		// Get lead and assignment statistics
		const [leadStats, assignmentStats] = await Promise.all([
			db_ws
				.select({
					status: leads.status,
					count: sql<number>`COUNT(*)`.as("count")
				})
				.from(campaignLeads)
				.leftJoin(leads, eq(campaignLeads.leadId, leads.id))
				.where(
					and(
						eq(campaignLeads.campaignId, campaignId),
						eq(campaignLeads.teamId, teamId)
					)
				)
				.groupBy(leads.status),
			db_ws
				.select({
					status: campaignLeads.status,
					count: sql<number>`COUNT(*)`.as("count")
				})
				.from(campaignLeads)
				.where(
					and(
						eq(campaignLeads.campaignId, campaignId),
						eq(campaignLeads.teamId, teamId)
					)
				)
				.groupBy(campaignLeads.status)
		])

		// Convert stats to objects for easier access
		const queueStatsObj = queueStats.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = stat.count
				}
				return acc
			},
			{} as Record<string, number>
		)

		const leadStatsObj = leadStats.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = stat.count
				}
				return acc
			},
			{} as Record<string, number>
		)

		const assignmentStatsObj = assignmentStats.reduce(
			(acc, stat) => {
				if (stat.status) {
					acc[stat.status] = stat.count
				}
				return acc
			},
			{} as Record<string, number>
		)

		// Calculate totals and progress
		const totalLeads = Object.values(assignmentStatsObj).reduce(
			(sum, count) => sum + count,
			0
		)
		const totalCalls = Object.values(queueStatsObj).reduce(
			(sum, count) => sum + count,
			0
		)
		const completedCalls =
			(queueStatsObj.completed || 0) + (queueStatsObj.failed || 0)
		const progress =
			totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0

		return {
			success: true,
			data: {
				campaign: campaign[0],
				queue: {
					total: totalCalls,
					queued: queueStatsObj.queued || 0,
					processing: queueStatsObj.processing || 0,
					paused: queueStatsObj.paused || 0,
					completed: queueStatsObj.completed || 0,
					failed: queueStatsObj.failed || 0
				},
				leads: {
					total: totalLeads,
					pending: assignmentStatsObj.pending || 0,
					attempted: assignmentStatsObj.attempted || 0,
					completed: assignmentStatsObj.completed || 0,
					failed: assignmentStatsObj.failed || 0,
					excluded: assignmentStatsObj.excluded || 0,
					new: leadStatsObj.new || 0,
					contacted: leadStatsObj.contacted || 0,
					qualified: leadStatsObj.qualified || 0,
					converted: leadStatsObj.converted || 0,
					lost: leadStatsObj.lost || 0
				},
				progress: Math.round(progress * 100) / 100
			},
			error: null
		}
	} catch (error) {
		console.error("Error getting campaign execution status:", error)
		return {
			success: false,
			error: "Failed to get campaign execution status",
			data: null
		}
	}
}

// Trigger next batch processing (can be called manually or via cron/webhook)
export async function triggerCampaignProcessing(campaignId?: number) {
	try {
		const { teamId } = await getExecutionContext()

		let campaignsToProcess: number[] = []

		if (campaignId) {
			// Process specific campaign
			campaignsToProcess = [campaignId]
		} else {
			// Find all running campaigns for this user
			const runningCampaigns = await db_ws
				.select({ id: campaigns.id })
				.from(campaigns)
				.where(
					and(
						eq(campaigns.teamId, teamId),
						eq(campaigns.status, "running")
					)
				)

			campaignsToProcess = runningCampaigns.map((c) => c.id)
		}

		const results = []

		for (const id of campaignsToProcess) {
			const result = await processNextQueueBatch(id)
			results.push({
				campaignId: id,
				result
			})
		}

		return {
			success: true,
			data: {
				processedCampaigns: results.length,
				results
			},
			error: null
		}
	} catch (error) {
		console.error("Error triggering campaign processing:", error)
		return {
			success: false,
			error: "Failed to trigger campaign processing",
			data: null
		}
	}
}

// Schedule campaign to start at a specific time
export async function scheduleCampaign(campaignId: number, startTime: Date) {
	try {
		const { teamId } = await getExecutionContext()

		// Validate campaign ownership
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		const campaignData = campaign[0]

		// Check if campaign can be scheduled
		if (campaignData.status === "running") {
			return {
				success: false,
				error: "Campaign is already running",
				data: null
			}
		}

		if (campaignData.status === "completed") {
			return {
				success: false,
				error: "Campaign is already completed",
				data: null
			}
		}

		// Validate start time is in the future
		if (startTime <= new Date()) {
			return {
				success: false,
				error: "Scheduled start time must be in the future",
				data: null
			}
		}

		// Update campaign with scheduled start time
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "scheduled",
				startDate: startTime,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), teamScope(campaigns, teamId))
			)
			.returning()

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error scheduling campaign:", error)
		return {
			success: false,
			error: "Failed to schedule campaign",
			data: null
		}
	}
}

// Check and start scheduled campaigns
export async function processScheduledCampaigns() {
	try {
		// Find all scheduled campaigns that should start now
		const scheduledCampaigns = await db_ws
			.select({
				id: campaigns.id,
				teamId: campaigns.teamId,
				name: campaigns.name,
				startDate: campaigns.startDate
			})
			.from(campaigns)
			.where(
				and(
					eq(campaigns.status, "scheduled"),
					lte(campaigns.startDate, new Date())
				)
			)

		const results = []

		for (const campaign of scheduledCampaigns) {
			try {
				// Start the campaign using existing start function
				const result = await startCampaignDirect(
					campaign.id,
					campaign.teamId
				)

				results.push({
					campaignId: campaign.id,
					name: campaign.name,
					status: result.success ? "started" : "failed",
					error: result.error
				})
			} catch (error) {
				results.push({
					campaignId: campaign.id,
					name: campaign.name,
					status: "failed",
					error:
						error instanceof Error ? error.message : "Unknown error"
				})
			}
		}

		return {
			success: true,
			data: {
				processedCampaigns: results.length,
				results
			},
			error: null
		}
	} catch (error) {
		console.error("Error processing scheduled campaigns:", error)
		return {
			success: false,
			error: "Failed to process scheduled campaigns",
			data: null
		}
	}
}

// Direct campaign start without auth context (for scheduled processing)
async function startCampaignDirect(campaignId: number, teamId: string) {
	try {
		// Validate campaign
		const campaign = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				status: campaigns.status,
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.teamId, teamId))
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

		// Check if campaign can be started
		if (campaignData.status === "running") {
			return {
				success: false,
				error: "Campaign is already running",
				data: null
			}
		}

		if (campaignData.status === "completed") {
			return {
				success: false,
				error: "Campaign is already completed",
				data: null
			}
		}

		// Validate voice agent
		if (!campaignData.voiceAgentId) {
			return {
				success: false,
				error: "Campaign must have a voice agent assigned",
				data: null
			}
		}

		const voiceAgent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, campaignData.voiceAgentId),
					eq(voiceAgents.teamId, teamId)
				)
			)
			.limit(1)

		if (!voiceAgent || voiceAgent.length === 0) {
			return {
				success: false,
				error: "Voice agent not found",
				data: null
			}
		}

		if (voiceAgent[0].status !== "active") {
			return {
				success: false,
				error: `Voice agent "${voiceAgent[0].name}" is not active`,
				data: null
			}
		}

		// Check if there are leads in the queue
		const queueCount = await db_ws
			.select({ count: sql<number>`COUNT(*)` })
			.from(campaignQueue)
			.innerJoin(
				campaignLeads,
				eq(campaignQueue.campaignLeadId, campaignLeads.id)
			)
			.where(
				and(
					eq(campaignQueue.campaignId, campaignId),
					eq(campaignQueue.status, "queued"),
					eq(campaignLeads.teamId, teamId)
				)
			)

		if (queueCount[0].count === 0) {
			return {
				success: false,
				error: "No leads in queue to call",
				data: null
			}
		}

		// Update campaign status to running
		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				status: "running",
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.teamId, teamId))
			)
			.returning()

		await ensureCampaignRun(campaignId)

		return {
			success: true,
			data: updatedCampaign[0],
			error: null
		}
	} catch (error) {
		console.error("Error starting campaign directly:", error)
		return {
			success: false,
			error: "Failed to start campaign",
			data: null
		}
	}
}
