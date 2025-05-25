import { db_ws } from "@/db"
import { leads, tasks, leadInteractions } from "@/db/schema"
import { eq, and, gte, avg, count, sql } from "drizzle-orm"
import {
	UpdateLeadScoreSchema,
	UpdateLeadNotesSchema,
	GetLeadHistorySchema,
	UpdateDealStageSchema,
	UpdateLeadStatusSchema,
	AssignLeadSchema,
	DetectDuplicateLeadsSchema
} from "../schemas"
import { logLeadInteraction } from "../utils"

// Add new enum for lead stages (matching schema leadStatusEnum)
const LEAD_STAGES = {
	NEW: "new",
	CONTACTED: "contacted",
	QUALIFIED: "qualified",
	CONVERTED: "converted",
	LOST: "lost"
} as const

// Add note categorization functionality
export function categorizeNote(noteContent: string): {
	category: "follow-up" | "objection" | "interest" | "general"
	keywords: string[]
	priority: "low" | "medium" | "high"
} {
	const content = noteContent.toLowerCase()

	// Keywords for different categories
	const followUpKeywords = [
		"follow up",
		"call back",
		"meeting",
		"appointment",
		"schedule",
		"next week",
		"contact again"
	]
	const objectionKeywords = [
		"too expensive",
		"not interested",
		"think about it",
		"budget",
		"competitor",
		"already have"
	]
	const interestKeywords = [
		"interested",
		"like it",
		"sounds good",
		"perfect",
		"exactly what",
		"need this",
		"when can we start"
	]

	// Check for follow-up indicators
	if (followUpKeywords.some((keyword) => content.includes(keyword))) {
		return {
			category: "follow-up",
			keywords: followUpKeywords.filter((keyword) =>
				content.includes(keyword)
			),
			priority:
				content.includes("urgent") || content.includes("asap")
					? "high"
					: "medium"
		}
	}

	// Check for objections
	if (objectionKeywords.some((keyword) => content.includes(keyword))) {
		return {
			category: "objection",
			keywords: objectionKeywords.filter((keyword) =>
				content.includes(keyword)
			),
			priority: "high" // Objections need immediate attention
		}
	}

	// Check for interest indicators
	if (interestKeywords.some((keyword) => content.includes(keyword))) {
		return {
			category: "interest",
			keywords: interestKeywords.filter((keyword) =>
				content.includes(keyword)
			),
			priority: "high" // High interest leads are priority
		}
	}

	return {
		category: "general",
		keywords: [],
		priority: "low"
	}
}

// Automated lead stage progression based on conversation outcomes
export async function progressLeadStage(
	leadId: number,
	currentStage: string,
	conversationOutcome: string,
	userId: string,
	toolCallId: string
): Promise<string | null> {
	try {
		const outcome = conversationOutcome.toLowerCase()
		let newStage = null

		switch (currentStage) {
			case LEAD_STAGES.NEW:
				if (outcome.includes("answered") || outcome.includes("spoke")) {
					newStage = LEAD_STAGES.CONTACTED
				}
				break

			case LEAD_STAGES.CONTACTED:
				if (
					outcome.includes("interested") ||
					outcome.includes("qualified") ||
					outcome.includes("meeting")
				) {
					newStage = LEAD_STAGES.QUALIFIED
				} else if (
					outcome.includes("not interested") ||
					outcome.includes("declined")
				) {
					newStage = LEAD_STAGES.LOST
				}
				break

			case LEAD_STAGES.QUALIFIED:
				if (
					outcome.includes("deal closed") ||
					outcome.includes("contract signed") ||
					outcome.includes("agreement reached") ||
					outcome.includes("accepted") ||
					outcome.includes("signed")
				) {
					newStage = LEAD_STAGES.CONVERTED
				} else if (
					outcome.includes("not qualified") ||
					outcome.includes("budget issues") ||
					outcome.includes("rejected") ||
					outcome.includes("declined")
				) {
					newStage = LEAD_STAGES.LOST
				}
				break
		}

		if (newStage && newStage !== currentStage) {
			// Update the lead stage
			await db_ws
				.update(leads)
				.set({
					status: newStage,
					updatedAt: new Date()
				})
				.where(and(eq(leads.id, leadId), eq(leads.userId, userId)))

			// Log the stage progression
			await logLeadInteraction(
				leadId,
				"stage_progression",
				"automated",
				toolCallId,
				{ stage: currentStage },
				{ stage: newStage },
				{ conversationOutcome, reason: "automated_progression" },
				userId
			)

			return newStage
		}

		return null
	} catch (error) {
		console.error("Error progressing lead stage:", error)
		return null
	}
}

