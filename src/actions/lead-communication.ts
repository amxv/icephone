"use server"

import { requireTeam } from "@/lib/auth/session"
import { createAppointment } from "@/actions/appointmentActions"
import { db_ws } from "@/db"
import {
	callQueue,
	textMessages,
	appointments,
	communicationLogs,
	voiceAgents,
	leads,
	calls,
	teamPhoneNumbers
} from "@/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { teamScope } from "@/lib/team-scope"
import { revalidatePath } from "next/cache"

// Types
interface ScheduleCallInput {
	leadId: number
	voiceAgentId?: number
	instructions?: string
	scheduledTime?: Date
	priority?: number
	phoneNumber?: string // Override lead's phone if needed
	outboundPhoneNumberId?: number // Selected team outbound caller ID
}

interface SendTextMessageInput {
	leadId: number
	content: string
}

interface ScheduleAppointmentInput {
	leadId: number
	title: string
	description?: string
	startTime: Date
	endTime: Date
	location?: string
}

// Add to existing types
interface CommunicationHistoryItem {
	id: string
	type: "call" | "text" | "appointment"
	direction: "incoming" | "outgoing"
	status: string
	timestamp: Date
	content?: string
	subject?: string
	duration?: number
	relatedData?: {
		voiceAgentName?: string
		templateName?: string
		location?: string
		phoneNumber?: string
	}
	details?: Record<string, unknown>
}

// Schedule a call for a lead
export async function scheduleCall(input: ScheduleCallInput) {
	try {
		const { teamId, user } = await requireTeam()

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), teamScope(leads, teamId)))
			.limit(1)

		if (!lead.length) {
			return { success: false, error: "Lead not found" }
		}

		// If voice agent specified, validate it belongs to user
		if (input.voiceAgentId) {
			const agent = await db_ws
				.select()
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, input.voiceAgentId),
						teamScope(voiceAgents, teamId)
					)
				)
				.limit(1)

			if (!agent.length) {
				return { success: false, error: "Voice agent not found" }
			}
		}

		let outboundPhoneNumber: {
			id: number
			phoneNumber: string
			provider: "mock" | "twilio" | "telnyx" | "vonage"
		} | null = null

		if (input.outboundPhoneNumberId) {
			const selected = await db_ws
				.select({
					id: teamPhoneNumbers.id,
					phoneNumber: teamPhoneNumbers.phoneNumber,
					provider: teamPhoneNumbers.provider
				})
				.from(teamPhoneNumbers)
				.where(
					and(
						eq(teamPhoneNumbers.id, input.outboundPhoneNumberId),
						eq(teamPhoneNumbers.teamId, teamId),
						eq(teamPhoneNumbers.status, "active")
					)
				)
				.limit(1)

			if (!selected.length) {
				return {
					success: false,
					error: "Selected outbound phone number is not active or unavailable"
				}
			}

			outboundPhoneNumber = selected[0]
		}

		// Create call queue entry
		const [callQueueEntry] = await db_ws
			.insert(callQueue)
			.values({
				leadId: input.leadId,
				teamId,
				voiceAgentId: input.voiceAgentId || null,
				instructions: input.instructions || null,
				scheduledTime: input.scheduledTime || null,
				priority: input.priority || 0,
				phoneNumber: input.phoneNumber || null,
				metadata: {
					callConfiguration: {
						outboundPhoneNumberId: outboundPhoneNumber?.id || null,
						outboundPhoneNumber:
							outboundPhoneNumber?.phoneNumber || null,
						outboundProvider: outboundPhoneNumber?.provider || null
					}
				},
				status: "pending",
				userId: user.id
			})
			.returning()

		// Log the communication attempt
		await db_ws.insert(communicationLogs).values({
			leadId: input.leadId,
			type: "outgoing",
			method: "call",
			status: "pending",
			details: {
				voiceAgentId: input.voiceAgentId,
				phoneNumber: input.phoneNumber,
				outboundPhoneNumberId: outboundPhoneNumber?.id,
				outboundPhoneNumber: outboundPhoneNumber?.phoneNumber,
				outboundProvider: outboundPhoneNumber?.provider
			},
			relatedRecordId: callQueueEntry.id,
			relatedRecordType: "call_queue",
			notes: input.instructions,
			userId: user.id
		})

		revalidatePath(`/leads/${input.leadId}`)
		revalidatePath("/calls")

		return {
			success: true,
			data: callQueueEntry,
			message: input.scheduledTime
				? "Call scheduled successfully"
				: "Call queued successfully"
		}
	} catch (error) {
		console.error("Error scheduling call:", error)
		return { success: false, error: "Failed to schedule call" }
	}
}

