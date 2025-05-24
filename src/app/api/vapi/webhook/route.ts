import { db_ws } from "@/db"
import {
	appointments,
	calls,
	leads,
	voiceSessions,
	voiceAgents
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// Type definitions for VAPI call data
interface VapiCallData {
	id: string
	type?: string
	status?: string
	assistantId?: string
	phoneNumberId?: string
	customer?: {
		number?: string
	}
	started_at?: string
	ended_at?: string
	cost?: number
	transcript?: string
	recording_url?: string
	summary?: string
	analysis?: {
		sentiment?: string
		score?: number
		keywords?: string[]
	}
	metadata?: Record<string, unknown>
}

// Enhanced Vapi webhook event schemas
const VapiWebhookEventSchema = z.object({
	type: z.string(),
	call: z
		.object({
			id: z.string(),
			type: z.string().optional(),
			status: z.string().optional(),
			assistantId: z.string().optional(),
			phoneNumberId: z.string().optional(),
			customer: z
				.object({
					number: z.string().optional()
				})
				.optional(),
			started_at: z.string().optional(),
			ended_at: z.string().optional(),
			cost: z.number().optional(),
			cost_breakdown: z
				.object({
					transport: z.number().optional(),
					stt: z.number().optional(),
					llm: z.number().optional(),
					tts: z.number().optional(),
					vapi: z.number().optional(),
					total: z.number().optional()
				})
				.optional(),
			transcript: z.string().optional(),
			recording_url: z.string().optional(),
			summary: z.string().optional(),
			analysis: z
				.object({
					sentiment: z.string().optional(),
					score: z.number().optional(),
					keywords: z.array(z.string()).optional()
				})
				.optional(),
			metadata: z.record(z.any()).optional()
		})
		.optional(),
	message: z
		.object({
			type: z.string(),
			functionCall: z
				.object({
					name: z.string(),
					parameters: z.record(z.any())
				})
				.optional(),
			transcript: z.string().optional(),
			timestamp: z.string().optional()
		})
		.optional(),
	timestamp: z.string().optional()
})

// Function call schemas
const UpdateLeadStatusSchema = z.object({
	leadId: z.string(),
	status: z.enum(["new", "contacted", "qualified", "converted", "lost"])
})

const ScheduleAppointmentSchema = z.object({
	leadId: z.string(),
	dateTime: z.string(),
	duration: z.string()
})

const AddNoteToLeadSchema = z.object({
	leadId: z.string(),
	note: z.string()
})

// Enhanced function handlers with better error handling and user context
async function handleUpdateLeadStatus(
	parameters: Record<string, unknown>,
	callId?: string
) {
	try {
		const { leadId, status } = UpdateLeadStatusSchema.parse(parameters)

		// Get the voice session to validate user ownership
		const session = await getVoiceSessionByCallId(callId)
		if (!session) {
			return NextResponse.json(
				{ error: "Call session not found" },
				{ status: 404 }
			)
		}

		const result = await db_ws
			.update(leads)
			.set({
				status,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, session.userId) // Ensure user ownership
				)
			)
			.returning()

		if (result.length === 0) {
			return NextResponse.json(
				{ error: "Lead not found or access denied" },
				{ status: 404 }
			)
		}

		return NextResponse.json({
			message: `Lead status updated to ${status}`,
			lead: result[0]
		})
	} catch (error) {
		console.error("Error updating lead status:", error)
		return NextResponse.json(
			{ error: "Failed to update lead status" },
			{ status: 500 }
		)
	}
}

async function handleScheduleAppointment(
	parameters: Record<string, unknown>,
	callId?: string
) {
	try {
		const { leadId, dateTime, duration } =
			ScheduleAppointmentSchema.parse(parameters)

		// Get the voice session to validate user ownership
		const session = await getVoiceSessionByCallId(callId)
		if (!session) {
			return NextResponse.json(
				{ error: "Call session not found" },
				{ status: 404 }
			)
		}

		// Parse the date time
		const startTime = new Date(dateTime)
		if (Number.isNaN(startTime.getTime())) {
			return NextResponse.json(
				{ error: "Invalid date format" },
				{ status: 400 }
			)
		}

		// Calculate end time based on duration
		const durationMinutes = duration.includes("hour") ? 60 : 30 // Simple parsing
		const endTime = new Date(
			startTime.getTime() + durationMinutes * 60 * 1000
		)

		// Check if lead exists and belongs to the user
		const lead = await db_ws
			.select()
			.from(leads)
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, session.userId)
				)
			)
			.limit(1)

		if (lead.length === 0) {
			return NextResponse.json(
				{ error: "Lead not found or access denied" },
				{ status: 404 }
			)
		}

		// Create appointment
		const result = await db_ws
			.insert(appointments)
			.values({
				leadId: Number.parseInt(leadId),
				title: `Appointment with ${lead[0].name}`,
				startTime,
				endTime,
				userId: session.userId
			})
			.returning()

		return NextResponse.json({
			message: "Appointment scheduled successfully",
			appointment: result[0]
		})
	} catch (error) {
		console.error("Error scheduling appointment:", error)
		return NextResponse.json(
			{ error: "Failed to schedule appointment" },
			{ status: 500 }
		)
	}
}