export async function updateLeadScore(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, scoreChange, reason } =
			UpdateLeadScoreSchema.parse(parameters)

		// Get current lead
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Calculate new score (clamp between 0-100)
		const currentScore = lead.score || 0
		const newScore = Math.max(0, Math.min(100, currentScore + scoreChange))

		// Store old values for interaction logging
		const oldValues = {
			score: currentScore,
			notes: lead.notes,
			status: lead.status
		}

		// Update the lead
		const noteUpdate = reason
			? `${lead.notes ? `${lead.notes}\n` : ""}Score updated: ${reason} (${scoreChange > 0 ? "+" : ""}${scoreChange} points)`
			: lead.notes

		await db_ws
			.update(leads)
			.set({
				score: newScore,
				notes: noteUpdate,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, userId)
				)
			)

		// Automated stage progression based on score changes
		let stageProgressionMessage = ""
		if (reason && lead.status) {
			const newStage = await progressLeadStage(
				Number.parseInt(leadId),
				lead.status,
				reason,
				userId,
				toolCallId
			)

			if (newStage) {
				stageProgressionMessage = ` Lead stage automatically progressed to ${newStage}.`
			}
		}

		// Log the interaction
		await logLeadInteraction(
			Number.parseInt(leadId),
			"score_update",
			"vapi_tool",
			toolCallId,
			oldValues,
			{ score: newScore, notes: noteUpdate },
			{ reason, scoreChange, toolName: "updateLeadScore" },
			userId
		)

		return {
			toolCallId,
			result: `Lead score updated from ${currentScore} to ${newScore}. ${reason ? `Reason: ${reason}` : ""}${stageProgressionMessage}`
		}
	} catch (error) {
		console.error("Error updating lead score:", error)
		return {
			toolCallId,
			result: "Failed to update lead score"
		}
	}
}

export async function updateLeadNotes(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, notes, append } =
			UpdateLeadNotesSchema.parse(parameters)

		// Get current lead
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Categorize the note
		const noteAnalysis = categorizeNote(notes)

		// Store old values for interaction logging
		const oldNotes = lead.notes

		// Prepare new notes with categorization
		const timestamp = new Date().toISOString()
		const categoryTag = `[${noteAnalysis.category.toUpperCase()}${noteAnalysis.priority === "high" ? " - HIGH PRIORITY" : ""}]`
		const formattedNote = `[${timestamp}] ${categoryTag} ${notes}`
		const newNotes =
			append && lead.notes
				? `${lead.notes}\n${formattedNote}`
				: formattedNote

		// Update the lead
		await db_ws
			.update(leads)
			.set({
				notes: newNotes,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, userId)
				)
			)

		// Automatic stage progression for certain note categories
		let stageProgressionMessage = ""
		if (
			(noteAnalysis.category === "objection" ||
				noteAnalysis.category === "interest") &&
			lead.status
		) {
			const progressionReason =
				noteAnalysis.category === "objection"
					? `objection noted: ${noteAnalysis.keywords.join(", ")}`
					: `strong interest shown: ${noteAnalysis.keywords.join(", ")}`

			const newStage = await progressLeadStage(
				Number.parseInt(leadId),
				lead.status,
				progressionReason,
				userId,
				toolCallId
			)

			if (newStage) {
				stageProgressionMessage = ` Lead stage automatically progressed to ${newStage} based on note content.`
			}
		}

		// Log the interaction
		await logLeadInteraction(
			Number.parseInt(leadId),
			"note_added",
			"vapi_tool",
			toolCallId,
			{ notes: oldNotes },
			{ notes: newNotes },
			{
				append,
				originalNote: notes,
				toolName: "updateLeadNotes",
				category: noteAnalysis.category,
				priority: noteAnalysis.priority,
				keywords: noteAnalysis.keywords
			},
			userId
		)

		return {
			toolCallId,
			result: `Lead notes ${append ? "updated" : "replaced"} successfully. Note categorized as ${noteAnalysis.category} (${noteAnalysis.priority} priority).${stageProgressionMessage}`
		}
	} catch (error) {
		console.error("Error updating lead notes:", error)
		return {
			toolCallId,
			result: "Failed to update lead notes"
		}
	}
}

