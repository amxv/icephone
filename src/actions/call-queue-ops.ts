"use server"

import { db_ws } from "@/db"
import { callQueue, communicationLogs } from "@/db/schema"
import { requireTeam } from "@/lib/auth/session"
import { and, eq, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { z } from "zod"

const queueIdsSchema = z.array(z.number().int().positive()).min(1).max(200)

const processSchema = z.object({
	batchSize: z.number().int().min(1).max(50).optional().default(10),
	forceProcessing: z.boolean().optional().default(true)
})

function resolveBaseUrl(requestHeaders: Headers) {
	const envBaseUrl =
		process.env.NEXT_PUBLIC_APP_URL?.trim() ||
		process.env.APP_URL?.trim() ||
		process.env.BETTER_AUTH_URL?.trim() ||
		null
	if (envBaseUrl) {
		return envBaseUrl.replace(/\/+$/, "")
	}

	const host =
		requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
	if (!host) {
		return null
	}

	const protocol = requestHeaders.get("x-forwarded-proto") || "http"
	return `${protocol}://${host}`
}

export async function processCallQueueNow(rawInput?: unknown) {
	try {
		const input = processSchema.parse(rawInput || {})
		const { teamId } = await requireTeam()
		const secret = process.env.CALL_QUEUE_PROCESSOR_SECRET
		if (!secret) {
			return {
				success: false,
				error: "CALL_QUEUE_PROCESSOR_SECRET is not configured",
				data: null
			}
		}

		const requestHeaders = await headers()
		const baseUrl = resolveBaseUrl(requestHeaders)
		if (!baseUrl) {
			return {
				success: false,
				error: "Unable to resolve application base URL for queue processing",
				data: null
			}
		}

		const response = await fetch(`${baseUrl}/api/call-queue/process`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${secret}`
			},
			body: JSON.stringify({
				teamId,
				batchSize: input.batchSize,
				forceProcessing: input.forceProcessing
			}),
			cache: "no-store"
		})

		const payload = (await response.json()) as {
			error?: string
			processed?: number
			successful?: number
			failed?: number
			results?: Array<{
				teamId: string
				status: string
				processed?: number
				successful?: number
				failed?: number
				retries?: number
				message?: string
			}>
		}

		if (!response.ok) {
			return {
				success: false,
				error: payload.error || "Failed to process queue",
				data: null
			}
		}

		const teamResult =
			payload.results?.find((result) => result.teamId === teamId) ||
			payload.results?.[0]

		return {
			success: true,
			data: {
				processed: teamResult?.processed ?? payload.processed ?? 0,
				successful: teamResult?.successful ?? payload.successful ?? 0,
				failed: teamResult?.failed ?? payload.failed ?? 0,
				retries: teamResult?.retries ?? 0,
				message: teamResult?.message || null
			},
			error: null
		}
	} catch (error) {
		console.error("Error processing call queue:", error)
		return {
			success: false,
			error: "Failed to process call queue",
			data: null
		}
	}
}

export async function retryCallQueueEntries(rawQueueIds: unknown) {
	try {
		const queueIds = queueIdsSchema.parse(rawQueueIds)
		const { teamId } = await requireTeam()
		const now = new Date()

		const rows = await db_ws
			.update(callQueue)
			.set({
				status: "pending",
				scheduledTime: now,
				startedAt: null,
				completedAt: null,
				lastError: null,
				updatedAt: now
			})
			.where(
				and(
					eq(callQueue.teamId, teamId),
					inArray(callQueue.id, queueIds),
					inArray(callQueue.status, ["failed", "cancelled"])
				)
			)
			.returning({ id: callQueue.id })

		if (rows.length > 0) {
			await db_ws
				.update(communicationLogs)
				.set({
					status: "pending",
					updatedAt: now
				})
				.where(
					and(
						eq(communicationLogs.relatedRecordType, "call_queue"),
						inArray(
							communicationLogs.relatedRecordId,
							rows.map((row) => row.id)
						)
					)
				)
		}

		return {
			success: true,
			data: {
				retriedCount: rows.length,
				queueIds: rows.map((r) => r.id)
			},
			error: null
		}
	} catch (error) {
		console.error("Error retrying call queue entries:", error)
		return {
			success: false,
			error: "Failed to retry selected queue entries",
			data: null
		}
	}
}

export async function cancelCallQueueEntries(rawQueueIds: unknown) {
	try {
		const queueIds = queueIdsSchema.parse(rawQueueIds)
		const { teamId } = await requireTeam()
		const now = new Date()

		const rows = await db_ws
			.update(callQueue)
			.set({
				status: "cancelled",
				completedAt: now,
				updatedAt: now
			})
			.where(
				and(
					eq(callQueue.teamId, teamId),
					inArray(callQueue.id, queueIds),
					inArray(callQueue.status, ["pending", "queued", "calling"])
				)
			)
			.returning({ id: callQueue.id })

		if (rows.length > 0) {
			await db_ws
				.update(communicationLogs)
				.set({
					status: "failed",
					updatedAt: now
				})
				.where(
					and(
						eq(communicationLogs.relatedRecordType, "call_queue"),
						inArray(
							communicationLogs.relatedRecordId,
							rows.map((row) => row.id)
						)
					)
				)
		}

		return {
			success: true,
			data: {
				cancelledCount: rows.length,
				queueIds: rows.map((row) => row.id)
			},
			error: null
		}
	} catch (error) {
		console.error("Error cancelling queue entries:", error)
		return {
			success: false,
			error: "Failed to cancel selected queue entries",
			data: null
		}
	}
}
