"use server"

import { db_ws as db } from "@/db"
import {
	voiceAgents,
	voiceSessions,
	agentRoles,
	voicePresets,
	adminSettings,
	users,
	teamMembers
} from "@/db/schema"
import type { VoiceAgent, VoiceAgentStatus } from "@/types"
import { currentUser } from "@/lib/auth/session"
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

// Admin authentication helper
async function requireAdmin() {
	const user = await currentUser()
	const ownerUserId = process.env.OWNER_USER_ID

	if (!user || !ownerUserId || user.id !== ownerUserId) {
		throw new Error("Admin access required")
	}

	return user
}

// Database voice agent type for nullable fields
interface DatabaseVoiceAgent {
	id: number
	name: string
	description: string | null
	prompt: string | null
	voice: Record<string, unknown> | null
	language: string | null
	status: VoiceAgentStatus | null
	configuration: Record<string, unknown> | null
	firstMessage: string | null
	createdAt: Date
	updatedAt: Date
	userId: string
}

// Session data type
interface SessionData {
	agentId: number
	count: number
	lastSession: Date | null
}

// Database query result type
interface AgentQueryResult {
	id: number
	name: string
	description: string | null
	prompt: string | null
	voice: Record<string, unknown> | null
	language: string | null
	status: VoiceAgentStatus | null
	configuration: Record<string, unknown> | null
	firstMessage: string | null
	createdAt: Date
	updatedAt: Date
	userId: string
	agentRoleId: number | null
	voicePresetId: number | null
	// Agent role fields
	agentRoleId_: number | null
	agentRoleDisplayName: string | null
	agentRoleSystemPrompt: string | null
	// Voice preset fields
	voicePresetId_: number | null
	voicePresetDisplayName: string | null
	voicePresetVapiProvider: string | null
	voicePresetVapiVoiceId: string | null
}

// Enhanced voice agent with user and phone number info
interface AdminVoiceAgentWithDetails extends DatabaseVoiceAgent {
	user: {
		id: string
		email: string | null
		firstName: string | null
		lastName: string | null
	} | null
	agentRole: {
		id: number
		displayName: string
		systemPrompt: string
	} | null
	voicePreset: {
		id: number
		displayName: string
		vapiProvider: string
		vapiVoiceId: string
	} | null
	sessionsCount: number
	lastSessionDate: Date | null
}

type UserSummary = {
	id: string
	email: string | null
	name: string | null
}

function splitName(name: string | null) {
	if (!name) return { firstName: null, lastName: null }
	const parts = name.trim().split(/\s+/)
	if (parts.length === 1) return { firstName: parts[0], lastName: null }
	return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

async function getUserMap(userIds: string[]) {
	if (!userIds.length) return new Map<string, UserSummary>()
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name
		})
		.from(users)
		.where(inArray(users.id, userIds))

	return new Map(rows.map((row) => [row.id, row]))
}