// Send text message to a lead
export async function sendTextMessage(input: SendTextMessageInput) {
	try {
		const { teamId, user } = await requireTeam()

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), teamScope(leads, teamId)))
			.limit(1)

		if (!lead.length) {
			return { success: false, error: "Lead not found" }
		}

		if (!lead[0].phone) {
			return { success: false, error: "Lead has no phone number" }
		}

		// Create text message record
		const [textRecord] = await db_ws
			.insert(textMessages)
			.values({
				leadId: input.leadId,
				type: "outgoing",
				content: input.content,
				sentAt: new Date(),
				userId: user.id
			})
			.returning()

		// Log the communication attempt
		await db_ws.insert(communicationLogs).values({
			leadId: input.leadId,
			type: "outgoing",
			method: "text",
			status: "pending",
			details: {
				content: input.content
			},
			relatedRecordId: textRecord.id,
			relatedRecordType: "text_message",
			userId: user.id
		})

		revalidatePath(`/leads/${input.leadId}`)
		revalidatePath("/messages")

		return {
			success: true,
			data: textRecord,
			message: "Text message sent successfully"
		}
	} catch (error) {
		console.error("Error sending text message:", error)
		return { success: false, error: "Failed to send text message" }
	}
}

// Schedule appointment with a lead
export async function scheduleAppointment(input: ScheduleAppointmentInput) {
	try {
		const { teamId, user } = await requireTeam()

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), teamScope(leads, teamId)))
			.limit(1)

		if (!lead.length) {
			return { success: false, error: "Lead not found" }
		}

		// Validate appointment times
		if (input.startTime >= input.endTime) {
			return {
				success: false,
				error: "Start time must be before end time"
			}
		}

		if (input.startTime < new Date()) {
			return {
				success: false,
				error: "Cannot schedule appointment in the past"
			}
		}

		const leadRecord = lead[0]

		const appointmentResult = await createAppointment({
			title: input.title,
			startDate: input.startTime.toISOString(),
			endDate: input.endTime.toISOString(),
			description: input.description,
			location: input.location,
			leadId: input.leadId,
			attendee: {
				name: leadRecord.name || user.name || user.email || "Guest",
				email: leadRecord.email || user.email,
				phoneNumber: leadRecord.phone || undefined,
				timeZone: "UTC"
			}
		})

		if ("error" in appointmentResult) {
			return { success: false, error: appointmentResult.error }
		}

		// Log the communication attempt
		await db_ws.insert(communicationLogs).values({
			leadId: input.leadId,
			type: "outgoing",
			method: "appointment",
			status: "pending",
			details: {
				subject: input.title,
				content: input.description,
				deliveryTime: input.startTime.toISOString()
			},
			relatedRecordId: appointmentResult.id,
			relatedRecordType: "appointment",
			userId: user.id
		})

		revalidatePath(`/leads/${input.leadId}`)
		revalidatePath("/appointments")

		return {
			success: true,
			data: appointmentResult,
			message: "Appointment scheduled successfully"
		}
	} catch (error) {
		console.error("Error scheduling appointment:", error)
		return { success: false, error: "Failed to schedule appointment" }
	}
}

