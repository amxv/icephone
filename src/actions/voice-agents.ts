"use server"

import { db_ws } from "@/db"
import {
	phoneNumbers,
	voiceAgentFunctions,
	voiceAgents,
	voiceRecordings,
	voiceSessions
} from "@/db/schema"
import type {
	VoiceAgent,
	VoiceAgentCreateRequest,
	VoiceAgentFunction,
	VoiceAgentFunctionCreateRequest,
	VoiceAgentStatus,
	VoiceAgentUpdateRequest,
	VoiceAgentWithPhoneNumber,
	VoiceSession,
	VoiceSessionCreateRequest,
	VoiceSessionStatus,
	VoiceSettings
} from "@/types"
import { auth, currentUser } from "@clerk/nextjs/server"
import {
	type SQL,
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	ne,
	or,
	sql
} from "drizzle-orm"

// Import Vapi integration services
import { VoiceAgentService } from "@/lib/voice-agent-service"
import { getAgentRole } from "@/actions/agent-roles"
import { getVoicePreset } from "@/actions/voice-presets"

// Define types for filtering
type VoiceAgentFilter = {
	search?: string
	status?: string[]
	phoneNumberId?: number
	orderBy?: string
	orderDir?: "asc" | "desc"
}

// Get all voice agents with optional filtering
export async function getVoiceAgents(filter: VoiceAgentFilter = {}): Promise<{
	data: VoiceAgentWithPhoneNumber[] | null
	success: boolean
	error: string | null
}> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Apply filters
		const conditions = [eq(voiceAgents.userId, userId)]

		if (filter.search) {
			const searchCondition = or(
				ilike(voiceAgents.name, `%${filter.search}%`),
				ilike(voiceAgents.description, `%${filter.search}%`)
			)
			if (searchCondition) {
				conditions.push(searchCondition)
			}
		}

		if (filter.status && filter.status.length > 0) {
			conditions.push(
				inArray(voiceAgents.status, filter.status as VoiceAgentStatus[])
			)
		}

		if (filter.phoneNumberId) {
			conditions.push(eq(voiceAgents.phoneNumberId, filter.phoneNumberId))
		}

		// Execute query with combined conditions
		const agentsData = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				description: voiceAgents.description,
				prompt: voiceAgents.prompt,
				voice: voiceAgents.voice,
				language: voiceAgents.language,
				phoneNumberId: voiceAgents.phoneNumberId,
				status: voiceAgents.status,
				configuration: voiceAgents.configuration,
				firstMessage: voiceAgents.firstMessage,
				vapiAssistantId: voiceAgents.vapiAssistantId,
				createdAt: voiceAgents.createdAt,
				updatedAt: voiceAgents.updatedAt,
				userId: voiceAgents.userId,
				phoneNumber: {
					id: phoneNumbers.id,
					number: phoneNumbers.number,
					friendlyName: phoneNumbers.friendlyName,
					type: phoneNumbers.type,
					status: phoneNumbers.status
				}
			})
			.from(voiceAgents)
			.leftJoin(
				phoneNumbers,
				eq(voiceAgents.phoneNumberId, phoneNumbers.id)
			)
			.where(and(...conditions))

		// Apply sorting
		let sortedData = agentsData
		if (filter.orderBy) {
			// Create a type-safe mapping for sort columns
			const sortableColumns = {
				id: "id",
				name: "name",
				status: "status",
				createdAt: "createdAt",
				updatedAt: "updatedAt"
			} as const

			const orderColumn =
				sortableColumns[filter.orderBy as keyof typeof sortableColumns]
			const orderDirection = filter.orderDir || "desc"

			if (orderColumn) {
				sortedData = agentsData.sort((a, b) => {
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
					if (
						typeof valueA === "string" &&
						typeof valueB === "string"
					) {
						return orderDirection === "asc"
							? valueA.localeCompare(valueB)
							: valueB.localeCompare(valueA)
					}

					// Handle numbers
					if (
						typeof valueA === "number" &&
						typeof valueB === "number"
					) {
						return orderDirection === "asc"
							? valueA - valueB
							: valueB - valueA
					}

					return 0
				})
			}
		} else {
			// Default sort by updatedAt desc
			sortedData = agentsData.sort((a, b) => {
				const dateA = new Date(a.updatedAt).getTime()
				const dateB = new Date(b.updatedAt).getTime()
				return dateB - dateA
			})
		}

		// Transform data to match expected type by ensuring required fields are not null
		const transformedData: VoiceAgentWithPhoneNumber[] = sortedData.map(
			(agent) => ({
				...agent,
				prompt: agent.prompt || "", // Convert null to empty string
				voice: agent.voice || {
					provider: "elevenlabs",
					voice_id: "default"
				}, // Provide default voice
				phoneNumber: agent.phoneNumber?.id ? agent.phoneNumber : null
			})
		)

		return { data: transformedData, success: true, error: null }
	} catch (error) {
		console.error("Error getting voice agents:", error)
		return {
			error: "Failed to get voice agents",
			success: false,
			data: null
		}
	}
}

