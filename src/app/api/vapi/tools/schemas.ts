import { z } from "zod"

// Vapi Tool Call Request Schema based on Vapi documentation
export const VapiToolCallSchema = z.object({
	message: z.object({
		timestamp: z.number(),
		type: z.literal("tool-calls"),
		toolCallList: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				arguments: z.record(z.any())
			})
		),
		toolWithToolCallList: z.array(
			z.object({
				type: z.literal("function"),
				name: z.string(),
				parameters: z
					.object({
						type: z.literal("object"),
						properties: z.record(z.any())
					})
					.optional(),
				description: z.string().optional(),
				server: z
					.object({
						url: z.string()
					})
					.optional(),
				messages: z.array(z.any()).optional(),
				toolCall: z.object({
					id: z.string(),
					type: z.literal("function"),
					function: z.object({
						name: z.string(),
						parameters: z.record(z.any())
					})
				})
			})
		)
	}),
	assistant: z
		.object({
			name: z.string().optional(),
			description: z.string().optional()
		})
		.optional(),
	call: z
		.object({
			id: z.string(),
			orgId: z.string().optional(),
			type: z.string().optional()
		})
		.optional()
})

// Tool Function Parameter Schemas
export const UpdateLeadScoreSchema = z.object({
	leadId: z.string(),
	scoreChange: z.number().min(-100).max(100),
	reason: z.string().optional()
})

export const UpdateLeadNotesSchema = z.object({
	leadId: z.string(),
	notes: z.string(),
	append: z.boolean().optional().default(true)
})

export const UpdateLeadStatusSchema = z.object({
	leadId: z.string(),
	status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
	reason: z.string().optional(),
	conversationOutcome: z.string().optional()
})

export const AssignLeadSchema = z.object({
	leadId: z.string(),
	assigneeId: z.string().optional(),
	reason: z.string().optional()
})

export const DetectDuplicateLeadsSchema = z.object({
	leadId: z.string()
})

export const SendFollowUpEmailSchema = z.object({
	leadId: z.string(),
	subject: z.string(),
	content: z.string(),
	templateType: z
		.enum(["follow_up", "appointment_reminder", "custom"])
		.optional()
		.default("follow_up")
})

export const SearchCallTranscriptsSchema = z.object({
	query: z.string(),
	leadId: z.string().optional(),
	limit: z.number().min(1).max(10).optional().default(5)
})

export const SendFollowUpSMSSchema = z.object({
	leadId: z.string(),
	content: z.string().max(160), // SMS character limit
	templateType: z
		.enum(["follow_up", "appointment_reminder", "custom"])
		.optional()
		.default("follow_up")
})

export const GetLeadHistorySchema = z.object({
	leadId: z.string(),
	includeInteractions: z.boolean().optional().default(true),
	includeTranscripts: z.boolean().optional().default(true),
	limit: z.number().min(1).max(20).optional().default(10)
})

export const SearchKnowledgeBaseSchema = z.object({
	query: z.string().min(1).max(500), // Search query with reasonable length limit
	limit: z.number().min(1).max(10).optional().default(5), // Limit results for voice response
	threshold: z.number().min(0).max(1).optional().default(0.7), // Similarity threshold
	sourceId: z.number().optional(), // Optional filter by specific knowledge base source
	includeMetadata: z.boolean().optional().default(false) // Include metadata for debugging
})

export const ScheduleAppointmentSchema = z.object({
	leadId: z.string(), // Lead ID to schedule appointment for
	title: z.string().min(1).max(200), // Appointment title
	dateTime: z.string(), // ISO datetime string for appointment start
	duration: z.number().min(15).max(480).optional().default(60), // Duration in minutes (15 min to 8 hours)
	description: z.string().max(1000).optional(), // Optional description
	location: z.string().max(200).optional(), // Optional location (can be virtual meeting link)
	timeZone: z.string().optional().default("UTC") // Time zone for the appointment
})

export const AnalyzeConversationSchema = z.object({
	callId: z.string().optional(), // Optional call ID to analyze specific call
	transcript: z.string().min(1).max(10000), // Call transcript to analyze
	analysisType: z
		.enum(["intent", "sentiment", "quality", "objections", "full"])
		.optional()
		.default("full"), // Type of analysis to perform
	includeActionRecommendations: z.boolean().optional().default(true), // Include action recommendations
	leadId: z.string().optional() // Optional lead ID for context
})

export const CreateTaskSchema = z.object({
	leadId: z.string(), // Lead ID for the task
	title: z.string().min(1).max(200), // Task title
	description: z.string().max(1000).optional(), // Task description
	dueDate: z.string().optional(), // ISO datetime string for due date
	priority: z
		.enum(["low", "medium", "high", "urgent"])
		.optional()
		.default("medium"), // Task priority
	taskType: z
		.enum(["call", "email", "follow_up", "meeting", "research", "other"])
		.optional()
		.default("follow_up"), // Task type
	assignedTo: z.string().optional() // User ID to assign task to (defaults to current user)
})

export const UpdateDealStageSchema = z.object({
	leadId: z.string(), // Lead ID to update deal stage for
	dealStage: z.enum([
		"prospect",
		"qualified",
		"proposal",
		"negotiation",
		"closed_won",
		"closed_lost"
	]), // New deal stage
	dealValue: z.number().min(0).optional(), // Optional deal value
	notes: z.string().max(1000).optional(), // Optional notes about the stage change
	expectedCloseDate: z.string().optional() // Optional expected close date (ISO format)
})
