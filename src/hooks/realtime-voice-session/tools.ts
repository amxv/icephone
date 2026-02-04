import { performRAGQuery } from "@/actions/knowledge-base"
import { scheduleAppointment } from "@/actions/lead-communication"
import { z } from "zod"

function clipSnippet(text: string, maxLength = 550) {
	const compactText = text.replace(/\s+/g, " ").trim()
	if (compactText.length <= maxLength) {
		return compactText
	}
	return `${compactText.slice(0, maxLength)}...`
}

export async function executeRealtimeToolCall(params: {
	toolName: string
	args: Record<string, unknown>
	knowledgeSourceScope: number[]
}) {
	switch (params.toolName) {
		case "scheduleAppointment": {
			const inputSchema = z.object({
				leadId: z.coerce.number().int().positive(),
				title: z.string().trim().min(1),
				description: z.string().optional(),
				startTime: z.string().min(1),
				endTime: z.string().min(1),
				location: z.string().optional()
			})

			try {
				const parsed = inputSchema.parse(params.args)
				const start = new Date(parsed.startTime)
				const end = new Date(parsed.endTime)

				if (
					Number.isNaN(start.getTime()) ||
					Number.isNaN(end.getTime())
				) {
					return {
						success: false,
						error: "Invalid appointment time"
					}
				}

				return await scheduleAppointment({
					leadId: parsed.leadId,
					title: parsed.title,
					description: parsed.description,
					startTime: start,
					endTime: end,
					location: parsed.location
				})
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Invalid tool input"
				return { success: false, error: message }
			}
		}
		case "searchKnowledgeBase": {
			const inputSchema = z.object({
				query: z.string().trim().min(2),
				limit: z.coerce.number().int().min(1).max(8).optional(),
				sourceId: z.coerce.number().int().positive().optional(),
				sourceIds: z
					.array(z.coerce.number().int().positive())
					.max(20)
					.optional(),
				threshold: z.coerce.number().min(0).max(1).optional()
			})

			try {
				const parsed = inputSchema.parse(params.args)
				const scopedSourceIds = params.knowledgeSourceScope
				const requestedSourceIds = Array.from(
					new Set([
						...(typeof parsed.sourceId === "number"
							? [parsed.sourceId]
							: []),
						...(Array.isArray(parsed.sourceIds)
							? parsed.sourceIds
							: [])
					])
				)
				const effectiveSourceIds =
					scopedSourceIds.length > 0
						? requestedSourceIds.length > 0
							? requestedSourceIds.filter((sourceId) =>
									scopedSourceIds.includes(sourceId)
								)
							: scopedSourceIds
						: requestedSourceIds

				if (
					scopedSourceIds.length > 0 &&
					effectiveSourceIds.length === 0
				) {
					return {
						success: false,
						error: "Requested knowledge source is outside the agent's allowed scope.",
						allowedSourceIds: scopedSourceIds
					}
				}

				const result = await performRAGQuery(parsed.query, {
					limit: parsed.limit ?? 5,
					sourceId:
						effectiveSourceIds.length === 1
							? effectiveSourceIds[0]
							: undefined,
					sourceIds:
						effectiveSourceIds.length > 1
							? effectiveSourceIds
							: undefined,
					threshold: parsed.threshold
				})

				if (!result.success) {
					return {
						success: false,
						error: result.error || "Knowledge base search failed"
					}
				}

				const matches = result.data ?? []
				if (matches.length === 0) {
					return {
						success: true,
						query: parsed.query,
						totalResults: 0,
						message:
							"No relevant knowledge-base content found for this query.",
						citations: [],
						snippets: []
					}
				}

				const citations = matches.map((match, index) => {
					const fileName = String(
						match.metadata.fileName ||
							match.metadata.filename ||
							"Knowledge document"
					)

					return {
						index: index + 1,
						label: `[${index + 1}]`,
						sourceId: match.source_id,
						sourceName: match.source_name,
						sourceType: match.source_type,
						fileName,
						similarity: Number((match.similarity || 0).toFixed(3))
					}
				})

				const snippets = matches.map((match, index) => ({
					citation: `[${index + 1}]`,
					content: clipSnippet(match.content_chunk)
				}))

				return {
					success: true,
					query: parsed.query,
					totalResults: matches.length,
					sourceIds: effectiveSourceIds,
					citations,
					snippets,
					guidance:
						"When answering, ground the response in snippets and cite them with [1], [2], etc."
				}
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Invalid knowledge search input"
				return { success: false, error: message }
			}
		}
		default:
			return {
				success: false,
				error: `Unknown tool: ${params.toolName}`
			}
	}
}