// Get a single voice agent by ID with related data
export async function getVoiceAgentById(agentId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized" }
		}

		// Get the voice agent with phone number
		const agent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				description: voiceAgents.description,
				prompt: voiceAgents.prompt,
				voice: voiceAgents.voice,
				language: voiceAgents.language,
				phoneNumberId: voiceAgents.phoneNumberId,
				status: voiceAgents.status,
				configuration: voiceAgents.configuration,
				firstMessage: voiceAgents.firstMessage,
				createdAt: voiceAgents.createdAt,
				updatedAt: voiceAgents.updatedAt,
				userId: voiceAgents.userId,
				phoneNumber: {
					id: phoneNumbers.id,
					number: phoneNumbers.number,
					friendlyName: phoneNumbers.friendlyName,
					type: phoneNumbers.type,
					status: phoneNumbers.status
				}
			})
			.from(voiceAgents)
			.leftJoin(
				phoneNumbers,
				eq(voiceAgents.phoneNumberId, phoneNumbers.id)
			)
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return { success: false, error: "Voice agent not found" }
		}

		// Get related functions
		const agentFunctions = await db_ws
			.select()
			.from(voiceAgentFunctions)
			.where(
				and(
					eq(voiceAgentFunctions.agentId, agentId),
					eq(voiceAgentFunctions.userId, userId)
				)
			)
			.orderBy(asc(voiceAgentFunctions.name))

		// Get recent sessions
		const recentSessions = await db_ws
			.select()
			.from(voiceSessions)
			.where(
				and(
					eq(voiceSessions.agentId, agentId),
					eq(voiceSessions.userId, userId)
				)
			)
			.orderBy(desc(voiceSessions.startTime))
			.limit(10)

		return {
			success: true,
			data: {
				agent: agent[0],
				functions: agentFunctions,
				recentSessions: recentSessions
			}
		}
	} catch (error) {
		console.error("Error getting voice agent details:", error)
		return {
			success: false,
			error: "Failed to retrieve voice agent details"
		}
	}
}

// Create a new voice agent
export async function createVoiceAgent(data: VoiceAgentCreateRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate phone number ownership if provided
		if (data.phoneNumberId) {
			const phoneNumber = await db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, data.phoneNumberId),
						eq(phoneNumbers.userId, userId)
					)
				)
				.limit(1)

			if (!phoneNumber || phoneNumber.length === 0) {
				return {
					error: "Phone number not found or not owned by user",
					success: false,
					data: null
				}
			}
		}

		const result = await db_ws
			.insert(voiceAgents)
			.values({
				...data,
				userId,
				status: data.status || "inactive"
			})
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error creating voice agent:", error)
		return {
			error: "Failed to create voice agent",
			success: false,
			data: null
		}
	}
}

/**
 * Enhanced voice agent creation with automatic VAPI assistant creation
 * This function creates both the database record and the corresponding VAPI assistant
 */
export async function createVoiceAgentWithRole(data: {
	name: string
	description?: string
	agentRoleId: number
	voicePresetId: number
	language: string
	phoneNumberId?: number
	status?: VoiceAgentStatus
	industryContext?: string
}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate phone number ownership if provided
		if (data.phoneNumberId) {
			const phoneNumber = await db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, data.phoneNumberId),
						eq(phoneNumbers.userId, userId)
					)
				)
				.limit(1)

			if (!phoneNumber || phoneNumber.length === 0) {
				return {
					error: "Phone number not found or not owned by user",
					success: false,
					data: null
				}
			}
		}

		// Get agent role and voice preset configurations
		const [agentRole, voicePreset] = await Promise.all([
			getAgentRole(data.agentRoleId),
			getVoicePreset(data.voicePresetId)
		])

		if (!agentRole) {
			return {
				error: "Agent role not found",
				success: false,
				data: null
			}
		}

		if (!voicePreset) {
			return {
				error: "Voice preset not found",
				success: false,
				data: null
			}
		}

		// Generate voice configuration and first message
		const voiceConfig = {
			provider: voicePreset.vapiProvider as
				| "elevenlabs"
				| "playht"
				| "cartesia",
			voice_id: voicePreset.vapiVoiceId
		}

		const firstMessage =
			agentRole.firstMessageTemplate?.replace(
				"{{agent_name}}",
				data.name
			) ||
			`Hello! I'm ${data.name}, your ${agentRole.displayName.toLowerCase()}. How can I help you today?`

		let vapiAssistantId: string | null = null

		try {
			// Create VAPI assistant using the VoiceAgentService
			const voiceService = VoiceAgentService.getInstance()
			const assistantResult = await voiceService.createVAPIAssistant({
				name: data.name,
				agentRole,
				voicePreset,
				language: data.language,
				industryContext: data.industryContext,
				phoneNumberId: data.phoneNumberId || undefined
			})

			vapiAssistantId = assistantResult.assistantId
			console.log(
				`Created VAPI assistant ${vapiAssistantId} for agent ${data.name}`
			)
		} catch (vapiError) {
			console.error("Failed to create VAPI assistant:", vapiError)
			// Continue with agent creation even if VAPI fails
			// The assistant can be created later via sync operation
		}

		// Create the voice agent in database
		const result = await db_ws
			.insert(voiceAgents)
			.values({
				name: data.name,
				description: data.description,
				prompt: agentRole.systemPrompt,
				voice: voiceConfig,
				language: data.language,
				phoneNumberId: data.phoneNumberId,
				status: data.status || "inactive",
				configuration: agentRole.defaultConfiguration || {},
				firstMessage,
				vapiAssistantId,
				userId
			})
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error creating voice agent with role:", error)
		return {
			error: "Failed to create voice agent",
			success: false,
			data: null
		}
	}
}

// Update a voice agent
export async function updateVoiceAgent(
	id: number,
	data: VoiceAgentUpdateRequest
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Validate phone number ownership if provided
		if (data.phoneNumberId) {
			const phoneNumber = await db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, data.phoneNumberId),
						eq(phoneNumbers.userId, userId)
					)
				)
				.limit(1)

			if (!phoneNumber || phoneNumber.length === 0) {
				return {
					error: "Phone number not found or not owned by user",
					success: false,
					data: null
				}
			}
		}

		const result = await db_ws
			.update(voiceAgents)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(and(eq(voiceAgents.id, id), eq(voiceAgents.userId, userId)))
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error updating voice agent:", error)
		return {
			error: "Failed to update voice agent",
			success: false,
			data: null
		}
	}
}

