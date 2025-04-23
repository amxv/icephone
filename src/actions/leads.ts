"use server"

import { db_ws } from "@/db"
import { appointments, calls, emails, leads, textMessages } from "@/db/schema"
import { auth, currentUser } from "@clerk/nextjs/server"
import { type SQL, and, asc, desc, eq, gte, lte, sql } from "drizzle-orm"
import type { PgSelect } from "drizzle-orm/pg-core"

// Define types for filtering
type LeadFilter = {
	search?: string
	status?: string[]
	minScore?: number
	maxScore?: number
	orderBy?: string
	orderDir?: "asc" | "desc"
}

// Get all leads with optional filtering
export async function getLeads(filter: LeadFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Collect where conditions
		const whereConditions: SQL[] = [eq(leads.userId, userId)]

		// Apply search filter
		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${leads.name} ILIKE ${searchPattern} OR ${leads.email} ILIKE ${searchPattern} OR ${leads.phone} ILIKE ${searchPattern})`
			)
		}

		// Filter by status
		if (filter.status && filter.status.length > 0) {
			whereConditions.push(
				sql`${leads.status} IN (${sql.join(filter.status)})`
			)
		}

		// Filter by score range
		if (filter.minScore !== undefined) {
			whereConditions.push(gte(leads.score, filter.minScore))
		}

		if (filter.maxScore !== undefined) {
			whereConditions.push(lte(leads.score, filter.maxScore))
		}

		// Create a single 'and' condition from all conditions
		const condition = and(...whereConditions)

		// Execute the query, handle sorting separately
		let leadsData = await db_ws.select().from(leads).where(condition)

		// Apply sorting in memory since we have all data
		if (filter.orderBy) {
			const orderColumn =
				filter.orderBy as keyof typeof leads.$inferSelect
			const orderDirection = filter.orderDir || "desc"

			leadsData = leadsData.sort((a, b) => {
				const valueA = a[orderColumn]
				const valueB = b[orderColumn]

				// Handle dates
				if (
					orderColumn === "createdAt" ||
					orderColumn === "updatedAt"
				) {
					const dateA = new Date(valueA as string).getTime()
					const dateB = new Date(valueB as string).getTime()
					return orderDirection === "asc"
						? dateA - dateB
						: dateB - dateA
				}

				// Handle strings
				if (typeof valueA === "string" && typeof valueB === "string") {
					return orderDirection === "asc"
						? valueA.localeCompare(valueB)
						: valueB.localeCompare(valueA)
				}

				// Handle numbers
				if (typeof valueA === "number" && typeof valueB === "number") {
					return orderDirection === "asc"
						? valueA - valueB
						: valueB - valueA
				}

				return 0
			})
		} else {
			// Default sort by updatedAt desc
			leadsData = leadsData.sort((a, b) => {
				const dateA = new Date(a.updatedAt).getTime()
				const dateB = new Date(b.updatedAt).getTime()
				return dateB - dateA
			})
		}

		return { data: leadsData, success: true, error: null }
	} catch (error) {
		console.error("Error getting leads:", error)
		return { error: "Failed to get leads", success: false, data: null }
	}
}

// Get a single lead by ID
export async function getLeadById(leadId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized" }
		}

		// Get the lead
		const lead = await db_ws
			.select()
			.from(leads)
			.where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
			.limit(1)

		if (!lead || lead.length === 0) {
			return { success: false, error: "Lead not found" }
		}

		// Get related appointments
		const leadAppointments = await db_ws
			.select()
			.from(appointments)
			.where(
				and(
					eq(appointments.leadId, leadId),
					eq(appointments.userId, userId)
				)
			)
			.orderBy(desc(appointments.startTime))

		// Get related calls
		const leadCalls = await db_ws
			.select()
			.from(calls)
			.where(and(eq(calls.leadId, leadId), eq(calls.userId, userId)))
			.orderBy(desc(calls.startTime))

		// Get related text messages
		const leadTextMessages = await db_ws
			.select()
			.from(textMessages)
			.where(
				and(
					eq(textMessages.leadId, leadId),
					eq(textMessages.userId, userId)
				)
			)
			.orderBy(desc(textMessages.sentAt))

		// Get related emails
		const leadEmails = await db_ws
			.select()
			.from(emails)
			.where(and(eq(emails.leadId, leadId), eq(emails.userId, userId)))
			.orderBy(desc(emails.sentAt))

		return {
			success: true,
			data: {
				lead: lead[0],
				appointments: leadAppointments,
				calls: leadCalls,
				textMessages: leadTextMessages,
				emails: leadEmails
			}
		}
	} catch (error) {
		console.error("Error getting lead details:", error)
		return { success: false, error: "Failed to retrieve lead details" }
	}
}

// Create a new lead
export async function createLead(
	data: Omit<
		typeof leads.$inferInsert,
		"id" | "createdAt" | "updatedAt" | "userId"
	>
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const result = await db_ws
			.insert(leads)
			.values({
				...data,
				userId
			})
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error creating lead:", error)
		return { error: "Failed to create lead", success: false, data: null }
	}
}

// Update an existing lead
export async function updateLead(
	id: number,
	data: Partial<
		Omit<typeof leads.$inferInsert, "id" | "createdAt" | "userId">
	>
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const result = await db_ws
			.update(leads)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(and(eq(leads.id, id), eq(leads.userId, userId)))
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Lead not found or update failed",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error updating lead:", error)
		return { error: "Failed to update lead", success: false, data: null }
	}
}

// Delete a lead
export async function deleteLead(id: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const result = await db_ws
			.delete(leads)
			.where(and(eq(leads.id, id), eq(leads.userId, userId)))
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Lead not found or delete failed",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error deleting lead:", error)
		return { error: "Failed to delete lead", success: false, data: null }
	}
}
