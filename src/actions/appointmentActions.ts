"use server"

import { db_ws } from "@/db"
import { appointments, teamIntegrations } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import {
	cancelCalcomBooking,
	createCalcomBooking,
	rescheduleCalcomBooking
} from "@/lib/calcom"
import type { IEvent, IUser } from "@/lib/calendar/interfaces"
import type { TEventColor } from "@/lib/calendar/types"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const appointmentInputSchema = z.object({
	title: z.string().trim().min(2),
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	description: z.string().trim().optional(),
	location: z.string().trim().optional(),
	leadId: z.number().int().positive().nullable().optional(),
	attendee: z
		.object({
			name: z.string().trim().optional(),
			email: z.string().email().optional(),
			timeZone: z.string().optional(),
			phoneNumber: z.string().optional()
		})
		.optional()
})

const appointmentUpdateSchema = appointmentInputSchema.partial()
const appointmentIdSchema = z.number().int().positive()

interface CalcomBooking {
	id?: number
	uid?: string
	title?: string
	description?: string
	start?: string
	end?: string
	location?: string
	status?: string
}

interface CalcomResponse {
	status: "success" | "error"
	data?: CalcomBooking | CalcomBooking[]
	error?: unknown
}

type CalcomSettings = {
	eventTypeId?: number | string
	eventTypeSlug?: string
	teamSlug?: string
	username?: string
	organizationSlug?: string
	defaultTimeZone?: string
}

const getCurrentUserAsIUser = async (): Promise<IUser> => {
	const { user } = await requireTeam()
	return {
		id: user.id,
		name: user.name || user.email || "Unnamed User",
		picturePath: user.image || null
	}
}

const transformToIEvent = (
	appointment: typeof appointments.$inferSelect,
	user: IUser,
	color: TEventColor = "blue"
): IEvent => {
	return {
		id: appointment.id,
		title: appointment.title,
		description: appointment.description || undefined,
		startDate: appointment.startTime.toISOString(),
		endDate: appointment.endTime.toISOString(),
		location: appointment.location || undefined,
		color,
		user
	}
}

const pickBooking = (data?: CalcomBooking | CalcomBooking[]) => {
	if (!data) return null
	if (Array.isArray(data)) {
		return data[0] || null
	}
	return data
}

const getCalcomIntegration = async (teamId: string) => {
	const [integration] = await db_ws
		.select()
		.from(teamIntegrations)
		.where(
			and(
				eq(teamIntegrations.teamId, teamId),
				eq(teamIntegrations.provider, "calcom")
			)
		)
		.limit(1)
	return integration
}

const resolveCalcomSettings = (settings: Record<string, unknown> = {}) => {
	const typed = settings as CalcomSettings
	const envEventTypeId = process.env.CALCOM_EVENT_TYPE_ID
	const eventTypeId =
		typed.eventTypeId !== undefined && typed.eventTypeId !== null
			? Number(typed.eventTypeId)
			: envEventTypeId
				? Number(envEventTypeId)
				: undefined

	return {
		eventTypeId,
		eventTypeSlug:
			typed.eventTypeSlug || process.env.CALCOM_EVENT_TYPE_SLUG,
		teamSlug: typed.teamSlug || process.env.CALCOM_TEAM_SLUG,
		username: typed.username || process.env.CALCOM_USERNAME,
		organizationSlug:
			typed.organizationSlug || process.env.CALCOM_ORGANIZATION_SLUG,
		defaultTimeZone:
			typed.defaultTimeZone || process.env.CALCOM_DEFAULT_TIMEZONE
	}
}

const buildBookingTarget = (
	settings: ReturnType<typeof resolveCalcomSettings>
) => {
	if (settings.eventTypeId && !Number.isNaN(settings.eventTypeId)) {
		return { eventTypeId: settings.eventTypeId }
	}

	if (settings.eventTypeSlug && (settings.teamSlug || settings.username)) {
		return {
			eventTypeSlug: settings.eventTypeSlug,
			teamSlug: settings.teamSlug,
			username: settings.username,
			organizationSlug: settings.organizationSlug
		}
	}

	throw new Error("Cal.com event type configuration is missing")
}