// Delete a voice agent
export async function deleteVoiceAgent(id: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Check if agent has active sessions
		const activeSessions = await db_ws
			.select()
			.from(voiceSessions)
			.where(
				and(
					eq(voiceSessions.agentId, id),
					eq(voiceSessions.userId, userId),
					eq(voiceSessions.status, "active")
				)
			)

		if (activeSessions.length > 0) {
			return {
				error: "Cannot delete voice agent with active sessions",
				success: false
			}
		}

		const result = await db_ws
			.delete(voiceAgents)
			.where(and(eq(voiceAgents.id, id), eq(voiceAgents.userId, userId)))
			.returning()

		if (!result || result.length === 0) {
			return { error: "Voice agent not found", success: false }
		}

		return { success: true, error: null }
	} catch (error) {
		console.error("Error deleting voice agent:", error)
		return { error: "Failed to delete voice agent", success: false }
	}
}

// Voice Agent Functions CRUD Operations

// Get functions for a voice agent
export async function getVoiceAgentFunctions(agentId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify agent ownership
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		const functions = await db_ws
			.select()
			.from(voiceAgentFunctions)
			.where(
				and(
					eq(voiceAgentFunctions.agentId, agentId),
					eq(voiceAgentFunctions.userId, userId)
				)
			)
			.orderBy(asc(voiceAgentFunctions.name))

		return { data: functions, success: true, error: null }
	} catch (error) {
		console.error("Error getting voice agent functions:", error)
		return {
			error: "Failed to get voice agent functions",
			success: false,
			data: null
		}
	}
}

// Create a new voice agent function
export async function createVoiceAgentFunction(
	data: VoiceAgentFunctionCreateRequest
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify agent ownership
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, data.agentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		const result = await db_ws
			.insert(voiceAgentFunctions)
			.values({
				...data,
				userId,
				method: data.method || "POST",
				headers: data.headers || {},
				parameters: data.parameters || [],
				timeout: data.timeout || 30,
				runAfterCall: data.runAfterCall || false,
				responseMode: data.responseMode || "strict",
				executeAfterMessage: data.executeAfterMessage !== false,
				excludeSessionId: data.excludeSessionId || false
			})
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error creating voice agent function:", error)
		return {
			error: "Failed to create voice agent function",
			success: false,
			data: null
		}
	}
}

// Update a voice agent function
export async function updateVoiceAgentFunction(
	id: number,
	data: Partial<VoiceAgentFunctionCreateRequest>
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const result = await db_ws
			.update(voiceAgentFunctions)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(voiceAgentFunctions.id, id),
					eq(voiceAgentFunctions.userId, userId)
				)
			)
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Voice agent function not found",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error updating voice agent function:", error)
		return {
			error: "Failed to update voice agent function",
			success: false,
			data: null
		}
	}
}

// Delete a voice agent function
export async function deleteVoiceAgentFunction(id: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const result = await db_ws
			.delete(voiceAgentFunctions)
			.where(
				and(
					eq(voiceAgentFunctions.id, id),
					eq(voiceAgentFunctions.userId, userId)
				)
			)
			.returning()

		if (!result || result.length === 0) {
			return { error: "Voice agent function not found", success: false }
		}

		return { success: true, error: null }
	} catch (error) {
		console.error("Error deleting voice agent function:", error)
		return {
			error: "Failed to delete voice agent function",
			success: false
		}
	}
}

// Voice Sessions Management

// Get voice sessions with optional filtering
export async function getVoiceSessions(agentId?: number, limit = 50) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [eq(voiceSessions.userId, userId)]

		if (agentId) {
			// Verify agent ownership
			const agent = await db_ws
				.select()
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, agentId),
						eq(voiceAgents.userId, userId)
					)
				)
				.limit(1)

			if (!agent || agent.length === 0) {
				return {
					error: "Voice agent not found",
					success: false,
					data: null
				}
			}

			whereConditions.push(eq(voiceSessions.agentId, agentId))
		}

		const condition = and(...whereConditions)

		const sessions = await db_ws
			.select({
				id: voiceSessions.id,
				sessionId: voiceSessions.sessionId,
				agentId: voiceSessions.agentId,
				leadId: voiceSessions.leadId,
				phoneNumber: voiceSessions.phoneNumber,
				direction: voiceSessions.direction,
				status: voiceSessions.status,
				startTime: voiceSessions.startTime,
				endTime: voiceSessions.endTime,
				duration: voiceSessions.duration,
				metadata: voiceSessions.metadata,
				transcript: voiceSessions.transcript,
				summary: voiceSessions.summary,
				sentiment: voiceSessions.sentiment,
				recordingUrl: voiceSessions.recordingUrl,
				cost: voiceSessions.cost,
				createdAt: voiceSessions.createdAt,
				updatedAt: voiceSessions.updatedAt,
				userId: voiceSessions.userId,
				agent: {
					id: voiceAgents.id,
					name: voiceAgents.name
				}
			})
			.from(voiceSessions)
			.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
			.where(condition)
			.orderBy(desc(voiceSessions.startTime))
			.limit(limit)

		return { data: sessions, success: true, error: null }
	} catch (error) {
		console.error("Error getting voice sessions:", error)
		return {
			error: "Failed to get voice sessions",
			success: false,
			data: null
		}
	}
}

// Get a specific voice session by ID
export async function getVoiceSessionById(sessionId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized" }
		}

		const session = await db_ws
			.select({
				id: voiceSessions.id,
				sessionId: voiceSessions.sessionId,
				agentId: voiceSessions.agentId,
				leadId: voiceSessions.leadId,
				phoneNumber: voiceSessions.phoneNumber,
				direction: voiceSessions.direction,
				status: voiceSessions.status,
				startTime: voiceSessions.startTime,
				endTime: voiceSessions.endTime,
				duration: voiceSessions.duration,
				metadata: voiceSessions.metadata,
				transcript: voiceSessions.transcript,
				summary: voiceSessions.summary,
				sentiment: voiceSessions.sentiment,
				recordingUrl: voiceSessions.recordingUrl,
				cost: voiceSessions.cost,
				createdAt: voiceSessions.createdAt,
				updatedAt: voiceSessions.updatedAt,
				userId: voiceSessions.userId,
				agent: {
					id: voiceAgents.id,
					name: voiceAgents.name,
					prompt: voiceAgents.prompt
				}
			})
			.from(voiceSessions)
			.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
			.where(
				and(
					eq(voiceSessions.id, sessionId),
					eq(voiceSessions.userId, userId)
				)
			)
			.limit(1)

		if (!session || session.length === 0) {
			return { success: false, error: "Voice session not found" }
		}

		// Get recordings for this session
		const recordings = await db_ws
			.select()
			.from(voiceRecordings)
			.where(
				and(
					eq(voiceRecordings.sessionId, sessionId),
					eq(voiceRecordings.userId, userId)
				)
			)
			.orderBy(desc(voiceRecordings.createdAt))

		return {
			success: true,
			data: {
				session: session[0],
				recordings: recordings
			}
		}
	} catch (error) {
		console.error("Error getting voice session details:", error)
		return {
			success: false,
			error: "Failed to retrieve voice session details"
		}
	}
}

