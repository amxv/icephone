"use server"

import { db_ws } from "@/db"
import { calls, leads, voiceSessions, voiceAgents } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { type SQL, and, desc, eq, gte, lte, sql, or } from "drizzle-orm"

// Define types for filtering
type CallFilter = {
	search?: string
	type?: string[]
	status?: string[]
	startDate?: Date
	endDate?: Date
	orderBy?: string
	orderDir?: "asc" | "desc"
	campaignId?: number
}

// Get all calls with optional filtering - combines data from calls and voiceSessions tables
export async function getCalls(filter: CallFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Collect where conditions for calls table
		const callsWhereConditions: SQL[] = [eq(calls.userId, userId)]

		// Collect where conditions for voice sessions table
		const voiceSessionsWhereConditions: SQL[] = [
			eq(voiceSessions.userId, userId)
		]

		// Filter by campaignId if provided (only for calls table)
		if (filter.campaignId !== undefined) {
			callsWhereConditions.push(eq(calls.campaignId, filter.campaignId))
		}

		// Apply search filter for both tables
		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			// Search in summary or transcript for calls
			callsWhereConditions.push(
				sql`(${calls.summary} ILIKE ${searchPattern} OR ${calls.transcript} ILIKE ${searchPattern})`
			)
			// Search in summary or transcript for voice sessions
			voiceSessionsWhereConditions.push(
				sql`(${voiceSessions.summary} ILIKE ${searchPattern} OR ${voiceSessions.transcript} ILIKE ${searchPattern})`
			)
		}

		// Filter by status for both tables
		if (filter.status && filter.status.length > 0) {
			callsWhereConditions.push(
				sql`${calls.status} IN (${sql.join(filter.status)})`
			)
			voiceSessionsWhereConditions.push(
				sql`${voiceSessions.status} IN (${sql.join(filter.status)})`
			)
		}

		// Filter by type (incoming/outgoing) for both tables
		if (filter.type && filter.type.length > 0) {
			callsWhereConditions.push(
				sql`${calls.type} IN (${sql.join(filter.type)})`
			)
			voiceSessionsWhereConditions.push(
				sql`${voiceSessions.direction} IN (${sql.join(filter.type)})`
			)
		}

		// Filter by date range for both tables
		if (filter.startDate) {
			callsWhereConditions.push(gte(calls.startTime, filter.startDate))
			voiceSessionsWhereConditions.push(
				gte(voiceSessions.startTime, filter.startDate)
			)
		}

		if (filter.endDate) {
			callsWhereConditions.push(lte(calls.startTime, filter.endDate))
			voiceSessionsWhereConditions.push(
				lte(voiceSessions.startTime, filter.endDate)
			)
		}

		// Create conditions for both tables
		const callsCondition = and(...callsWhereConditions)
		const voiceSessionsCondition = and(...voiceSessionsWhereConditions)

		// Get data from calls table (legacy communication data)
		const callsData = await db_ws
			.select({
				id: sql<string>`'call_' || ${calls.id}`,
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
				updatedAt: calls.updatedAt,
				source: sql<string>`'calls'`,
				campaignId: calls.campaignId,
				agentId: sql<number | null>`NULL`,
				agentName: sql<string | null>`NULL`,
				sessionId: sql<string | null>`NULL`,
				cost: sql<string | null>`NULL`,
				sentiment: sql<string | null>`NULL`
			})
			.from(calls)
			.leftJoin(leads, eq(calls.leadId, leads.id))
			.where(callsCondition)

		// Get data from voice sessions table (voice call data)
		const voiceSessionsData = await db_ws
			.select({
				id: sql<string>`'voice_' || ${voiceSessions.id}`,
				leadId: voiceSessions.leadId,
				leadName: leads.name,
				type: voiceSessions.direction,
				duration: voiceSessions.duration,
				startTime: voiceSessions.startTime,
				summary: voiceSessions.summary,
				transcript: voiceSessions.transcript,
				recordingUrl: voiceSessions.recordingUrl,
				status: voiceSessions.status,
				createdAt: voiceSessions.createdAt,
				updatedAt: voiceSessions.updatedAt,
				source: sql<string>`'voice_sessions'`,
				campaignId: sql<number | null>`NULL`,
				agentId: voiceSessions.agentId,
				agentName: voiceAgents.name,
				sessionId: voiceSessions.sessionId,
				cost: voiceSessions.cost,
				sentiment: voiceSessions.sentiment
			})
			.from(voiceSessions)
			.leftJoin(leads, eq(voiceSessions.leadId, leads.id))
			.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
			.where(voiceSessionsCondition)

		// Combine both datasets
		const allCallsData = [...callsData, ...voiceSessionsData]

		// Sort by start time (most recent first)
		allCallsData.sort((a, b) => {
			const timeA = new Date(a.startTime).getTime()
			const timeB = new Date(b.startTime).getTime()
			return timeB - timeA
		})

		return { data: allCallsData, success: true, error: null }
	} catch (error) {
		console.error("Error getting calls:", error)
		return { error: "Failed to get calls", success: false, data: null }
	}
}

