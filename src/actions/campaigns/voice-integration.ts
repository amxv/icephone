"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, desc } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, voiceAgents, leads, calls } from "@/db/schema"

// Get the type from the schema definition
type CampaignSettingsType = NonNullable<
	typeof campaigns.$inferSelect.campaignSettings
>

// Extended campaign settings type that includes voice configuration
type ExtendedCampaignSettings = CampaignSettingsType & {
	voiceConfiguration?: CampaignVoiceConfiguration
}

// Interface for campaign-specific voice configuration
export interface CampaignVoiceConfiguration {
	campaignSpecificPrompt?: string
	leadPersonalizationRules?: {
		includeLeadName: boolean
		includeLeadScore: boolean
		includePreviousInteractions: boolean
		includeSource: boolean
		includeNotes: boolean
	}
	callFlowCustomization?: {
		openingScript?: string
		objectionHandling?: string[]
		closingScript?: string
		appointmentScheduling?: boolean
		followupInstructions?: string
	}
	contextVariables?: {
		campaignGoal?: string
		targetAudience?: string
		valueProposition?: string
		urgencyLevel?: "low" | "medium" | "high"
		callToAction?: string
	}
	behaviorSettings?: {
		aggressivenessLevel?: number // 1-10 scale
		professionalismLevel?: number // 1-10 scale
		persistenceLevel?: number // 1-10 scale
		empathyLevel?: number // 1-10 scale
	}
}

// Interface for dynamic prompt generation based on lead context
export interface LeadCallContext {
	leadId: number
	leadName: string
	leadScore?: number
	previousInteractions?: {
		lastCallDate?: Date
		lastCallOutcome?: string
		notesFromPreviousCalls?: string
	}
	leadStatus: string
	source?: string
	notes?: string
}

/**
 * Configure campaign-specific voice agent settings
 */
export async function configureCampaignVoiceAgent(
	campaignId: number,
	voiceConfig: CampaignVoiceConfiguration
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Verify campaign ownership
		const campaign = await db_ws
			.select({ id: campaigns.id, voiceAgentId: campaigns.voiceAgentId })
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaign || campaign.length === 0) {
			return { success: false, error: "Campaign not found" }
		}

		if (!campaign[0].voiceAgentId) {
			return {
				success: false,
				error: "No voice agent assigned to this campaign. Please assign a voice agent first."
			}
		}

		// Update campaign settings with voice configuration
		const updatedSettings: ExtendedCampaignSettings = {
			voiceConfiguration: voiceConfig
		}

		await db_ws
			.update(campaigns)
			.set({
				campaignSettings: updatedSettings,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)

		return { success: true, data: voiceConfig }
	} catch (error) {
		console.error("Error configuring campaign voice agent:", error)
		return { success: false, error: "Failed to configure voice agent" }
	}
}

/**
 * Generate campaign-specific prompt for a voice agent based on lead context
 */
