"use server"

import { currentUser } from "@clerk/nextjs/server"
import { db_ws } from "@/db"
import {
	callQueue,
	emails,
	textMessages,
	appointments,
	communicationLogs,
	emailTemplates,
	voiceAgents,
	leads,
	calls
} from "@/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Types
interface ScheduleCallInput {
	leadId: number
	voiceAgentId?: number
	instructions?: string
	scheduledTime?: Date
	priority?: number
	phoneNumber?: string // Override lead's phone if needed
}

interface SendEmailInput {
	leadId: number
	subject: string
	content: string
	templateId?: number
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
	type: "call" | "email" | "text" | "appointment"
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
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), eq(leads.userId, user.id)))
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
						eq(voiceAgents.userId, user.id)
					)
				)
				.limit(1)

			if (!agent.length) {
				return { success: false, error: "Voice agent not found" }
			}
		}

		// Create call queue entry
		const [callQueueEntry] = await db_ws
			.insert(callQueue)
			.values({
				leadId: input.leadId,
				voiceAgentId: input.voiceAgentId || null,
				instructions: input.instructions || null,
				scheduledTime: input.scheduledTime || null,
				priority: input.priority || 0,
				phoneNumber: input.phoneNumber || null,
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
				phoneNumber: input.phoneNumber
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

// Send email to a lead
export async function sendEmail(input: SendEmailInput) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), eq(leads.userId, user.id)))
			.limit(1)

		if (!lead.length) {
			return { success: false, error: "Lead not found" }
		}

		if (!lead[0].email) {
			return { success: false, error: "Lead has no email address" }
		}

		// Create email record with pending status
		const [emailRecord] = await db_ws
			.insert(emails)
			.values({
				leadId: input.leadId,
				type: "outgoing",
				subject: input.subject,
				content: input.content,
				sentAt: new Date(),
				status: "pending",
				userId: user.id
			})
			.returning()

		// Get template for HTML generation if templateId provided
		let templateData = null
		if (input.templateId) {
			const templateResult = await db_ws
				.select()
				.from(emailTemplates)
				.where(
					and(
						eq(emailTemplates.id, input.templateId),
						eq(emailTemplates.userId, user.id)
					)
				)
				.limit(1)

			if (templateResult.length > 0) {
				templateData = templateResult[0]
			}
		}

		// Send actual email using Resend service
		try {
			const { sendEmail: sendEmailService } = await import("@/lib/email")
			const { generateFollowUpEmailTemplate } = await import(
				"@/lib/email-templates"
			)

			// Generate HTML email content
			const templateType =
				templateData?.category === "appointment_reminder"
					? "appointment_reminder"
					: templateData?.category === "follow_up"
						? "follow_up"
						: "custom"

			const emailHtml = generateFollowUpEmailTemplate(
				lead[0].name,
				input.content,
				templateType as "follow_up" | "appointment_reminder" | "custom"
			)

			const emailResult = await sendEmailService({
				to: [lead[0].email],
				subject: input.subject,
				html: emailHtml,
				replyTo: "support@icephone.com"
			})

			if (emailResult.success) {
				// Update email record with sent status
				await db_ws
					.update(emails)
					.set({
						status: "sent",
						updatedAt: new Date()
					})
					.where(eq(emails.id, emailRecord.id))

				// Update communication log with success
				await db_ws.insert(communicationLogs).values({
					leadId: input.leadId,
					type: "outgoing",
					method: "email",
					status: "sent",
					details: {
						subject: input.subject,
						content: input.content,
						templateId: input.templateId
					},
					relatedRecordId: emailRecord.id,
					relatedRecordType: "email",
					userId: user.id
				})

				revalidatePath(`/leads/${input.leadId}`)
				revalidatePath("/emails")

				return {
					success: true,
					data: { ...emailRecord, status: "sent" },
					message: "Email sent successfully"
				}
			}

			// Update email record with failed status
			await db_ws
				.update(emails)
				.set({
					status: "failed",
					updatedAt: new Date()
				})
				.where(eq(emails.id, emailRecord.id))

			// Update communication log with failure
			await db_ws.insert(communicationLogs).values({
				leadId: input.leadId,
				type: "outgoing",
				method: "email",
				status: "failed",
				details: {
					subject: input.subject,
					content: input.content,
					templateId: input.templateId,
					errorMessage: emailResult.error || "Email sending failed"
				},
				relatedRecordId: emailRecord.id,
				relatedRecordType: "email",
				userId: user.id
			})

			return {
				success: false,
				error: `Failed to send email: ${emailResult.error}`
			}
		} catch (emailError) {
			// Update email record with failed status
			await db_ws
				.update(emails)
				.set({
					status: "failed",
					updatedAt: new Date()
				})
				.where(eq(emails.id, emailRecord.id))

			// Log the communication failure
			await db_ws.insert(communicationLogs).values({
				leadId: input.leadId,
				type: "outgoing",
				method: "email",
				status: "failed",
				details: {
					subject: input.subject,
					content: input.content,
					templateId: input.templateId,
					errorMessage:
						emailError instanceof Error
							? emailError.message
							: "Unknown error"
				},
				relatedRecordId: emailRecord.id,
				relatedRecordType: "email",
				userId: user.id
			})

			console.error("Error sending email via Resend:", emailError)
			return {
				success: false,
				error: "Failed to send email via email service"
			}
		}
	} catch (error) {
		console.error("Error in sendEmail function:", error)
		return { success: false, error: "Failed to send email" }
	}
}