const mapBookingStatus = (status?: string) => {
	if (!status) return "scheduled"
	if (status === "cancelled") return "cancelled"
	return "scheduled"
}

const getApiKey = (integration?: typeof teamIntegrations.$inferSelect) => {
	return integration?.apiKey || process.env.CALCOM_API_KEY || null
}

export async function getAppointments(): Promise<IEvent[]> {
	try {
		const { teamId } = await requireTeam()
		const user = await getCurrentUserAsIUser()

		const teamAppointments = await db_ws
			.select()
			.from(appointments)
			.where(eq(appointments.teamId, teamId))
			.orderBy(asc(appointments.startTime))

		return teamAppointments
			.filter((appointment) => appointment.status !== "cancelled")
			.map((appointment) => transformToIEvent(appointment, user))
	} catch (error) {
		console.error("Error fetching appointments:", error)
		return []
	}
}

export async function createAppointment(
	data: z.infer<typeof appointmentInputSchema>
): Promise<IEvent | { error: string }> {
	try {
		const payload = appointmentInputSchema.parse(data)
		const { teamId, user } = await requireTeam()
		const userInfo = await getCurrentUserAsIUser()

		const start = new Date(payload.startDate)
		const end = new Date(payload.endDate)
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			return { error: "Invalid appointment time" }
		}
		if (start >= end) {
			return { error: "Start time must be before end time" }
		}
		if (start < new Date()) {
			return { error: "Cannot schedule appointment in the past" }
		}

		const integration = await getCalcomIntegration(teamId)
		const apiKey = getApiKey(integration)
		if (!apiKey) {
			return { error: "Cal.com API key not configured" }
		}

		const settings = resolveCalcomSettings(
			(integration?.settings as Record<string, unknown>) || {}
		)
		const bookingTarget = buildBookingTarget(settings)
		const attendeeName =
			payload.attendee?.name || user.name || user.email || "Guest"
		const attendeeEmail = payload.attendee?.email || user.email
		if (!attendeeEmail) {
			return { error: "Attendee email is required for booking" }
		}
		const attendeeTimeZone =
			payload.attendee?.timeZone || settings.defaultTimeZone || "UTC"

		const lengthInMinutes = Math.max(
			1,
			Math.round((end.getTime() - start.getTime()) / 60000)
		)

		const calcomPayload: Record<string, unknown> = {
			start: start.toISOString(),
			attendee: {
				name: attendeeName,
				email: attendeeEmail,
				timeZone: attendeeTimeZone,
				phoneNumber: payload.attendee?.phoneNumber
			},
			lengthInMinutes,
			...bookingTarget,
			metadata: {
				title: payload.title,
				description: payload.description,
				location: payload.location,
				leadId: payload.leadId ?? null
			}
		}

		const calcomResponse = await createCalcomBooking<CalcomResponse>(
			apiKey,
			calcomPayload
		)

		if (calcomResponse.status !== "success") {
			return { error: "Failed to create booking in Cal.com" }
		}

		const booking = pickBooking(calcomResponse.data)
		if (!booking || !booking.uid) {
			return { error: "Cal.com booking response missing" }
		}

		const appointmentStart = booking.start ? new Date(booking.start) : start
		const appointmentEnd = booking.end ? new Date(booking.end) : end

		const [created] = await db_ws
			.insert(appointments)
			.values({
				teamId,
				leadId: payload.leadId ?? null,
				title: payload.title || booking.title || "Appointment",
				description: payload.description || booking.description || null,
				startTime: appointmentStart,
				endTime: appointmentEnd,
				location: payload.location || booking.location || null,
				status: mapBookingStatus(booking.status),
				calEventId: booking.id ? String(booking.id) : null,
				calBookingId: booking.uid,
				createdByUserId: user.id,
				userId: user.id,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "appointment.created",
			entityType: "appointment",
			entityId: created.id,
			metadata: {
				calBookingId: created.calBookingId,
				leadId: created.leadId
			}
		})

		revalidatePath("/appointments")
		return transformToIEvent(created, userInfo)
	} catch (error) {
		console.error("Error creating appointment:", error)
		return { error: "Failed to create appointment" }
	}
}