export async function generateCampaignContextPrompt(
	campaignId: number,
	leadContext: LeadCallContext
): Promise<{ success: boolean; prompt?: string; error?: string }> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Get campaign and its voice configuration
		const campaignResult = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				description: campaigns.description,
				campaignSettings: campaigns.campaignSettings,
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaignResult || campaignResult.length === 0) {
			return { success: false, error: "Campaign not found" }
		}

		const campaign = campaignResult[0]
		const settings = campaign.campaignSettings as ExtendedCampaignSettings
		const voiceConfig = settings?.voiceConfiguration

		if (!voiceConfig) {
			return {
				success: false,
				error: "No voice configuration found for this campaign"
			}
		}

		// Get the base voice agent configuration
		let basePrompt = ""
		if (campaign.voiceAgentId) {
			const agentResult = await db_ws
				.select({ prompt: voiceAgents.prompt })
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, campaign.voiceAgentId),
						eq(voiceAgents.userId, userId)
					)
				)
				.limit(1)

			if (agentResult && agentResult.length > 0) {
				basePrompt = agentResult[0].prompt || ""
			}
		}

		// Build dynamic prompt with campaign and lead context
		let contextualPrompt = basePrompt

		// Add campaign-specific instructions
		if (voiceConfig.campaignSpecificPrompt) {
			contextualPrompt += `\n\nCAMPAIGN CONTEXT:\n${voiceConfig.campaignSpecificPrompt}`
		}

		// Add campaign context variables
		if (voiceConfig.contextVariables) {
			contextualPrompt += `\n\nCAMPAIGN DETAILS:`
			if (voiceConfig.contextVariables.campaignGoal) {
				contextualPrompt += `\n- Goal: ${voiceConfig.contextVariables.campaignGoal}`
			}
			if (voiceConfig.contextVariables.targetAudience) {
				contextualPrompt += `\n- Target Audience: ${voiceConfig.contextVariables.targetAudience}`
			}
			if (voiceConfig.contextVariables.valueProposition) {
				contextualPrompt += `\n- Value Proposition: ${voiceConfig.contextVariables.valueProposition}`
			}
			if (voiceConfig.contextVariables.callToAction) {
				contextualPrompt += `\n- Call to Action: ${voiceConfig.contextVariables.callToAction}`
			}
			if (voiceConfig.contextVariables.urgencyLevel) {
				contextualPrompt += `\n- Urgency Level: ${voiceConfig.contextVariables.urgencyLevel}`
			}
		}

		// Add lead personalization
		if (voiceConfig.leadPersonalizationRules) {
			contextualPrompt += `\n\nLEAD INFORMATION:`

			if (
				voiceConfig.leadPersonalizationRules.includeLeadName &&
				leadContext.leadName
			) {
				contextualPrompt += `\n- Lead Name: ${leadContext.leadName}`
			}

			if (
				voiceConfig.leadPersonalizationRules.includeLeadScore &&
				leadContext.leadScore
			) {
				contextualPrompt += `\n- Lead Score: ${leadContext.leadScore}/100`
			}

			if (
				voiceConfig.leadPersonalizationRules.includeSource &&
				leadContext.source
			) {
				contextualPrompt += `\n- Lead Source: ${leadContext.source}`
			}

			if (
				voiceConfig.leadPersonalizationRules.includeNotes &&
				leadContext.notes
			) {
				contextualPrompt += `\n- Notes: ${leadContext.notes}`
			}

			if (
				voiceConfig.leadPersonalizationRules
					.includePreviousInteractions &&
				leadContext.previousInteractions
			) {
				contextualPrompt += `\n- Previous Interactions:`
				if (leadContext.previousInteractions.lastCallDate) {
					contextualPrompt += `\n  - Last Call: ${leadContext.previousInteractions.lastCallDate.toDateString()}`
				}
				if (leadContext.previousInteractions.lastCallOutcome) {
					contextualPrompt += `\n  - Last Outcome: ${leadContext.previousInteractions.lastCallOutcome}`
				}
				if (leadContext.previousInteractions.notesFromPreviousCalls) {
					contextualPrompt += `\n  - Previous Notes: ${leadContext.previousInteractions.notesFromPreviousCalls}`
				}
			}
		}

		// Add call flow customization
		if (voiceConfig.callFlowCustomization) {
			contextualPrompt += `\n\nCALL FLOW INSTRUCTIONS:`

			if (voiceConfig.callFlowCustomization.openingScript) {
				contextualPrompt += `\n- Opening Script: ${voiceConfig.callFlowCustomization.openingScript}`
			}

			if (
				voiceConfig.callFlowCustomization.objectionHandling &&
				voiceConfig.callFlowCustomization.objectionHandling.length > 0
			) {
				contextualPrompt += `\n- Objection Handling:`
				voiceConfig.callFlowCustomization.objectionHandling.forEach(
					(objection, index) => {
						contextualPrompt += `\n  ${index + 1}. ${objection}`
					}
				)
			}

			if (voiceConfig.callFlowCustomization.closingScript) {
				contextualPrompt += `\n- Closing Script: ${voiceConfig.callFlowCustomization.closingScript}`
			}

			if (voiceConfig.callFlowCustomization.appointmentScheduling) {
				contextualPrompt += `\n- Appointment Scheduling: Enabled - Offer to schedule a follow-up appointment if interested`
			}

			if (voiceConfig.callFlowCustomization.followupInstructions) {
				contextualPrompt += `\n- Follow-up Instructions: ${voiceConfig.callFlowCustomization.followupInstructions}`
			}
		}

		// Add behavior settings
		if (voiceConfig.behaviorSettings) {
			contextualPrompt += `\n\nBEHAVIOR SETTINGS:`
			if (voiceConfig.behaviorSettings.aggressivenessLevel) {
				contextualPrompt += `\n- Aggressiveness: ${voiceConfig.behaviorSettings.aggressivenessLevel}/10`
			}
			if (voiceConfig.behaviorSettings.professionalismLevel) {
				contextualPrompt += `\n- Professionalism: ${voiceConfig.behaviorSettings.professionalismLevel}/10`
			}
			if (voiceConfig.behaviorSettings.persistenceLevel) {
				contextualPrompt += `\n- Persistence: ${voiceConfig.behaviorSettings.persistenceLevel}/10`
			}
			if (voiceConfig.behaviorSettings.empathyLevel) {
				contextualPrompt += `\n- Empathy: ${voiceConfig.behaviorSettings.empathyLevel}/10`
			}
		}

		return { success: true, prompt: contextualPrompt }
	} catch (error) {
		console.error("Error generating campaign context prompt:", error)
		return { success: false, error: "Failed to generate contextual prompt" }
	}
}

