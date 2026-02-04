"use server"

import { assignLeadsToCampaign } from "@/actions/campaigns/core"
import { db_ws } from "@/db"
import { crmExternalRecords, teamIntegrations } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import {
	deleteTeamCRMIntegration,
	importCRMLeadsForTeam,
	listTeamCRMIntegrations,
	upsertTeamCRMIntegration
} from "@/lib/crm/integration-service"
import { crmProviderValues, type CRMProviderSettings } from "@/lib/crm/types"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

const crmProviderSchema = z.enum(crmProviderValues)

const saveIntegrationSchema = z.object({
	provider: crmProviderSchema,
	apiKey: z.string().trim().optional().nullable(),
	settings: z.record(z.unknown()).optional().default({})
})

const importLeadsSchema = z.object({
	provider: crmProviderSchema,
	campaignId: z.number().int().positive().optional(),
	limit: z.number().int().min(1).max(100).optional().default(25),
	cursor: z.string().trim().optional().nullable(),
	query: z.string().trim().optional().nullable(),
	autoAssignToCampaign: z.boolean().optional().default(true)
})

export async function getCRMIntegrations() {
	try {
		const { teamId } = await requireTeam()
		const rows = await listTeamCRMIntegrations(teamId)

		const mappings = await db_ws
			.select({
				provider: crmExternalRecords.provider,
				count: crmExternalRecords.id
			})
			.from(crmExternalRecords)
			.where(
				and(
					eq(crmExternalRecords.teamId, teamId),
					eq(crmExternalRecords.entityType, "lead"),
					inArray(
						crmExternalRecords.provider,
						crmProviderValues as unknown as string[]
					)
				)
			)

		const counts = new Map<string, number>()
		for (const row of mappings) {
			counts.set(row.provider, (counts.get(row.provider) || 0) + 1)
		}

		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				provider: row.provider,
				isConnected: Boolean(row.apiKey || row.settings),
				settings: row.settings || {},
				leadLinks: counts.get(row.provider) || 0,
				updatedAt: row.updatedAt
			})),
			error: null
		}
	} catch (error) {
		console.error("Error getting CRM integrations:", error)
		return {
			success: false,
			error: "Failed to load CRM integrations",
			data: null
		}
	}
}

export async function saveCRMIntegration(rawInput: unknown) {
	try {
		const input = saveIntegrationSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()

		const result = await upsertTeamCRMIntegration({
			teamId,
			provider: input.provider,
			apiKey: input.apiKey ?? null,
			settings: input.settings as CRMProviderSettings
		})

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "crm_integration_saved",
			entityType: "integration",
			entityId: result?.id,
			metadata: {
				provider: input.provider
			}
		})

		return { success: true, data: result, error: null }
	} catch (error) {
		console.error("Error saving CRM integration:", error)
		return {
			success: false,
			error: "Failed to save CRM integration",
			data: null
		}
	}
}

export async function disconnectCRMIntegration(rawProvider: unknown) {
	try {
		const provider = crmProviderSchema.parse(rawProvider)
		const { teamId, user } = await requireTeam()

		const removed = await deleteTeamCRMIntegration(teamId, provider)
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
			action: "crm_integration_deleted",
			entityType: "integration",
			entityId: removed.id,
			metadata: {
				provider
			}
		})

		return { success: true, data: removed, error: null }
	} catch (error) {
		console.error("Error disconnecting CRM integration:", error)
		return {
			success: false,
			error: "Failed to disconnect CRM integration",
			data: null
		}
	}
}

export async function importLeadsFromCRM(rawInput: unknown) {
	try {
		const input = importLeadsSchema.parse(rawInput)
		const { teamId, user } = await requireTeam()

		const imported = await importCRMLeadsForTeam({
			teamId,
			userId: user.id,
			provider: input.provider,
			limit: input.limit,
			cursor: input.cursor,
			query: input.query
		})

		let assignedCount = 0
		if (
			input.campaignId &&
			input.autoAssignToCampaign &&
			imported.leadIds.length > 0
		) {
			const assignmentResult = await assignLeadsToCampaign(
				input.campaignId,
				imported.leadIds,
				{
					notes: `Imported from ${input.provider}`,
					priority: 0
				}
			)
			if (assignmentResult.success) {
				assignedCount = imported.leadIds.length
			}
		}

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "crm_leads_imported",
			entityType: "lead",
			metadata: {
				provider: input.provider,
				campaignId: input.campaignId || null,
				createdCount: imported.createdCount,
				updatedCount: imported.updatedCount,
				assignedCount
			}
		})

		return {
			success: true,
			data: {
				provider: imported.provider,
				createdCount: imported.createdCount,
				updatedCount: imported.updatedCount,
				assignedCount,
				leadIds: imported.leadIds,
				nextCursor: imported.nextCursor,
				totalProcessed:
					imported.createdCount + imported.updatedCount
			},
			error: null
		}
	} catch (error) {
		console.error("Error importing CRM leads:", error)
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to import CRM leads",
			data: null
		}
	}
}
