import type {
	CRMCallSyncInput,
	CRMIntegrationConfig,
	CRMLeadImportResult,
	CRMProviderAdapter
} from "@/lib/crm/types"
import {
	CRMProviderError,
	ensureToken,
	requestJson,
	withBearerToken
} from "@/lib/crm/providers/http"
import { buildCallNoteBody } from "@/lib/crm/providers/shared"

interface GoHighLevelContactsResponse {
	contacts?: Array<Record<string, unknown>>
	count?: number
}

export class GoHighLevelAdapter implements CRMProviderAdapter {
	private readonly token: string
	private readonly baseUrl: string
	private readonly locationId: string

	constructor(config: CRMIntegrationConfig) {
		this.token = ensureToken(
			"gohighlevel",
			config.settings?.accessToken || config.apiKey
		)
		this.baseUrl = "https://services.leadconnectorhq.com"
		const locationId = config.settings?.locationId
		if (!locationId) {
			throw new CRMProviderError(
				"gohighlevel",
				"gohighlevel locationId is required in integration settings"
			)
		}
		this.locationId = locationId
	}

	async importLeads(params: {
		limit: number
		cursor?: string | null
		query?: string | null
	}): Promise<CRMLeadImportResult> {
		const limit = Math.max(1, Math.min(params.limit || 25, 100))
		const url = new URL(`${this.baseUrl}/contacts/`)
		url.searchParams.set("locationId", this.locationId)
		url.searchParams.set("limit", String(limit))
		if (params.query?.trim()) {
			url.searchParams.set("query", params.query.trim())
		}
		if (params.cursor) {
			url.searchParams.set("startAfterId", params.cursor)
		}

		const response = await requestJson<GoHighLevelContactsResponse>(
			"gohighlevel",
			url.toString(),
			{
				method: "GET",
				headers: {
					...withBearerToken(this.token, {
						Version: "2021-07-28"
					})
				}
			}
		)

		const contacts = response.contacts || []
		const nextCursor = getNextCursor(contacts)

		return {
			leads: contacts.map((record) => {
				const firstName = toOptionalString(record.firstName)
				const lastName = toOptionalString(record.lastName)
				const fullName = [firstName, lastName].filter(Boolean).join(" ")
				const email = toOptionalString(record.email)
				const phone =
					toOptionalString(record.phone) ||
					toOptionalString(record.phoneNumber)

				return {
					externalId: String(record.id),
					name:
						fullName ||
						toOptionalString(record.name) ||
						email ||
						`Contact ${record.id}`,
					email,
					phone,
					source: toOptionalString(record.source),
					notes: toOptionalString(record.notes),
					status: toOptionalString(record.contactType),
					metadata: {
						provider: "gohighlevel"
					}
				}
			}),
			nextCursor,
			raw: response as unknown as Record<string, unknown>
		}
	}

	async syncCallOutcome(input: CRMCallSyncInput) {
		if (!input.externalContactId) {
			return {
				success: false,
				provider: "gohighlevel" as const,
				error: "Missing external GoHighLevel contact ID"
			}
		}

		const response = await requestJson<{
			note?: {
				id?: string
			}
		}>(
			"gohighlevel",
			`${this.baseUrl}/contacts/${input.externalContactId}/notes`,
			{
				method: "POST",
				headers: {
					...withBearerToken(this.token, {
						Version: "2021-07-28",
						"Content-Type": "application/json"
					})
				},
				body: JSON.stringify({
					body: buildCallNoteBody(input)
				})
			}
		)

		return {
			success: true,
			provider: "gohighlevel" as const,
			externalActivityId: response.note?.id || null
		}
	}
}

function toOptionalString(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim()
	}
	return null
}

function getNextCursor(rows: Array<Record<string, unknown>>) {
	if (rows.length === 0) {
		return null
	}
	const last = rows[rows.length - 1]
	if (typeof last.id === "string" && last.id.trim().length > 0) {
		return last.id
	}
	return null
}