export async function getLeadHistory(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, includeInteractions, includeTranscripts, limit } =
			GetLeadHistorySchema.parse(parameters)

		// Get the lead with user context validation
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Build comprehensive lead history
		const history: string[] = []

		// Basic lead information
		history.push(`Lead: ${lead.name}`)
		if (lead.email) history.push(`Email: ${lead.email}`)
		if (lead.phone) history.push(`Phone: ${lead.phone}`)
		history.push(`Status: ${lead.status}`)
		history.push(`Score: ${lead.score || 0}/100`)
		if (lead.source) history.push(`Source: ${lead.source}`)
		if (lead.notes) history.push(`Notes: ${lead.notes}`)

		// Get recent calls
		const { calls } = await import("@/db/schema")
		const { desc } = await import("drizzle-orm")

		const recentCalls = await db_ws.query.calls.findMany({
			where: and(
				eq(calls.leadId, Number.parseInt(leadId)),
				eq(calls.userId, userId)
			),
			orderBy: [desc(calls.startTime)],
			limit
		})

		if (recentCalls.length > 0) {
			history.push("\nRecent Calls:")
			for (const call of recentCalls) {
				const date = new Date(call.startTime).toLocaleDateString()
				const duration = call.duration ? `${call.duration}s` : "Unknown"
				history.push(
					`- ${date}: ${call.type} call, ${duration}, ${call.status || "completed"}`
				)

				if (includeTranscripts && call.transcript) {
					const excerpt = call.transcript.slice(0, 150)
					history.push(`  Summary: ${call.summary || excerpt}...`)
				}
			}
		}

		// Get recent emails
		const { emails } = await import("@/db/schema")

		const recentEmails = await db_ws.query.emails.findMany({
			where: and(
				eq(emails.leadId, Number.parseInt(leadId)),
				eq(emails.userId, userId)
			),
			orderBy: [desc(emails.sentAt)],
			limit: Math.min(limit, 5) // Limit emails to avoid too much text
		})

		if (recentEmails.length > 0) {
			history.push("\nRecent Emails:")
			for (const email of recentEmails) {
				const date = new Date(email.sentAt).toLocaleDateString()
				history.push(
					`- ${date}: ${email.type} - "${email.subject}" (${email.status})`
				)
			}
		}

		// Get recent text messages
		const { textMessages } = await import("@/db/schema")

		const recentTexts = await db_ws.query.textMessages.findMany({
			where: and(
				eq(textMessages.leadId, Number.parseInt(leadId)),
				eq(textMessages.userId, userId)
			),
			orderBy: [desc(textMessages.sentAt)],
			limit: Math.min(limit, 5)
		})

		if (recentTexts.length > 0) {
			history.push("\nRecent Text Messages:")
			for (const text of recentTexts) {
				const date = new Date(text.sentAt).toLocaleDateString()
				const preview = text.content.slice(0, 50)
				history.push(`- ${date}: ${text.type} - "${preview}..."`)
			}
		}

		// Get recent interactions if requested
		const { leadInteractions } = await import("@/db/schema")
		let recentInteractions: (typeof leadInteractions.$inferSelect)[] = []
		if (includeInteractions) {
			recentInteractions = await db_ws.query.leadInteractions.findMany({
				where: and(
					eq(leadInteractions.leadId, Number.parseInt(leadId)),
					eq(leadInteractions.userId, userId)
				),
				orderBy: [desc(leadInteractions.createdAt)],
				limit: Math.min(limit, 5)
			})

			if (recentInteractions.length > 0) {
				history.push("\nRecent Interactions:")
				for (const interaction of recentInteractions) {
					const date = new Date(
						interaction.createdAt
					).toLocaleDateString()
					history.push(
						`- ${date}: ${interaction.interactionType} via ${interaction.source}`
					)
					if (interaction.metadata?.reason) {
						history.push(`  Reason: ${interaction.metadata.reason}`)
					}
				}
			}
		}

		const result = history.join("\n")

		// Log the retrieval for analytics
		await logLeadInteraction(
			Number.parseInt(leadId),
			"history_retrieved",
			"vapi_tool",
			toolCallId,
			null,
			{
				includeInteractions,
				includeTranscripts,
				recordsReturned: {
					calls: recentCalls.length,
					emails: recentEmails.length,
					texts: recentTexts.length,
					interactions: includeInteractions
						? recentInteractions?.length || 0
						: 0
				}
			},
			{
				toolName: "getLeadHistory",
				totalRecords:
					recentCalls.length +
					recentEmails.length +
					recentTexts.length
			},
			userId
		)

		return {
			toolCallId,
			result: `Lead History for ${lead.name}:\n\n${result}`
		}
	} catch (error) {
		console.error("Error retrieving lead history:", error)
		return {
			toolCallId,
			result: "Failed to retrieve lead history"
		}
	}
}

