"use server"

import { getAgentRole } from "@/actions/agent-roles"
import { getVoicePreset } from "@/actions/voice-presets"
import { db_ws } from "@/db"
import { voiceAgents } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import {
	OPENAI_REALTIME_MODEL,
	normalizeOpenAIVoiceId
} from "@/lib/openai/realtime-voice"
import { teamScope, withTeamId } from "@/lib/team-scope"
import type {
	VoiceAgent,
	VoiceAgentStatus,
	VoiceAgentUpdateRequest,
	VoiceSettings
} from "@/types"
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm"
import { z } from "zod"

// Define types for filtering
export type VoiceAgentFilter = {
	search?: string
	status?: VoiceAgentStatus[]
	orderBy?: "id" | "name" | "status" | "createdAt" | "updatedAt"
	orderDir?: "asc" | "desc"
}

const voiceAgentFilterSchema = z
	.object({
		search: z.string().trim().min(1).optional(),
		status: z
			.array(z.enum(["active", "inactive", "training", "error"]))
			.optional(),
		orderBy: z
			.enum(["id", "name", "status", "createdAt", "updatedAt"])
			.optional(),
		orderDir: z.enum(["asc", "desc"]).optional()
	})
	.default({})

const DEFAULT_VOICE: VoiceSettings = {
	provider: "openai",
	voice_id: "alloy",
	model: OPENAI_REALTIME_MODEL
}

type VoiceAgentRow = {
	id: number
	name: string
	description: string | null
	prompt: string | null
	voice: VoiceSettings | null
	language: string | null
	status: VoiceAgentStatus | null
	configuration: Record<string, unknown> | null
	firstMessage: string | null
	agentRoleId: number | null
	voicePresetId: number | null
	createdAt: Date
	updatedAt: Date
	userId: string
	teamId: string
}

function normalizeVoiceAgent(agent: VoiceAgentRow): VoiceAgent {
	return {
		...agent,
		prompt: agent.prompt || "",
		voice: agent.voice || DEFAULT_VOICE,
		status: agent.status || "inactive",
		configuration: agent.configuration || null,
		firstMessage: agent.firstMessage || null,
		agentRoleId: agent.agentRoleId ?? null,
		voicePresetId: agent.voicePresetId ?? null
	}
}

// Get all voice agents with optional filtering
export async function getVoiceAgents(
	rawFilter: VoiceAgentFilter = {}
): Promise<{
	data: VoiceAgent[] | null
	success: boolean
	error: string | null
}> {
	try {
		const filter = voiceAgentFilterSchema.parse(rawFilter)
		const { teamId } = await requireTeam()

		const conditions = [teamScope(voiceAgents, teamId)]

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
			conditions.push(inArray(voiceAgents.status, filter.status))
		}

		const orderColumns = {
			id: voiceAgents.id,
			name: voiceAgents.name,
			status: voiceAgents.status,
			createdAt: voiceAgents.createdAt,
			updatedAt: voiceAgents.updatedAt
		} as const

		const orderColumn = filter.orderBy
			? orderColumns[filter.orderBy]
			: voiceAgents.updatedAt
		const orderDirection = filter.orderDir === "asc" ? asc : desc

		const agentsData = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				description: voiceAgents.description,
				prompt: voiceAgents.prompt,
				voice: voiceAgents.voice,
				language: voiceAgents.language,
				status: voiceAgents.status,
				configuration: voiceAgents.configuration,
				firstMessage: voiceAgents.firstMessage,
				agentRoleId: voiceAgents.agentRoleId,
				voicePresetId: voiceAgents.voicePresetId,
				createdAt: voiceAgents.createdAt,
				updatedAt: voiceAgents.updatedAt,
				userId: voiceAgents.userId,
				teamId: voiceAgents.teamId
			})
			.from(voiceAgents)
			.where(and(...conditions))
			.orderBy(orderDirection(orderColumn))

		return {
			data: agentsData.map((agent) => normalizeVoiceAgent(agent)),
			success: true,
			error: null
		}
	} catch (error) {
		console.error("Error fetching voice agents:", error)
		return {
			error: "Failed to fetch voice agents",
			success: false,
			data: null
		}
	}
}

