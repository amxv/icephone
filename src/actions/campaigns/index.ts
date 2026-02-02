// Re-export all campaign functions for backward compatibility

// Basic campaign operations
export {
	getCampaigns,
	getCampaignById,
	createCampaign,
	updateCampaign,
	deleteCampaign,
	createEnhancedCampaign,
	assignVoiceAgentToCampaign,
	configureCampaignSettings,
	archiveCampaign,
	unarchiveCampaign,
	bulkArchiveCampaigns,
	getArchivedCampaigns,
	permanentlyDeleteCampaign,
	duplicateCampaign,
	createCampaignTemplate,
	getCampaignTemplates,
	createCampaignFromTemplate
} from "./basic"

// Types and interfaces
export type {
	CampaignFilter,
	CampaignStatus,
	EnhancedCampaignData
} from "./basic"

// Lead management
export {
	assignLeadsToCampaign,
	removeLeadFromCampaign,
	bulkAssignLeads,
	getCampaignLeads,
	createLeadAndAssignToCampaign
} from "./leads"

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

// Campaign execution engine
export {
	startCampaign,
	pauseCampaign,
	resumeCampaign,
	stopCampaign,
	scheduleCampaign,
	processScheduledCampaigns,
	processNextQueueBatch,
	getCampaignExecutionStatus,
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
