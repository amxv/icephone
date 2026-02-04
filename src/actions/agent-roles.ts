"use server"

import { db_ws as db } from "@/db"
import { agentRoles } from "@/db/schema"
import { asc, eq } from "drizzle-orm"

export type AgentRole = {
	id: number
	roleName: string
	displayName: string
	description: string
	icon: string
	systemPrompt: string
	conversationStyle: string
	industryFocus?: string | null
	sampleConversation?: string | null
	defaultFunctions: Array<{
		name: string
		description: string
		webhook: string
		parameters: Array<{
			name: string
			type: "string" | "number" | "boolean" | "object" | "array"
			description: string
			required: boolean
		}>
	}>
	defaultConfiguration: {
		flow?: {
			user_start_first?: boolean
			interruption?: {
				allowed?: boolean
				keep_interruption_message?: boolean
				first_message?: boolean
			}
			response_delay?: number
			auto_fill_responses?: {
				response_gap_threshold?: number
				messages?: string[]
			}
			agent_terminate_call?: {
				enabled?: boolean
				instruction?: string
				messages?: string[]
			}
			voicemail?: {
				action?: "hangup" | "continue"
				message?: string
				continue_on_voice_activity?: boolean
			}
			inactivity_handling?: {
				idle_time?: number
				message?: string
			}
		}
		llm?: {
			model?: string
			temperature?: number
		}
		session_timeout?: {
			max_duration?: number
			max_idle?: number
			message?: string
		}
	}
	firstMessageTemplate?: string | null
	isActive: boolean
	sortOrder: number
	createdAt: Date
	updatedAt: Date
}

/**
 * Get all active agent roles available in the system
 * @returns Array of agent roles
 */
export async function getAgentRoles(): Promise<AgentRole[]> {
	try {
		const roles = await db.query.agentRoles.findMany({
			where: eq(agentRoles.isActive, true),
			orderBy: [asc(agentRoles.sortOrder), asc(agentRoles.displayName)]
		})

		return roles as AgentRole[]
	} catch (error) {
		console.error("Failed to get agent roles:", error)
		throw new Error("Failed to get agent roles")
	}
}

/**
 * Get a specific agent role by ID
 * @param id - Agent role ID
 * @returns Agent role or null if not found
 */
export async function getAgentRole(id: number): Promise<AgentRole | null> {
	try {
		const role = await db.query.agentRoles.findFirst({
			where: eq(agentRoles.id, id)
		})

		return role as AgentRole | null
	} catch (error) {
		console.error("Failed to get agent role:", error)
		throw new Error("Failed to get agent role")
	}
}

/**
 * Get agent role by role name
 * @param roleName - Role name (e.g., 'customer-service', 'sales')
 * @returns Agent role or null if not found
 */
export async function getAgentRoleByName(
	roleName: string
): Promise<AgentRole | null> {
	try {
		const role = await db.query.agentRoles.findFirst({
			where: eq(agentRoles.roleName, roleName)
		})

		return role as AgentRole | null
	} catch (error) {
		console.error("Failed to get agent role by name:", error)
		throw new Error("Failed to get agent role by name")
	}
}

/**
 * Apply agent role configuration to an existing voice agent
 * This maps the business role to technical voice configuration
 * @param agentId - Voice agent ID
 * @param roleId - Agent role ID
 * @returns Success status
 */
export async function applyAgentRole(
	agentId: number,
	roleId: number
): Promise<boolean> {
	try {
		const role = await getAgentRole(roleId)
		if (!role) {
			throw new Error("Agent role not found")
		}

		// This will be implemented when we update voice agents
		// For now, just return success
		return true
	} catch (error) {
		console.error("Failed to apply agent role:", error)
		throw new Error("Failed to apply agent role")
	}
}

/**
 * Get role template configuration for creating new agents
 * @param roleId - Agent role ID
 * @returns Complete role configuration for voice agent creation
 */
export async function getRoleTemplate(roleId: number) {
	try {
		const role = await getAgentRole(roleId)
		if (!role) {
			throw new Error("Agent role not found")
		}

		return {
			systemPrompt: role.systemPrompt,
			firstMessage:
				role.firstMessageTemplate ||
				`Hello! I'm your ${role.displayName.toLowerCase()}. How can I help you today?`,
			configuration: role.defaultConfiguration,
			functions: role.defaultFunctions,
			conversationStyle: role.conversationStyle
		}
	} catch (error) {
		console.error("Failed to get role template:", error)
		throw new Error("Failed to get role template")
	}
}

/**
 * Customize role for specific business context
 * @param roleId - Agent role ID
 * @param businessContext - Business-specific context (industry, company info, etc.)
 * @returns Customized role configuration
 */
export async function customizeRoleForBusiness(
	roleId: number,
	businessContext: {
		industry?: string
		companyName?: string
		products?: string[]
		specialInstructions?: string
	}
) {
	try {
		const template = await getRoleTemplate(roleId)

		// Customize the system prompt with business context
		let customizedPrompt = template.systemPrompt

		if (businessContext.companyName) {
			customizedPrompt += `\n\nYou work for ${businessContext.companyName}.`
		}

		if (businessContext.industry) {
			customizedPrompt += `\nYou specialize in the ${businessContext.industry} industry.`
		}

		if (businessContext.products && businessContext.products.length > 0) {
			customizedPrompt += `\nOur main products/services include: ${businessContext.products.join(", ")}.`
		}

		if (businessContext.specialInstructions) {
			customizedPrompt += `\n\nSpecial instructions: ${businessContext.specialInstructions}`
		}

		return {
			...template,
			systemPrompt: customizedPrompt
		}
	} catch (error) {
		console.error("Failed to customize role for business:", error)
		throw new Error("Failed to customize role for business")
	}
}