// Create a new voice session
export async function createVoiceSession(data: VoiceSessionCreateRequest) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify agent ownership
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, data.agentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		// Generate a unique session ID for Vapi AI
		const vapiSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		const result = await db_ws
			.insert(voiceSessions)
			.values({
				sessionId: vapiSessionId,
				agentId: data.agentId,
				leadId: data.leadId,
				phoneNumber: data.phoneNumber,
				direction: data.direction,
				status: "active",
				metadata: data.metadata || {},
				userId
			})
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error creating voice session:", error)
		return {
			error: "Failed to create voice session",
			success: false,
			data: null
		}
	}
}

// Update a voice session (typically called when session ends)
export async function updateVoiceSession(
	id: number,
	data: {
		status?: "active" | "completed" | "failed" | "timeout"
		endTime?: Date
		duration?: number
		transcript?: string
		summary?: string
		sentiment?: string
		recordingUrl?: string
		cost?: string
	}
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const result = await db_ws
			.update(voiceSessions)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(
				and(eq(voiceSessions.id, id), eq(voiceSessions.userId, userId))
			)
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Voice session not found",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error updating voice session:", error)
		return {
			error: "Failed to update voice session",
			success: false,
			data: null
		}
	}
}

// Get session transcript
export async function getSessionTranscript(sessionId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const session = await db_ws
			.select({
				transcript: voiceSessions.transcript,
				summary: voiceSessions.summary,
				sentiment: voiceSessions.sentiment
			})
			.from(voiceSessions)
			.where(
				and(
					eq(voiceSessions.id, sessionId),
					eq(voiceSessions.userId, userId)
				)
			)
			.limit(1)

		if (!session || session.length === 0) {
			return {
				error: "Voice session not found",
				success: false,
				data: null
			}
		}

		return { data: session[0], success: true, error: null }
	} catch (error) {
		console.error("Error getting session transcript:", error)
		return {
			error: "Failed to get session transcript",
			success: false,
			data: null
		}
	}
}

// ============================================================================
// INBOUND CALL HANDLING
// ============================================================================

// Handle incoming call and route to appropriate voice agent
export async function handleInboundCall(
	phoneNumber: string,
	callData: {
		from: string
		to: string
		callSid?: string
		metadata?: Record<string, unknown>
	}
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Find the phone number and its associated voice agent
		const phoneNumberRecord = await db_ws
			.select({
				id: phoneNumbers.id,
				number: phoneNumbers.number,
				configuration: phoneNumbers.configuration
			})
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.number, phoneNumber),
					eq(phoneNumbers.userId, userId),
					eq(phoneNumbers.status, "active")
				)
			)
			.limit(1)

		if (!phoneNumberRecord || phoneNumberRecord.length === 0) {
			return {
				error: "Phone number not found or inactive",
				success: false,
				data: null
			}
		}

		// Find active voice agent for this phone number
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.phoneNumberId, phoneNumberRecord[0].id),
					eq(voiceAgents.userId, userId),
					eq(voiceAgents.status, "active")
				)
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "No active voice agent found for this phone number",
				success: false,
				data: null
			}
		}

		// Create voice session for the inbound call
		const sessionResult = await createVoiceSession({
			agentId: agent[0].id,
			phoneNumber: callData.from,
			direction: "incoming",
			metadata: {
				...callData.metadata,
				custom_data: {
					call_sid: callData.callSid,
					to_number: callData.to,
					from_number: callData.from
				}
			}
		})

		if (!sessionResult.success) {
			return sessionResult
		}

		return {
			success: true,
			data: {
				agent: agent[0],
				session: sessionResult.data,
				phoneNumber: phoneNumberRecord[0]
			},
			error: null
		}
	} catch (error) {
		console.error("Error handling inbound call:", error)
		return {
			error: "Failed to handle inbound call",
			success: false,
			data: null
		}
	}
}

// Configure routing for a phone number to a specific agent
export async function configureInboundRouting(
	phoneNumberId: number,
	agentId: number
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify ownership of both phone number and agent
		const [phoneNumber, agent] = await Promise.all([
			db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, phoneNumberId),
						eq(phoneNumbers.userId, userId)
					)
				)
				.limit(1),
			db_ws
				.select()
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, agentId),
						eq(voiceAgents.userId, userId)
					)
				)
				.limit(1)
		])

		if (!phoneNumber || phoneNumber.length === 0) {
			return {
				error: "Phone number not found",
				success: false,
				data: null
			}
		}

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		// Update the voice agent with the phone number
		const result = await db_ws
			.update(voiceAgents)
			.set({
				phoneNumberId,
				updatedAt: new Date()
			})
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error configuring inbound routing:", error)
		return {
			error: "Failed to configure inbound routing",
			success: false,
			data: null
		}
	}
}

