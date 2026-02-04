import type {
	CRMCallSyncInput,
	CRMIntegrationConfig,
	CRMLeadImportResult,
	CRMProviderAdapter
} from "@/lib/crm/types"
import {
	ensureToken,
	requestJson,
	withBearerToken
} from "@/lib/crm/providers/http"
import { buildCallNoteBody } from "@/lib/crm/providers/shared"

interface HubSpotListResponse {
	results?: Array<{
		id: string
		properties?: Record<string, string | null>
	}>
	paging?: {
		next?: {
			after?: string
		}
	}
}

export class HubSpotAdapter implements CRMProviderAdapter {
	private readonly token: string
	private readonly baseUrl: string
	private readonly noteToContactAssociationTypeId: number

	constructor(config: CRMIntegrationConfig) {
		this.token = ensureToken(
			"hubspot",
			config.settings?.accessToken || config.apiKey
		)
		this.baseUrl = "https://api.hubapi.com"
		const associationType =
			config.settings?.objectMapping?.noteAssociationTypeId
		this.noteToContactAssociationTypeId =
			typeof associationType === "number" ? associationType : 202
	}

	async importLeads(params: {
		limit: number
		cursor?: string | null
		query?: string | null
	}): Promise<CRMLeadImportResult> {
		const limit = Math.max(1, Math.min(params.limit || 25, 100))

		if (params.query?.trim()) {
			return this.searchContacts(params.query.trim(), limit)
		}

		const url = new URL(`${this.baseUrl}/crm/v3/objects/contacts`)
		url.searchParams.set("limit", String(limit))
		url.searchParams.set("archived", "false")
		url.searchParams.set(
			"properties",
			[
				"firstname",
				"lastname",
				"email",
				"phone",
				"lifecyclestage",
				"hs_lead_status",
				"notes"
			].join(",")
		)
		if (params.cursor) {
			url.searchParams.set("after", params.cursor)
		}

		const response = await requestJson<HubSpotListResponse>(
			"hubspot",
			url.toString(),
			{
				method: "GET",
				headers: withBearerToken(this.token)
			}
		)

		return {
			leads: (response.results || []).map((record) =>
				this.toLeadRecord(record)
			),
			nextCursor: response.paging?.next?.after || null,
			raw: response as unknown as Record<string, unknown>
		}
	}

	private async searchContacts(query: string, limit: number) {
		const response = await requestJson<HubSpotListResponse>(
			"hubspot",
			`${this.baseUrl}/crm/v3/objects/contacts/search`,
			{
				method: "POST",
				headers: {
					...withBearerToken(this.token),
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					limit,
					properties: [
						"firstname",
						"lastname",
						"email",
						"phone",
						"lifecyclestage",
						"hs_lead_status",
						"notes"
					],
					filterGroups: [
						{
							filters: [
								{
									propertyName: "firstname",
									operator: "CONTAINS_TOKEN",
									value: query
								}
							]
						},
						{
							filters: [
								{
									propertyName: "lastname",
									operator: "CONTAINS_TOKEN",
									value: query
								}
							]
						},
						{
							filters: [
								{
									propertyName: "email",
									operator: "CONTAINS_TOKEN",
									value: query
								}
							]
						}
					]
				})
			}
		)

		return {
			leads: (response.results || []).map((record) =>
				this.toLeadRecord(record)
			),
			nextCursor: response.paging?.next?.after || null,
			raw: response as unknown as Record<string, unknown>
		}
	}

	async syncCallOutcome(input: CRMCallSyncInput) {
		if (!input.externalContactId) {
			return {
				success: false,
				provider: "hubspot" as const,
				error: "Missing external HubSpot contact ID"
			}
		}

		const noteResponse = await requestJson<{ id?: string }>(
			"hubspot",
			`${this.baseUrl}/crm/v3/objects/notes`,
			{
				method: "POST",
				headers: {
					...withBearerToken(this.token),
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					properties: {
						hs_timestamp: input.callTimestamp.toISOString(),
						hs_note_body: buildCallNoteBody(input)
					},
					associations: [
						{
							to: {
								id: input.externalContactId
							},
							types: [
								{
									associationCategory: "HUBSPOT_DEFINED",
									associationTypeId:
										this.noteToContactAssociationTypeId
								}
							]
						}
					]
				})
			}
		)

		return {
			success: true,
			provider: "hubspot" as const,
			externalActivityId: noteResponse.id || null
		}
	}

	private toLeadRecord(record: {
		id: string
		properties?: Record<string, string | null>
	}) {
		const properties = record.properties || {}
		const firstName = (properties.firstname || "").trim()
		const lastName = (properties.lastname || "").trim()
		const fallbackName = [firstName, lastName].filter(Boolean).join(" ")

		return {
			externalId: record.id,
			name: fallbackName || properties.email || `Contact ${record.id}`,
			email: properties.email || null,
			phone: properties.phone || null,
			source: properties.lifecyclestage || null,
			status: properties.hs_lead_status || null,
			notes: properties.notes || null,
			metadata: {
				provider: "hubspot"
			}
		}
	}
}
