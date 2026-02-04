"use server"

import { db_ws } from "@/db"
import { teamPhoneNumbers, voiceAgents } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"

const phoneNumberProviderSchema = z.enum(["twilio", "telnyx", "vonage", "mock"])
const phoneNumberStatusSchema = z.enum([
	"provisioning",
	"active",
	"inactive",
	"released"
])

const phoneNumberSchema = z
	.string()
	.trim()
	.min(7, "Phone number is required")
	.max(50, "Phone number is too long")
	.regex(
		/^\+?[0-9][0-9\s\-().]{6,}$/,
		"Enter a valid phone number (E.164 preferred)"
	)

const createPhoneNumberSchema = z.object({
	provider: phoneNumberProviderSchema,
	phoneNumber: phoneNumberSchema,
	label: z.string().trim().max(120).optional().nullable(),
	status: phoneNumberStatusSchema.optional(),
	capabilities: z
		.object({
			voice: z.boolean().default(true),
			sms: z.boolean().optional(),
			mms: z.boolean().optional()
		})
		.optional(),
	isDefaultOutbound: z.boolean().optional(),
	assignedAgentId: z.number().int().positive().optional().nullable(),
	metadata: z.record(z.unknown()).optional()
})

const updatePhoneNumberSchema = createPhoneNumberSchema.partial().extend({
	id: z.number().int().positive()
})

const setDefaultPhoneNumberSchema = z.object({
	id: z.number().int().positive()
})

const updatePhoneNumberStatusSchema = z.object({
	id: z.number().int().positive(),
	status: phoneNumberStatusSchema
})

function normalizePhoneNumber(raw: string) {
	return raw.replace(/[()\s-]/g, "")
}

export async function getPhoneNumbers() {
	try {
		const { teamId } = await requireTeam()

		const data = await db_ws
			.select({
				id: teamPhoneNumbers.id,
				teamId: teamPhoneNumbers.teamId,
				provider: teamPhoneNumbers.provider,
				phoneNumber: teamPhoneNumbers.phoneNumber,
				label: teamPhoneNumbers.label,
				status: teamPhoneNumbers.status,
				capabilities: teamPhoneNumbers.capabilities,
				isDefaultOutbound: teamPhoneNumbers.isDefaultOutbound,
				assignedAgentId: teamPhoneNumbers.assignedAgentId,
				assignedAgentName: voiceAgents.name,
				metadata: teamPhoneNumbers.metadata,
				createdAt: teamPhoneNumbers.createdAt,
				updatedAt: teamPhoneNumbers.updatedAt
			})
			.from(teamPhoneNumbers)
			.leftJoin(
				voiceAgents,
				eq(teamPhoneNumbers.assignedAgentId, voiceAgents.id)
			)
			.where(eq(teamPhoneNumbers.teamId, teamId))
			.orderBy(
				desc(teamPhoneNumbers.isDefaultOutbound),
				asc(teamPhoneNumbers.phoneNumber)
			)

		return { success: true, data, error: null }
	} catch (error) {
		console.error("Error fetching phone numbers:", error)
		return {
			success: false,
			data: null,
			error: "Failed to fetch phone numbers"
		}
	}
}

export async function createPhoneNumber(rawInput: unknown) {
	try {
		const input = createPhoneNumberSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()
		const now = new Date()

		const normalizedNumber = normalizePhoneNumber(input.phoneNumber)
		const capabilities = input.capabilities || { voice: true }
		const isDefaultOutbound = input.isDefaultOutbound === true

		if (input.assignedAgentId) {
			const matchingAgent = await db_ws
				.select({ id: voiceAgents.id })
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, input.assignedAgentId),
						eq(voiceAgents.teamId, teamId)
					)
				)
				.limit(1)

			if (!matchingAgent.length) {
				return {
					success: false,
					data: null,
					error: "Selected voice agent does not belong to this team"
				}
			}
		}

		if (isDefaultOutbound) {
			await db_ws
				.update(teamPhoneNumbers)
				.set({
					isDefaultOutbound: false,
					updatedAt: now
				})
				.where(eq(teamPhoneNumbers.teamId, teamId))
		}

		const [created] = await db_ws
			.insert(teamPhoneNumbers)
			.values({
				teamId,
				provider: input.provider,
				phoneNumber: normalizedNumber,
				label: input.label || null,
				status: input.status || "active",
				capabilities,
				isDefaultOutbound,
				assignedAgentId: input.assignedAgentId || null,
				metadata: input.metadata || {},
				createdAt: now,
				updatedAt: now,
				userId: user.id
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "phone_number_created",
			entityType: "phone_number",
			entityId: created.id,
			metadata: {
				provider: created.provider,
				phoneNumber: created.phoneNumber,
				isDefaultOutbound: created.isDefaultOutbound
			}
		})

		return { success: true, data: created, error: null }
	} catch (error) {
		console.error("Error creating phone number:", error)
		if (
			error instanceof Error &&
			/team_phone_numbers_team_number_unique/.test(error.message)
		) {
			return {
				success: false,
				data: null,
				error: "This phone number already exists in your workspace"
			}
		}
		return {
			success: false,
			data: null,
			error: "Failed to create phone number"
		}
	}
}