async function resolveUserTeamId(userId: string) {
	const [user] = await db
		.select({ defaultTeamId: users.defaultTeamId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	if (user?.defaultTeamId) {
		return user.defaultTeamId
	}

	const [membership] = await db
		.select({ teamId: teamMembers.teamId })
		.from(teamMembers)
		.where(eq(teamMembers.userId, userId))
		.limit(1)

	return membership?.teamId ?? null
}

function buildUserPayload(userId: string, userMap: Map<string, UserSummary>) {
	const user = userMap.get(userId)
	const { firstName, lastName } = splitName(user?.name ?? null)
	return {
		id: userId,
		email: user?.email ?? null,
		firstName,
		lastName
	}
}

// Status distribution type
interface StatusDistribution {
	[key: string]: number
}

// Language distribution type
interface LanguageDistribution {
	[key: string]: number
}

// Type definitions for admin settings
export interface AdminSettingValue {
	// System prompts
	systemPrompt?: string
	industryPrompts?: Record<string, string>

	// Model configurations
	defaultModel?: string
	availableModels?: Array<{
		id: string
		name: string
		provider: string
		description: string
		costPerToken?: number
		maxTokens?: number
	}>

	// Voice agent defaults
	defaultVoiceSettings?: {
		provider?: string
		voiceId?: string
		speed?: number
		stability?: number
		similarityBoost?: number
	}

	// A/B testing configurations
	abTestConfigs?: Array<{
		name: string
		variants: Array<{
			name: string
			weight: number
			config: Record<string, unknown>
		}>
		isActive: boolean
	}>

	// Global prompt templates
	promptTemplates?: Array<{
		id: string
		name: string
		category: string
		template: string
		variables: string[]
	}>

	// Platform configurations
	platformSettings?: {
		maxAgentsPerUser?: number
		defaultLanguage?: string
		enableAnalytics?: boolean
		enableRecording?: boolean
	}

	// Any other configuration data
	[key: string]: unknown
}

export interface AdminSetting {
	id: number
	settingKey: string
	settingValue: AdminSettingValue
	description: string | null
	isActive: boolean
	createdAt: Date
	updatedAt: Date
	createdBy: string
}

/**
 * Get all voice agents across all users with comprehensive details
 */
export async function getAllVoiceAgents(): Promise<
	AdminVoiceAgentWithDetails[]
> {
	await requireAdmin()

	try {
		// Get voice agents with phone number, role, and preset data
		const agentsData = await db
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
				createdAt: voiceAgents.createdAt,
				updatedAt: voiceAgents.updatedAt,
				userId: voiceAgents.userId,
				agentRoleId: voiceAgents.agentRoleId,
				voicePresetId: voiceAgents.voicePresetId,
				// Agent role data
				agentRoleId_: agentRoles.id,
				agentRoleDisplayName: agentRoles.displayName,
				agentRoleSystemPrompt: agentRoles.systemPrompt,
				// Voice preset data
				voicePresetId_: voicePresets.id,
				voicePresetDisplayName: voicePresets.displayName,
				voicePresetVapiProvider: voicePresets.vapiProvider,
				voicePresetVapiVoiceId: voicePresets.vapiVoiceId
			})
			.from(voiceAgents)
			.leftJoin(agentRoles, eq(voiceAgents.agentRoleId, agentRoles.id))
			.leftJoin(
				voicePresets,
				eq(voiceAgents.voicePresetId, voicePresets.id)
			)
			.orderBy(desc(voiceAgents.updatedAt))

		// Get session counts and last session dates for each agent
		const sessionsData = await db
			.select({
				agentId: voiceSessions.agentId,
				count: count(voiceSessions.id),
				lastSession: sql<Date | null>`MAX(${voiceSessions.startTime})`
			})
			.from(voiceSessions)
			.groupBy(voiceSessions.agentId)

		// Create a map for quick lookup
		const sessionsMap = new Map(
			sessionsData.map((s: SessionData) => [
				s.agentId,
				{ count: s.count, lastSession: s.lastSession }
			])
		)

		const userMap = await getUserMap(
			Array.from(new Set(agentsData.map((agent) => agent.userId)))
		)

		// Transform and combine data
		const transformedData: AdminVoiceAgentWithDetails[] = agentsData.map(
			(agent: AgentQueryResult) => ({
				id: agent.id,
				name: agent.name,
				description: agent.description,
				prompt: agent.prompt,
				voice: agent.voice,
				language: agent.language,
				status: agent.status,
				configuration: agent.configuration,
				firstMessage: agent.firstMessage,
				createdAt: agent.createdAt,
				updatedAt: agent.updatedAt,
				userId: agent.userId,
				user: buildUserPayload(agent.userId, userMap),
				agentRole:
					agent.agentRoleId_ &&
					agent.agentRoleDisplayName &&
					agent.agentRoleSystemPrompt
						? {
								id: agent.agentRoleId_,
								displayName: agent.agentRoleDisplayName,
								systemPrompt: agent.agentRoleSystemPrompt
							}
						: null,
				voicePreset:
					agent.voicePresetId_ &&
					agent.voicePresetDisplayName &&
					agent.voicePresetVapiProvider &&
					agent.voicePresetVapiVoiceId
						? {
								id: agent.voicePresetId_,
								displayName: agent.voicePresetDisplayName,
								vapiProvider: agent.voicePresetVapiProvider,
								vapiVoiceId: agent.voicePresetVapiVoiceId
							}
						: null,
				sessionsCount: sessionsMap.get(agent.id)?.count || 0,
				lastSessionDate: sessionsMap.get(agent.id)?.lastSession || null
			})
		)

		return transformedData
	} catch (error) {
		console.error("Error fetching all voice agents:", error)
		throw new Error("Failed to fetch voice agents")
	}
}

/**
 * Get voice agents for a specific user (admin only)
 */