export async function updateDealStage(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const { leadId, dealStage, dealValue, notes, expectedCloseDate } =
			UpdateDealStageSchema.parse(parameters)

		// Verify lead exists and belongs to user
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			return {
				toolCallId,
				result: "Lead not found or access denied"
			}
		}

		// Store old values for audit logging
		const oldValues = {
			dealStage: lead.dealStage,
			dealValue: lead.dealValue,
			expectedCloseDate: lead.expectedCloseDate?.toISOString()
		}

		// Prepare update data
		const updateData: Partial<typeof leads.$inferInsert> = {
			dealStage: dealStage,
			updatedAt: new Date()
		}

		if (dealValue !== undefined) {
			updateData.dealValue = dealValue.toString()
		}

		if (expectedCloseDate) {
			updateData.expectedCloseDate = new Date(expectedCloseDate)
		}

		// Update lead
		const [updatedLead] = await db_ws
			.update(leads)
			.set(updateData)
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, userId)
				)
			)
			.returning()

		// Log the interaction
		await logLeadInteraction(
			Number.parseInt(leadId),
			"deal_stage_updated",
			"vapi_tool",
			toolCallId,
			oldValues,
			{
				dealStage: updatedLead.dealStage,
				dealValue: updatedLead.dealValue,
				expectedCloseDate: updatedLead.expectedCloseDate?.toISOString()
			},
			{
				toolCall: "updateDealStage",
				notes: notes,
				previousStage: oldValues.dealStage,
				newStage: dealStage
			},
			userId
		)

		// Add notes if provided
		if (notes) {
			await db_ws
				.update(leads)
				.set({
					notes: lead.notes
						? `${lead.notes}\n\n[Deal Stage Update]: ${notes}`
						: `[Deal Stage Update]: ${notes}`,
					updatedAt: new Date()
				})
				.where(eq(leads.id, Number.parseInt(leadId)))
		}

		// Format result message
		let resultMessage = `Successfully updated ${lead.name}'s deal stage from "${oldValues.dealStage || "none"}" to "${dealStage}"`

		if (dealValue !== undefined) {
			resultMessage += ` with deal value $${dealValue.toLocaleString()}`
		}

		if (expectedCloseDate) {
			const closeDate = new Date(expectedCloseDate)
			resultMessage += ` expected to close on ${closeDate.toLocaleDateString()}`
		}

		if (notes) {
			resultMessage += `. Notes: ${notes}`
		}

		// Create follow-up task for deal progression if appropriate
		if (dealStage === "proposal" || dealStage === "negotiation") {
			await db_ws.insert(tasks).values({
				leadId: Number.parseInt(leadId),
				title: `Follow up on ${dealStage} stage`,
				description: `Follow up with ${lead.name} regarding the ${dealStage} stage. ${notes || ""}`,
				priority: dealStage === "negotiation" ? "high" : "medium",
				taskType: "follow_up",
				assignedTo: userId,
				createdBy: userId,
				userId,
				status: "pending",
				dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
				createdAt: new Date(),
				updatedAt: new Date()
			})

			resultMessage += ". Automatic follow-up task created for tomorrow."
		}

		return {
			toolCallId,
			result: resultMessage
		}
	} catch (error) {
		console.error("Error updating deal stage:", error)
		return {
			toolCallId,
			result: `Failed to update deal stage: ${error instanceof Error ? error.message : "Unknown error"}`
		}
	}
}

