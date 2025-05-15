"use server"

import { db_ws } from "@/db"
import { calls, leads } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { type SQL, and, desc, eq, gte, lte, sql } from "drizzle-orm"

// Define types for filtering
type CallFilter = {
	search?: string
	type?: string[]
	status?: string[]
	startDate?: Date
	endDate?: Date
	orderBy?: string
	orderDir?: "asc" | "desc"
}

// Mock data for development and demonstration
const MOCK_CALLS = [
	{
		id: 1,
		leadId: 1,
		type: "outgoing" as const,
		duration: 124,
		startTime: new Date("2023-05-15T10:30:00"),
		summary: "Discussed product features and pricing options",
		transcript:
			"Hello, this is IcePhone calling about our latest offering...",
		recordingUrl: "https://example.com/recordings/call1.mp3",
		status: "answered",
		createdAt: new Date("2023-05-15T10:30:00"),
		updatedAt: new Date("2023-05-15T10:30:00"),
		userId: "user_123",
		leadName: "Ashray"
	},
	{
		id: 2,
		leadId: 1,
		type: "incoming" as const,
		duration: 67,
		startTime: new Date("2023-05-16T14:45:00"),
		summary: "Client requested follow-up on earlier demo",
		transcript: "Hi, I'm calling about the demo we had yesterday...",
		recordingUrl: "https://example.com/recordings/call2.mp3",
		status: "answered",
		createdAt: new Date("2023-05-16T14:45:00"),
		updatedAt: new Date("2023-05-16T14:45:00"),
		userId: "user_123",
		leadName: "Ashray"
	},
	{
		id: 3,
		leadId: 2,
		type: "outgoing" as const,
		duration: 0,
		startTime: new Date("2023-05-17T09:15:00"),
		summary: "No answer, left voicemail about product update",
		transcript: null,
		recordingUrl: "https://example.com/recordings/call3.mp3",
		status: "voicemail",
		createdAt: new Date("2023-05-17T09:15:00"),
		updatedAt: new Date("2023-05-17T09:15:00"),
		userId: "user_123",
		leadName: "Sarah Johnson"
	},
	{
		id: 4,
		leadId: 3,
		type: "outgoing" as const,
		duration: 0,
		startTime: new Date("2023-05-17T11:30:00"),
		summary: "Call failed to connect with lead",
		transcript: null,
		recordingUrl: null,
		status: "failed",
		createdAt: new Date("2023-05-17T11:30:00"),
		updatedAt: new Date("2023-05-17T11:30:00"),
		userId: "user_123",
		leadName: "Michael Torres"
	},
	{
		id: 5,
		leadId: 4,
		type: "incoming" as const,
		duration: 213,
		startTime: new Date("2023-05-18T15:00:00"),
		summary: "Lead asked for pricing details and implementation",
		transcript: "I'd like to know more about your pricing structure...",
		recordingUrl: "https://example.com/recordings/call5.mp3",
		status: "answered",
		createdAt: new Date("2023-05-18T15:00:00"),
		updatedAt: new Date("2023-05-18T15:00:00"),
		userId: "user_123",
		leadName: "Emily Chen"
	},
	{
		id: 6,
		leadId: 5,
		type: "outgoing" as const,
		duration: 0,
		startTime: new Date("2023-05-19T10:00:00"),
		summary: "Lead was unavailable, phone was busy",
		transcript: null,
		recordingUrl: null,
		status: "busy",
		createdAt: new Date("2023-05-19T10:00:00"),
		updatedAt: new Date("2023-05-19T10:00:00"),
		userId: "user_123",
		leadName: "David Wilson"
	},
	{
		id: 7,
		leadId: 6,
		type: "incoming" as const,
		duration: 185,
		startTime: new Date("2023-05-20T13:30:00"),
		summary: "Discussed technical requirements and integration options",
		transcript: "I'm calling to ask about your API integration options...",
		recordingUrl: "https://example.com/recordings/call7.mp3",
		status: "answered",
		createdAt: new Date("2023-05-20T13:30:00"),
		updatedAt: new Date("2023-05-20T13:30:00"),
		userId: "user_123",
		leadName: "Alex Rodriguez"
	},
	{
		id: 8,
		leadId: 7,
		type: "outgoing" as const,
		duration: 42,
		startTime: new Date("2023-05-21T09:45:00"),
		summary: "Brief call to schedule demo next week",
		transcript: "Hello, I'm calling from IcePhone to schedule your demo...",
		recordingUrl: "https://example.com/recordings/call8.mp3",
		status: "answered",
		createdAt: new Date("2023-05-21T09:45:00"),
		updatedAt: new Date("2023-05-21T09:45:00"),
		userId: "user_123",
		leadName: "Jessica Kim"
	},
	{
		id: 9,
		leadId: 8,
		type: "outgoing" as const,
		duration: 0,
		startTime: new Date("2023-05-22T10:15:00"),
		summary: "No answer from lead, no voicemail left",
		transcript: null,
		recordingUrl: null,
		status: "missed",
		createdAt: new Date("2023-05-22T10:15:00"),
		updatedAt: new Date("2023-05-22T10:15:00"),
		userId: "user_123",
		leadName: "Thomas Brown"
	},
	{
		id: 10,
		leadId: 9,
		type: "incoming" as const,
		duration: 156,
		startTime: new Date("2023-05-23T16:00:00"),
		summary: "Lead inquired about enterprise pricing and support",
		transcript: "I'm interested in your enterprise plan...",
		recordingUrl: "https://example.com/recordings/call10.mp3",
		status: "answered",
		createdAt: new Date("2023-05-23T16:00:00"),
		updatedAt: new Date("2023-05-23T16:00:00"),
		userId: "user_123",
		leadName: "Olivia Martinez"
	}
]