export async function getVoiceAgentsByUser(
	userId: string
): Promise<AdminVoiceAgentWithDetails[]> {
	await requireAdmin()

	try {
		// Get voice agents for specific user with comprehensive details
		const agentsData = await db
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
				createdAt: voiceAgents.createdAt,
				updatedAt: voiceAgents.updatedAt,
				userId: voiceAgents.userId,
				agentRoleId: voiceAgents.agentRoleId,
				voicePresetId: voiceAgents.voicePresetId,
				// Agent role data
				agentRoleId_: agentRoles.id,
				agentRoleDisplayName: agentRoles.displayName,
				agentRoleSystemPrompt: agentRoles.systemPrompt,
				// Voice preset data
				voicePresetId_: voicePresets.id,
				voicePresetDisplayName: voicePresets.displayName,
				voicePresetVapiProvider: voicePresets.vapiProvider,
				voicePresetVapiVoiceId: voicePresets.vapiVoiceId
			})
			.from(voiceAgents)
			.leftJoin(agentRoles, eq(voiceAgents.agentRoleId, agentRoles.id))
			.leftJoin(
				voicePresets,
				eq(voiceAgents.voicePresetId, voicePresets.id)
			)
			.where(eq(voiceAgents.userId, userId))
			.orderBy(desc(voiceAgents.updatedAt))

		// Get agent IDs for session lookup
		const agentIds = agentsData.map((a: AgentQueryResult) => a.id)

		// Get session data for these agents if any exist
		let sessionsData: SessionData[] = []
		if (agentIds.length > 0) {
			sessionsData = await db
				.select({
					agentId: voiceSessions.agentId,
					count: count(voiceSessions.id),
					lastSession: sql<Date | null>`MAX(${voiceSessions.startTime})`
				})
				.from(voiceSessions)
				.where(inArray(voiceSessions.agentId, agentIds))
				.groupBy(voiceSessions.agentId)
		}

		// Create a map for quick lookup
		const sessionsMap = new Map(
			sessionsData.map((s: SessionData) => [
				s.agentId,
				{ count: s.count, lastSession: s.lastSession }
			])
		)

		const userMap = await getUserMap([userId])

		// Transform and combine data
		const transformedData: AdminVoiceAgentWithDetails[] = agentsData.map(
			(agent: AgentQueryResult) => ({
				id: agent.id,
				name: agent.name,
				description: agent.description,
				prompt: agent.prompt,
				voice: agent.voice,
				language: agent.language,
				status: agent.status,
				configuration: agent.configuration,
				firstMessage: agent.firstMessage,
				createdAt: agent.createdAt,
				updatedAt: agent.updatedAt,
				userId: agent.userId,
				user: buildUserPayload(agent.userId, userMap),
				agentRole:
					agent.agentRoleId_ &&
					agent.agentRoleDisplayName &&
					agent.agentRoleSystemPrompt
						? {
								id: agent.agentRoleId_,
								displayName: agent.agentRoleDisplayName,
								systemPrompt: agent.agentRoleSystemPrompt
							}
						: null,
				voicePreset:
					agent.voicePresetId_ &&
					agent.voicePresetDisplayName &&
					agent.voicePresetVapiProvider &&
					agent.voicePresetVapiVoiceId
						? {
								id: agent.voicePresetId_,
								displayName: agent.voicePresetDisplayName,
								vapiProvider: agent.voicePresetVapiProvider,
								vapiVoiceId: agent.voicePresetVapiVoiceId
							}
						: null,
				sessionsCount: sessionsMap.get(agent.id)?.count || 0,
				lastSessionDate: sessionsMap.get(agent.id)?.lastSession || null
			})
		)

		return transformedData
	} catch (error) {
		console.error("Error fetching voice agents by user:", error)
		throw new Error("Failed to fetch user voice agents")
	}
}

/**
 * Update voice agent status (admin only)
 */
export async function updateVoiceAgentStatus(
	agentId: number,
	status: VoiceAgentStatus
): Promise<void> {
	await requireAdmin()

	try {
		await db
			.update(voiceAgents)
			.set({
				status,
				updatedAt: new Date()
			})
			.where(eq(voiceAgents.id, agentId))
	} catch (error) {
		console.error("Error updating voice agent status:", error)
		throw new Error("Failed to update voice agent status")
	}
}

/**
 * Delete voice agent (admin only)
 */
