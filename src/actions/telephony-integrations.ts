"use server"

import { db_ws } from "@/db"
import { teamIntegrations } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

const telephonyProviderSchema = z.enum(["twilio", "telnyx", "vonage"])

const saveTelephonyIntegrationSchema = z.object({
	provider: telephonyProviderSchema,
	apiKey: z.string().optional().nullable(),
	settings: z.record(z.unknown()).optional().default({})
})

function normalizeOptionalString(value: unknown) {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function normalizeTelephonySettings(
	provider: z.infer<typeof telephonyProviderSchema>,
	settings: Record<string, unknown>
) {
	const normalized: Record<string, unknown> = {}
	const setIfString = (key: string) => {
		const value = normalizeOptionalString(settings[key])
		if (value) normalized[key] = value
	}

	switch (provider) {
		case "twilio":
			setIfString("accountSid")
			setIfString("fromNumber")
			setIfString("outboundTwimlUrl")
			setIfString("statusCallbackUrl")
			if (typeof settings.recordCalls === "boolean") {
				normalized.recordCalls = settings.recordCalls
			}
			break
		case "telnyx":
			setIfString("connectionId")
			setIfString("fromNumber")
			setIfString("webhookUrl")
			break
		case "vonage":
			setIfString("applicationId")
			setIfString("fromNumber")
			setIfString("answerUrl")
			setIfString("eventUrl")
			break
	}

	return normalized
}

function validateTelephonyIntegrationInput(params: {
	provider: z.infer<typeof telephonyProviderSchema>
	apiKey: string | null
	settings: Record<string, unknown>
}) {
	switch (params.provider) {
		case "twilio":
			if (!normalizeOptionalString(params.apiKey)) {
				return "Twilio Auth Token is required"
			}
			if (!normalizeOptionalString(params.settings.accountSid)) {
				return "Twilio Account SID is required"
			}
			return null
		case "telnyx":
			if (!normalizeOptionalString(params.apiKey)) {
				return "Telnyx API key is required"
			}
			if (!normalizeOptionalString(params.settings.connectionId)) {
				return "Telnyx Connection ID is required"
			}
			return null
		case "vonage":
			if (!normalizeOptionalString(params.apiKey)) {
				return "Vonage private key is required"
			}
			if (!normalizeOptionalString(params.settings.applicationId)) {
				return "Vonage application ID is required"
			}
			if (!normalizeOptionalString(params.settings.answerUrl)) {
				return "Vonage answer URL is required"
			}
			return null
		default:
			return "Unsupported provider"
	}
}

export async function getTelephonyIntegrations() {
	try {
		const { teamId } = await requireTeam()

		const rows = await db_ws
			.select()
			.from(teamIntegrations)
			.where(
				and(
					eq(teamIntegrations.teamId, teamId),
					inArray(teamIntegrations.provider, [
						"twilio",
						"telnyx",
						"vonage"
					])
				)
			)

		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				provider: row.provider as "twilio" | "telnyx" | "vonage",
				isConnected: Boolean(row.apiKey),
				settings: (row.settings || {}) as Record<string, unknown>,
				updatedAt: row.updatedAt
			})),
			error: null
		}
	} catch (error) {
		console.error("Error loading telephony integrations:", error)
		return {
			success: false,
			error: "Failed to load telephony integrations",
			data: null
		}
	}
}

export async function saveTelephonyIntegration(rawInput: unknown) {
	try {
		const input = saveTelephonyIntegrationSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()

		const apiKey = normalizeOptionalString(input.apiKey)
		const normalizedSettings = normalizeTelephonySettings(
			input.provider,
			input.settings
		)

		const validationError = validateTelephonyIntegrationInput({
			provider: input.provider,
			apiKey,
			settings: normalizedSettings
		})
		if (validationError) {
			return { success: false, error: validationError, data: null }
		}

		const [existing] = await db_ws
			.select()
			.from(teamIntegrations)
			.where(
				and(
					eq(teamIntegrations.teamId, teamId),
					eq(teamIntegrations.provider, input.provider)
				)
			)
			.limit(1)

		if (existing) {
			const [updated] = await db_ws
				.update(teamIntegrations)
				.set({
					apiKey: apiKey ?? existing.apiKey,
					settings: normalizedSettings,
					updatedAt: new Date()
				})
				.where(eq(teamIntegrations.id, existing.id))
				.returning()

			await logAuditEvent({
				teamId,
				actorUserId: user.id,
				action: "telephony_integration_saved",
				entityType: "integration",
				entityId: updated?.id,
				metadata: { provider: input.provider }
			})

			return { success: true, data: updated, error: null }
		}

		const [created] = await db_ws
			.insert(teamIntegrations)
			.values({
				teamId,
				provider: input.provider,
				apiKey,
				settings: normalizedSettings,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "telephony_integration_saved",
			entityType: "integration",
			entityId: created?.id,
			metadata: { provider: input.provider }
		})

		return { success: true, data: created, error: null }
	} catch (error) {
		console.error("Error saving telephony integration:", error)
		return {
			success: false,
			error: "Failed to save telephony integration",
			data: null
		}
	}
}

export async function disconnectTelephonyIntegration(rawProvider: unknown) {
	try {
		const provider = telephonyProviderSchema.parse(rawProvider)
		const { teamId, user } = await requireTeam()

		const [removed] = await db_ws
			.delete(teamIntegrations)
			.where(
				and(
					eq(teamIntegrations.teamId, teamId),
					eq(teamIntegrations.provider, provider)
				)
			)
			.returning()

		if (!removed) {
			return {
				success: false,
				error: "Integration not found",
				data: null
			}
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "telephony_integration_deleted",
			entityType: "integration",
			entityId: removed.id,
			metadata: { provider }
		})

		return { success: true, data: removed, error: null }
	} catch (error) {
		console.error("Error disconnecting telephony integration:", error)
		return {
			success: false,
			error: "Failed to disconnect telephony integration",
			data: null
		}
	}
}