// Get inbound call history with filtering
export async function getInboundCallHistory(filter?: {
	agentId?: number
	phoneNumberId?: number
	startDate?: Date
	endDate?: Date
	limit?: number
}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [
			eq(voiceSessions.userId, userId),
			eq(voiceSessions.direction, "incoming")
		]

		// Apply filters
		if (filter?.agentId) {
			whereConditions.push(eq(voiceSessions.agentId, filter.agentId))
		}

		if (filter?.startDate) {
			whereConditions.push(gte(voiceSessions.startTime, filter.startDate))
		}

		if (filter?.endDate) {
			whereConditions.push(lte(voiceSessions.startTime, filter.endDate))
		}

		const condition = and(...whereConditions)

		const sessions = await db_ws
			.select({
				id: voiceSessions.id,
				sessionId: voiceSessions.sessionId,
				agentId: voiceSessions.agentId,
				leadId: voiceSessions.leadId,
				phoneNumber: voiceSessions.phoneNumber,
				direction: voiceSessions.direction,
				status: voiceSessions.status,
				startTime: voiceSessions.startTime,
				endTime: voiceSessions.endTime,
				duration: voiceSessions.duration,
				transcript: voiceSessions.transcript,
				summary: voiceSessions.summary,
				sentiment: voiceSessions.sentiment,
				recordingUrl: voiceSessions.recordingUrl,
				cost: voiceSessions.cost,
				createdAt: voiceSessions.createdAt,
				updatedAt: voiceSessions.updatedAt,
				agent: {
					id: voiceAgents.id,
					name: voiceAgents.name,
					description: voiceAgents.description
				}
			})
			.from(voiceSessions)
			.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
			.where(condition)
			.orderBy(desc(voiceSessions.startTime))
			.limit(filter?.limit || 50)

		return { data: sessions, success: true, error: null }
	} catch (error) {
		console.error("Error getting inbound call history:", error)
		return {
			error: "Failed to get inbound call history",
			success: false,
			data: null
		}
	}
}

// ============================================================================
// OUTBOUND CALL OPERATIONS
// ============================================================================

// Initiate an outbound call using a voice agent
export async function initiateOutboundCall(data: {
	fromPhoneNumberId: number
	toPhoneNumber: string
	agentId: number
	leadId?: number
	metadata?: Record<string, unknown>
	scheduledTime?: Date
}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify ownership of phone number and agent
		const [phoneNumber, agent] = await Promise.all([
			db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, data.fromPhoneNumberId),
						eq(phoneNumbers.userId, userId),
						eq(phoneNumbers.status, "active")
					)
				)
				.limit(1),
			db_ws
				.select()
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, data.agentId),
						eq(voiceAgents.userId, userId),
						eq(voiceAgents.status, "active")
					)
				)
				.limit(1)
		])

		if (!phoneNumber || phoneNumber.length === 0) {
			return {
				error: "Phone number not found or inactive",
				success: false,
				data: null
			}
		}

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found or inactive",
				success: false,
				data: null
			}
		}

		// Check if this is a scheduled call for the future
		if (data.scheduledTime && data.scheduledTime > new Date()) {
			// For scheduled calls, we'll store the session as pending
			const sessionResult = await createVoiceSession({
				agentId: data.agentId,
				leadId: data.leadId,
				phoneNumber: data.toPhoneNumber,
				direction: "outgoing",
				metadata: {
					...data.metadata,
					custom_data: {
						from_phone_number_id: data.fromPhoneNumberId,
						from_phone_number: phoneNumber[0].number,
						scheduled_time: data.scheduledTime.toISOString(),
						status: "scheduled"
					}
				}
			})

			if (!sessionResult.success) {
				return sessionResult
			}

			return {
				success: true,
				data: {
					session: sessionResult.data,
					agent: agent[0],
					phoneNumber: phoneNumber[0],
					scheduled: true
				},
				error: null
			}
		}

		// For immediate calls, create active session first
		const sessionResult = await createVoiceSession({
			agentId: data.agentId,
			leadId: data.leadId,
			phoneNumber: data.toPhoneNumber,
			direction: "outgoing",
			metadata: {
				...data.metadata,
				custom_data: {
					from_phone_number_id: data.fromPhoneNumberId,
					from_phone_number: phoneNumber[0].number
				}
			}
		})

		if (!sessionResult.success) {
			return sessionResult
		}

		// Actually initiate the VAPI call
		try {
			const { vapiCallClient } = await import("@/lib/vapi-call-client")

			const vapiCallResult = await vapiCallClient.initiateOutboundCall({
				phoneNumberId: phoneNumber[0].number,
				customerPhoneNumber: data.toPhoneNumber,
				assistantId: agent[0].vapiAssistantId || undefined,
				assistantOverrides: agent[0].vapiAssistantId
					? undefined
					: {
							name: agent[0].name,
							firstMessage:
								agent[0].firstMessage ||
								`Hello! I'm ${agent[0].name}. How can I help you today?`,
							prompt:
								agent[0].prompt ||
								"You are a helpful AI assistant making an outbound call.",
							voice: agent[0].voice
								? {
										provider: agent[0].voice.provider as
											| "11labs"
											| "playht"
											| "cartesia",
										voiceId: agent[0].voice.voice_id
									}
								: undefined
						},
				metadata: {
					sessionId: sessionResult.data?.sessionId,
					leadId: data.leadId,
					agentId: data.agentId,
					...data.metadata
				}
			})

			if (!vapiCallResult.success) {
				// Update session to failed
				if (sessionResult.data) {
					await updateVoiceSession(sessionResult.data.id, {
						status: "failed"
					})
				}
				return {
					success: false,
					error:
						vapiCallResult.error || "Failed to initiate VAPI call",
					data: null
				}
			}

			// Update session with VAPI call ID
			if (sessionResult.data && vapiCallResult.data) {
				await updateVoiceSession(sessionResult.data.id, {
					status: "active"
				})
			}

			return {
				success: true,
				data: {
					session: sessionResult.data,
					agent: agent[0],
					phoneNumber: phoneNumber[0],
					scheduled: false,
					vapiCallId: vapiCallResult.data?.callId
				},
				error: null
			}
		} catch (error) {
			console.error("Error initiating VAPI call:", error)

			// Update session to failed
			if (sessionResult.data) {
				await updateVoiceSession(sessionResult.data.id, {
					status: "failed"
				})
			}

			return {
				success: false,
				error: "Failed to initiate VAPI call",
				data: null
			}
		}
	} catch (error) {
		console.error("Error initiating outbound call:", error)
		return {
			error: "Failed to initiate outbound call",
			success: false,
			data: null
		}
	}
}