// Performance metrics for scoring accuracy
export async function calculateScoringAccuracy(userId: string): Promise<{
	accuracy: number
	totalScoreChanges: number
	positiveOutcomes: number
	negativeOutcomes: number
	averageScoreChange: number
	conversionRateByScore: Record<string, number>
}> {
	try {
		// Get all lead interactions with score changes from the last 90 days
		const threeMonthsAgo = new Date()
		threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90)

		const scoreChanges = await db_ws.query.leadInteractions.findMany({
			where: and(
				eq(leadInteractions.userId, userId),
				eq(leadInteractions.interactionType, "score_updated"),
				gte(leadInteractions.createdAt, threeMonthsAgo)
			)
		})

		if (scoreChanges.length === 0) {
			return {
				accuracy: 0,
				totalScoreChanges: 0,
				positiveOutcomes: 0,
				negativeOutcomes: 0,
				averageScoreChange: 0,
				conversionRateByScore: {}
			}
		}

		// Analyze outcomes for each score change
		let positiveOutcomes = 0
		let negativeOutcomes = 0
		let totalScoreChange = 0

		const conversionRates: Record<
			string,
			{ conversions: number; total: number }
		> = {
			"0-20": { conversions: 0, total: 0 },
			"21-40": { conversions: 0, total: 0 },
			"41-60": { conversions: 0, total: 0 },
			"61-80": { conversions: 0, total: 0 },
			"81-100": { conversions: 0, total: 0 }
		}

		for (const interaction of scoreChanges) {
			const leadId = interaction.leadId
			// Extract score change from the metadata or newValue
			const scoreChange =
				typeof interaction.newValue === "object" &&
				interaction.newValue !== null
					? (interaction.newValue as Record<string, unknown>)
							.scoreChange || 0
					: 0

			if (typeof scoreChange === "number") {
				totalScoreChange += Math.abs(scoreChange)

				// Get the lead's current status to check if the scoring prediction was accurate
				const lead = await db_ws.query.leads.findFirst({
					where: eq(leads.id, leadId)
				})

				if (lead) {
					// Determine score range
					const score = lead.score || 0
					let scoreRange = "0-20"
					if (score > 80) scoreRange = "81-100"
					else if (score > 60) scoreRange = "61-80"
					else if (score > 40) scoreRange = "41-60"
					else if (score > 20) scoreRange = "21-40"

					conversionRates[scoreRange].total++

					// Check if the outcome matched the score prediction
					// Higher scores should lead to better outcomes
					if (scoreChange > 0) {
						// Positive score change - check if lead status improved
						if (
							lead.status === "converted" ||
							lead.status === "qualified"
						) {
							positiveOutcomes++
							conversionRates[scoreRange].conversions++
						} else if (lead.status === "lost") {
							negativeOutcomes++
						}
					} else if (scoreChange < 0) {
						// Negative score change - check if lead status declined
						if (lead.status === "lost" || lead.status === "new") {
							positiveOutcomes++ // Correctly predicted negative outcome
						} else if (lead.status === "converted") {
							negativeOutcomes++ // Incorrectly predicted negative outcome
						}
					}
				}
			}
		}

		const accuracy =
			scoreChanges.length > 0
				? (positiveOutcomes / scoreChanges.length) * 100
				: 0

		const averageScoreChange =
			scoreChanges.length > 0 ? totalScoreChange / scoreChanges.length : 0

		// Calculate conversion rates by score range
		const conversionRateByScore: Record<string, number> = {}
		for (const [range, data] of Object.entries(conversionRates)) {
			conversionRateByScore[range] =
				data.total > 0 ? (data.conversions / data.total) * 100 : 0
		}

		return {
			accuracy: Math.round(accuracy * 100) / 100,
			totalScoreChanges: scoreChanges.length,
			positiveOutcomes,
			negativeOutcomes,
			averageScoreChange: Math.round(averageScoreChange * 100) / 100,
			conversionRateByScore
		}
	} catch (error) {
		console.error("Error calculating scoring accuracy:", error)
		return {
			accuracy: 0,
			totalScoreChanges: 0,
			positiveOutcomes: 0,
			negativeOutcomes: 0,
			averageScoreChange: 0,
			conversionRateByScore: {}
		}
	}
}

