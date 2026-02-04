import { NextRequest, NextResponse } from "next/server"
import { db_ws } from "@/db"
import { calls, telephonyCalls, telephonyEvents } from "@/db/schema"
import { upsertCallRecording } from "@/lib/telephony/recordings"
import { normalizeCallLifecycleStatus } from "@/lib/telephony/providers/shared"
import { getTelephonyWebhookAdapter } from "@/lib/telephony/webhooks"
import { and, eq } from "drizzle-orm"

function mapTelephonyStatusToCallStatus(status: string | null) {
	switch ((status || "").toLowerCase()) {
		case "completed":
			return "completed"
		case "failed":
			return "failed"
		case "busy":
			return "busy"
		case "no_answer":
			return "no_answer"
		case "ringing":
			return "ringing"
		case "in_progress":
			return "in_progress"
		case "canceled":
			return "cancelled"
		default:
			return null
	}
}

function resolveRecordingStatus(event: {
	eventType: string
	status: string | null
	recordingUrl: string | null
}) {
	if (
		event.status?.includes("fail") ||
		event.status?.includes("error") ||
		event.status?.includes("absent")
	) {
		return "failed" as const
	}
	if (
		event.recordingUrl ||
		event.eventType.toLowerCase().includes("recording")
	) {
		return "ready" as const
	}
	return "processing" as const
}