/**
 * Create a voice agent from a role + voice preset
 */
export async function createVoiceAgentWithRole(data: {
	name: string
	description?: string
	agentRoleId: number
	voicePresetId: number
	language: string
	status?: VoiceAgentStatus
	industryContext?: string
}) {
	try {
		const { teamId, user } = await requireTeam()

		const [agentRole, voicePreset] = await Promise.all([
			getAgentRole(data.agentRoleId),
			getVoicePreset(data.voicePresetId)
		])

		if (!agentRole) {
			return { error: "Agent role not found", success: false, data: null }
		}

		if (!voicePreset) {
			return {
				error: "Voice preset not found",
				success: false,
				data: null
			}
		}

		const voiceConfig: VoiceSettings = {
			provider: "openai",
			voice_id: normalizeOpenAIVoiceId(
				voicePreset.vapiVoiceId,
				Math.max((voicePreset.sortOrder || 1) - 1, 0)
			),
			model: OPENAI_REALTIME_MODEL
		}

		const basePrompt = agentRole.systemPrompt
		const prompt = data.industryContext
			? `${basePrompt}\n\nIndustry Context: ${data.industryContext}`
			: basePrompt

		const firstMessage =
			agentRole.firstMessageTemplate?.replace(
				"{{agent_name}}",
				data.name
			) ||
			`Hello! I'm ${data.name}, your ${agentRole.displayName.toLowerCase()}. How can I help you today?`

		const result = await db_ws
			.insert(voiceAgents)
			.values(
				withTeamId(
					{
						name: data.name,
						description: data.description || null,
						prompt,
						voice: voiceConfig,
						language: data.language,
						status: data.status || "inactive",
						configuration: agentRole.defaultConfiguration || {},
						firstMessage,
						agentRoleId: data.agentRoleId,
						voicePresetId: data.voicePresetId,
						createdByUserId: user.id,
						userId: user.id,
						createdAt: new Date(),
						updatedAt: new Date()
					},
					teamId
				)
			)
			.returning()

		const createdAgent = result[0] ? normalizeVoiceAgent(result[0]) : null

		if (createdAgent) {
			await logAuditEvent({
				teamId,
				actorUserId: user.id,
				action: "voice_agent_created",
				entityType: "voice_agent",
				entityId: createdAgent.id,
				metadata: {
					name: createdAgent.name,
					roleId: createdAgent.agentRoleId
				}
			})
		}

		return {
			data: createdAgent,
			success: true,
			error: null
		}
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
		const { teamId, user } = await requireTeam()

		const result = await db_ws
			.update(voiceAgents)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(and(eq(voiceAgents.id, id), teamScope(voiceAgents, teamId)))
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		const updatedAgent = normalizeVoiceAgent(result[0])
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "voice_agent_updated",
			entityType: "voice_agent",
			entityId: updatedAgent.id,
			metadata: {
				updatedFields: Object.keys(data)
			}
		})

		return {
			data: updatedAgent,
			success: true,
			error: null
		}
	} catch (error) {
		console.error("Error updating voice agent:", error)
		return {
			error: "Failed to update voice agent",
			success: false,
			data: null
		}
	}
}

// Update voice agent status only
export async function updateVoiceAgentStatus(
	id: number,
	status: VoiceAgentStatus
) {
	try {
		const { teamId, user } = await requireTeam()

		const result = await db_ws
			.update(voiceAgents)
			.set({
				status,
				updatedAt: new Date()
			})
			.where(and(eq(voiceAgents.id, id), teamScope(voiceAgents, teamId)))
			.returning()

		if (!result || result.length === 0) {
			return {
				error: "Voice agent not found",
				success: false,
				data: null
			}
		}

		const updatedAgent = normalizeVoiceAgent(result[0])
		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "voice_agent_status_updated",
			entityType: "voice_agent",
			entityId: updatedAgent.id,
			metadata: {
				status
			}
		})

		return {
			data: updatedAgent,
			success: true,
			error: null
		}
	} catch (error) {
		console.error("Error updating voice agent status:", error)
		return {
			error: "Failed to update voice agent status",
			success: false,
			data: null
		}
	}
}
