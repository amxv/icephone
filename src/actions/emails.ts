"use server"

import { db_ws } from "@/db"
import { communicationTypeEnum, emails, leads } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"

import { type SQL, and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"

// Define the email filter interface
export interface EmailFilter {
	search?: string
	startDate?: Date
	endDate?: Date
	orderBy?: "leadName" | "sentAt" | "summary"
	orderDir?: "asc" | "desc"
}

// Get all emails with optional filtering
export async function getEmails(filter: EmailFilter = {}) {
	console.log(
		"getEmails called with filter:",
		JSON.stringify(filter, null, 2)
	)
	try {
		const { userId: currentUserId } = await auth()

		console.log("Current User ID from auth():", currentUserId)

		if (!currentUserId) {
			console.log("No currentUserId, returning Unauthorized.")
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [eq(emails.userId, currentUserId)]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			console.log("Applying search filter with pattern:", searchPattern)

			const combinedSearchCondition = or(
				sql`${emails.subject} ilike ${searchPattern}`,
				sql`${emails.content} ilike ${searchPattern}`,
				sql`EXISTS (SELECT 1 FROM ${leads} WHERE ${leads.id} = ${emails.leadId} AND ${leads.name} ilike ${searchPattern})`
			)
			if (combinedSearchCondition) {
				whereConditions.push(combinedSearchCondition)
			}
		}

		if (filter.startDate) {
			console.log("Applying start date filter:", filter.startDate)
			whereConditions.push(gte(emails.sentAt, filter.startDate))
		}

		if (filter.endDate) {
			console.log("Applying end date filter:", filter.endDate)
			whereConditions.push(lte(emails.sentAt, filter.endDate))
		}

		console.log("Executing database query for emails...")
		const query = db_ws
			.select({
				id: emails.id,
				leadId: emails.leadId,
				leadName: leads.name,
				sentAt: emails.sentAt,
				summary: emails.subject,
				createdAt: emails.createdAt,
				updatedAt: emails.updatedAt,
				userId: emails.userId
			})
			.from(emails)
			.leftJoin(leads, eq(emails.leadId, leads.id))
			.where(and(...whereConditions))

		const orderByField = filter.orderBy || "sentAt"
		const orderDirection = filter.orderDir === "asc" ? "asc" : "desc"

		if (orderByField === "leadName" && leads.name) {
			query.orderBy(
				orderDirection === "asc" ? leads.name : desc(leads.name)
			)
		} else if (orderByField === "sentAt" && emails.sentAt) {
			query.orderBy(
				orderDirection === "asc" ? emails.sentAt : desc(emails.sentAt)
			)
		} else if (orderByField === "summary" && emails.subject) {
			query.orderBy(
				orderDirection === "asc" ? emails.subject : desc(emails.subject)
			)
		} else {
			query.orderBy(desc(emails.sentAt))
		}

		const emailsData = await query
		console.log(`Database query returned ${emailsData.length} emails.`)

		return { data: emailsData, success: true, error: null }
	} catch (error) {
		console.error("Error in getEmails:", error)
		const errorMessage =
			error instanceof Error ? error.message : "Failed to get emails"
		return { error: errorMessage, success: false, data: null }
	}
}

// Get a single email by ID
export async function getEmailById(emailId: number) {
	console.log(`getEmailById called for emailId: ${emailId}`)
	try {
		const { userId: currentUserId } = await auth()

		console.log("Current User ID from auth():", currentUserId)

		if (!currentUserId) {
			console.log("No currentUserId, returning Unauthorized.")
			return {
				success: false,
				error: "Unauthorized",
				data: null
			}
		}

		console.log("Querying database for email with ID:", emailId)
		const emailDataResult = await db_ws
			.select({
				id: emails.id,
				leadId: emails.leadId,
				leadName: leads.name,
				type: emails.type,
				subject: emails.subject,
				content: emails.content,
				sentAt: emails.sentAt,
				openedAt: emails.openedAt,
				clickedAt: emails.clickedAt,
				createdAt: emails.createdAt,
				updatedAt: emails.updatedAt,
				userId: emails.userId
			})
			.from(emails)
			.leftJoin(leads, eq(emails.leadId, leads.id))
			.where(
				and(eq(emails.id, emailId), eq(emails.userId, currentUserId))
			)
			.limit(1)

		if (emailDataResult && emailDataResult.length > 0) {
			const emailFromDb = emailDataResult[0]
			console.log(
				"Found email in DB:",
				JSON.stringify(emailFromDb, null, 2)
			)

			const responseData = {
				...emailFromDb,
				summary: emailFromDb.subject
			}
			return { success: true, data: responseData, error: null }
		}

		console.log(`Email with ID ${emailId} not found in database.`)
		return { success: false, error: "Email not found", data: null }
	} catch (error) {
		console.error("Error in getEmailById:", error)
		const errorMessage =
			error instanceof Error ? error.message : "Failed to get email"
		return { success: false, error: errorMessage, data: null }
	}
}
