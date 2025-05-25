import { type NextRequest } from "next/server"
import { db_ws } from "@/db"
import { voiceSessions, toolCalls, leadInteractions } from "@/db/schema"
import { eq } from "drizzle-orm"

// Utility function to get user context from Vapi call
export async function getUserContextFromCall(
	callId?: string
): Promise<string | null> {
	if (!callId) return null

	try {
		// Get voice session by call ID to find the user
		const session = await db_ws.query.voiceSessions.findFirst({
			where: eq(voiceSessions.sessionId, callId)
		})

		return session?.userId || null
	} catch (error) {
		console.error("Error getting user context from call:", error)
		return null
	}
}

// Utility function to get session ID from Vapi call
export async function getSessionIdFromCall(
	callId?: string
): Promise<string | null> {
	if (!callId) return null

	try {
		// Get voice session by call ID
		const session = await db_ws.query.voiceSessions.findFirst({
			where: eq(voiceSessions.sessionId, callId)
		})

		return session?.sessionId || null
	} catch (error) {
		console.error("Error getting session ID from call:", error)
		return null
	}
}

// Utility function to log tool calls for audit and analytics
export async function logToolCall(
	toolCallId: string,
	toolName: string,
	parameters: Record<string, unknown>,
	result: {
		success: boolean
		message: string
		data?: Record<string, unknown>
		error?: string
	},
	executionTime: number,
	userId: string,
	callId?: string,
	sessionId?: string,
	request?: NextRequest
): Promise<void> {
	try {
		const ipAddress =
			request?.headers.get("x-forwarded-for") ||
			request?.headers.get("x-real-ip") ||
			"unknown"
		const userAgent = request?.headers.get("user-agent") || "unknown"

		await db_ws.insert(toolCalls).values({
			toolCallId,
			callId: callId || null,
			sessionId: sessionId || null,
			toolName,
			parameters,
			result,
			executionTime,
			userId,
			ipAddress,
			userAgent
		})
	} catch (error) {
		console.error("Error logging tool call:", error)
		// Don't throw - logging failure shouldn't break the tool execution
	}
}

// Utility function to log lead interactions for analytics
export async function logLeadInteraction(
	leadId: number,
	interactionType: string,
	source: string,
	sourceId: string,
	oldValue: Record<string, unknown> | null,
	newValue: Record<string, unknown> | null,
	metadata: Record<string, unknown>,
	userId: string
): Promise<void> {
	try {
		await db_ws.insert(leadInteractions).values({
			leadId,
			interactionType,
			source,
			sourceId,
			oldValue,
			newValue,
			metadata,
			userId
		})
	} catch (error) {
		console.error("Error logging lead interaction:", error)
		// Don't throw - logging failure shouldn't break the operation
	}
}
