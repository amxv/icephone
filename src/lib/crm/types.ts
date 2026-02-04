export const crmProviderValues = [
	"hubspot",
	"salesforce",
	"gohighlevel",
	"pipedrive"
] as const

export type CRMProvider = (typeof crmProviderValues)[number]

export interface CRMProviderSettings {
	accessToken?: string
	refreshToken?: string
	tokenExpiresAt?: string | null
	instanceUrl?: string
	apiDomain?: string
	companyDomain?: string
	locationId?: string
	apiVersion?: string
	objectMapping?: {
		salesforceLeadObject?: "Lead" | "Contact"
		noteAssociationTypeId?: number
	}
	[key: string]: unknown
}

export interface CRMIntegrationConfig {
	provider: CRMProvider
	apiKey?: string | null
	settings?: CRMProviderSettings
}

export interface CRMLeadRecord {
	externalId: string
	name: string
	email?: string | null
	phone?: string | null
	source?: string | null
	notes?: string | null
	status?: string | null
	dealValue?: number | null
	externalOwnerId?: string | null
	externalStageId?: string | null
	metadata?: Record<string, unknown>
}

export interface CRMLeadImportResult {
	leads: CRMLeadRecord[]
	nextCursor?: string | null
	raw?: Record<string, unknown>
}

export interface CRMCallSyncInput {
	externalContactId?: string | null
	externalDealId?: string | null
	callId: number
	callTimestamp: Date
	durationSeconds?: number | null
	status?: string | null
	disposition?: string | null
	summary?: string | null
	transcript?: string | null
	autoNote?: string | null
	campaignId?: number | null
	agentId?: number | null
	metadata?: Record<string, unknown>
}

export interface CRMCallSyncResult {
	success: boolean
	provider: CRMProvider
	externalActivityId?: string | null
	message?: string
	error?: string
}

export interface CRMProviderAdapter {
	importLeads(params: {
		limit: number
		cursor?: string | null
		query?: string | null
	}): Promise<CRMLeadImportResult>
	syncCallOutcome(input: CRMCallSyncInput): Promise<CRMCallSyncResult>
}
