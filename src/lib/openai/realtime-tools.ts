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
	}
]
