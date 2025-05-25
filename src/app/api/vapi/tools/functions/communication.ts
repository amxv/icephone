import { db_ws } from "@/db"
import { leads, emails, textMessages, calls } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import {
	SendFollowUpEmailSchema,
	SendFollowUpSMSSchema,
	SearchCallTranscriptsSchema
} from "../schemas"
import { logLeadInteraction } from "../utils"

// Email personalization utility function
function personalizeEmailContent(
	baseContent: string,
	lead: {
		name: string | null
		email: string | null
		phone: string | null
		score: number | null
		status: string | null
		source: string | null
		notes: string | null
	},
	recentCalls: Array<{
		createdAt: Date
		duration: number | null
	}>
): string {
	let personalizedContent = baseContent

	// Replace placeholder variables with actual lead data
	personalizedContent = personalizedContent
		.replace(/\{lead_name\}/g, lead.name || "there")
		.replace(/\{lead_email\}/g, lead.email || "")
		.replace(/\{lead_phone\}/g, lead.phone || "")
		.replace(/\{lead_score\}/g, (lead.score || 0).toString())
		.replace(/\{lead_status\}/g, lead.status || "new")
		.replace(/\{lead_source\}/g, lead.source || "unknown")

	// Add recent interaction context if available
	if (recentCalls.length > 0) {
		const lastCall = recentCalls[0]
		const lastCallDate = new Date(lastCall.createdAt).toLocaleDateString()

		// If the content doesn't already mention recent conversations, add context
		if (
			!personalizedContent
				.toLowerCase()
				.includes("our recent conversation") &&
			!personalizedContent.toLowerCase().includes("we spoke")
		) {
			const contextLine = `\n\nFollowing up on our conversation from ${lastCallDate}, `
			personalizedContent = personalizedContent.replace(/^/, contextLine)
		}

		// Replace call-specific placeholders
		personalizedContent = personalizedContent
			.replace(/\{last_call_date\}/g, lastCallDate)
			.replace(
				/\{last_call_duration\}/g,
				lastCall.duration ? `${lastCall.duration} seconds` : "our call"
			)
			.replace(/\{total_calls\}/g, recentCalls.length.toString())
	}

	// Add lead notes context if available and content is generic
	if (lead.notes && personalizedContent.length < 200) {
		// Extract key points from notes for context
		const noteLines = lead.notes
			.split("\n")
			.filter((line: string) => line.trim())
		const recentNote = noteLines[noteLines.length - 1]

		if (recentNote && recentNote.length < 100) {
			personalizedContent += `\n\nAs discussed: ${recentNote.trim()}`
		}
	}

	return personalizedContent
}

export async function sendFollowUpEmail(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, subject, content, templateType } =
			SendFollowUpEmailSchema.parse(parameters)

		// Get lead details
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

		if (!lead.email) {
			return {
				toolCallId,
				result: "Lead does not have an email address"
			}
		}

		// Get recent call history for email personalization
		const recentCalls = await db_ws.query.calls.findMany({
			where: and(
				eq(calls.leadId, Number.parseInt(leadId)),
				eq(calls.userId, userId)
			),
			orderBy: [desc(calls.createdAt)],
			limit: 3
		})

		// Personalize email content based on lead data and recent interactions
		const personalizedContent = personalizeEmailContent(
			content,
			lead,
			recentCalls
		)

		// Store email record with pending status (using personalized content)
		const emailRecord = await db_ws
			.insert(emails)
			.values({
				leadId: Number.parseInt(leadId),
				type: "outgoing",
				subject,
				content: personalizedContent,
				sentAt: new Date(),
				status: "pending",
				userId
			})
			.returning()

		// Send actual email using Resend
		const { sendEmail } = await import("@/lib/email")
		const { generateFollowUpEmailTemplate } = await import(
			"@/lib/email-templates"
		)

		const emailHtml = generateFollowUpEmailTemplate(
			lead.name,
			personalizedContent,
			templateType
		)

		const emailResult = await sendEmail({
			to: [lead.email],
			subject,
			html: emailHtml,
			replyTo: "support@icephone.com"
		})

		if (emailResult.success) {
			// Update the email record with sent status
			await db_ws
				.update(emails)
				.set({
					status: "sent",
					updatedAt: new Date()
				})
				.where(eq(emails.id, emailRecord[0].id))

			// Log the interaction
			await logLeadInteraction(
				Number.parseInt(leadId),
				"email_sent",
				"vapi_tool",
				toolCallId,
				null,
				{
					emailId: emailRecord[0].id,
					subject,
					status: "sent",
					to: lead.email
				},
				{ templateType, toolName: "sendFollowUpEmail" },
				userId
			)

			return {
				toolCallId,
				result: `Follow-up email sent successfully to ${lead.name} (${lead.email}): "${subject}"`
			}
		}

		// Update the email record with failed status
		await db_ws
			.update(emails)
			.set({
				status: "failed",
				updatedAt: new Date()
			})
			.where(eq(emails.id, emailRecord[0].id))

		return {
			toolCallId,
			result: `Failed to send email to ${lead.name}: ${emailResult.error || "Unknown error"}`
		}
	} catch (error) {
		console.error("Error sending follow-up email:", error)
		return {
			toolCallId,
			result: "Failed to schedule follow-up email"
		}
	}
}