async function handleAddNoteToLead(
	parameters: Record<string, unknown>,
	callId?: string
) {
	try {
		const { leadId, note } = AddNoteToLeadSchema.parse(parameters)

		// Get the voice session to validate user ownership
		const session = await getVoiceSessionByCallId(callId)
		if (!session) {
			return NextResponse.json(
				{ error: "Call session not found" },
				{ status: 404 }
			)
		}

		// Get current notes and append new note
		const lead = await db_ws
			.select()
			.from(leads)
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, session.userId)
				)
			)
			.limit(1)

		if (lead.length === 0) {
			return NextResponse.json(
				{ error: "Lead not found or access denied" },
				{ status: 404 }
			)
		}

		const currentNotes = lead[0].notes || ""
		const timestamp = new Date().toISOString()
		const newNote = `[${timestamp}] Voice Agent: ${note}`
		const updatedNotes = currentNotes
			? `${currentNotes}\n${newNote}`
			: newNote

		// Update lead with new note
		const result = await db_ws
			.update(leads)
			.set({
				notes: updatedNotes,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, session.userId)
				)
			)
			.returning()

		return NextResponse.json({
			message: "Note added successfully",
			lead: result[0]
		})
	} catch (error) {
		console.error("Error adding note to lead:", error)
		return NextResponse.json(
			{ error: "Failed to add note" },
			{ status: 500 }
		)
	}
}

// Helper function to get voice session by Vapi call ID
async function getVoiceSessionByCallId(callId?: string) {
	if (!callId) return null

	const sessions = await db_ws
		.select()
		.from(voiceSessions)
		.where(eq(voiceSessions.sessionId, callId))
		.limit(1)

	return sessions[0] || null
}

// Enhanced call event handlers
async function handleCallStarted(callData: VapiCallData) {
	try {
		console.log("Call started:", callData)

		// Find the voice agent by assistant ID or phone number
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				eq(voiceAgents.id, Number.parseInt(callData.assistantId || "0"))
			)
			.limit(1)

		if (agent.length === 0) {
			console.warn("No voice agent found for call:", callData.id)
			return
		}

		// Try to find or create lead based on phone number
		let leadId = null
		if (callData.customer?.number) {
			const existingLead = await db_ws
				.select()
				.from(leads)
				.where(
					and(
						eq(leads.phone, callData.customer.number),
						eq(leads.userId, agent[0].userId)
					)
				)
				.limit(1)

			if (existingLead.length > 0) {
				leadId = existingLead[0].id
			} else {
				// Create new lead
				const newLead = await db_ws
					.insert(leads)
					.values({
						name: "Unknown Caller",
						phone: callData.customer.number,
						source: "Voice Agent Call",
						userId: agent[0].userId
					})
					.returning()

				leadId = newLead[0].id
			}
		}

		// Create voice session
		const sessionData = {
			sessionId: callData.id,
			agentId: agent[0].id,
			leadId,
			phoneNumber: callData.customer?.number,
			direction:
				callData.type === "inbound"
					? ("incoming" as const)
					: ("outgoing" as const),
			status: "active" as const,
			startTime: callData.started_at
				? new Date(callData.started_at)
				: new Date(),
			metadata: callData.metadata || {},
			userId: agent[0].userId
		}

		await db_ws.insert(voiceSessions).values(sessionData)

		// Also create entry in calls table for compatibility
		if (leadId) {
			await db_ws.insert(calls).values({
				leadId,
				type:
					callData.type === "inbound"
						? ("incoming" as const)
						: ("outgoing" as const),
				startTime: sessionData.startTime,
				status: "active",
				userId: agent[0].userId
			})
		}

		console.log("Voice session created successfully")
	} catch (error) {
		console.error("Error handling call started:", error)
	}
}

