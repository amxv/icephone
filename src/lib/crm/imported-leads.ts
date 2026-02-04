import { db_ws } from "@/db"
import { crmExternalRecords, leads } from "@/db/schema"
import type { CRMLeadRecord, CRMProvider } from "@/lib/crm/types"
import { and, eq, inArray } from "drizzle-orm"

type PersistImportedLeadsParams = {
	teamId: string
	userId: string
	provider: CRMProvider
	leadsToPersist: CRMLeadRecord[]
}

export async function persistImportedLeads(params: PersistImportedLeadsParams) {
	if (params.leadsToPersist.length === 0) {
		return {
			leadIds: [] as number[],
			createdCount: 0,
			updatedCount: 0
		}
	}

	const externalIds = params.leadsToPersist.map((lead) => lead.externalId)
	const mappingRows = await db_ws
		.select()
		.from(crmExternalRecords)
		.where(
			and(
				eq(crmExternalRecords.teamId, params.teamId),
				eq(crmExternalRecords.provider, params.provider),
				eq(crmExternalRecords.entityType, "lead"),
				inArray(crmExternalRecords.externalId, externalIds)
			)
		)

	const mappedLeadIds = mappingRows.map((row) => row.entityId)
	const mappedLeads = mappedLeadIds.length
		? await db_ws
				.select()
				.from(leads)
				.where(inArray(leads.id, mappedLeadIds))
		: []

	const emailCandidates = unique(
		params.leadsToPersist
			.map((lead) => lead.email?.toLowerCase().trim())
			.filter((value): value is string => Boolean(value))
	)
	const phoneCandidates = unique(
		params.leadsToPersist
			.map((lead) => normalizePhone(lead.phone))
			.filter((value): value is string => Boolean(value))
	)

	const existingByEmail = new Map<string, typeof leads.$inferSelect>()
	const existingByPhone = new Map<string, typeof leads.$inferSelect>()
	for (const row of mappedLeads) {
		if (row.email) {
			existingByEmail.set(row.email.toLowerCase(), row)
		}
		if (row.phone) {
			const normalizedPhone = normalizePhone(row.phone)
			if (normalizedPhone) {
				existingByPhone.set(normalizedPhone, row)
			}
		}
	}

	if (emailCandidates.length > 0) {
		const byEmailRows = await db_ws
			.select()
			.from(leads)
			.where(
				and(
					eq(leads.teamId, params.teamId),
					inArray(leads.email, emailCandidates)
				)
			)
		for (const row of byEmailRows) {
			if (row.email) {
				existingByEmail.set(row.email.toLowerCase(), row)
			}
		}
	}

	if (phoneCandidates.length > 0) {
		const byPhoneRows = await db_ws
			.select()
			.from(leads)
			.where(
				and(
					eq(leads.teamId, params.teamId),
					inArray(leads.phone, phoneCandidates)
				)
			)
		for (const row of byPhoneRows) {
			if (row.phone) {
				const normalizedPhone = normalizePhone(row.phone)
				if (normalizedPhone) {
					existingByPhone.set(normalizedPhone, row)
				}
			}
		}
	}

	const mappingByExternalId = new Map(
		mappingRows.map((row) => [row.externalId, row])
	)

	let createdCount = 0
	let updatedCount = 0
	const leadIds: number[] = []

	for (const externalLead of params.leadsToPersist) {
		const mapped = mappingByExternalId.get(externalLead.externalId)
		const byMappedId =
			mapped && mappedLeads.find((row) => row.id === mapped.entityId)
		const byEmail = externalLead.email
			? existingByEmail.get(externalLead.email.toLowerCase())
			: undefined
		const normalizedExternalPhone = normalizePhone(externalLead.phone)
		const byPhone = externalLead.phone
			? normalizedExternalPhone
				? existingByPhone.get(normalizedExternalPhone)
				: undefined
			: undefined

		const targetLead = byMappedId || byEmail || byPhone
		let leadId = targetLead?.id

		if (leadId && targetLead) {
			await db_ws
				.update(leads)
				.set({
					name: externalLead.name,
					email: normalizeEmail(externalLead.email),
					phone: normalizePhone(externalLead.phone),
					source: `${params.provider}:import`,
					notes: mergeNotes(targetLead.notes, externalLead.notes),
					status:
						normalizeLeadStatus(externalLead.status) ||
						targetLead.status ||
						"new",
					dealValue:
						typeof externalLead.dealValue === "number"
							? externalLead.dealValue.toString()
							: targetLead.dealValue,
					updatedAt: new Date()
				})
				.where(
					and(eq(leads.id, leadId), eq(leads.teamId, params.teamId))
				)
			updatedCount += 1
		} else {
			const [created] = await db_ws
				.insert(leads)
				.values({
					teamId: params.teamId,
					createdByUserId: params.userId,
					userId: params.userId,
					name: externalLead.name,
					email: normalizeEmail(externalLead.email),
					phone: normalizePhone(externalLead.phone),
					status: normalizeLeadStatus(externalLead.status) || "new",
					source: `${params.provider}:import`,
					notes: externalLead.notes || null,
					dealValue:
						typeof externalLead.dealValue === "number"
							? externalLead.dealValue.toString()
							: null,
					createdAt: new Date(),
					updatedAt: new Date()
				})
				.returning()

			leadId = created.id
			createdCount += 1
		}

		if (leadId) {
			leadIds.push(leadId)
			await db_ws
				.insert(crmExternalRecords)
				.values({
					teamId: params.teamId,
					provider: params.provider,
					entityType: "lead",
					entityId: leadId,
					externalId: externalLead.externalId,
					externalParentId: externalLead.externalStageId || null,
					metadata: externalLead.metadata || {},
					createdAt: new Date(),
					updatedAt: new Date()
				})
				.onConflictDoUpdate({
					target: [
						crmExternalRecords.teamId,
						crmExternalRecords.provider,
						crmExternalRecords.externalId
					],
					set: {
						entityType: "lead",
						entityId: leadId,
						externalParentId: externalLead.externalStageId || null,
						metadata: externalLead.metadata || {},
						updatedAt: new Date()
					}
				})
		}
	}

	return { leadIds: unique(leadIds), createdCount, updatedCount }
}

function normalizeEmail(value?: string | null) {
	if (!value) return null
	const trimmed = value.trim().toLowerCase()
	return trimmed.length ? trimmed : null
}

function normalizePhone(value?: string | null) {
	if (!value) return null
	const normalized = value.replace(/[^+\d]/g, "")
	return normalized.length ? normalized : null
}

function normalizeLeadStatus(value?: string | null) {
	if (!value) return null
	const normalized = value.toLowerCase()
	if (normalized.includes("qualified")) return "qualified"
	if (
		normalized.includes("converted") ||
		normalized.includes("customer") ||
		normalized.includes("won")
	)
		return "converted"
	if (normalized.includes("lost") || normalized.includes("unqualified"))
		return "lost"
	if (normalized.includes("contact")) return "contacted"
	return "new"
}

function unique<T>(values: T[]) {
	return [...new Set(values)]
}

function mergeNotes(current?: string | null, incoming?: string | null) {
	if (!incoming || incoming.trim().length === 0) {
		return current || null
	}
	if (!current || current.trim().length === 0) {
		return incoming.trim()
	}
	if (current.includes(incoming.trim())) {
		return current
	}
	return `${current}\n\n[CRM Import]\n${incoming.trim()}`
}