export async function updateAppointment(
	id: number,
	data: z.infer<typeof appointmentUpdateSchema>
): Promise<IEvent | { error: string }> {
	try {
		const appointmentId = appointmentIdSchema.parse(id)
		const payload = appointmentUpdateSchema.parse(data)
		const { teamId, user } = await requireTeam()
		const userInfo = await getCurrentUserAsIUser()

		const [appointment] = await db_ws
			.select()
			.from(appointments)
			.where(
				and(
					eq(appointments.id, appointmentId),
					eq(appointments.teamId, teamId)
				)
			)
			.limit(1)

		if (!appointment) {
			return { error: "Appointment not found" }
		}

		let updatedStart = appointment.startTime
		let updatedEnd = appointment.endTime
		let calBookingId = appointment.calBookingId
		let calEventId = appointment.calEventId

		if (payload.startDate || payload.endDate) {
			const start = payload.startDate
				? new Date(payload.startDate)
				: appointment.startTime
			const end = payload.endDate
				? new Date(payload.endDate)
				: appointment.endTime

			if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
				return { error: "Invalid appointment time" }
			}

			if (start >= end) {
				return { error: "Start time must be before end time" }
			}

			if (appointment.calBookingId) {
				const integration = await getCalcomIntegration(teamId)
				const apiKey = getApiKey(integration)
				if (!apiKey) {
					return { error: "Cal.com API key not configured" }
				}

				const calcomResponse =
					await rescheduleCalcomBooking<CalcomResponse>(
						apiKey,
						appointment.calBookingId,
						{
							start: start.toISOString(),
							rescheduledBy: user.email,
							reschedulingReason: payload.description
						}
					)

				if (calcomResponse.status !== "success") {
					return { error: "Failed to reschedule booking" }
				}

				const booking = pickBooking(calcomResponse.data)
				if (booking?.start) updatedStart = new Date(booking.start)
				if (booking?.end) updatedEnd = new Date(booking.end)
				if (booking?.uid) calBookingId = booking.uid
				if (booking?.id) calEventId = String(booking.id)
			} else {
				updatedStart = start
				updatedEnd = end
			}
		}

		const [updated] = await db_ws
			.update(appointments)
			.set({
				title: payload.title ?? appointment.title,
				description: payload.description ?? appointment.description,
				location: payload.location ?? appointment.location,
				startTime: updatedStart,
				endTime: updatedEnd,
				calBookingId,
				calEventId,
				updatedAt: new Date()
			})
			.where(eq(appointments.id, appointmentId))
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "appointment.updated",
			entityType: "appointment",
			entityId: appointmentId,
			metadata: {
				calBookingId: calBookingId
			}
		})

		revalidatePath("/appointments")
		return transformToIEvent(updated, userInfo)
	} catch (error) {
		console.error("Error updating appointment:", error)
		return { error: "Failed to update appointment" }
	}
}

export async function deleteAppointment(
	id: number
): Promise<{ success: boolean; error?: string }> {
	try {
		const appointmentId = appointmentIdSchema.parse(id)
		const { teamId, user } = await requireTeam()

		const [appointment] = await db_ws
			.select()
			.from(appointments)
			.where(
				and(
					eq(appointments.id, appointmentId),
					eq(appointments.teamId, teamId)
				)
			)
			.limit(1)

		if (!appointment) {
			return { success: false, error: "Appointment not found" }
		}

		if (appointment.calBookingId) {
			const integration = await getCalcomIntegration(teamId)
			const apiKey = getApiKey(integration)
			if (!apiKey) {
				return {
					success: false,
					error: "Cal.com API key not configured"
				}
			}

			await cancelCalcomBooking<CalcomResponse>(
				apiKey,
				appointment.calBookingId,
				{
					cancellationReason: "Cancelled via IcePhone"
				}
			)
		}

		await db_ws
			.delete(appointments)
			.where(eq(appointments.id, appointmentId))

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "appointment.deleted",
			entityType: "appointment",
			entityId: appointmentId,
			metadata: {
				calBookingId: appointment.calBookingId
			}
		})

		revalidatePath("/appointments")
		return { success: true }
	} catch (error) {
		console.error("Error deleting appointment:", error)
		return { success: false, error: "Failed to delete appointment" }
	}
}