async function handleCallEnded(callData: VapiCallData) {
	try {
		console.log("Call ended:", callData)

		const endTime = callData.ended_at
			? new Date(callData.ended_at)
			: new Date()
		const startTime = callData.started_at
			? new Date(callData.started_at)
			: null
		const duration = startTime
			? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
			: null

		// Update voice session
		const sessionResult = await db_ws
			.update(voiceSessions)
			.set({
				status: "completed",
				endTime,
				duration,
				transcript: callData.transcript,
				summary: callData.summary,
				sentiment: callData.analysis?.sentiment,
				recordingUrl: callData.recording_url,
				cost: callData.cost?.toString(),
				updatedAt: new Date()
			})
			.where(eq(voiceSessions.sessionId, callData.id))
			.returning()

		if (sessionResult.length > 0) {
			const session = sessionResult[0]

			// Update corresponding call record if it exists
			if (session.leadId) {
				await db_ws
					.update(calls)
					.set({
						duration,
						summary: callData.summary,
						transcript: callData.transcript,
						recordingUrl: callData.recording_url,
						status: "completed",
						updatedAt: new Date()
					})
					.where(
						and(
							eq(calls.leadId, session.leadId),
							eq(calls.startTime, session.startTime)
						)
					)

				// Post-call actions: Update lead score and notes
				await performPostCallActions(session, callData)
			}
		}

		console.log("Call session updated successfully")
	} catch (error) {
		console.error("Error handling call ended:", error)
	}
}

async function performPostCallActions(
	session: typeof voiceSessions.$inferSelect,
	callData: VapiCallData
) {
	try {
		if (!session.leadId) return

		// Auto-generate sentiment-based lead score adjustment
		let scoreAdjustment = 0
		if (callData.analysis?.sentiment === "positive") {
			scoreAdjustment = 10
		} else if (callData.analysis?.sentiment === "negative") {
			scoreAdjustment = -5
		}

		// Get current lead
		const lead = await db_ws
			.select()
			.from(leads)
			.where(eq(leads.id, session.leadId))
			.limit(1)

		if (lead.length > 0) {
			const currentScore = lead[0].score || 0
			const newScore = Math.max(
				0,
				Math.min(100, currentScore + scoreAdjustment)
			)

			// Update lead with call summary note and score
			const callSummaryNote = `[${new Date().toISOString()}] Call completed (${session.duration}s): ${callData.summary || "No summary available"}`
			const updatedNotes = lead[0].notes
				? `${lead[0].notes}\n${callSummaryNote}`
				: callSummaryNote

			await db_ws
				.update(leads)
				.set({
					score: newScore,
					notes: updatedNotes,
					status:
						session.duration && session.duration > 30
							? "contacted"
							: "new",
					updatedAt: new Date()
				})
				.where(eq(leads.id, session.leadId))
		}

		console.log("Post-call actions completed")
	} catch (error) {
		console.error("Error in post-call actions:", error)
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		console.log("Vapi webhook received:", JSON.stringify(body, null, 2))

		// Parse the webhook event
		const event = VapiWebhookEventSchema.parse(body)

		// Handle different event types
		switch (event.type) {
			case "call-start":
				await handleCallStarted(event.call as VapiCallData)
				break

			case "call-end":
				await handleCallEnded(event.call as VapiCallData)
				break

			case "function-call":
				if (event.message?.functionCall) {
					const { name, parameters } = event.message.functionCall
					const callId = event.call?.id

					switch (name) {
						case "updateLeadStatus":
							return await handleUpdateLeadStatus(
								parameters,
								callId
							)

						case "scheduleAppointment":
							return await handleScheduleAppointment(
								parameters,
								callId
							)

						case "addNoteToLead":
							return await handleAddNoteToLead(parameters, callId)

						default:
							console.warn(`Unknown function call: ${name}`)
							return NextResponse.json(
								{ error: `Unknown function: ${name}` },
								{ status: 400 }
							)
					}
				}
				break

			case "transcript":
				// Handle real-time transcript updates if needed
				console.log(
					"Transcript update received:",
					event.message?.transcript
				)
				break

			case "hang":
				// Handle call hang up events
				console.log("Call hang event:", event.call?.id)
				break

			case "speech-start":
			case "speech-end":
				// Handle speech detection events for real-time UI updates
				console.log(`Speech event: ${event.type}`)
				break

			default:
				console.log(`Unhandled event type: ${event.type}`)
		}

		return NextResponse.json({
			message: "Webhook processed successfully",
			type: event.type,
			timestamp: new Date().toISOString()
		})
	} catch (error) {
		console.error("Error processing Vapi webhook:", error)
		return NextResponse.json(
			{ error: "Failed to process webhook" },
			{ status: 500 }
		)
	}
}

// Handle GET requests (for webhook verification if needed)
export async function GET() {
	return NextResponse.json({
		message: "Vapi webhook endpoint is active",
		timestamp: new Date().toISOString(),
		version: "2.0"
	})
}