// Schedule an outbound call for future execution
export async function scheduleOutboundCall(
	callData: {
		fromPhoneNumberId: number
		toPhoneNumber: string
		agentId: number
		leadId?: number
		metadata?: Record<string, unknown>
	},
	scheduledTime: Date
) {
	return initiateOutboundCall({
		...callData,
		scheduledTime
	})
}

// Get status of an outbound call
export async function getOutboundCallStatus(sessionId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const session = await db_ws
			.select({
				id: voiceSessions.id,
				sessionId: voiceSessions.sessionId,
				status: voiceSessions.status,
				startTime: voiceSessions.startTime,
				endTime: voiceSessions.endTime,
				duration: voiceSessions.duration,
				direction: voiceSessions.direction,
				phoneNumber: voiceSessions.phoneNumber,
				metadata: voiceSessions.metadata,
				agent: {
					id: voiceAgents.id,
					name: voiceAgents.name
				}
			})
			.from(voiceSessions)
			.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
			.where(
				and(
					eq(voiceSessions.id, sessionId),
					eq(voiceSessions.userId, userId),
					eq(voiceSessions.direction, "outgoing")
				)
			)
			.limit(1)

		if (!session || session.length === 0) {
			return {
				error: "Outbound call session not found",
				success: false,
				data: null
			}
		}

		return { data: session[0], success: true, error: null }
	} catch (error) {
		console.error("Error getting outbound call status:", error)
		return {
			error: "Failed to get outbound call status",
			success: false,
			data: null
		}
	}
}

// Cancel a scheduled outbound call
export async function cancelScheduledCall(sessionId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Check if this is a scheduled call that hasn't started yet
		const session = await db_ws
			.select()
			.from(voiceSessions)
			.where(
				and(
					eq(voiceSessions.id, sessionId),
					eq(voiceSessions.userId, userId),
					eq(voiceSessions.direction, "outgoing"),
					eq(voiceSessions.status, "active") // Scheduled calls are marked as active
				)
			)
			.limit(1)

		if (!session || session.length === 0) {
			return {
				error: "Scheduled call not found or cannot be cancelled",
				success: false,
				data: null
			}
		}

		// Check metadata to see if it's actually scheduled
		const metadata = session[0].metadata as {
			custom_data?: { scheduled_time?: string }
		}
		if (!metadata?.custom_data?.scheduled_time) {
			return {
				error: "This call is not scheduled and cannot be cancelled",
				success: false,
				data: null
			}
		}

		// Update session status to failed (cancelled)
		const result = updateVoiceSession(sessionId, {
			status: "failed",
			endTime: new Date()
		})

		return result
	} catch (error) {
		console.error("Error cancelling scheduled call:", error)
		return {
			error: "Failed to cancel scheduled call",
			success: false,
			data: null
		}
	}
}

// Get outbound call history and statistics
export async function getOutboundCallHistory(filter?: {
	agentId?: number
	leadId?: number
	status?: "active" | "completed" | "failed" | "timeout"
	startDate?: Date
	endDate?: Date
	limit?: number
}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [
			eq(voiceSessions.userId, userId),
			eq(voiceSessions.direction, "outgoing")
		]

		// Apply filters
		if (filter?.agentId) {
			whereConditions.push(eq(voiceSessions.agentId, filter.agentId))
		}

		if (filter?.leadId) {
			whereConditions.push(eq(voiceSessions.leadId, filter.leadId))
		}

		if (filter?.status) {
			whereConditions.push(eq(voiceSessions.status, filter.status))
		}

		if (filter?.startDate) {
			whereConditions.push(gte(voiceSessions.startTime, filter.startDate))
		}

		if (filter?.endDate) {
			whereConditions.push(lte(voiceSessions.startTime, filter.endDate))
		}

		const condition = and(...whereConditions)

		const sessions = await db_ws
			.select({
				id: voiceSessions.id,
				sessionId: voiceSessions.sessionId,
				agentId: voiceSessions.agentId,
				leadId: voiceSessions.leadId,
				phoneNumber: voiceSessions.phoneNumber,
				direction: voiceSessions.direction,
				status: voiceSessions.status,
				startTime: voiceSessions.startTime,
				endTime: voiceSessions.endTime,
				duration: voiceSessions.duration,
				transcript: voiceSessions.transcript,
				summary: voiceSessions.summary,
				sentiment: voiceSessions.sentiment,
				recordingUrl: voiceSessions.recordingUrl,
				cost: voiceSessions.cost,
				metadata: voiceSessions.metadata,
				createdAt: voiceSessions.createdAt,
				updatedAt: voiceSessions.updatedAt,
				agent: {
					id: voiceAgents.id,
					name: voiceAgents.name,
					description: voiceAgents.description
				}
			})
			.from(voiceSessions)
			.leftJoin(voiceAgents, eq(voiceSessions.agentId, voiceAgents.id))
			.where(condition)
			.orderBy(desc(voiceSessions.startTime))
			.limit(filter?.limit || 50)

		return { data: sessions, success: true, error: null }
	} catch (error) {
		console.error("Error getting outbound call history:", error)
		return {
			error: "Failed to get outbound call history",
			success: false,
			data: null
		}
	}
}

