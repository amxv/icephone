"use server"

import { db_ws } from "@/db"
import { teamIntegrations } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const saveCalcomIntegrationSchema = z.object({
	apiKey: z.string().trim().optional().nullable(),
	settings: z
		.object({
			eventTypeId: z.preprocess(
				(value) => {
					if (value === "" || value === null || value === undefined) {
						return undefined
					}
					return Number(value)
				},
				z.number().int().positive().optional()
			),
			eventTypeSlug: z.string().trim().optional().nullable(),
			teamSlug: z.string().trim().optional().nullable(),
			username: z.string().trim().optional().nullable(),
			organizationSlug: z.string().trim().optional().nullable(),
			defaultTimeZone: z.string().trim().optional().nullable()
		})
		.optional()
		.default({})
})

function normalizeOptionalString(value?: string | null) {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function normalizeCalcomSettings(
	settings: z.infer<typeof saveCalcomIntegrationSchema>["settings"]
) {
	const normalized: Record<string, unknown> = {}
	if (settings?.eventTypeId && Number.isFinite(settings.eventTypeId)) {
		normalized.eventTypeId = settings.eventTypeId
	}
	const eventTypeSlug = normalizeOptionalString(settings?.eventTypeSlug)
	if (eventTypeSlug) normalized.eventTypeSlug = eventTypeSlug
	const teamSlug = normalizeOptionalString(settings?.teamSlug)
	if (teamSlug) normalized.teamSlug = teamSlug
	const username = normalizeOptionalString(settings?.username)
	if (username) normalized.username = username
	const organizationSlug = normalizeOptionalString(settings?.organizationSlug)
	if (organizationSlug) normalized.organizationSlug = organizationSlug
	const defaultTimeZone = normalizeOptionalString(settings?.defaultTimeZone)
	if (defaultTimeZone) normalized.defaultTimeZone = defaultTimeZone
	return normalized
}

export async function getCalcomIntegration() {
	try {
		const { teamId } = await requireTeam()
		const [integration] = await db_ws
			.select()
			.from(teamIntegrations)
			.where(
				and(
					eq(teamIntegrations.teamId, teamId),
					eq(teamIntegrations.provider, "calcom")
				)
			)
			.limit(1)

		return {
			success: true,
			data: {
				isConnected: Boolean(integration?.apiKey),
				hasApiKey: Boolean(integration?.apiKey),
				settings: (integration?.settings || {}) as Record<
					string,
					unknown
				>,
				updatedAt: integration?.updatedAt || null
			},
			error: null
		}
	} catch (error) {
		console.error("Error loading Cal.com integration:", error)
		return {
			success: false,
			error: "Failed to load Cal.com integration",
			data: null
		}
	}
}

export async function saveCalcomIntegration(rawInput: unknown) {
	try {
		const input = saveCalcomIntegrationSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()

		const trimmedApiKey = normalizeOptionalString(input.apiKey)
		const normalizedSettings = normalizeCalcomSettings(input.settings)

		const [existing] = await db_ws
			.select()
			.from(teamIntegrations)
			.where(
				and(
					eq(teamIntegrations.teamId, teamId),
					eq(teamIntegrations.provider, "calcom")
				)
			)
			.limit(1)

		if (existing) {
			const [updated] = await db_ws
				.update(teamIntegrations)
				.set({
					apiKey: trimmedApiKey ?? existing.apiKey,
					settings: normalizedSettings,
					updatedAt: new Date()
				})
				.where(eq(teamIntegrations.id, existing.id))
				.returning()

			await logAuditEvent({
				teamId,
				actorUserId: user.id,
				action: "calcom_integration_saved",
				entityType: "integration",
				entityId: updated?.id
			})

			return { success: true, data: updated, error: null }
		}

		const [created] = await db_ws
			.insert(teamIntegrations)
			.values({
				teamId,
				provider: "calcom",
				apiKey: trimmedApiKey,
				settings: normalizedSettings,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "calcom_integration_saved",
			entityType: "integration",
			entityId: created?.id
		})

		return { success: true, data: created, error: null }
	} catch (error) {
		console.error("Error saving Cal.com integration:", error)
		return {
			success: false,
			error: "Failed to save Cal.com integration",
			data: null
		}
	}
}

export async function disconnectCalcomIntegration() {
	try {
		const { teamId, user } = await requireTeam()
		const [removed] = await db_ws
			.delete(teamIntegrations)
			.where(
				and(
					eq(teamIntegrations.teamId, teamId),
					eq(teamIntegrations.provider, "calcom")
				)
			)
			.returning()

		if (!removed) {
			return {
				success: false,
				error: "Cal.com integration not found",
				data: null
			}
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "calcom_integration_deleted",
			entityType: "integration",
			entityId: removed.id
		})

		return { success: true, data: removed, error: null }
	} catch (error) {
		console.error("Error disconnecting Cal.com integration:", error)
		return {
			success: false,
			error: "Failed to disconnect Cal.com integration",
			data: null
		}
	}
}
