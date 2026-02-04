"use server"

import { currentUser } from "@/lib/auth/session"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db_ws as db } from "@/db/index"
import { appointments } from "@/db/schema"
import type { IEvent, IUser } from "@/lib/calendar/interfaces"
import type { TEventColor } from "@/lib/calendar/types"

// Helper to simulate user data for IEvent, as we don't store full user objects with events
// In a real app, you might fetch minimal user details if needed or adjust IEvent
const getCurrentUserAsIUser = async (): Promise<IUser | null> => {
	const user = await currentUser()
	if (!user) return null
	return {
		id: user.id,
		name: user.name || user.email || "Unnamed User",
		picturePath: user.image || null
	}
}

// Helper to transform DB appointment to IEvent
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
		color: color, // Default color, can be customized later
		user: user
	}
}

export async function getAppointments(): Promise<IEvent[]> {
	const user = await getCurrentUserAsIUser()
	if (!user) {
		console.error("User not authenticated")
		return []
	}

	try {
		const userAppointments = await db
			.select()
			.from(appointments)
			.where(eq(appointments.userId, user.id))
			.orderBy(appointments.startTime)

		return userAppointments.map((app: typeof appointments.$inferSelect) =>
			transformToIEvent(app, user)
		)
	} catch (error) {
		console.error("Error fetching appointments:", error)
		return []
	}
}

interface AppointmentInput {
	title: string
	startDate: string // ISO string
	endDate: string // ISO string
	description?: string
	location?: string
	leadId?: number | null
	// color?: TEventColor; // Color can be added later if needed
}

export async function createAppointment(
	data: AppointmentInput
): Promise<IEvent | { error: string }> {
	const user = await getCurrentUserAsIUser()
	if (!user) {
		return { error: "User not authenticated" }
	}

	try {
		const [newAppointment] = await db
			.insert(appointments)
			.values({
				...data,
				startTime: new Date(data.startDate),
				endTime: new Date(data.endDate),
				userId: user.id,
				leadId: data.leadId === undefined ? null : data.leadId, // Handle undefined leadId
				description: data.description || null, // ensure null if undefined
				location: data.location || null // ensure null if undefined
			})
			.returning()

		if (!newAppointment) {
			return { error: "Failed to create appointment" }
		}
		revalidatePath("/appointments")
		return transformToIEvent(newAppointment, user)
	} catch (error) {
		console.error("Error creating appointment:", error)
		return { error: "Failed to create appointment" }
	}
}

export async function updateAppointment(
	id: number,
	data: Partial<AppointmentInput>
): Promise<IEvent | { error: string }> {
	const user = await getCurrentUserAsIUser()
	if (!user) {
		return { error: "User not authenticated" }
	}

	try {
		const updateData: Partial<typeof appointments.$inferInsert> = {}
		if (data.title) updateData.title = data.title
		if (data.description) updateData.description = data.description
		if (data.startDate) updateData.startTime = new Date(data.startDate)
		if (data.endDate) updateData.endTime = new Date(data.endDate)
		if (data.location) updateData.location = data.location
		if (data.leadId !== undefined) updateData.leadId = data.leadId
		// Ensure updatedAt is updated
		updateData.updatedAt = new Date()

		const [updatedAppointment] = await db
			.update(appointments)
			.set(updateData)
			.where(
				and(eq(appointments.id, id), eq(appointments.userId, user.id))
			)
			.returning()

		if (!updatedAppointment) {
			return { error: "Appointment not found or failed to update" }
		}
		revalidatePath("/appointments")
		return transformToIEvent(updatedAppointment, user)
	} catch (error) {
		console.error("Error updating appointment:", error)
		return { error: "Failed to update appointment" }
	}
}

export async function deleteAppointment(
	id: number
): Promise<{ success: boolean; error?: string }> {
	const user = await getCurrentUserAsIUser()
	if (!user) {
		return { success: false, error: "User not authenticated" }
	}

	try {
		const result = await db
			.delete(appointments)
			.where(
				and(eq(appointments.id, id), eq(appointments.userId, user.id))
			)
			.returning({ id: appointments.id })

		if (result.length === 0) {
			return {
				success: false,
				error: "Appointment not found or failed to delete"
			}
		}
		revalidatePath("/appointments")
		return { success: true }
	} catch (error) {
		console.error("Error deleting appointment:", error)
		return { success: false, error: "Failed to delete appointment" }
	}
}