export async function POST(
	request: NextRequest,
	{ params }: { params: { provider: string } }
) {
	const now = new Date()
	const { provider: rawProvider } = params
	const adapter = getTelephonyWebhookAdapter(rawProvider)

	if (!adapter) {
		return NextResponse.json(
			{ error: `Unsupported telephony provider: ${rawProvider}` },
			{ status: 404 }
		)
	}

	const rawBody = await request.text()
	const requestUrl = request.url
	const webhookRequest = {
		provider: adapter.provider,
		rawBody,
		requestUrl,
		headers: request.headers
	}
	const signatureValid = adapter.verifySignature(webhookRequest)
	const allowUnsigned =
		process.env.TELEPHONY_WEBHOOK_ALLOW_UNSIGNED === "true"
	const normalizedEvents = adapter.normalizeEvents(webhookRequest)

	const processed = []

	for (const event of normalizedEvents) {
		const matchedTelephonyCall =
			event.providerCallId === null
				? null
				: (
						await db_ws
							.select({
								id: telephonyCalls.id,
								teamId: telephonyCalls.teamId,
								callId: telephonyCalls.callId,
								userId: telephonyCalls.userId,
								metadata: telephonyCalls.metadata
							})
							.from(telephonyCalls)
							.where(
								and(
									eq(
										telephonyCalls.provider,
										adapter.provider
									),
									eq(
										telephonyCalls.providerCallId,
										event.providerCallId
									)
								)
							)
							.limit(1)
					)[0] || null

		const [persistedEvent] = await db_ws
			.insert(telephonyEvents)
			.values({
				teamId: matchedTelephonyCall?.teamId || null,
				telephonyCallId: matchedTelephonyCall?.id || null,
				provider: adapter.provider,
				providerEventId: event.eventId,
				eventType: event.eventType,
				dedupeKey: event.dedupeKey,
				signatureValid,
				occurredAt: event.occurredAt || null,
				receivedAt: now,
				processingStatus:
					signatureValid || allowUnsigned ? "ingested" : "rejected",
				processingError:
					signatureValid || allowUnsigned
						? null
						: "Invalid webhook signature",
				payload: event.payload,
				createdAt: now,
				updatedAt: now,
				userId: matchedTelephonyCall?.userId || null
			})
			.onConflictDoNothing({
				target: telephonyEvents.dedupeKey
			})
			.returning({ id: telephonyEvents.id })

		if (!persistedEvent) {
			processed.push({
				dedupeKey: event.dedupeKey,
				status: "duplicate"
			})
			continue
		}

		if (!matchedTelephonyCall) {
			processed.push({
				dedupeKey: event.dedupeKey,
				status: "unmatched",
				eventType: event.eventType
			})
			continue
		}

		if (!signatureValid && !allowUnsigned) {
			processed.push({
				dedupeKey: event.dedupeKey,
				status: "rejected_signature"
			})
			continue
		}

		const telephonyStatus = normalizeCallLifecycleStatus(event.status)
		const mergedTelephonyMetadata = {
			...((matchedTelephonyCall.metadata as Record<string, unknown>) ||
				{}),
			lastEventType: event.eventType,
			lastEventId: event.eventId,
			lastEventAt: (event.occurredAt || now).toISOString(),
			lastEventPayload: event.payload
		}

		const telephonyUpdate: Partial<typeof telephonyCalls.$inferInsert> = {
			status: telephonyStatus,
			duration: event.durationSeconds ?? undefined,
			recordingUrl: event.recordingUrl || undefined,
			recordingStatus:
				event.providerRecordingId || event.recordingUrl
					? resolveRecordingStatus(event)
					: undefined,
			lastWebhookAt: now,
			metadata: mergedTelephonyMetadata,
			updatedAt: now
		}

		if (
			telephonyStatus === "completed" ||
			telephonyStatus === "failed" ||
			telephonyStatus === "busy" ||
			telephonyStatus === "no_answer" ||
			telephonyStatus === "canceled"
		) {
			telephonyUpdate.endedAt = event.occurredAt || now
		}

		await db_ws
			.update(telephonyCalls)
			.set(telephonyUpdate)
			.where(eq(telephonyCalls.id, matchedTelephonyCall.id))

		if (matchedTelephonyCall.callId) {
			const callRows = await db_ws
				.select({
					id: calls.id,
					teamId: calls.teamId,
					metadata: calls.metadata,
					recordingUrl: calls.recordingUrl
				})
				.from(calls)
				.where(
					and(
						eq(calls.id, matchedTelephonyCall.callId),
						eq(calls.teamId, matchedTelephonyCall.teamId)
					)
				)
				.limit(1)

			if (callRows.length) {
				const callRow = callRows[0]
				const updatedMetadata = {
					...((callRow.metadata as Record<string, unknown>) || {}),
					telephony: {
						provider: adapter.provider,
						providerCallId: event.providerCallId,
						lastEventType: event.eventType,
						lastEventAt: (event.occurredAt || now).toISOString(),
						lastEventStatus: event.status
					}
				}

				const callUpdate: Partial<typeof calls.$inferInsert> = {
					metadata: updatedMetadata,
					updatedAt: now
				}

				const mappedCallStatus = mapTelephonyStatusToCallStatus(
					event.status
				)
				if (mappedCallStatus) {
					callUpdate.status = mappedCallStatus
				}

				if (event.durationSeconds !== null) {
					callUpdate.duration = event.durationSeconds
				}

				if (event.recordingUrl) {
					callUpdate.recordingUrl = event.recordingUrl
				}

				if (
					telephonyStatus === "completed" ||
					telephonyStatus === "failed" ||
					telephonyStatus === "busy" ||
					telephonyStatus === "no_answer" ||
					telephonyStatus === "canceled"
				) {
					callUpdate.endTime = event.occurredAt || now
				}

				await db_ws
					.update(calls)
					.set(callUpdate)
					.where(
						and(
							eq(calls.id, matchedTelephonyCall.callId),
							eq(calls.teamId, matchedTelephonyCall.teamId)
						)
					)

				if (event.providerRecordingId || event.recordingUrl) {
					await upsertCallRecording({
						teamId: matchedTelephonyCall.teamId,
						callId: matchedTelephonyCall.callId,
						telephonyCallId: matchedTelephonyCall.id,
						userId: matchedTelephonyCall.userId,
						provider: adapter.provider,
						providerRecordingId: event.providerRecordingId,
						recordingUrl: event.recordingUrl,
						status: resolveRecordingStatus(event),
						durationSeconds: event.durationSeconds,
						recordedAt: event.occurredAt,
						metadata: {
							sourceEventType: event.eventType,
							sourceEventId: event.eventId
						}
					})
				}
			}
		}

		processed.push({
			dedupeKey: event.dedupeKey,
			status: "processed",
			eventType: event.eventType
		})
	}

	if (!signatureValid && !allowUnsigned) {
		return NextResponse.json(
			{
				success: false,
				error: "Invalid webhook signature",
				processed
			},
			{ status: 401 }
		)
	}

	return NextResponse.json({
		success: true,
		processed
	})
}