export async function sendFollowUpSMS(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { leadId, content, templateType } =
			SendFollowUpSMSSchema.parse(parameters)

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

		if (!lead.phone) {
			return {
				toolCallId,
				result: "No phone number available for this lead"
			}
		}

		// For now, store the SMS in the text_messages table with a placeholder
		// In the future, this will integrate with a real SMS provider (Twilio, etc.)
		const currentTime = new Date()

		// Insert the SMS record into the database
		await db_ws.insert(textMessages).values({
			leadId: Number.parseInt(leadId),
			type: "outgoing",
			content: content,
			sentAt: currentTime,
			userId: userId
		})

		// Log the interaction
		await logLeadInteraction(
			Number.parseInt(leadId),
			"sms_sent",
			"vapi_tool",
			toolCallId,
			null,
			{
				content,
				templateType,
				phone: lead.phone,
				status: "queued" // Since we're not actually sending yet
			},
			{
				templateType,
				toolName: "sendFollowUpSMS",
				provider: "placeholder" // Will be updated when SMS provider is integrated
			},
			userId
		)

		return {
			toolCallId,
			result: `SMS follow-up queued for ${lead.name} at ${lead.phone}. Message: "${content}". Note: SMS sending will be activated when SMS provider integration is complete.`
		}
	} catch (error) {
		console.error("Error sending follow-up SMS:", error)
		return {
			toolCallId,
			result: "Failed to send follow-up SMS"
		}
	}
}

export async function searchCallTranscripts(
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
): Promise<{ toolCallId: string; result: string }> {
	try {
		const { query, leadId, limit } =
			SearchCallTranscriptsSchema.parse(parameters)

		// Build search conditions
		const conditions = [eq(calls.userId, userId)]

		if (leadId) {
			conditions.push(eq(calls.leadId, Number.parseInt(leadId)))
		}

		// Search for calls with transcripts containing the query
		const searchResults = await db_ws.query.calls.findMany({
			where: and(...conditions),
			orderBy: [desc(calls.startTime)],
			limit,
			with: {
				lead: {
					columns: {
						name: true
					}
				}
			}
		})

		// Filter results by transcript content (simple text search)
		const relevantCalls = searchResults.filter((call) =>
			call.transcript?.toLowerCase().includes(query.toLowerCase())
		)

		if (relevantCalls.length === 0) {
			return {
				toolCallId,
				result: `No call transcripts found containing "${query}"`
			}
		}

		// Format results for the voice agent
		const results = relevantCalls.map((call) => {
			const excerpt = `${call.transcript?.substring(0, 200) ?? ""}...`
			const date = new Date(call.startTime).toLocaleDateString()
			return `${date} - ${call.lead?.name ?? "Unknown"}: ${excerpt}`
		})

		return {
			toolCallId,
			result: `Found ${relevantCalls.length} relevant call(s):\n${results.join("\n\n")}`
		}
	} catch (error) {
		console.error("Error searching call transcripts:", error)
		return {
			toolCallId,
			result: "Failed to search call transcripts"
		}
	}
}