export async function deleteVoiceAgent(agentId: number): Promise<void> {
	await requireAdmin()

	try {
		// First delete related sessions (if any cascade is not set)
		await db.delete(voiceSessions).where(eq(voiceSessions.agentId, agentId))

		// Then delete the agent
		await db.delete(voiceAgents).where(eq(voiceAgents.id, agentId))
	} catch (error) {
		console.error("Error deleting voice agent:", error)
		throw new Error("Failed to delete voice agent")
	}
}

/**
 * Get voice agent statistics for admin dashboard
 */
export async function getVoiceAgentStats() {
	await requireAdmin()

	try {
		// Get total counts
		const totalAgents = await db
			.select({ count: count(voiceAgents.id) })
			.from(voiceAgents)

		const activeAgents = await db
			.select({ count: count(voiceAgents.id) })
			.from(voiceAgents)
			.where(eq(voiceAgents.status, "active"))

		// Get total sessions across all agents
		const totalSessions = await db
			.select({ count: count(voiceSessions.id) })
			.from(voiceSessions)

		// Get status distribution
		const statusDistributionResult = await db
			.select({
				status: voiceAgents.status,
				count: count(voiceAgents.id)
			})
			.from(voiceAgents)
			.groupBy(voiceAgents.status)

		// Get language distribution
		const languageDistributionResult = await db
			.select({
				language: voiceAgents.language,
				count: count(voiceAgents.id)
			})
			.from(voiceAgents)
			.groupBy(voiceAgents.language)

		// Get agents created in last 30 days
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

		const recentAgents = await db
			.select({ count: count(voiceAgents.id) })
			.from(voiceAgents)
			.where(sql`${voiceAgents.createdAt} >= ${thirtyDaysAgo}`)

		return {
			totalAgents: totalAgents[0]?.count || 0,
			activeAgents: activeAgents[0]?.count || 0,
			agentsWithPhoneNumbers: 0,
			totalSessions: totalSessions[0]?.count || 0,
			recentAgents: recentAgents[0]?.count || 0,
			statusDistribution: statusDistributionResult.reduce(
				(
					acc: StatusDistribution,
					item: { status: VoiceAgentStatus | null; count: number }
				) => {
					acc[item.status || "unknown"] = item.count
					return acc
				},
				{}
			),
			languageDistribution: languageDistributionResult.reduce(
				(
					acc: LanguageDistribution,
					item: { language: string | null; count: number }
				) => {
					acc[item.language || "unknown"] = item.count
					return acc
				},
				{}
			)
		}
	} catch (error) {
		console.error("Error fetching voice agent stats:", error)
		throw new Error("Failed to fetch voice agent statistics")
	}
}

/**
 * Search voice agents across all users (admin only)
 */