/**
 * Get campaign voice configuration
 */
export async function getCampaignVoiceConfiguration(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaignResult = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				campaignSettings: campaigns.campaignSettings,
				voiceAgentId: campaigns.voiceAgentId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaignResult || campaignResult.length === 0) {
			return { success: false, error: "Campaign not found", data: null }
		}

		const campaign = campaignResult[0]
		const settings = campaign.campaignSettings as ExtendedCampaignSettings
		const voiceConfig = settings?.voiceConfiguration

		return {
			success: true,
			data: {
				campaignId: campaign.id,
				campaignName: campaign.name,
				voiceAgentId: campaign.voiceAgentId,
				voiceConfiguration: voiceConfig || null
			}
		}
	} catch (error) {
		console.error("Error getting campaign voice configuration:", error)
		return {
			success: false,
			error: "Failed to get voice configuration",
			data: null
		}
	}
}

/**
 * Get lead context for call personalization
 */
export async function getLeadCallContext(
	leadId: number
): Promise<{ success: boolean; data?: LeadCallContext; error?: string }> {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		// Get lead information
		const leadResult = await db_ws
			.select({
				id: leads.id,
				name: leads.name,
				score: leads.score,
				status: leads.status,
				source: leads.source,
				notes: leads.notes
			})
			.from(leads)
			.where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
			.limit(1)

		if (!leadResult || leadResult.length === 0) {
			return { success: false, error: "Lead not found" }
		}

		const lead = leadResult[0]

		// Get previous call information
		const previousCalls = await db_ws
			.select({
				startTime: calls.startTime,
				status: calls.status,
				summary: calls.summary
			})
			.from(calls)
			.where(and(eq(calls.leadId, leadId), eq(calls.userId, userId)))
			.orderBy(desc(calls.startTime))
			.limit(3)

		const leadContext: LeadCallContext = {
			leadId: lead.id,
			leadName: lead.name,
			leadScore: lead.score || undefined,
			leadStatus: lead.status || "new",
			source: lead.source || undefined,
			notes: lead.notes || undefined,
			previousInteractions:
				previousCalls.length > 0
					? {
							lastCallDate: previousCalls[0].startTime,
							lastCallOutcome:
								previousCalls[0].status || undefined,
							notesFromPreviousCalls:
								previousCalls
									.map((call) => call.summary)
									.filter(Boolean)
									.join("; ") || undefined
						}
					: undefined
		}

		return { success: true, data: leadContext }
	} catch (error) {
		console.error("Error getting lead call context:", error)
		return { success: false, error: "Failed to get lead context" }
	}
}
