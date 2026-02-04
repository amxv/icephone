import { GoHighLevelAdapter } from "@/lib/crm/providers/gohighlevel"
import { HubSpotAdapter } from "@/lib/crm/providers/hubspot"
import { PipedriveAdapter } from "@/lib/crm/providers/pipedrive"
import { SalesforceAdapter } from "@/lib/crm/providers/salesforce"
import { CRMProviderError } from "@/lib/crm/providers/http"
import type { CRMIntegrationConfig, CRMProviderAdapter } from "@/lib/crm/types"

export function createCRMProviderAdapter(
	config: CRMIntegrationConfig
): CRMProviderAdapter {
	switch (config.provider) {
		case "hubspot":
			return new HubSpotAdapter(config)
		case "salesforce":
			return new SalesforceAdapter(config)
		case "gohighlevel":
			return new GoHighLevelAdapter(config)
		case "pipedrive":
			return new PipedriveAdapter(config)
		default:
			throw new CRMProviderError(
				config.provider,
				`Unsupported CRM provider: ${config.provider}`
			)
	}
}