export async function searchVoiceAgents(
	query: string
): Promise<AdminVoiceAgentWithDetails[]> {
	await requireAdmin()

	if (!query || query.trim().length === 0) {
		return getAllVoiceAgents()
	}

	try {
		const searchTerm = `%${query.toLowerCase()}%`

		// Search voice agents with comprehensive details
		const agentsData = await db
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
				createdAt: voiceAgents.createdAt,
				updatedAt: voiceAgents.updatedAt,
				userId: voiceAgents.userId,
				agentRoleId: voiceAgents.agentRoleId,
				voicePresetId: voiceAgents.voicePresetId,
				// Agent role data
				agentRoleId_: agentRoles.id,
				agentRoleDisplayName: agentRoles.displayName,
				agentRoleSystemPrompt: agentRoles.systemPrompt,
				// Voice preset data
				voicePresetId_: voicePresets.id,
				voicePresetDisplayName: voicePresets.displayName,
				voicePresetVapiProvider: voicePresets.vapiProvider,
				voicePresetVapiVoiceId: voicePresets.vapiVoiceId
			})
			.from(voiceAgents)
			.leftJoin(agentRoles, eq(voiceAgents.agentRoleId, agentRoles.id))
			.leftJoin(
				voicePresets,
				eq(voiceAgents.voicePresetId, voicePresets.id)
			)
			.where(
				or(
					ilike(voiceAgents.name, searchTerm),
					ilike(voiceAgents.description, searchTerm),
					ilike(voiceAgents.userId, searchTerm),
					ilike(agentRoles.displayName, searchTerm),
					ilike(voicePresets.displayName, searchTerm)
				)
			)
			.orderBy(desc(voiceAgents.updatedAt))

		// Get agent IDs for session lookup
		const agentIds = agentsData.map((a: AgentQueryResult) => a.id)

		// Get session data for these agents if any exist
		let sessionsData: SessionData[] = []
		if (agentIds.length > 0) {
			sessionsData = await db
				.select({
					agentId: voiceSessions.agentId,
					count: count(voiceSessions.id),
					lastSession: sql<Date | null>`MAX(${voiceSessions.startTime})`
				})
				.from(voiceSessions)
				.where(inArray(voiceSessions.agentId, agentIds))
				.groupBy(voiceSessions.agentId)
		}

		// Create a map for quick lookup
		const sessionsMap = new Map(
			sessionsData.map((s: SessionData) => [
				s.agentId,
				{ count: s.count, lastSession: s.lastSession }
			])
		)

		const userMap = await getUserMap(
			Array.from(new Set(agentsData.map((agent) => agent.userId)))
		)

		// Transform and combine data
		const transformedData: AdminVoiceAgentWithDetails[] = agentsData.map(
			(agent: AgentQueryResult) => ({
				id: agent.id,
				name: agent.name,
				description: agent.description,
				prompt: agent.prompt,
				voice: agent.voice,
				language: agent.language,
				status: agent.status,
				configuration: agent.configuration,
				firstMessage: agent.firstMessage,
				createdAt: agent.createdAt,
				updatedAt: agent.updatedAt,
				userId: agent.userId,
				user: buildUserPayload(agent.userId, userMap),
				agentRole:
					agent.agentRoleId_ &&
					agent.agentRoleDisplayName &&
					agent.agentRoleSystemPrompt
						? {
								id: agent.agentRoleId_,
								displayName: agent.agentRoleDisplayName,
								systemPrompt: agent.agentRoleSystemPrompt
							}
						: null,
				voicePreset:
					agent.voicePresetId_ &&
					agent.voicePresetDisplayName &&
					agent.voicePresetVapiProvider &&
					agent.voicePresetVapiVoiceId
						? {
								id: agent.voicePresetId_,
								displayName: agent.voicePresetDisplayName,
								vapiProvider: agent.voicePresetVapiProvider,
								vapiVoiceId: agent.voicePresetVapiVoiceId
							}
						: null,
				sessionsCount: sessionsMap.get(agent.id)?.count || 0,
				lastSessionDate: sessionsMap.get(agent.id)?.lastSession || null
			})
		)

		return transformedData
	} catch (error) {
		console.error("Error searching voice agents:", error)
		throw new Error("Failed to search voice agents")
	}
}

/**
 * Create voice agent for a specific user (admin only)
 */
