import { db_ws } from "@/db"
import { crmExternalRecords, teamIntegrations } from "@/db/schema"
import { persistImportedLeads } from "@/lib/crm/imported-leads"
import { createCRMProviderAdapter } from "@/lib/crm/providers"
import type {
	CRMCallSyncInput,
	CRMCallSyncResult,
	CRMIntegrationConfig,
	CRMProvider,
	CRMProviderSettings
} from "@/lib/crm/types"
import { crmProviderValues } from "@/lib/crm/types"
import { and, eq, inArray } from "drizzle-orm"

interface ImportCRMLeadsParams {
	teamId: string
	userId: string
	provider: CRMProvider
	limit: number
	cursor?: string | null
	query?: string | null
}

interface SyncCallToCRMParams {
	teamId: string
	leadId?: number | null
	payload: CRMCallSyncInput
}

export async function listTeamCRMIntegrations(teamId: string) {
	const rows = await db_ws
		.select()
		.from(teamIntegrations)
		.where(
			and(
				eq(teamIntegrations.teamId, teamId),
				inArray(
					teamIntegrations.provider,
					crmProviderValues as unknown as string[]
				)
			)
		)

	return rows
}

export async function getTeamCRMIntegration(
	teamId: string,
	provider: CRMProvider
) {
	const rows = await db_ws
		.select()
		.from(teamIntegrations)
		.where(
			and(
				eq(teamIntegrations.teamId, teamId),
				eq(teamIntegrations.provider, provider)
			)
		)
		.limit(1)

	return rows[0] || null
}

export async function upsertTeamCRMIntegration(params: {
	teamId: string
	provider: CRMProvider
	apiKey?: string | null
	settings?: CRMProviderSettings
}) {
	const existing = await getTeamCRMIntegration(params.teamId, params.provider)

	if (existing) {
		const [updated] = await db_ws
			.update(teamIntegrations)
			.set({
				apiKey:
					params.apiKey === undefined
						? existing.apiKey
						: params.apiKey,
				settings: params.settings || {},
				updatedAt: new Date()
			})
			.where(eq(teamIntegrations.id, existing.id))
			.returning()
		return updated
	}

	const [created] = await db_ws
		.insert(teamIntegrations)
		.values({
			teamId: params.teamId,
			provider: params.provider,
			apiKey: params.apiKey ?? null,
			settings: params.settings || {},
			createdAt: new Date(),
			updatedAt: new Date()
		})
		.returning()

	return created
}

export async function deleteTeamCRMIntegration(
	teamId: string,
	provider: CRMProvider
) {
	const rows = await db_ws
		.delete(teamIntegrations)
		.where(
			and(
				eq(teamIntegrations.teamId, teamId),
				eq(teamIntegrations.provider, provider)
			)
		)
		.returning()

	return rows[0] || null
}

export async function importCRMLeadsForTeam(params: ImportCRMLeadsParams) {
	const integration = await getTeamCRMIntegration(
		params.teamId,
		params.provider
	)
	if (!integration) {
		throw new Error(`${params.provider} integration is not configured`)
	}

	const adapter = createCRMProviderAdapter(toConfig(integration))
	const imported = await adapter.importLeads({
		limit: params.limit,
		cursor: params.cursor,
		query: params.query
	})

	const persisted = await persistImportedLeads({
		teamId: params.teamId,
		userId: params.userId,
		provider: params.provider,
		leadsToPersist: imported.leads
	})

	return {
		provider: params.provider,
		nextCursor: imported.nextCursor || null,
		createdCount: persisted.createdCount,
		updatedCount: persisted.updatedCount,
		leadIds: persisted.leadIds,
		leads: imported.leads
	}
}

export async function syncCallOutcomeToCRMs(params: SyncCallToCRMParams) {
	if (!params.leadId) {
		return [] as CRMCallSyncResult[]
	}

	const integrations = await listTeamCRMIntegrations(params.teamId)
	if (integrations.length === 0) {
		return [] as CRMCallSyncResult[]
	}

	const leadMappings = await db_ws
		.select()
		.from(crmExternalRecords)
		.where(
			and(
				eq(crmExternalRecords.teamId, params.teamId),
				eq(crmExternalRecords.entityType, "lead"),
				eq(crmExternalRecords.entityId, params.leadId),
				inArray(
					crmExternalRecords.provider,
					crmProviderValues as unknown as string[]
				)
			)
		)

	const mappingByProvider = new Map(
		leadMappings.map((row) => [row.provider as CRMProvider, row])
	)

	const results: CRMCallSyncResult[] = []

	for (const integration of integrations) {
		const provider = integration.provider as CRMProvider
		const leadMapping = mappingByProvider.get(provider)
		if (!leadMapping) {
			results.push({
				success: false,
				provider,
				error: `No linked ${provider} lead record`
			})
			continue
		}

		const adapter = createCRMProviderAdapter(toConfig(integration))
		try {
			const response = await adapter.syncCallOutcome({
				...params.payload,
				externalContactId: leadMapping.externalId
			})
			results.push(response)

			if (response.success && response.externalActivityId) {
				await db_ws
					.insert(crmExternalRecords)
					.values({
						teamId: params.teamId,
						provider,
						entityType: "call",
						entityId: params.payload.callId,
						externalId: response.externalActivityId,
						externalParentId: leadMapping.externalId,
						metadata: {
							syncedAt: new Date().toISOString()
						},
						createdAt: new Date(),
						updatedAt: new Date()
					})
					.onConflictDoUpdate({
						target: [
							crmExternalRecords.teamId,
							crmExternalRecords.provider,
							crmExternalRecords.entityType,
							crmExternalRecords.entityId
						],
						set: {
							externalId: response.externalActivityId,
							externalParentId: leadMapping.externalId,
							updatedAt: new Date(),
							metadata: {
								syncedAt: new Date().toISOString()
							}
						}
					})
			}
		} catch (error) {
			results.push({
				success: false,
				provider,
				error:
					error instanceof Error ? error.message : "CRM sync failed"
			})
		}
	}

	return results
}

function toConfig(
	integration: typeof teamIntegrations.$inferSelect
): CRMIntegrationConfig {
	return {
		provider: integration.provider as CRMProvider,
		apiKey: integration.apiKey,
		settings: (integration.settings || {}) as CRMProviderSettings
	}
}
