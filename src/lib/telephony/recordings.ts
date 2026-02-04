import { db_ws } from "@/db"
import { callRecordings, calls, telephonyCalls } from "@/db/schema"
import type { TelephonyProvider } from "@/lib/telephony/types"
import { and, eq } from "drizzle-orm"

export type TelephonyRecordingStatus = "processing" | "ready" | "failed"

type UpsertCallRecordingInput = {
	teamId: string
	callId: number
	userId: string
	provider: Exclude<TelephonyProvider, "mock">
	providerRecordingId?: string | null
	recordingUrl?: string | null
	storageKey?: string | null
	status: TelephonyRecordingStatus
	durationSeconds?: number | null
	channels?: number | null
	recordedAt?: Date | null
	expiresAt?: Date | null
	metadata?: Record<string, unknown>
	telephonyCallId?: number | null
}

export async function upsertCallRecording(input: UpsertCallRecordingInput) {
	const now = new Date()

	let persistedRecording: typeof callRecordings.$inferSelect | undefined
	if (input.providerRecordingId) {
		;[persistedRecording] = await db_ws
			.insert(callRecordings)
			.values({
				teamId: input.teamId,
				callId: input.callId,
				telephonyCallId: input.telephonyCallId || null,
				provider: input.provider,
				providerRecordingId: input.providerRecordingId,
				recordingUrl: input.recordingUrl || null,
				storageKey: input.storageKey || null,
				status: input.status,
				duration: input.durationSeconds ?? null,
				channels: input.channels ?? null,
				recordedAt: input.recordedAt || null,
				expiresAt: input.expiresAt || null,
				metadata: input.metadata || {},
				createdAt: now,
				updatedAt: now,
				userId: input.userId
			})
			.onConflictDoUpdate({
				target: [
					callRecordings.provider,
					callRecordings.providerRecordingId
				],
				set: {
					callId: input.callId,
					telephonyCallId: input.telephonyCallId || null,
					recordingUrl: input.recordingUrl || null,
					storageKey: input.storageKey || null,
					status: input.status,
					duration: input.durationSeconds ?? null,
					channels: input.channels ?? null,
					recordedAt: input.recordedAt || null,
					expiresAt: input.expiresAt || null,
					metadata: input.metadata || {},
					updatedAt: now
				}
			})
			.returning()
	} else {
		;[persistedRecording] = await db_ws
			.insert(callRecordings)
			.values({
				teamId: input.teamId,
				callId: input.callId,
				telephonyCallId: input.telephonyCallId || null,
				provider: input.provider,
				providerRecordingId: null,
				recordingUrl: input.recordingUrl || null,
				storageKey: input.storageKey || null,
				status: input.status,
				duration: input.durationSeconds ?? null,
				channels: input.channels ?? null,
				recordedAt: input.recordedAt || null,
				expiresAt: input.expiresAt || null,
				metadata: input.metadata || {},
				createdAt: now,
				updatedAt: now,
				userId: input.userId
			})
			.returning()
	}

	if (input.telephonyCallId) {
		await db_ws
			.update(telephonyCalls)
			.set({
				recordingStatus: input.status,
				recordingUrl: input.recordingUrl || null,
				updatedAt: now
			})
			.where(
				and(
					eq(telephonyCalls.id, input.telephonyCallId),
					eq(telephonyCalls.teamId, input.teamId)
				)
			)
	}

	const callRows = await db_ws
		.select({
			id: calls.id,
			metadata: calls.metadata,
			recordingUrl: calls.recordingUrl
		})
		.from(calls)
		.where(and(eq(calls.id, input.callId), eq(calls.teamId, input.teamId)))
		.limit(1)

	if (callRows.length) {
		const currentMetadata =
			(callRows[0].metadata as Record<string, unknown>) || {}

		await db_ws
			.update(calls)
			.set({
				recordingUrl: input.recordingUrl || callRows[0].recordingUrl,
				metadata: {
					...currentMetadata,
					telephonyRecording: {
						provider: input.provider,
						providerRecordingId: input.providerRecordingId || null,
						recordingUrl: input.recordingUrl || null,
						status: input.status,
						durationSeconds: input.durationSeconds ?? null,
						channels: input.channels ?? null,
						recordedAt: input.recordedAt
							? input.recordedAt.toISOString()
							: null
					}
				},
				updatedAt: now
			})
			.where(
				and(eq(calls.id, input.callId), eq(calls.teamId, input.teamId))
			)
	}

	return persistedRecording || null
}