export async function createVoiceAgentForUser(data: {
	name: string
	description?: string
	userId: string
	agentRoleId?: number
	voicePresetId?: number
	language?: string
	status?: VoiceAgentStatus
}): Promise<DatabaseVoiceAgent> {
	const admin = await requireAdmin()

	try {
		const teamId = await resolveUserTeamId(data.userId)
		if (!teamId) {
			throw new Error("User does not belong to a team")
		}

		const [newAgent] = await db
			.insert(voiceAgents)
			.values({
				name: data.name,
				description: data.description || null,
				teamId,
				userId: data.userId,
				createdByUserId: admin.id,
				agentRoleId: data.agentRoleId || null,
				voicePresetId: data.voicePresetId || null,
				language: data.language || "en",
				status: data.status || "inactive",
				prompt: null, // Will be generated from role
				voice: null, // Will be generated from preset
				configuration: {},
				firstMessage: null,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		return newAgent as DatabaseVoiceAgent
	} catch (error) {
		console.error("Error creating voice agent for user:", error)
		throw new Error("Failed to create voice agent")
	}
}

/**
 * Update voice agent prompt (admin only)
 */
export async function updateVoiceAgentPrompt(
	agentId: number,
	prompt: string
): Promise<void> {
	await requireAdmin()

	try {
		await db
			.update(voiceAgents)
			.set({
				prompt,
				updatedAt: new Date()
			})
			.where(eq(voiceAgents.id, agentId))
	} catch (error) {
		console.error("Error updating voice agent prompt:", error)
		throw new Error("Failed to update voice agent prompt")
	}
}

/**
 * Get all admin settings
 */
export async function getAdminSettings(): Promise<AdminSetting[]> {
	await requireAdmin()

	try {
		const settings = await db
			.select()
			.from(adminSettings)
			.where(eq(adminSettings.isActive, true))
			.orderBy(adminSettings.settingKey)

		return settings as AdminSetting[]
	} catch (error) {
		console.error("Error fetching admin settings:", error)
		throw new Error("Failed to fetch admin settings")
	}
}

/**
 * Get a specific admin setting by key
 */
export async function getAdminSetting(
	key: string
): Promise<AdminSetting | null> {
	await requireAdmin()

	try {
		const [setting] = await db
			.select()
			.from(adminSettings)
			.where(
				and(
					eq(adminSettings.settingKey, key),
					eq(adminSettings.isActive, true)
				)
			)
			.limit(1)

		return (setting as AdminSetting) || null
	} catch (error) {
		console.error("Error fetching admin setting:", error)
		throw new Error("Failed to fetch admin setting")
	}
}

/**
 * Update or create an admin setting
 */
export async function updateAdminSetting(
	key: string,
	value: AdminSettingValue,
	description?: string
): Promise<AdminSetting> {
	const admin = await requireAdmin()

	try {
		// Check if setting exists
		const existing = await getAdminSetting(key)

		if (existing) {
			// Update existing setting
			const [updated] = await db
				.update(adminSettings)
				.set({
					settingValue: value,
					description: description || existing.description,
					updatedAt: new Date()
				})
				.where(eq(adminSettings.id, existing.id))
				.returning()

			return updated as AdminSetting
		}

		// Create new setting
		const [created] = await db
			.insert(adminSettings)
			.values({
				settingKey: key,
				settingValue: value,
				description: description || null,
				createdBy: admin.id,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		return created as AdminSetting
	} catch (error) {
		console.error("Error updating admin setting:", error)
		throw new Error("Failed to update admin setting")
	}
}

/**
 * Get the global base system prompt that gets applied to all new agents
 */
export async function getBaseSystemPrompt(): Promise<string> {
	try {
		const setting = await getAdminSetting("base_system_prompt")
		return (
			setting?.settingValue?.systemPrompt ||
			"You are a helpful AI assistant."
		)
	} catch (error) {
		console.error("Error fetching base system prompt:", error)
		return "You are a helpful AI assistant."
	}
}

/**
 * Update the global base system prompt
 */
export async function updateBaseSystemPrompt(prompt: string): Promise<void> {
	await requireAdmin()

	try {
		await updateAdminSetting(
			"base_system_prompt",
			{ systemPrompt: prompt },
			"Base system prompt applied to all new voice agents"
		)
	} catch (error) {
		console.error("Error updating base system prompt:", error)
		throw new Error("Failed to update base system prompt")
	}
}

/**
 * Get industry-specific prompt templates
 */
export async function getIndustryPrompts(): Promise<Record<string, string>> {
	try {
		const setting = await getAdminSetting("industry_prompts")
		return setting?.settingValue?.industryPrompts || {}
	} catch (error) {
		console.error("Error fetching industry prompts:", error)
		return {}
	}
}

/**
 * Update industry-specific prompt templates
 */
export async function updateIndustryPrompts(
	prompts: Record<string, string>
): Promise<void> {
	await requireAdmin()

	try {
		await updateAdminSetting(
			"industry_prompts",
			{ industryPrompts: prompts },
			"Industry-specific prompt templates for voice agents"
		)
	} catch (error) {
		console.error("Error updating industry prompts:", error)
		throw new Error("Failed to update industry prompts")
	}
}

/**
 * Get available AI models configuration
 */
export async function getAvailableModels(): Promise<
	Array<{
		id: string
		name: string
		provider: string
		description: string
		costPerToken?: number
		maxTokens?: number
	}>
> {
	try {
		const setting = await getAdminSetting("available_models")
		return (
			setting?.settingValue?.availableModels || [
				{
					id: "gpt-4",
					name: "GPT-4",
					provider: "openai",
					description:
						"Most capable model, best for complex conversations",
					costPerToken: 0.00003,
					maxTokens: 8192
				},
				{
					id: "gpt-3.5-turbo",
					name: "GPT-3.5 Turbo",
					provider: "openai",
					description: "Fast and cost-effective for most use cases",
					costPerToken: 0.000002,
					maxTokens: 4096
				}
			]
		)
	} catch (error) {
		console.error("Error fetching available models:", error)
		return []
	}
}

/**
 * Update available AI models configuration
 */
export async function updateAvailableModels(
	models: Array<{
		id: string
		name: string
		provider: string
		description: string
		costPerToken?: number
		maxTokens?: number
	}>
): Promise<void> {
	await requireAdmin()

	try {
		await updateAdminSetting(
			"available_models",
			{ availableModels: models },
			"Available AI models for voice agents"
		)
	} catch (error) {
		console.error("Error updating available models:", error)
		throw new Error("Failed to update available models")
	}
}

/**
 * Get prompt templates for different categories
 */
export async function getPromptTemplates(): Promise<
	Array<{
		id: string
		name: string
		category: string
		template: string
		variables: string[]
	}>
> {
	try {
		const setting = await getAdminSetting("prompt_templates")
		return setting?.settingValue?.promptTemplates || []
	} catch (error) {
		console.error("Error fetching prompt templates:", error)
		return []
	}
}

/**
 * Update prompt templates
 */
export async function updatePromptTemplates(
	templates: Array<{
		id: string
		name: string
		category: string
		template: string
		variables: string[]
	}>
): Promise<void> {
	await requireAdmin()

	try {
		await updateAdminSetting(
			"prompt_templates",
			{ promptTemplates: templates },
			"Reusable prompt templates for voice agents"
		)
	} catch (error) {
		console.error("Error updating prompt templates:", error)
		throw new Error("Failed to update prompt templates")
	}
}

/**
 * Initialize default admin settings if they don't exist
 */
export async function initializeDefaultSettings(): Promise<void> {
	await requireAdmin()

	try {
		// Initialize base system prompt
		const basePrompt = await getAdminSetting("base_system_prompt")
		if (!basePrompt) {
			await updateBaseSystemPrompt(
				"You are a professional AI voice assistant. Be helpful, concise, and natural in your responses. Maintain a friendly but professional tone."
			)
		}

		// Initialize industry prompts
		const industryPrompts = await getIndustryPrompts()
		if (Object.keys(industryPrompts).length === 0) {
			await updateIndustryPrompts({
				sales: "You are a professional sales representative. Your goal is to understand customer needs, build rapport, and guide them towards a solution that benefits them. Be consultative, not pushy.",
				support:
					"You are a customer support specialist. Your goal is to help customers resolve their issues quickly and efficiently. Be patient, empathetic, and solution-focused.",
				appointment:
					"You are a scheduling assistant. Your goal is to help customers book appointments efficiently. Be clear about availability, confirm details, and provide helpful reminders.",
				lead_qualification:
					"You are a lead qualification specialist. Your goal is to understand prospect needs and determine if they're a good fit for our services. Ask relevant questions and gather key information."
			})
		}

		// Initialize default models
		const models = await getAvailableModels()
		if (models.length === 0) {
			await updateAvailableModels([
				{
					id: "gpt-4",
					name: "GPT-4",
					provider: "openai",
					description:
						"Most capable model, best for complex conversations",
					costPerToken: 0.00003,
					maxTokens: 8192
				},
				{
					id: "gpt-3.5-turbo",
					name: "GPT-3.5 Turbo",
					provider: "openai",
					description: "Fast and cost-effective for most use cases",
					costPerToken: 0.000002,
					maxTokens: 4096
				}
			])
		}

		// Initialize prompt templates
		const templates = await getPromptTemplates()
		if (templates.length === 0) {
			await updatePromptTemplates([
				{
					id: "greeting",
					name: "Professional Greeting",
					category: "general",
					template:
						"Hello! I'm {agent_name} from {company_name}. How can I help you today?",
					variables: ["agent_name", "company_name"]
				},
				{
					id: "appointment_booking",
					name: "Appointment Booking",
					category: "scheduling",
					template:
						"I'd be happy to schedule an appointment for you. What day and time works best for you? I have availability {availability_times}.",
					variables: ["availability_times"]
				},
				{
					id: "lead_qualification",
					name: "Lead Qualification Questions",
					category: "sales",
					template:
						"To better assist you, could you tell me about {qualification_topic}? This will help me understand your needs better.",
					variables: ["qualification_topic"]
				}
			])
		}
	} catch (error) {
		console.error("Error initializing default settings:", error)
		throw new Error("Failed to initialize default settings")
	}
}