// Get a single call by ID - supports both calls and voice sessions
export async function getCallById(callId: string) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized", data: null }
		}

		// Determine if this is a call or voice session based on ID prefix
		const isVoiceSession = callId.startsWith("voice_")
		const actualId = callId.replace(/^(call_|voice_)/, "")

		// Define the unified call data type
		type CallDataType = {
			id: string
			leadId: number | null
			leadName: string | null
			type: string
			duration: number | null
			startTime: Date
			summary: string | null
			transcript: string | null
			recordingUrl: string | null
			status: string | null
			createdAt: Date
			updatedAt: Date
			source: string
			campaignId: number | null
			agentId: number | null
			agentName: string | null
			sessionId: string | null
			cost: string | null
			sentiment: string | null
		}

		let callData: CallDataType | null = null

		if (isVoiceSession) {
			// Get from voice sessions table
			const voiceSessionData = await db_ws
				.select({
					id: sql<string>`'voice_' || ${voiceSessions.id}`,
					leadId: voiceSessions.leadId,
					leadName: leads.name,
					type: voiceSessions.direction,
					duration: voiceSessions.duration,
					startTime: voiceSessions.startTime,
					summary: voiceSessions.summary,
					transcript: voiceSessions.transcript,
					recordingUrl: voiceSessions.recordingUrl,
					status: voiceSessions.status,
					createdAt: voiceSessions.createdAt,
					updatedAt: voiceSessions.updatedAt,
					source: sql<string>`'voice_sessions'`,
					campaignId: sql<number | null>`NULL`,
					agentId: voiceSessions.agentId,
					agentName: voiceAgents.name,
					sessionId: voiceSessions.sessionId,
					cost: voiceSessions.cost,
					sentiment: voiceSessions.sentiment
				})
				.from(voiceSessions)
				.leftJoin(leads, eq(voiceSessions.leadId, leads.id))
				.leftJoin(
					voiceAgents,
					eq(voiceSessions.agentId, voiceAgents.id)
				)
				.where(
					and(
						eq(voiceSessions.id, Number(actualId)),
						eq(voiceSessions.userId, userId)
					)
				)
				.limit(1)

			if (voiceSessionData && voiceSessionData.length > 0) {
				callData = voiceSessionData[0]
			}
		} else {
			// Get from calls table
			const callsTableData = await db_ws
				.select({
					id: sql<string>`'call_' || ${calls.id}`,
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
					updatedAt: calls.updatedAt,
					source: sql<string>`'calls'`,
					campaignId: calls.campaignId,
					agentId: sql<number | null>`NULL`,
					agentName: sql<string | null>`NULL`,
					sessionId: sql<string | null>`NULL`,
					cost: sql<string | null>`NULL`,
					sentiment: sql<string | null>`NULL`
				})
				.from(calls)
				.leftJoin(leads, eq(calls.leadId, leads.id))
				.where(
					and(
						eq(calls.id, Number(actualId)),
						eq(calls.userId, userId)
					)
				)
				.limit(1)

			if (callsTableData && callsTableData.length > 0) {
				callData = callsTableData[0]
			}
		}

		if (!callData) {
			return { success: false, error: "Call not found", data: null }
		}

		return { success: true, data: callData, error: null }
	} catch (error) {
		console.error("Error getting call details:", error)
		return {
			success: false,
			error: "Failed to retrieve call details",
			data: null
		}
	}
}