// Lead Status Management Tool - Update lead status based on conversation outcomes
export async function updateLeadStatus(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const { leadId, status, reason, conversationOutcome } =
			UpdateLeadStatusSchema.parse(parameters)

		// Get current lead to check existing status
		const lead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!lead) {
			await logLeadInteraction(
				Number.parseInt(leadId),
				"status_update_failed",
				"vapi_tool",
				toolCallId,
				null,
				{ error: "Lead not found" },
				{
					toolCallId,
					leadId: Number.parseInt(leadId),
					targetStatus: status,
					success: false,
					error: "Lead not found or access denied"
				},
				userId
			)

			return {
				toolCallId,
				result: `Lead with ID ${leadId} not found or you don't have access to it.`
			}
		}

		const previousStatus = lead.status

		// Update lead status
		const result = await db_ws
			.update(leads)
			.set({
				status,
				updatedAt: new Date()
			})
			.where(
				and(
					eq(leads.id, Number.parseInt(leadId)),
					eq(leads.userId, userId)
				)
			)
			.returning()

		if (result.length === 0) {
			return {
				toolCallId,
				result: `Failed to update lead status. Lead not found.`
			}
		}

		// Attempt automated stage progression if conversation outcome provided
		let stageProgression = null
		if (conversationOutcome) {
			stageProgression = await progressLeadStage(
				Number.parseInt(leadId),
				status,
				conversationOutcome,
				userId,
				toolCallId
			)
		}

		// Schedule follow-up actions based on new status
		await scheduleFollowUpActions(
			Number.parseInt(leadId),
			status,
			conversationOutcome || reason || "status updated via tool",
			userId,
			toolCallId
		)

		// Log the status update
		await logLeadInteraction(
			Number.parseInt(leadId),
			"status_updated",
			"vapi_tool",
			toolCallId,
			{ status: previousStatus },
			{ status, reason, conversationOutcome },
			{
				toolCallId,
				leadId: Number.parseInt(leadId),
				previousStatus,
				newStatus: status,
				stageProgression,
				success: true,
				reason,
				conversationOutcome
			},
			userId
		)

		// Create success message
		let successMessage = `Successfully updated lead "${lead.name}" status from "${previousStatus}" to "${status}".`

		if (reason) {
			successMessage += ` Reason: ${reason}.`
		}

		if (stageProgression) {
			successMessage += ` Lead stage automatically progressed to: ${stageProgression}.`
		}

		return { toolCallId, result: successMessage }
	} catch (error) {
		console.error("Error updating lead status:", error)

		await logLeadInteraction(
			Number.parseInt((parameters.leadId as string) || "0"),
			"status_update_failed",
			"vapi_tool",
			toolCallId,
			null,
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{
				toolCallId,
				parameters,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error"
			},
			userId
		)

		return {
			toolCallId,
			result: `Failed to update lead status: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		}
	}
}

// Schedule follow-up actions based on conversation outcomes
async function scheduleFollowUpActions(
	leadId: number,
	status: string,
	conversationContext: string,
	userId: string,
	toolCallId: string
): Promise<void> {
	try {
		const context = conversationContext.toLowerCase()
		const now = new Date()

		// Define follow-up actions based on status and conversation outcome
		const followUpActions: Array<{
			title: string
			dueDate: Date
			priority: "low" | "medium" | "high" | "urgent"
			type:
				| "call"
				| "email"
				| "follow_up"
				| "meeting"
				| "research"
				| "other"
			description: string
		}> = []

		switch (status) {
			case "contacted":
				if (
					context.includes("interested") ||
					context.includes("maybe")
				) {
					followUpActions.push({
						title: `Follow up with interested lead`,
						dueDate: new Date(
							now.getTime() + 2 * 24 * 60 * 60 * 1000
						), // 2 days
						priority: "high",
						type: "call",
						description: `Lead showed interest during call. Follow up to qualify further.`
					})
				} else if (
					context.includes("not available") ||
					context.includes("busy")
				) {
					followUpActions.push({
						title: `Retry contact - was busy`,
						dueDate: new Date(
							now.getTime() + 7 * 24 * 60 * 60 * 1000
						), // 1 week
						priority: "medium",
						type: "call",
						description: `Lead was busy during last contact. Retry at better time.`
					})
				}
				break

			case "qualified":
				followUpActions.push({
					title: `Send proposal or quote`,
					dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day
					priority: "high",
					type: "email",
					description: `Lead is qualified. Send detailed proposal or pricing.`
				})

				followUpActions.push({
					title: `Schedule demo or presentation`,
					dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
					priority: "high",
					type: "meeting",
					description: `Qualified lead - schedule product demo or detailed presentation.`
				})
				break

			case "lost":
				if (
					!context.includes("never") &&
					!context.includes("not interested forever")
				) {
					followUpActions.push({
						title: `Nurture lost lead for future opportunity`,
						dueDate: new Date(
							now.getTime() + 90 * 24 * 60 * 60 * 1000
						), // 3 months
						priority: "low",
						type: "email",
						description: `Check back with lost lead - circumstances may have changed.`
					})
				}
				break

			case "new":
				followUpActions.push({
					title: `Initial contact attempt`,
					dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day
					priority: "medium",
					type: "call",
					description: `New lead - make initial contact to introduce services.`
				})
				break
		}

		// Create the follow-up tasks
		for (const action of followUpActions) {
			await db_ws.insert(tasks).values({
				leadId,
				title: action.title,
				description: action.description,
				dueDate: action.dueDate,
				priority: action.priority,
				taskType: action.type,
				status: "pending",
				createdBy: userId,
				userId
			})
		}

		// Log the follow-up scheduling
		if (followUpActions.length > 0) {
			await logLeadInteraction(
				leadId,
				"follow_up_scheduled",
				"automated",
				toolCallId,
				null,
				{
					actionsScheduled: followUpActions.length,
					actions: followUpActions
				},
				{
					leadId,
					actionsCreated: followUpActions.length,
					status,
					conversationContext
				},
				userId
			)
		}
	} catch (error) {
		console.error("Error scheduling follow-up actions:", error)
	}
}

// Lead assignment and routing logic
export async function assignLead(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		// Validate parameters
		const { leadId, assigneeId, reason } =
			AssignLeadSchema.parse(parameters)

		// Current implementation: Log the assignment request for future development
		await logLeadInteraction(
			Number.parseInt(leadId),
			"assignment_requested",
			"vapi_tool",
			toolCallId,
			null,
			{ assigneeId, reason },
			{
				toolCallId,
				leadId: Number.parseInt(leadId),
				assigneeId,
				reason,
				note: "Assignment logged for future team feature implementation"
			},
			userId
		)

		return {
			toolCallId,
			result: `Lead assignment request logged. Team management features will be available in a future update.`
		}
	} catch (error) {
		console.error("Error with lead assignment:", error)
		return {
			toolCallId,
			result: `Failed to process lead assignment: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		}
	}
}