// Get available voice agents for a user
export async function getAvailableVoiceAgents() {
	try {
		const { teamId } = await requireTeam()

		const agents = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				description: voiceAgents.description,
				status: voiceAgents.status
			})
			.from(voiceAgents)
			.where(
				and(
					teamScope(voiceAgents, teamId),
					eq(voiceAgents.status, "active")
				)
			)
			.orderBy(voiceAgents.name)

		return { success: true, data: agents }
	} catch (error) {
		console.error("Error getting voice agents:", error)
		return { success: false, error: "Failed to get voice agents", data: [] }
	}
}

// Get call queue status for a lead
export async function getCallQueueStatus(leadId: number) {
	try {
		const { teamId } = await requireTeam()
		if (!teamId) {
			return { success: false, error: "Unauthorized", data: null }
		}

		const queueEntry = await db_ws
			.select()
			.from(callQueue)
			.where(
				and(eq(callQueue.leadId, leadId), teamScope(callQueue, teamId))
			)
			.orderBy(desc(callQueue.createdAt))
			.limit(1)

		return { success: true, data: queueEntry[0] || null }
	} catch (error) {
		console.error("Error getting call queue status:", error)
		return {
			success: false,
			error: "Failed to get call queue status",
			data: null
		}
	}
}

// Cancel a queued call
export async function cancelQueuedCall(queueId: number) {
	try {
		const { teamId, user } = await requireTeam()
		if (!teamId || !user) {
			return { success: false, error: "Unauthorized" }
		}

		const [updatedEntry] = await db_ws
			.update(callQueue)
			.set({
				status: "cancelled",
				completedAt: new Date(),
				updatedAt: new Date()
			})
			.where(and(eq(callQueue.id, queueId), teamScope(callQueue, teamId)))
			.returning()

		if (!updatedEntry) {
			return { success: false, error: "Call queue entry not found" }
		}

		// Update communication log
		await db_ws
			.update(communicationLogs)
			.set({
				status: "cancelled",
				updatedAt: new Date()
			})
			.where(
				and(
					eq(communicationLogs.relatedRecordId, queueId),
					eq(communicationLogs.relatedRecordType, "call_queue"),
					eq(communicationLogs.userId, user.id)
				)
			)

		revalidatePath(`/leads/${updatedEntry.leadId}`)
		revalidatePath("/calls")

		return {
			success: true,
			data: updatedEntry,
			message: "Call cancelled successfully"
		}
	} catch (error) {
		console.error("Error cancelling call:", error)
		return { success: false, error: "Failed to cancel call" }
	}
}

// Get all call queue entries for the current user
export async function getCallQueue() {
	try {
		const { teamId } = await requireTeam()
		if (!teamId) {
			return { success: false, error: "Unauthorized", data: null }
		}

		const queueEntries = await db_ws
			.select({
				id: callQueue.id,
				status: callQueue.status,
				priority: callQueue.priority,
				scheduledTime: callQueue.scheduledTime,
				instructions: callQueue.instructions,
				phoneNumber: callQueue.phoneNumber,
				startedAt: callQueue.startedAt,
				completedAt: callQueue.completedAt,
				retryCount: callQueue.retryCount,
				maxRetries: callQueue.maxRetries,
				lastError: callQueue.lastError,
				callResult: callQueue.callResult,
				createdAt: callQueue.createdAt,
				updatedAt: callQueue.updatedAt,
				lead: {
					id: leads.id,
					name: leads.name,
					phone: leads.phone,
					status: leads.status
				},
				voiceAgent: {
					id: voiceAgents.id,
					name: voiceAgents.name
				}
			})
			.from(callQueue)
			.leftJoin(leads, eq(callQueue.leadId, leads.id))
			.leftJoin(voiceAgents, eq(callQueue.voiceAgentId, voiceAgents.id))
			.where(teamScope(callQueue, teamId))
			.orderBy(desc(callQueue.createdAt))

		return { success: true, data: queueEntries }
	} catch (error) {
		console.error("Error getting call queue:", error)
		return {
			success: false,
			error: "Failed to get call queue",
			data: null
		}
	}
}

