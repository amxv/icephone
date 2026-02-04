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

interface SalesforceQueryResponse {
	records?: Array<Record<string, unknown>>
	nextRecordsUrl?: string
	done?: boolean
}

export class SalesforceAdapter implements CRMProviderAdapter {
	private readonly token: string
	private readonly instanceUrl: string
	private readonly apiVersion: string
	private readonly leadObject: "Lead" | "Contact"

	constructor(config: CRMIntegrationConfig) {
		this.token = ensureToken(
			"salesforce",
			config.settings?.accessToken || config.apiKey
		)
		const instanceUrl = config.settings?.instanceUrl
		if (!instanceUrl) {
			throw new CRMProviderError(
				"salesforce",
				"salesforce instanceUrl is required in integration settings"
			)
		}
		this.instanceUrl = instanceUrl.replace(/\/$/, "")
		this.apiVersion =
			typeof config.settings?.apiVersion === "string" &&
			config.settings.apiVersion.trim().length > 0
				? config.settings.apiVersion.trim()
				: "v60.0"
		this.leadObject =
			config.settings?.objectMapping?.salesforceLeadObject || "Lead"
	}

	async importLeads(params: {
		limit: number
		cursor?: string | null
		query?: string | null
	}): Promise<CRMLeadImportResult> {
		const limit = Math.max(1, Math.min(params.limit || 25, 200))

		if (params.cursor) {
			const continuationUrl = `${this.instanceUrl}${params.cursor}`
			const response = await requestJson<SalesforceQueryResponse>(
				"salesforce",
				continuationUrl,
				{
					method: "GET",
					headers: withBearerToken(this.token)
				}
			)
			return this.toImportResult(response)
		}

		const escapedQuery = params.query ? escapeSoql(params.query.trim()) : null
		const whereClause = escapedQuery
			? ` WHERE Name LIKE '%${escapedQuery}%' OR Email LIKE '%${escapedQuery}%'`
			: ""

		const query = `SELECT Id, Name, Email, Phone, LeadSource, Status FROM ${this.leadObject}${whereClause} ORDER BY LastModifiedDate DESC LIMIT ${limit}`
		const url = new URL(
			`${this.instanceUrl}/services/data/${this.apiVersion}/query`
		)
		url.searchParams.set("q", query)

		const response = await requestJson<SalesforceQueryResponse>(
			"salesforce",
			url.toString(),
			{
				method: "GET",
				headers: withBearerToken(this.token)
			}
		)

		return this.toImportResult(response)
	}

	async syncCallOutcome(input: CRMCallSyncInput) {
		if (!input.externalContactId && !input.externalDealId) {
			return {
				success: false,
				provider: "salesforce" as const,
				error: "Missing Salesforce target record IDs"
			}
		}

		const payload: Record<string, unknown> = {
			Subject: `IcePhone Call ${input.disposition ? `- ${input.disposition}` : ""}`.trim(),
			Description: buildCallNoteBody(input),
			Status: "Completed",
			Priority: "Normal",
			Type: "Call",
			ActivityDate: input.callTimestamp.toISOString().slice(0, 10)
		}

		if (input.externalContactId) {
			payload.WhoId = input.externalContactId
		}
		if (input.externalDealId) {
			payload.WhatId = input.externalDealId
		}

		const response = await requestJson<{ id?: string }>(
			"salesforce",
			`${this.instanceUrl}/services/data/${this.apiVersion}/sobjects/Task`,
			{
				method: "POST",
				headers: {
					...withBearerToken(this.token),
					"Content-Type": "application/json"
				},
				body: JSON.stringify(payload)
			}
		)

		return {
			success: true,
			provider: "salesforce" as const,
			externalActivityId: response.id || null
		}
	}

	private toImportResult(response: SalesforceQueryResponse): CRMLeadImportResult {
		const leads = (response.records || []).map((record) => ({
			externalId: String(record.Id),
			name: String(record.Name || "Unknown"),
			email: toOptionalString(record.Email),
			phone: toOptionalString(record.Phone),
			source: toOptionalString(record.LeadSource),
			status: toOptionalString(record.Status),
			metadata: {
				provider: "salesforce",
				object: this.leadObject
			}
		}))

		return {
			leads,
			nextCursor: response.nextRecordsUrl || null,
			raw: response as unknown as Record<string, unknown>
		}
	}
}

function toOptionalString(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim()
	}

	return null
}

function escapeSoql(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}