// Get all calls with optional filtering
export async function getCalls(filter: CallFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Collect where conditions
		const whereConditions: SQL[] = [eq(calls.userId, userId)]

		// Apply search filter
		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			// Search in summary or transcript
			whereConditions.push(
				sql`(${calls.summary} ILIKE ${searchPattern} OR ${calls.transcript} ILIKE ${searchPattern})`
			)
		}

		// Filter by status
		if (filter.status && filter.status.length > 0) {
			whereConditions.push(
				sql`${calls.status} IN (${sql.join(filter.status)})`
			)
		}

		// Filter by type (incoming/outgoing)
		if (filter.type && filter.type.length > 0) {
			whereConditions.push(
				sql`${calls.type} IN (${sql.join(filter.type)})`
			)
		}

		// Filter by date range
		if (filter.startDate) {
			whereConditions.push(gte(calls.startTime, filter.startDate))
		}

		if (filter.endDate) {
			whereConditions.push(lte(calls.startTime, filter.endDate))
		}

		// Create a single 'and' condition from all conditions
		const condition = and(...whereConditions)

		// Join with leads to get lead information
		const callsData = await db_ws
			.select({
				id: calls.id,
				leadId: calls.leadId,
				leadName: leads.name,
				type: calls.type,
				duration: calls.duration,
				startTime: calls.startTime,
				summary: calls.summary,
				transcript: calls.transcript,
				recordingUrl: calls.recordingUrl,
				status: calls.status,
				createdAt: calls.createdAt,
				updatedAt: calls.updatedAt
			})
			.from(calls)
			.leftJoin(leads, eq(calls.leadId, leads.id))
			.where(condition)
			.orderBy(desc(calls.startTime))

		// For development/testing, create some mock data if no calls exist
		if (callsData.length === 0) {
			const mockData = Array.from({ length: 15 }, (_, i) => ({
				id: i + 1,
				leadId: 1,
				leadName: `Test Lead ${(i % 5) + 1}`,
				type: i % 2 === 0 ? "incoming" : "outgoing",
				duration: Math.floor(Math.random() * 600) + 30, // 30 to 630 seconds
				startTime: new Date(
					Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
				), // Random date within last 30 days
				summary: `Mock call summary ${i + 1}. This is an automated test entry for development purposes.`,
				transcript: `Mock transcript for call ${i + 1}. The customer and agent discussed various topics related to the product. This is a long placeholder text to simulate an actual transcript.`,
				recordingUrl:
					i % 3 === 0 ? "https://example.com/recording.mp3" : null,
				status: ["answered", "voicemail", "missed", "completed"][i % 4],
				createdAt: new Date(),
				updatedAt: new Date()
			}))

			return { data: mockData, success: true, error: null }
		}

		return { data: callsData, success: true, error: null }
	} catch (error) {
		console.error("Error getting calls:", error)
		return { error: "Failed to get calls", success: false, data: null }
	}
}

// Get a single call by ID
export async function getCallById(callId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized", data: null }
		}

		// Get the call with lead information
		const callData = await db_ws
			.select({
				id: calls.id,
				leadId: calls.leadId,
				leadName: leads.name,
				type: calls.type,
				duration: calls.duration,
				startTime: calls.startTime,
				summary: calls.summary,
				transcript: calls.transcript,
				recordingUrl: calls.recordingUrl,
				status: calls.status,
				createdAt: calls.createdAt,
				updatedAt: calls.updatedAt
			})
			.from(calls)
			.leftJoin(leads, eq(calls.leadId, leads.id))
			.where(and(eq(calls.id, callId), eq(calls.userId, userId)))
			.limit(1)

		if (!callData || callData.length === 0) {
			return { success: false, error: "Call not found", data: null }
		}

		return { success: true, data: callData[0], error: null }
	} catch (error) {
		console.error("Error getting call details:", error)
		return {
			success: false,
			error: "Failed to retrieve call details",
			data: null
		}
	}
}
