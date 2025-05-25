import { db_ws } from "@/db"
import { leads, appointments, tasks } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { ScheduleAppointmentSchema, CreateTaskSchema } from "../schemas"
import { logLeadInteraction } from "../utils"
import { z } from "zod"

// Schedule Appointment Tool - allows voice agents to schedule appointments with leads
export async function scheduleAppointment(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const validated = ScheduleAppointmentSchema.parse(parameters)
		const {
			leadId,
			title,
			dateTime,
			duration,
			description,
			location,
			timeZone
		} = validated

		// Parse and validate the appointment date/time
		const startTime = new Date(dateTime)
		if (Number.isNaN(startTime.getTime())) {
			return {
				toolCallId,
				result: "Invalid date format provided. Please use ISO format (e.g., '2024-01-15T14:30:00Z')."
			}
		}

		// Check if the appointment is in the past
		if (startTime < new Date()) {
			return {
				toolCallId,
				result: "Cannot schedule appointments in the past. Please provide a future date and time."
			}
		}

		// Calculate end time
		const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

		// Verify the lead exists and belongs to the user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			await logLeadInteraction(
				Number.parseInt(leadId),
				"appointment_schedule_failed",
				"vapi_tool",
				toolCallId,
				null,
				{ error: "Lead not found" },
				{
					toolCallId,
					leadId: Number.parseInt(leadId),
					success: false,
					error: "Lead not found or access denied"
				},
				userId
			)

			return {
				toolCallId,
				result: `Lead with ID ${leadId} not found or you don't have access to it.`
			}
		}

		// Check for scheduling conflicts (optional - basic overlap check)
		const conflictingAppointments = await db_ws.query.appointments.findMany(
			{
				where: and(
					eq(appointments.userId, userId),
					// Check for time overlap
					sql`(
					(${appointments.startTime} <= ${startTime} AND ${appointments.endTime} > ${startTime}) OR
					(${appointments.startTime} < ${endTime} AND ${appointments.endTime} >= ${endTime}) OR
					(${appointments.startTime} >= ${startTime} AND ${appointments.endTime} <= ${endTime})
				)`
				)
			}
		)

		if (conflictingAppointments.length > 0) {
			const conflictTime =
				conflictingAppointments[0].startTime.toLocaleString()
			return {
				toolCallId,
				result: `Scheduling conflict detected. You already have an appointment at ${conflictTime}. Please choose a different time.`
			}
		}

		// Import the appointment creation function
		const { createAppointment } = await import(
			"@/actions/appointmentActions"
		)

		// Create the appointment
		const appointmentData = {
			title,
			startDate: startTime.toISOString(),
			endDate: endTime.toISOString(),
			description: description || `Appointment with ${lead.name}`,
			location: location || undefined,
			leadId: Number.parseInt(leadId)
		}

		const result = await createAppointment(appointmentData)

		if ("error" in result) {
			await logLeadInteraction(
				Number.parseInt(leadId),
				"appointment_schedule_failed",
				"vapi_tool",
				toolCallId,
				null,
				{ error: result.error },
				{
					toolCallId,
					leadId: Number.parseInt(leadId),
					appointmentData,
					success: false,
					error: result.error
				},
				userId
			)

			return {
				toolCallId,
				result: `Failed to schedule appointment: ${result.error}`
			}
		}

		// Log the successful appointment creation
		await logLeadInteraction(
			Number.parseInt(leadId),
			"appointment_scheduled",
			"vapi_tool",
			toolCallId,
			null,
			{
				appointmentId: result.id,
				title,
				startTime: startTime.toISOString(),
				endTime: endTime.toISOString(),
				duration
			},
			{
				toolCallId,
				leadId: Number.parseInt(leadId),
				appointmentId: result.id,
				success: true,
				appointmentDetails: {
					title,
					startTime: startTime.toISOString(),
					endTime: endTime.toISOString(),
					duration,
					location,
					description
				}
			},
			userId
		)

		// Format success response for voice agent
		const formattedStartTime = startTime.toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short"
		})

		let successMessage = `Successfully scheduled appointment "${title}" with ${lead.name} for ${formattedStartTime}.`

		if (duration !== 60) {
			successMessage += ` Duration: ${duration} minutes.`
		}

		if (location) {
			successMessage += ` Location: ${location}.`
		}

		successMessage +=
			" The appointment has been added to your calendar and the lead will be notified."

		return { toolCallId, result: successMessage }
	} catch (error) {
		console.error("Error scheduling appointment:", error)

		// Log the error
		await logLeadInteraction(
			parameters.leadId ? Number.parseInt(String(parameters.leadId)) : 0,
			"appointment_schedule_failed",
			"vapi_tool",
			toolCallId,
			null,
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{
				toolCallId,
				leadId: parameters.leadId
					? Number.parseInt(String(parameters.leadId))
					: 0,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				parameters
			},
			userId
		)

		return {
			toolCallId,
			result: `Failed to schedule appointment: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}

export async function createTask(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const {
			leadId,
			title,
			description,
			dueDate,
			priority,
			taskType,
			assignedTo
		} = CreateTaskSchema.parse(parameters)

		// Verify lead exists and belongs to user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Create task
		const [task] = await db_ws
			.insert(tasks)
			.values({
				leadId: Number.parseInt(leadId),
				title,
				description,
				dueDate: dueDate ? new Date(dueDate) : undefined,
				priority,
				taskType,
				assignedTo: assignedTo || userId,
				createdBy: userId,
				userId,
				status: "pending",
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		// Log the interaction
		await logLeadInteraction(
			Number.parseInt(leadId),
			"task_created",
			"vapi_tool",
			toolCallId,
			null,
			{
				taskId: task.id,
				title: task.title,
				priority: task.priority,
				taskType: task.taskType,
				dueDate: task.dueDate?.toISOString()
			},
			{
				toolCall: "createTask",
				description: task.description
			},
			userId
		)

		const dueDateStr = task.dueDate
			? ` with due date ${task.dueDate.toLocaleDateString()}`
			: ""

		return {
			toolCallId,
			result: `Successfully created ${task.priority} priority ${task.taskType} task "${task.title}"${dueDateStr} for ${lead.name}. Task ID: ${task.id}`
		}
	} catch (error) {
		console.error("Error creating task:", error)
		return {
			toolCallId,
			result: `Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}

// Add setReminder function
export async function setReminder(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, reminderDate, reminderType, notes } = z
			.object({
				leadId: z.string(),
				reminderDate: z.string(),
				reminderType: z.enum(["call", "email", "follow_up", "meeting"]),
				notes: z.string().optional()
			})
			.parse(parameters)

		// Verify lead exists and belongs to user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Create reminder task
		const reminderTask = await db_ws
			.insert(tasks)
			.values({
				leadId: Number.parseInt(leadId),
				title: `${reminderType.charAt(0).toUpperCase() + reminderType.slice(1)} reminder for ${lead.name}`,
				description:
					notes || `Reminder to ${reminderType} ${lead.name}`,
				priority: "medium",
				taskType: reminderType === "follow_up" ? "follow_up" : "call",
				assignedTo: userId,
				createdBy: userId,
				userId,
				status: "pending",
				dueDate: new Date(reminderDate),
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		// Log the interaction
		await logLeadInteraction(
			Number.parseInt(leadId),
			"reminder_set",
			"vapi_tool",
			toolCallId,
			null,
			{
				taskId: reminderTask[0].id,
				reminderDate,
				reminderType,
				notes
			},
			{
				toolCall: "setReminder",
				leadName: lead.name
			},
			userId
		)

		const formattedDate = new Date(reminderDate).toLocaleDateString()
		return {
			toolCallId,
			result: `Reminder set successfully for ${lead.name} on ${formattedDate} to ${reminderType}. ${notes ? `Notes: ${notes}` : ""}`
		}
	} catch (error) {
		console.error("Error setting reminder:", error)
		return {
			toolCallId,
			result: `Failed to set reminder: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}
