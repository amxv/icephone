export type OpenAIRealtimeTool = {
	type: "function"
	name: string
	description: string
	parameters: {
		type: "object"
		properties: Record<string, unknown>
		required?: string[]
	}
}

export const openAIRealtimeTools: OpenAIRealtimeTool[] = [
	{
		type: "function",
		name: "scheduleAppointment",
		description:
			"Schedule an appointment for a lead using Cal.com. Provide ISO start/end times.",
		parameters: {
			type: "object",
			properties: {
				leadId: {
					type: "number",
					description: "Lead ID to schedule the appointment for"
				},
				title: {
					type: "string",
					description: "Appointment title"
				},
				description: {
					type: "string",
					description: "Optional appointment description"
				},
				startTime: {
					type: "string",
					description:
						"Appointment start time in ISO-8601 format (e.g. 2026-02-10T15:00:00Z)"
				},
				endTime: {
					type: "string",
					description:
						"Appointment end time in ISO-8601 format (e.g. 2026-02-10T15:30:00Z)"
				},
				location: {
					type: "string",
					description: "Optional location or meeting link"
				}
			},
			required: ["leadId", "title", "startTime", "endTime"]
		}
	},
	{
		type: "function",
		name: "searchKnowledgeBase",
		description:
			"Search the team's knowledge base and return grounded snippets with citations. Use this before answering factual support, policy, pricing, process, or collections questions.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"Natural language search query for the company's knowledge base"
				},
				limit: {
					type: "number",
					description:
						"Optional number of results to return (1-8, default 5)"
				},
				sourceId: {
					type: "number",
					description:
						"Optional knowledge source ID to limit search scope"
				},
				threshold: {
					type: "number",
					description:
						"Optional relevance threshold between 0 and 1 for filtering weaker matches"
				}
			},
			required: ["query"]
		}
	}
]