// Get communication history for timeline display
export async function getCommunicationLogs(leadId: number): Promise<{
	success: boolean
	data: CommunicationHistoryItem[]
	error?: string
}> {
	try {
		const { teamId, user } = await requireTeam()

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, leadId), teamScope(leads, teamId)))
			.limit(1)

		if (!lead.length) {
			return { success: false, data: [], error: "Lead not found" }
		}

		// Get communication logs with related data
		const logs = await db_ws
			.select({
				id: communicationLogs.id,
				type: communicationLogs.type,
				method: communicationLogs.method,
				status: communicationLogs.status,
				details: communicationLogs.details,
				relatedRecordId: communicationLogs.relatedRecordId,
				relatedRecordType: communicationLogs.relatedRecordType,
				notes: communicationLogs.notes,
				createdAt: communicationLogs.createdAt,
				// Additional data from related tables
				textContent: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'text_message' THEN ${textMessages.content} END`,
				appointmentTitle: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'appointment' THEN ${appointments.title} END`,
				appointmentLocation: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'appointment' THEN ${appointments.location} END`,
				callDuration: sql<
					number | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'call' THEN ${calls.duration} END`,
				callSummary: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'call' THEN ${calls.summary} END`,
				voiceAgentName: sql<string | null>`${voiceAgents.name}`,
				queuePhoneNumber: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'call_queue' THEN ${callQueue.phoneNumber} END`
			})
			.from(communicationLogs)
			.leftJoin(
				textMessages,
				and(
					eq(communicationLogs.relatedRecordId, textMessages.id),
					eq(communicationLogs.relatedRecordType, "text_message")
				)
			)
			.leftJoin(
				appointments,
				and(
					eq(communicationLogs.relatedRecordId, appointments.id),
					eq(communicationLogs.relatedRecordType, "appointment")
				)
			)
			.leftJoin(
				calls,
				and(
					eq(communicationLogs.relatedRecordId, calls.id),
					eq(communicationLogs.relatedRecordType, "call")
				)
			)
			.leftJoin(
				callQueue,
				and(
					eq(communicationLogs.relatedRecordId, callQueue.id),
					eq(communicationLogs.relatedRecordType, "call_queue")
				)
			)
			.leftJoin(voiceAgents, eq(callQueue.voiceAgentId, voiceAgents.id))
			.where(
				and(
					eq(communicationLogs.leadId, leadId),
					eq(communicationLogs.userId, user.id)
				)
			)
			.orderBy(desc(communicationLogs.createdAt))

		// Transform the data into the timeline format
		const communicationHistory: CommunicationHistoryItem[] = logs.map(
			(log) => {
				const details = log.details as Record<string, unknown> | null
				const item: CommunicationHistoryItem = {
					id: `${log.method}-${log.id}`,
					type: log.method as "call" | "text" | "appointment",
					direction: log.type as "incoming" | "outgoing",
					status: log.status,
					timestamp: log.createdAt,
					details: details || undefined
				}

				// Add method-specific data
				switch (log.method) {
					case "text":
						item.content =
							log.textContent || (details?.content as string)
						break
					case "appointment":
						item.subject =
							log.appointmentTitle || (details?.subject as string)
						item.content = details?.content as string
						item.relatedData = {
							location:
								log.appointmentLocation ||
								(details?.location as string)
						}
						break
					case "call":
						item.duration =
							log.callDuration || (details?.duration as number)
						item.content =
							log.callSummary || (details?.outcome as string)
						item.relatedData = {
							voiceAgentName: log.voiceAgentName || undefined,
							phoneNumber:
								log.queuePhoneNumber ||
								(details?.phoneNumber as string)
						}
						break
				}

				return item
			}
		)

		return { success: true, data: communicationHistory }
	} catch (error) {
		console.error("Error getting communication logs:", error)
		return {
			success: false,
			data: [],
			error: "Failed to get communication history"
		}
	}
}