export async function updatePhoneNumber(rawInput: unknown) {
	try {
		const input = updatePhoneNumberSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()
		const now = new Date()

		const existing = await db_ws
			.select({ id: teamPhoneNumbers.id })
			.from(teamPhoneNumbers)
			.where(
				and(
					eq(teamPhoneNumbers.id, input.id),
					eq(teamPhoneNumbers.teamId, teamId)
				)
			)
			.limit(1)

		if (!existing.length) {
			return {
				success: false,
				data: null,
				error: "Phone number not found"
			}
		}

		if (input.assignedAgentId) {
			const matchingAgent = await db_ws
				.select({ id: voiceAgents.id })
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, input.assignedAgentId),
						eq(voiceAgents.teamId, teamId)
					)
				)
				.limit(1)

			if (!matchingAgent.length) {
				return {
					success: false,
					data: null,
					error: "Selected voice agent does not belong to this team"
				}
			}
		}

		if (input.isDefaultOutbound === true) {
			await db_ws
				.update(teamPhoneNumbers)
				.set({
					isDefaultOutbound: false,
					updatedAt: now
				})
				.where(eq(teamPhoneNumbers.teamId, teamId))
		}

		const updatePayload: Partial<typeof teamPhoneNumbers.$inferInsert> = {
			updatedAt: now
		}

		if (input.provider !== undefined)
			updatePayload.provider = input.provider
		if (input.phoneNumber !== undefined)
			updatePayload.phoneNumber = normalizePhoneNumber(input.phoneNumber)
		if (input.label !== undefined) updatePayload.label = input.label
		if (input.status !== undefined) updatePayload.status = input.status
		if (input.capabilities !== undefined)
			updatePayload.capabilities = input.capabilities
		if (input.isDefaultOutbound !== undefined)
			updatePayload.isDefaultOutbound = input.isDefaultOutbound
		if (input.assignedAgentId !== undefined)
			updatePayload.assignedAgentId = input.assignedAgentId
		if (input.metadata !== undefined)
			updatePayload.metadata = input.metadata

		const [updated] = await db_ws
			.update(teamPhoneNumbers)
			.set(updatePayload)
			.where(
				and(
					eq(teamPhoneNumbers.id, input.id),
					eq(teamPhoneNumbers.teamId, teamId)
				)
			)
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "phone_number_updated",
			entityType: "phone_number",
			entityId: updated.id,
			metadata: {
				provider: updated.provider,
				phoneNumber: updated.phoneNumber,
				status: updated.status,
				isDefaultOutbound: updated.isDefaultOutbound
			}
		})

		return { success: true, data: updated, error: null }
	} catch (error) {
		console.error("Error updating phone number:", error)
		return {
			success: false,
			data: null,
			error: "Failed to update phone number"
		}
	}
}

export async function setDefaultOutboundPhoneNumber(rawInput: unknown) {
	try {
		const input = setDefaultPhoneNumberSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()
		const now = new Date()

		const existing = await db_ws
			.select({
				id: teamPhoneNumbers.id,
				phoneNumber: teamPhoneNumbers.phoneNumber
			})
			.from(teamPhoneNumbers)
			.where(
				and(
					eq(teamPhoneNumbers.id, input.id),
					eq(teamPhoneNumbers.teamId, teamId)
				)
			)
			.limit(1)

		if (!existing.length) {
			return {
				success: false,
				data: null,
				error: "Phone number not found"
			}
		}

		await db_ws
			.update(teamPhoneNumbers)
			.set({
				isDefaultOutbound: false,
				updatedAt: now
			})
			.where(eq(teamPhoneNumbers.teamId, teamId))

		const [updated] = await db_ws
			.update(teamPhoneNumbers)
			.set({
				isDefaultOutbound: true,
				updatedAt: now
			})
			.where(
				and(
					eq(teamPhoneNumbers.id, input.id),
					eq(teamPhoneNumbers.teamId, teamId)
				)
			)
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "phone_number_default_set",
			entityType: "phone_number",
			entityId: updated.id,
			metadata: {
				phoneNumber: updated.phoneNumber
			}
		})

		return { success: true, data: updated, error: null }
	} catch (error) {
		console.error("Error setting default outbound phone number:", error)
		return {
			success: false,
			data: null,
			error: "Failed to set default outbound phone number"
		}
	}
}

export async function updatePhoneNumberStatus(rawInput: unknown) {
	try {
		const input = updatePhoneNumberStatusSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()
		const now = new Date()

		const [updated] = await db_ws
			.update(teamPhoneNumbers)
			.set({
				status: input.status,
				isDefaultOutbound:
					input.status === "released"
						? false
						: sql`${teamPhoneNumbers.isDefaultOutbound}`,
				updatedAt: now
			})
			.where(
				and(
					eq(teamPhoneNumbers.id, input.id),
					eq(teamPhoneNumbers.teamId, teamId)
				)
			)
			.returning()

		if (!updated) {
			return {
				success: false,
				data: null,
				error: "Phone number not found"
			}
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "phone_number_status_updated",
			entityType: "phone_number",
			entityId: updated.id,
			metadata: {
				status: updated.status
			}
		})

		return { success: true, data: updated, error: null }
	} catch (error) {
		console.error("Error updating phone number status:", error)
		return {
			success: false,
			data: null,
			error: "Failed to update phone number status"
		}
	}
}
