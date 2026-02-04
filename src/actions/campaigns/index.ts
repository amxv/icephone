// Re-export all campaign functions for backward compatibility

// Core campaign operations (team-scoped)
export {
	getCampaigns,
	getCampaignById,
	createCampaign,
	updateCampaign,
	deleteCampaign,
	createEnhancedCampaign,
	getCampaignTemplates,
	createCampaignFromTemplate,
	assignLeadsToCampaign,
	removeLeadFromCampaign,
	getCampaignLeads,
	createLeadAndAssignToCampaign,
	startCampaign,
	pauseCampaign,
	resumeCampaign,
	stopCampaign,
	getCampaignExecutionStatus
} from "./core"

// Types and interfaces
export type {
	CampaignFilter,
	CampaignStatus,
	EnhancedCampaignData
} from "./core"

// Advanced/basic campaign operations (legacy)
export {
	assignVoiceAgentToCampaign,
	configureCampaignSettings,
	archiveCampaign,
	unarchiveCampaign,
	bulkArchiveCampaigns,
	getArchivedCampaigns,
	permanentlyDeleteCampaign,
	duplicateCampaign,
	createCampaignTemplate
} from "./basic"

// Lead management (legacy helpers)
export { bulkAssignLeads } from "./leads"

// Queue management
export {
	addLeadsToQueue,
	removeLeadFromQueue,
	getCampaignQueue,
	reorderQueue
} from "./queue"

// Campaign validation
export { validateCampaignConfiguration } from "./validation"

// CSV import functionality
export { processCSVImport } from "./import"

// Types for CSV import
export type {
	CSVLeadData,
	CSVImportResult
} from "./import"

// Campaign execution engine (legacy / background)
export {
	scheduleCampaign,
	processScheduledCampaigns,
	processNextQueueBatch,
	triggerCampaignProcessing
} from "./execution"

// Campaign monitoring and analytics
export {
	getCampaignHealth,
	getAllCampaignsHealth,
	checkPerformanceAlerts,
	generateCampaignReport
} from "./monitoring"

// Types for monitoring
export type {
	CampaignHealth,
	PerformanceAlert,
	CampaignReport
} from "./monitoring"
