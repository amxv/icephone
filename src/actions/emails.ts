"use server"

import { db_ws } from "@/db"
import { communicationTypeEnum, emails, leads } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { getCloudflareContext } from "@opennextjs/cloudflare" // Import for env variables
import { type SQL, and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"

// Define types for filtering
type EmailFilter = {
	search?: string
	// Add other email-specific filters if needed, e.g., status: string[]
	startDate?: Date
	endDate?: Date
	orderBy?: string
	orderDir?: "asc" | "desc"
}

// This will be dynamically checked against the logged-in user
// const OWNER_USER_ID_FOR_MOCKS = "user_2vx9o0H7QqTrKPBERPN4CfZOUxD";

const MOCK_EMAILS = [
	{
		id: 1001,
		leadId: 1,
		leadName: "Ashray Owner (Mock)",
		type: "outgoing" as const,
		subject: "Mock: Following up on our conversation",
		content:
			"Hi Ashray, this is a mock email. Just wanted to follow up on our call from last week. Let me know if you have any questions about the proposal.",
		sentAt: new Date("2023-07-15T10:30:00Z"),
		openedAt: new Date("2023-07-15T12:00:00Z"),
		clickedAt: null,
		createdAt: new Date("2023-07-15T10:30:00Z"),
		updatedAt: new Date("2023-07-15T10:30:00Z")
		// userId will be set dynamically to OWNER_USER_ID from env for association
	},
	{
		id: 1002,
		leadId: 2,
		leadName: "Sarah Developer (Mock)",
		type: "incoming" as const,
		subject: "Mock: Re: Your recent inquiry",
		content:
			"Hello team, this is a mock email. Thank you for reaching out. I've reviewed the information and would like to schedule a demo.",
		sentAt: new Date("2023-07-16T14:00:00Z"),
		openedAt: null,
		clickedAt: null,
		createdAt: new Date("2023-07-16T14:00:00Z"),
		updatedAt: new Date("2023-07-16T14:00:00Z")
	},
	{
		id: 1003,
		leadId: 1,
		leadName: "Ashray Owner (Mock)",
		type: "outgoing" as const,
		subject: "Mock: Quick Question about requirements",
		content:
			"Hi Ashray, another mock email. Hope you're having a great week. I had a quick question regarding the integration points.",
		sentAt: new Date("2023-07-18T09:00:00Z"),
		openedAt: new Date("2023-07-18T09:30:00Z"),
		clickedAt: new Date("2023-07-18T09:35:00Z"),
		createdAt: new Date("2023-07-18T09:00:00Z"),
		updatedAt: new Date("2023-07-18T09:00:00Z")
	}
]

// Get all emails with optional filtering
export async function getEmails(filter: EmailFilter = {}) {
	console.log(
		"getEmails v2 called with filter:",
		JSON.stringify(filter, null, 2)
	)
	try {
		const { userId: currentUserId } = await auth()
		const cloudflareEnv = getCloudflareContext()?.env
		const OWNER_USER_ID =
			(cloudflareEnv?.OWNER_USER_ID as string | undefined) ||
			"user_2vx9o0H7QqTrKPBERPN4CfZOUxD" // Fallback for local dev if needed

		console.log("Current User ID from auth():", currentUserId)
		console.log("OWNER_USER_ID from env (or fallback):", OWNER_USER_ID)

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

		let emailsData = await query
		console.log(`Database query returned ${emailsData.length} emails.`)

		if (emailsData.length === 0 && currentUserId === OWNER_USER_ID) {
			console.log(
				"DB empty & user is OWNER. Using mock data, assigning OWNER_USER_ID to mocks."
			)

			const _mocks_with_owner_id = MOCK_EMAILS.map((m) => ({
				...m,
				userId: OWNER_USER_ID
			}))
			let filteredMockEmails = _mocks_with_owner_id

			if (filter.search) {
				const searchLower = filter.search.toLowerCase()
				console.log("Applying search to mock emails:", searchLower)
				filteredMockEmails = filteredMockEmails.filter(
					(email) =>
						email.leadName?.toLowerCase().includes(searchLower) ||
						email.subject?.toLowerCase().includes(searchLower) ||
						email.content?.toLowerCase().includes(searchLower)
				)
			}
			if (filter.startDate) {
				const startDate = filter.startDate
				console.log("Applying start date to mock emails:", startDate)
				filteredMockEmails = filteredMockEmails.filter(
					(email) => email.sentAt >= startDate
				)
			}
			if (filter.endDate) {
				const endDate = filter.endDate
				console.log("Applying end date to mock emails:", endDate)
				filteredMockEmails = filteredMockEmails.filter(
					(email) => email.sentAt <= endDate
				)
			}
			console.log(
				`${filteredMockEmails.length} mock emails remaining after all filters.`
			)

			emailsData = filteredMockEmails.map((mock) => ({
				id: mock.id,
				leadId: mock.leadId,
				leadName: mock.leadName,
				sentAt: mock.sentAt,
				summary: mock.subject,
				createdAt: mock.createdAt,
				updatedAt: mock.updatedAt,
				userId: mock.userId // This will be the OWNER_USER_ID
			}))
			console.log(
				"Final mock emailsData for OWNER:",
				JSON.stringify(emailsData, null, 2)
			)
		}

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
	console.log(`getEmailById v2 called for emailId: ${emailId}`)
	try {
		const { userId: currentUserId } = await auth()
		const cloudflareEnv = getCloudflareContext()?.env
		const OWNER_USER_ID =
			(cloudflareEnv?.OWNER_USER_ID as string | undefined) ||
			"user_2vx9o0H7QqTrKPBERPN4CfZOUxD" // Fallback for local dev

		console.log(
			"Current User ID from auth() in getEmailById:",
			currentUserId
		)
		console.log(
			"OWNER_USER_ID from env (or fallback) in getEmailById:",
			OWNER_USER_ID
		)

		if (!currentUserId) {
			console.log(
				"No currentUserId in getEmailById, returning Unauthorized."
			)
			return { success: false, error: "Unauthorized", data: null }
		}

		console.log("Executing database query for single email...")
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
				and(
					eq(emails.id, emailId)
					// eq(emails.userId, currentUserId) // Original user check, removed for now to allow owner access first
				)
			)
			.limit(1)

		if (emailDataResult && emailDataResult.length > 0) {
			// DB HAS EMAIL
			const emailFromDb = emailDataResult[0]
			console.log(
				"Found email in DB:",
				JSON.stringify(emailFromDb, null, 2)
			)

			// Authorization check: Does it belong to current user OR is current user the OWNER?
			if (
				emailFromDb.userId !== currentUserId &&
				currentUserId !== OWNER_USER_ID
			) {
				console.log(
					`Email ${emailId} found in DB but does not belong to user ${currentUserId} and user is not OWNER.`
				)
				return {
					success: false,
					error: "Email not found or access denied",
					data: null
				}
			}

			// User is authorized (either owner or it's their email)
			const responseData = {
				...emailFromDb,
				summary: emailFromDb.subject
			}
			return { success: true, data: responseData, error: null }
		}

		// DB IS EMPTY for this emailId (or for this user if a user check was in WHERE)
		console.log(`Email with ID ${emailId} not found in DB.`)
		if (currentUserId === OWNER_USER_ID) {
			// User is OWNER, try mocks
			console.log("User is OWNER. Attempting to use mock data.")
			const mockEmail = MOCK_EMAILS.find((e) => e.id === emailId)
			if (mockEmail) {
				console.log(
					"Found mock email for OWNER:",
					JSON.stringify(mockEmail, null, 2)
				)
				const mockEmailWithOwnerId = {
					...mockEmail,
					userId: OWNER_USER_ID // Ensure mock is associated with owner
				}
				return {
					success: true,
					data: {
						...mockEmailWithOwnerId,
						summary: mockEmailWithOwnerId.subject
					},
					error: null
				}
			}
			// Email not in mocks for OWNER
			console.log(
				`Email with ID ${emailId} also not found in mock data for OWNER.`
			)
			return {
				success: false,
				error: "Email not found (owner, not in mocks)",
				data: null
			}
		}

		// User is NOT OWNER, and DB is empty
		console.log("User is not OWNER and email not found in DB.")
		return { success: false, error: "Email not found", data: null }
	} catch (error) {
		console.error("Error in getEmailById:", error)
		const errorMessage =
			error instanceof Error
				? error.message
				: "Failed to retrieve email details"
		return {
			success: false,
			error: errorMessage,
			data: null
		}
	}
}