// Lead duplicate detection and merging
export async function detectDuplicateLeads(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId } = DetectDuplicateLeadsSchema.parse(parameters)

		// Get the target lead
		const targetLead = await db_ws.query.leads.findFirst({
			where: and(
				eq(leads.id, Number.parseInt(leadId)),
				eq(leads.userId, userId)
			)
		})

		if (!targetLead) {
			return {
				toolCallId,
				result: `Lead with ID ${leadId} not found.`
			}
		}

		// Find potential duplicates based on email and phone
		const duplicates = await db_ws.query.leads.findMany({
			where: and(
				eq(leads.userId, userId),
				sql`(
					(${leads.email} = ${targetLead.email} AND ${leads.email} IS NOT NULL) OR
					(${leads.phone} = ${targetLead.phone} AND ${leads.phone} IS NOT NULL)
				) AND ${leads.id} != ${targetLead.id}`
			)
		})

		if (duplicates.length === 0) {
			return {
				toolCallId,
				result: `No duplicate leads found for "${targetLead.name}".`
			}
		}

		// Log duplicate detection
		await logLeadInteraction(
			Number.parseInt(leadId),
			"duplicates_detected",
			"vapi_tool",
			toolCallId,
			null,
			{
				duplicatesFound: duplicates.length,
				duplicateIds: duplicates.map((d) => d.id)
			},
			{
				toolCallId,
				leadId: Number.parseInt(leadId),
				duplicatesFound: duplicates.length,
				duplicates: duplicates.map((d) => ({
					id: d.id,
					name: d.name,
					email: d.email,
					phone: d.phone
				}))
			},
			userId
		)

		const duplicateInfo = duplicates
			.map(
				(d) =>
					`ID: ${d.id}, Name: ${d.name}, Email: ${d.email || "N/A"}, Phone: ${d.phone || "N/A"}`
			)
			.join("; ")

		return {
			toolCallId,
			result: `Found ${duplicates.length} potential duplicate(s) for "${targetLead.name}": ${duplicateInfo}. Review these leads manually for potential merging.`
		}
	} catch (error) {
		console.error("Error detecting duplicate leads:", error)
		return {
			toolCallId,
			result: `Failed to detect duplicates: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		}
	}
}
