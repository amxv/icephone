import { db_ws } from "@/db"
import { calls, knowledgeSources, leads, voiceAgents } from "@/db/schema"
import { logAuditEvent } from "@/lib/audit-log"
import { requireTeam } from "@/lib/auth/session"
import {
	OPENAI_REALTIME_MODEL,
	normalizeOpenAIVoiceId
} from "@/lib/openai/realtime-voice"
import { openAIRealtimeTools } from "@/lib/openai/realtime-tools"
import { teamScope } from "@/lib/team-scope"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

const sessionRequestSchema = z.object({
	agentId: z.number().int().positive(),
	leadId: z.number().int().positive().optional(),
	direction: z.enum(["incoming", "outgoing"]).optional()
})

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime/client_secrets"

export async function POST(request: Request) {
	try {
		const payload = await request.json()
		const { agentId, leadId, direction } =
			sessionRequestSchema.parse(payload)
		const { teamId, user } = await requireTeam()

		const agent = await db_ws
			.select({
				id: voiceAgents.id,
				name: voiceAgents.name,
				prompt: voiceAgents.prompt,
				firstMessage: voiceAgents.firstMessage,
				voice: voiceAgents.voice,
				configuration: voiceAgents.configuration
			})
			.from(voiceAgents)
			.where(
				and(eq(voiceAgents.id, agentId), teamScope(voiceAgents, teamId))
			)
			.limit(1)

		if (!agent.length) {
			return new Response(
				JSON.stringify({ error: "Voice agent not found" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" }
				}
			)
		}

		if (leadId) {
			const lead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(and(eq(leads.id, leadId), teamScope(leads, teamId)))
				.limit(1)
			if (!lead.length) {
				return new Response(
					JSON.stringify({ error: "Lead not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" }
					}
				)
			}
		}

		const agentRecord = agent[0]
		const commandCenter = agentRecord.configuration?.command_center
		const configuredKnowledgeSourceIds = Array.from(
			new Set(
				(agentRecord.configuration?.knowledge_base?.sourceIds || [])
					.filter(
						(value): value is number =>
							Number.isInteger(value) && value > 0
					)
					.map((value) => Number(value))
			)
		)
		const scopedKnowledgeSources =
			configuredKnowledgeSourceIds.length > 0
				? await db_ws
						.select({
							id: knowledgeSources.id,
							name: knowledgeSources.name
						})
						.from(knowledgeSources)
						.where(
							and(
								eq(knowledgeSources.teamId, teamId),
								inArray(
									knowledgeSources.id,
									configuredKnowledgeSourceIds
								)
							)
						)
				: []
		const effectiveKnowledgeSourceIds = scopedKnowledgeSources.map(
			(source) => source.id
		)
		const knowledgeSourceHints = scopedKnowledgeSources.map(
			(source) => `${source.id}: ${source.name}`
		)
		const voiceSelection = normalizeOpenAIVoiceId(
			agentRecord.voice?.provider === "openai"
				? agentRecord.voice.voice_id
				: process.env.OPENAI_REALTIME_VOICE
		)
		const instructionsParts = [
			`You are ${agentRecord.name}, a helpful AI voice agent.`,
			agentRecord.prompt || "",
			agentRecord.firstMessage
				? `Begin the conversation with: ${agentRecord.firstMessage}`
				: "",
			commandCenter?.mode ? `Operating mode: ${commandCenter.mode}.` : "",
			commandCenter?.personality
				? `Personality guidance: ${commandCenter.personality}`
				: "",
			commandCenter?.scriptDirection
				? `Script direction: ${commandCenter.scriptDirection}`
				: "",
			"When scheduling appointments, call the scheduleAppointment tool with ISO-8601 start and end times.",
			"For factual support, policy, pricing, product, or collections questions, call the searchKnowledgeBase tool before answering.",
			effectiveKnowledgeSourceIds.length
				? `Knowledge-base scope for this agent is restricted to source IDs: ${effectiveKnowledgeSourceIds.join(", ")}.`
				: "",
			knowledgeSourceHints.length
				? `Knowledge-base source map: ${knowledgeSourceHints.join(" | ")}.`
				: "",
			effectiveKnowledgeSourceIds.length
				? "Always include sourceIds in searchKnowledgeBase tool calls and keep them within the allowed IDs."
				: "",
			"Ground answers in tool results and cite supporting snippets using labels like [1], [2]."
		].filter(Boolean)

		const instructions = instructionsParts.join("\n\n")

		if (!process.env.OPENAI_API_KEY) {
			return new Response(
				JSON.stringify({ error: "OpenAI API key not configured" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" }
				}
			)
		}

		const openaiResponse = await fetch(OPENAI_REALTIME_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				expires_after: {
					anchor: "created_at",
					seconds: 600
				},
				session: {
					type: "realtime",
					model: OPENAI_REALTIME_MODEL,
					instructions,
					output_modalities: ["audio", "text"],
					tools: openAIRealtimeTools,
					tool_choice: "auto",
					audio: {
						input: {
							transcription: {
								model: "whisper-1"
							}
						},
						output: {
							voice: voiceSelection
						}
					}
				}
			})
		})

		if (!openaiResponse.ok) {
			const errorText = await openaiResponse.text()
			console.error("OpenAI Realtime API error:", errorText)
			return new Response(
				JSON.stringify({
					error: "Failed to create voice session"
				}),
				{
					status: 502,
					headers: { "Content-Type": "application/json" }
				}
			)
		}

		const sessionData = await openaiResponse.json()
		const clientSecret = sessionData.value
		const sessionId = sessionData.session?.id ?? null

		if (!clientSecret) {
			return new Response(
				JSON.stringify({ error: "Failed to get client secret" }),
				{
					status: 502,
					headers: { "Content-Type": "application/json" }
				}
			)
		}

		const [callRow] = await db_ws
			.insert(calls)
			.values({
				leadId: leadId ?? null,
				teamId,
				agentId: agentRecord.id,
				campaignId: null,
				direction: direction ?? "outgoing",
				type: direction ?? "outgoing",
				startTime: new Date(),
				status: "active",
				sessionId,
				metadata: {
					realtimeSessionId: sessionId
				},
				createdAt: new Date(),
				updatedAt: new Date(),
				userId: user.id
			})
			.returning()

		await logAuditEvent({
			teamId,
			actorUserId: user.id,
			action: "call_created",
			entityType: "call",
			entityId: callRow.id,
			metadata: {
				agentId: agentRecord.id,
				leadId: leadId ?? null,
				status: "active"
			}
		})

		return new Response(
			JSON.stringify({
				callId: callRow.id,
				clientSecret,
				sessionId,
				expiresAt: sessionData.expires_at ?? null,
				knowledgeSourceIds: effectiveKnowledgeSourceIds
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" }
			}
		)
	} catch (error) {
		console.error("Voice session API error:", error)
		return new Response(
			JSON.stringify({
				error: "Internal server error",
				message:
					error instanceof Error ? error.message : "Unknown error"
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" }
			}
		)
	}
}