// Test call function for web-based voice testing (no phone numbers required)
export async function createTestVoiceSession(
	agentId: number,
	metadata?: Record<string, unknown>
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify the agent exists and belongs to the user
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		if (agent[0].status !== "active") {
			return {
				error: "Voice agent is not active",
				success: false,
				data: null
			}
		}

		// Generate a unique session ID for the test call
		const sessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		// Create the test session
		const result = await db_ws
			.insert(voiceSessions)
			.values({
				sessionId,
				agentId,
				userId,
				direction: "outgoing", // Use outgoing for test calls
				status: "active",
				startTime: new Date(),
				phoneNumber: "test-call", // Placeholder for test calls
				metadata: {
					custom_data: {
						test_call: true,
						agent_name: agent[0].name,
						...metadata
					}
				}
			})
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Failed to create test session",
				success: false,
				data: null
			}
		}

		const session = result[0]

		return {
			data: {
				id: session.id,
				sessionId: session.sessionId,
				agentId: session.agentId,
				status: session.status,
				startTime: session.startTime,
				metadata: session.metadata,
				agent: {
					id: agent[0].id,
					name: agent[0].name,
					prompt: agent[0].prompt,
					voice: agent[0].voice,
					language: agent[0].language,
					configuration: agent[0].configuration
				}
			},
			success: true,
			error: null
		}
	} catch (error) {
		console.error("Error creating test voice session:", error)
		return {
			error: "Failed to create test voice session",
			success: false,
			data: null
		}
	}
}

/**
 * Sync existing voice agents with VAPI assistants
 * This function creates VAPI assistants for agents that don't have them yet
 */
export async function syncVoiceAgentsWithVapi() {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Find voice agents without VAPI assistant IDs
		const agentsWithoutVapi = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.userId, userId),
					sql`${voiceAgents.vapiAssistantId} IS NULL`
				)
			)

		if (agentsWithoutVapi.length === 0) {
			return {
				success: true,
				data: {
					synced: 0,
					message: "All agents already have VAPI assistants"
				},
				error: null
			}
		}

		const voiceService = VoiceAgentService.getInstance()
		const errors: string[] = []

		for (const agent of agentsWithoutVapi) {
			try {
				// For existing agents, we'll create a basic VAPI assistant
				// without the full AgentRole/VoicePreset integration
				// This is a fallback sync for legacy agents

				// Skip sync for now - this will be implemented later
				// when we have a direct VAPI assistant creation method
				console.log(
					`Skipping sync for agent ${agent.name} - requires manual recreation with role/preset`
				)
			} catch (error) {
				console.error(`Failed to sync agent ${agent.name}:`, error)
				errors.push(
					`${agent.name}: ${error instanceof Error ? error.message : "Unknown error"}`
				)
			}
		}

		return {
			success: true,
			data: {
				synced: 0,
				total: agentsWithoutVapi.length,
				errors: errors.length > 0 ? errors : undefined
			},
			error: null
		}
	} catch (error) {
		console.error("Error syncing voice agents with VAPI:", error)
		return {
			error: "Failed to sync voice agents with VAPI",
			success: false,
			data: null
		}
	}
}

/**
 * Assign a phone number to a voice agent
 */
export async function assignPhoneNumberToAgent(
	agentId: number,
	phoneNumberId: number | null
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify agent ownership
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		// If phoneNumberId is provided, verify phone number ownership
		if (phoneNumberId) {
			const phoneNumber = await db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, phoneNumberId),
						eq(phoneNumbers.userId, userId)
					)
				)
				.limit(1)

			if (!phoneNumber || phoneNumber.length === 0) {
				return {
					error: "Phone number not found or not owned by user",
					success: false,
					data: null
				}
			}

			// Check if the phone number is already assigned to another agent
			const existingAssignment = await db_ws
				.select()
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.phoneNumberId, phoneNumberId),
						ne(voiceAgents.id, agentId),
						eq(voiceAgents.userId, userId)
					)
				)
				.limit(1)

			if (existingAssignment && existingAssignment.length > 0) {
				return {
					error: "Phone number is already assigned to another agent",
					success: false,
					data: null
				}
			}
		}

		// Update the agent's phone number assignment
		const result = await db_ws
			.update(voiceAgents)
			.set({
				phoneNumberId,
				updatedAt: new Date()
			})
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Failed to update voice agent",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error assigning phone number to agent:", error)
		return {
			error: "Failed to assign phone number to agent",
			success: false,
			data: null
		}
	}
}

/**
 * Update voice agent status
 */
export async function updateVoiceAgentStatus(
	agentId: number,
	status: VoiceAgentStatus
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		// Verify agent ownership
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		// Update the agent's status
		const result = await db_ws
			.update(voiceAgents)
			.set({
				status,
				updatedAt: new Date()
			})
			.where(
				and(eq(voiceAgents.id, agentId), eq(voiceAgents.userId, userId))
			)
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Failed to update voice agent status",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error updating voice agent status:", error)
		return {
			error: "Failed to update voice agent status",
			success: false,
			data: null
		}
	}
}

/**
 * Internal function for initiating outbound calls from background processors
 * This bypasses Clerk authentication and accepts userId as a parameter
 * Should only be called from authenticated background processes
 */
