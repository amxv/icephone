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

interface PipedriveCollectionResponse {
	success?: boolean
	data?: Array<Record<string, unknown>>
	additional_data?: {
		next_cursor?: string | null
		pagination?: {
			next_cursor?: string | null
		}
	}
}

export class PipedriveAdapter implements CRMProviderAdapter {
	private readonly token: string
	private readonly apiDomain: string

	constructor(config: CRMIntegrationConfig) {
		this.token = ensureToken(
			"pipedrive",
			config.settings?.accessToken || config.apiKey
		)

		const configuredApiDomain = config.settings?.apiDomain
		const companyDomain = config.settings?.companyDomain
		if (configuredApiDomain && typeof configuredApiDomain === "string") {
			this.apiDomain = configuredApiDomain.replace(/\/$/, "")
		} else if (companyDomain && typeof companyDomain === "string") {
			this.apiDomain = `https://${companyDomain}.pipedrive.com`
		} else {
			throw new CRMProviderError(
				"pipedrive",
				"pipedrive apiDomain or companyDomain is required in integration settings"
			)
		}
	}

	async importLeads(params: {
		limit: number
		cursor?: string | null
		query?: string | null
	}): Promise<CRMLeadImportResult> {
		const limit = Math.max(1, Math.min(params.limit || 25, 500))

		if (params.query?.trim()) {
			return this.searchPersons(params.query.trim(), limit)
		}

		const url = new URL(`${this.apiDomain}/api/v2/persons`)
		url.searchParams.set("limit", String(limit))
		if (params.cursor) {
			url.searchParams.set("cursor", params.cursor)
		}

		const response = await requestJson<PipedriveCollectionResponse>(
			"pipedrive",
			url.toString(),
			{
				method: "GET",
				headers: withBearerToken(this.token)
			}
		)

		return {
			leads: (response.data || []).map((person) =>
				mapPipedrivePerson(person)
			),
			nextCursor:
				response.additional_data?.pagination?.next_cursor ||
				response.additional_data?.next_cursor ||
				null,
			raw: response as unknown as Record<string, unknown>
		}
	}

	private async searchPersons(query: string, limit: number) {
		const url = new URL(`${this.apiDomain}/api/v2/persons/search`)
		url.searchParams.set("term", query)
		url.searchParams.set("limit", String(limit))

		const response = await requestJson<{
			success?: boolean
			data?: {
				items?: Array<{
					item?: Record<string, unknown>
				}>
			}
			additional_data?: {
				next_cursor?: string | null
				pagination?: {
					next_cursor?: string | null
				}
			}
		}>("pipedrive", url.toString(), {
			method: "GET",
			headers: withBearerToken(this.token)
		})

		const items = response.data?.items || []
		return {
			leads: items
				.map((entry) => entry.item)
				.filter(Boolean)
				.map((person) =>
					mapPipedrivePerson(person as Record<string, unknown>)
				),
			nextCursor:
				response.additional_data?.pagination?.next_cursor ||
				response.additional_data?.next_cursor ||
				null,
			raw: response as unknown as Record<string, unknown>
		}
	}

	async syncCallOutcome(input: CRMCallSyncInput) {
		if (!input.externalContactId && !input.externalDealId) {
			return {
				success: false,
				provider: "pipedrive" as const,
				error: "Missing Pipedrive target IDs"
			}
		}

		const payload: Record<string, unknown> = {
			content: buildCallNoteBody(input)
		}

		if (input.externalContactId) {
			payload.person_id = Number(input.externalContactId)
		}
		if (input.externalDealId) {
			payload.deal_id = Number(input.externalDealId)
		}

		const response = await requestJson<{
			success?: boolean
			data?: {
				id?: number
			}
		}>("pipedrive", `${this.apiDomain}/v1/notes`, {
			method: "POST",
			headers: {
				...withBearerToken(this.token),
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload)
		})

		return {
			success: true,
			provider: "pipedrive" as const,
			externalActivityId:
				typeof response.data?.id === "number"
					? String(response.data.id)
					: null
		}
	}
}

function mapPipedrivePerson(person: Record<string, unknown>) {
	const name = toOptionalString(person.name) || "Unknown"
	const primaryEmail = getPrimaryContactField(person.email)
	const primaryPhone = getPrimaryContactField(person.phone)
	return {
		externalId: String(person.id),
		name,
		email: primaryEmail,
		phone: primaryPhone,
		source: null,
		status: null,
		notes: null,
		metadata: {
			provider: "pipedrive"
		}
	}
}

function getPrimaryContactField(value: unknown) {
	if (typeof value === "string") {
		return value
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			if (typeof entry === "string" && entry.trim().length > 0) {
				return entry.trim()
			}
			if (entry && typeof entry === "object") {
				const record = entry as Record<string, unknown>
				if (
					typeof record.value === "string" &&
					record.value.trim().length > 0
				) {
					return record.value.trim()
				}
			}
		}
	}

	return null
}

function toOptionalString(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim()
	}
	return null
}