// Send text message to a lead
export async function sendTextMessage(input: SendTextMessageInput) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), eq(leads.userId, user.id)))
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
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, input.leadId), eq(leads.userId, user.id)))
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

		// Create appointment record
		const [appointmentRecord] = await db_ws
			.insert(appointments)
			.values({
				leadId: input.leadId,
				title: input.title,
				description: input.description || null,
				startTime: input.startTime,
				endTime: input.endTime,
				location: input.location || null,
				completed: false,
				userId: user.id
			})
			.returning()

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
			relatedRecordId: appointmentRecord.id,
			relatedRecordType: "appointment",
			userId: user.id
		})

		revalidatePath(`/leads/${input.leadId}`)
		revalidatePath("/appointments")

		return {
			success: true,
			data: appointmentRecord,
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
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized", data: [] }
		}

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
					eq(voiceAgents.userId, user.id),
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

// Get email templates for a user
export async function getEmailTemplates() {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized", data: [] }
		}

		const templates = await db_ws
			.select()
			.from(emailTemplates)
			.where(eq(emailTemplates.userId, user.id))
			.orderBy(emailTemplates.name)

		return { success: true, data: templates }
	} catch (error) {
		console.error("Error getting email templates:", error)
		return {
			success: false,
			error: "Failed to get email templates",
			data: []
		}
	}
}

// Get call queue status for a lead
export async function getCallQueueStatus(leadId: number) {
	try {
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized", data: null }
		}

		const queueEntry = await db_ws
			.select()
			.from(callQueue)
			.where(
				and(eq(callQueue.leadId, leadId), eq(callQueue.userId, user.id))
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
		const user = await currentUser()
		if (!user) {
			return { success: false, error: "Unauthorized" }
		}

		const [updatedEntry] = await db_ws
			.update(callQueue)
			.set({
				status: "cancelled",
				completedAt: new Date(),
				updatedAt: new Date()
			})
			.where(
				and(eq(callQueue.id, queueId), eq(callQueue.userId, user.id))
			)
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
		const user = await currentUser()
		if (!user) {
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
			.where(eq(callQueue.userId, user.id))
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
		const user = await currentUser()
		if (!user) {
			return { success: false, data: [], error: "Unauthorized" }
		}

		// Validate lead exists and belongs to user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, leadId), eq(leads.userId, user.id)))
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
				emailSubject: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'email' THEN ${emails.subject} END`,
				emailContent: sql<
					string | null
				>`CASE WHEN ${communicationLogs.relatedRecordType} = 'email' THEN ${emails.content} END`,
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
				emails,
				and(
					eq(communicationLogs.relatedRecordId, emails.id),
					eq(communicationLogs.relatedRecordType, "email")
				)
			)
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
					type: log.method as
						| "call"
						| "email"
						| "text"
						| "appointment",
					direction: log.type as "incoming" | "outgoing",
					status: log.status,
					timestamp: log.createdAt,
					details: details || undefined
				}

				// Add method-specific data
				switch (log.method) {
					case "email":
						item.subject =
							log.emailSubject || (details?.subject as string)
						item.content =
							log.emailContent || (details?.content as string)
						break
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