export async function initiateOutboundCallForBackgroundProcessor(
	userId: string,
	data: {
		fromPhoneNumberId: number
		toPhoneNumber: string
		agentId: number
		leadId?: number
		metadata?: Record<string, unknown>
		scheduledTime?: Date
	}
) {
	try {
		// Note: No Clerk auth check here - userId is provided by the processor
		// The caller is responsible for ensuring the userId is valid and authorized

		// Verify ownership of phone number and agent
		const [phoneNumber, agent] = await Promise.all([
			db_ws
				.select()
				.from(phoneNumbers)
				.where(
					and(
						eq(phoneNumbers.id, data.fromPhoneNumberId),
						eq(phoneNumbers.userId, userId),
						eq(phoneNumbers.status, "active")
					)
				)
				.limit(1),
			db_ws
				.select()
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, data.agentId),
						eq(voiceAgents.userId, userId),
						eq(voiceAgents.status, "active")
					)
				)
				.limit(1)
		])

		if (!phoneNumber || phoneNumber.length === 0) {
			return {
				error: "Phone number not found or inactive",
				success: false,
				data: null
			}
		}

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found or inactive",
				success: false,
				data: null
			}
		}

		// Check if this is a scheduled call for the future
		if (data.scheduledTime && data.scheduledTime > new Date()) {
			// For scheduled calls, we'll store the session as pending
			const sessionResult =
				await createVoiceSessionForBackgroundProcessor(userId, {
					agentId: data.agentId,
					leadId: data.leadId,
					phoneNumber: data.toPhoneNumber,
					direction: "outgoing",
					metadata: {
						...data.metadata,
						custom_data: {
							from_phone_number_id: data.fromPhoneNumberId,
							from_phone_number: phoneNumber[0].number,
							scheduled_time: data.scheduledTime.toISOString(),
							status: "scheduled"
						}
					}
				})

			if (!sessionResult.success) {
				return sessionResult
			}

			return {
				success: true,
				data: {
					session: sessionResult.data,
					agent: agent[0],
					phoneNumber: phoneNumber[0],
					scheduled: true
				},
				error: null
			}
		}

		// For immediate calls, create active session first
		const sessionResult = await createVoiceSessionForBackgroundProcessor(
			userId,
			{
				agentId: data.agentId,
				leadId: data.leadId,
				phoneNumber: data.toPhoneNumber,
				direction: "outgoing",
				metadata: {
					...data.metadata,
					custom_data: {
						from_phone_number_id: data.fromPhoneNumberId,
						from_phone_number: phoneNumber[0].number
					}
				}
			}
		)

		if (!sessionResult.success) {
			return sessionResult
		}

		// Actually initiate the VAPI call
		try {
			const { vapiCallClient } = await import("@/lib/vapi-call-client")

			const vapiCallResult = await vapiCallClient.initiateOutboundCall({
				phoneNumberId: phoneNumber[0].number,
				customerPhoneNumber: data.toPhoneNumber,
				assistantId: agent[0].vapiAssistantId || undefined,
				assistantOverrides: agent[0].vapiAssistantId
					? undefined
					: {
							name: agent[0].name,
							firstMessage:
								agent[0].firstMessage ||
								`Hello! I'm ${agent[0].name}. How can I help you today?`,
							prompt:
								agent[0].prompt ||
								"You are a helpful AI assistant making an outbound call.",
							voice: agent[0].voice
								? {
										provider: agent[0].voice.provider as
											| "11labs"
											| "playht"
											| "cartesia",
										voiceId: agent[0].voice.voice_id
									}
								: undefined
						},
				metadata: {
					sessionId: sessionResult.data?.sessionId,
					leadId: data.leadId,
					agentId: data.agentId,
					...data.metadata
				}
			})

			if (!vapiCallResult.success) {
				// Update session to failed
				if (sessionResult.data) {
					await updateVoiceSessionForBackgroundProcessor(
						userId,
						sessionResult.data.id,
						{
							status: "failed"
						}
					)
				}
				return {
					success: false,
					error:
						vapiCallResult.error || "Failed to initiate VAPI call",
					data: null
				}
			}

			// Update session with VAPI call ID
			if (sessionResult.data && vapiCallResult.data) {
				await updateVoiceSessionForBackgroundProcessor(
					userId,
					sessionResult.data.id,
					{
						status: "active"
					}
				)
			}

			return {
				success: true,
				data: {
					session: sessionResult.data,
					agent: agent[0],
					phoneNumber: phoneNumber[0],
					scheduled: false,
					vapiCallId: vapiCallResult.data?.callId
				},
				error: null
			}
		} catch (error) {
			console.error("Error initiating VAPI call:", error)

			// Update session to failed
			if (sessionResult.data) {
				await updateVoiceSessionForBackgroundProcessor(
					userId,
					sessionResult.data.id,
					{
						status: "failed"
					}
				)
			}

			return {
				success: false,
				error: "Failed to initiate VAPI call",
				data: null
			}
		}
	} catch (error) {
		console.error("Error initiating outbound call:", error)
		return {
			error: "Failed to initiate outbound call",
			success: false,
			data: null
		}
	}
}

/**
 * Internal function for creating voice sessions from background processors
 * This bypasses Clerk authentication and accepts userId as a parameter
 */
export async function createVoiceSessionForBackgroundProcessor(
	userId: string,
	data: VoiceSessionCreateRequest
) {
	try {
		// Note: No Clerk auth check here - userId is provided by the processor

		// Verify agent ownership
		const agent = await db_ws
			.select()
			.from(voiceAgents)
			.where(
				and(
					eq(voiceAgents.id, data.agentId),
					eq(voiceAgents.userId, userId)
				)
			)
			.limit(1)

		if (!agent || agent.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		// Generate a unique session ID for Vapi AI
		const vapiSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		const result = await db_ws
			.insert(voiceSessions)
			.values({
				sessionId: vapiSessionId,
				agentId: data.agentId,
				leadId: data.leadId,
				phoneNumber: data.phoneNumber,
				direction: data.direction,
				status: "active",
				metadata: data.metadata || {},
				userId
			})
			.returning()

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error creating voice session:", error)
		return {
			error: "Failed to create voice session",
			success: false,
			data: null
		}
	}
}

/**
 * Internal function for updating voice sessions from background processors
 * This bypasses Clerk authentication and accepts userId as a parameter
 */
export async function updateVoiceSessionForBackgroundProcessor(
	userId: string,
	id: number,
	data: {
		status?: "active" | "completed" | "failed" | "timeout"
		endTime?: Date
		duration?: number
		transcript?: string
		summary?: string
		sentiment?: string
		recordingUrl?: string
		cost?: string
	}
) {
	try {
		// Note: No Clerk auth check here - userId is provided by the processor

		const result = await db_ws
			.update(voiceSessions)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(
				and(eq(voiceSessions.id, id), eq(voiceSessions.userId, userId))
			)
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Voice session not found",
				success: false,
				data: null
			}
		}

		return { data: result[0], success: true, error: null }
	} catch (error) {
		console.error("Error updating voice session:", error)
		return {
			error: "Failed to update voice session",
			success: false,
			data: null
		}
	}
}
