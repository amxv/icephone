import { relations } from "drizzle-orm"
import { sql } from "drizzle-orm"
import {
	boolean,
	decimal,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
	vector
} from "drizzle-orm/pg-core"

// Define lead status enum
export const leadStatusEnum = pgEnum("lead_status", [
	"new",
	"contacted",
	"qualified",
	"converted",
	"lost"
])

// Define deal stage enum
export const dealStageEnum = pgEnum("deal_stage", [
	"prospect",
	"qualified",
	"proposal",
	"negotiation",
	"closed_won",
	"closed_lost"
])

// Define communication type enum
export const communicationTypeEnum = pgEnum("communication_type", [
	"incoming",
	"outgoing"
])

// Define task priority enum
export const taskPriorityEnum = pgEnum("task_priority", [
	"low",
	"medium",
	"high",
	"urgent"
])

// Define task status enum
export const taskStatusEnum = pgEnum("task_status", [
	"pending",
	"in_progress",
	"completed",
	"cancelled",
	"overdue"
])

// Define task type enum
export const taskTypeEnum = pgEnum("task_type", [
	"call",
	"email",
	"follow_up",
	"meeting",
	"research",
	"other"
])

// Define team member role enum
export const teamMemberRoleEnum = pgEnum("team_member_role", [
	"owner",
	"member"
])

// Auth + Tenancy tables (Better Auth)
export const teams = pgTable(
	"teams",
	{
		id: varchar("id", { length: 21 }).primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 255 }).notNull().unique(),
		createdByUserId: varchar("created_by_user_id", { length: 21 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("teams_slug_idx").on(table.slug),
		index("teams_created_by_idx").on(table.createdByUserId)
	]
)

export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 21 }).primaryKey(),
		name: varchar("name", { length: 255 }),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		isActive: boolean("is_active").notNull().default(true),
		defaultTeamId: varchar("default_team_id", { length: 21 }).references(
			() => teams.id
		),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow()
	},
	(table) => [
		index("users_email_idx").on(table.email),
		index("users_default_team_idx").on(table.defaultTeamId)
	]
)

export const teamMembers = pgTable(
	"team_members",
	{
		id: varchar("id", { length: 21 }).primaryKey(),
		teamId: varchar("team_id", { length: 21 })
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 21 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: teamMemberRoleEnum("role").default("member").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow()
	},
	(table) => [
		index("team_members_team_id_idx").on(table.teamId),
		index("team_members_user_id_idx").on(table.userId)
	]
)

export const sessions = pgTable(
	"sessions",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		userId: varchar("user_id", { length: 21 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow()
	},
	(table) => [
		index("sessions_user_id_idx").on(table.userId),
		index("sessions_expires_at_idx").on(table.expiresAt)
	]
)

export const accounts = pgTable(
	"accounts",
	{
		id: varchar("id", { length: 36 }).primaryKey(),
		userId: varchar("user_id", { length: 21 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		idToken: text("id_token"),
		password: text("password"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow()
	},
	(table) => [index("accounts_user_id_idx").on(table.userId)]
)

export const verifications = pgTable("verifications", {
	id: varchar("id", { length: 36 }).primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
})

// Define campaign status enum
export const campaignStatusEnum = pgEnum("campaign_status", [
	"draft",
	"scheduled",
	"running",
	"paused",
	"completed",
	"cancelled",
	"archived"
])

// Define campaign lead status enum
export const campaignLeadStatusEnum = pgEnum("campaign_lead_status", [
	"pending",
	"attempted",
	"completed",
	"failed",
	"excluded"
])

// Define campaign queue status enum
export const campaignQueueStatusEnum = pgEnum("campaign_queue_status", [
	"queued",
	"processing",
	"paused",
	"completed",
	"failed"
])

// Define call queue status enum (for manual calls)
export const callQueueStatusEnum = pgEnum("call_queue_status", [
	"pending",
	"queued",
	"calling",
	"completed",
	"failed",
	"cancelled"
])

// Leads table - stores information about leads/prospects
export const leads = pgTable(
	"leads",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		email: varchar("email", { length: 255 }),
		phone: varchar("phone", { length: 50 }),
		score: integer("score").default(0), // Lead score/rating (0-100)
		status: leadStatusEnum("status").default("new"),
		dealStage: dealStageEnum("deal_stage"),
		dealValue: decimal("deal_value", { precision: 12, scale: 2 }),
		expectedCloseDate: timestamp("expected_close_date"),
		source: varchar("source", { length: 100 }),
		notes: text("notes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("lead_name_idx").on(table.name),
		index("lead_email_idx").on(table.email),
		index("lead_status_idx").on(table.status),
		index("lead_deal_stage_idx").on(table.dealStage),
		index("lead_user_id_idx").on(table.userId)
	]
)

// Appointments table - stores appointments with leads
export const appointments = pgTable(
	"appointments",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id").references(() => leads.id),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description"),
		startTime: timestamp("start_time").notNull(),
		endTime: timestamp("end_time").notNull(),
		location: varchar("location", { length: 255 }),
		completed: boolean("completed").default(false),
		notes: text("notes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("appointment_lead_id_idx").on(table.leadId),
		index("appointment_start_time_idx").on(table.startTime),
		index("appointment_user_id_idx").on(table.userId)
	]
)

// Campaigns table - stores information about marketing/calling campaigns
export const campaigns = pgTable(
	"campaigns",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		startDate: timestamp("start_date"),
		endDate: timestamp("end_date"),
		status: campaignStatusEnum("status").default("draft"),
		voiceAgentId: integer("voice_agent_id").references(
			() => voiceAgents.id
		), // Voice agent assignment for cold calls
		campaignSettings: jsonb("campaign_settings")
			.$type<{
				callTiming?: {
					businessHours?: {
						enabled: boolean
						timezone: string
						schedule: {
							[key: string]: { start: string; end: string } | null
						}
					}
					maxCallsPerDay?: number
					callInterval?: number // minutes between calls
				}
				retryLogic?: {
					maxAttempts: number
					retryIntervals: number[] // hours between retries
					retryConditions: string[] // which statuses trigger retries
				}
				successCriteria?: {
					convertedStatuses: string[] // lead statuses that count as success
					qualifiedStatuses: string[] // lead statuses that count as qualified
				}
				goals?: {
					targetLeads?: number
					targetConversions?: number
					targetCallsPerDay?: number
				}
				automation?: {
					autoProgressLeads: boolean
					autoScheduleFollowups: boolean
					autoUpdateScores: boolean
				}
			}>()
			.default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("campaign_name_idx").on(table.name),
		index("campaign_status_idx").on(table.status),
		index("campaign_voice_agent_idx").on(table.voiceAgentId),
		index("campaign_user_id_idx").on(table.userId)
	]
)

// Calls table - stores call records with leads
export const calls = pgTable(
	"calls",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id),
		campaignId: integer("campaign_id").references(() => campaigns.id),
		type: communicationTypeEnum("type").notNull(),
		duration: integer("duration"), // in seconds
		startTime: timestamp("start_time").notNull(),
		summary: text("summary"),
		transcript: text("transcript"),
		recordingUrl: varchar("recording_url", { length: 1024 }),
		status: varchar("status", { length: 50 }), // answered, voicemail, missed, etc.
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("call_lead_id_idx").on(table.leadId),
		index("call_campaign_id_idx").on(table.campaignId),
		index("call_start_time_idx").on(table.startTime),
		index("call_user_id_idx").on(table.userId)
	]
)

// Text messages table - stores text message records with leads
export const textMessages = pgTable(
	"text_messages",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id),
		type: communicationTypeEnum("type").notNull(),
		content: text("content").notNull(),
		sentAt: timestamp("sent_at").notNull(),
		deliveredAt: timestamp("delivered_at"),
		readAt: timestamp("read_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("text_lead_id_idx").on(table.leadId),
		index("text_sent_at_idx").on(table.sentAt),
		index("text_user_id_idx").on(table.userId)
	]
)

// Relations definition
export const leadsRelations = relations(leads, ({ one, many }) => ({
	appointments: many(appointments),
	calls: many(calls),
	textMessages: many(textMessages),
	voiceSessions: many(voiceSessions),
	interactions: many(leadInteractions),
	tasks: many(tasks),
	campaignLeads: many(campaignLeads),
	callQueue: many(callQueue),
	communicationLogs: many(communicationLogs)
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
	lead: one(leads, {
		fields: [appointments.leadId],
		references: [leads.id]
	})
}))

export const callsRelations = relations(calls, ({ one }) => ({
	lead: one(leads, {
		fields: [calls.leadId],
		references: [leads.id]
	}),
	campaign: one(campaigns, {
		fields: [calls.campaignId],
		references: [campaigns.id]
	})
}))

export const textMessagesRelations = relations(textMessages, ({ one }) => ({
	lead: one(leads, {
		fields: [textMessages.leadId],
		references: [leads.id]
	})
}))

// Add campaign relations
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
	voiceAgent: one(voiceAgents, {
		fields: [campaigns.voiceAgentId],
		references: [voiceAgents.id]
	}),
	campaignLeads: many(campaignLeads),
	campaignQueue: many(campaignQueue),
	calls: many(calls)
}))

// Define voice agent status enum
export const voiceAgentStatusEnum = pgEnum("voice_agent_status", [
	"active",
	"inactive",
	"training",
	"error"
])

// Define voice session status enum
export const voiceSessionStatusEnum = pgEnum("voice_session_status", [
	"active",
	"completed",
	"failed",
	"timeout"
])

// Define voice preset language enum
export const voicePresetLanguageEnum = pgEnum("voice_preset_language", [
	"en",
	"es",
	"fr",
	"de",
	"it",
	"pt",
	"zh",
	"hi",
	"ar",
	"ja"
])

// Define voice preset gender enum
export const voicePresetGenderEnum = pgEnum("voice_preset_gender", [
	"male",
	"female",
	"neutral"
])

// Voice Presets table - stores business-friendly voice configurations
export const voicePresets = pgTable(
	"voice_presets",
	{
		id: serial("id").primaryKey(),
		codename: varchar("codename", { length: 100 }).notNull().unique(), // Business-friendly name like "Professional", "Friendly"
		displayName: varchar("display_name", { length: 100 }).notNull(), // Display name for UI
		language: voicePresetLanguageEnum("language").notNull(),
		gender: voicePresetGenderEnum("gender").notNull(),
		description: text("description").notNull(), // Description for business users
		// Provider configuration (hidden from users)
		vapiVoiceId: varchar("vapi_voice_id", { length: 255 }).notNull(), // ElevenLabs voice ID, etc.
		vapiProvider: varchar("vapi_provider", { length: 50 }).notNull(), // "elevenlabs", "playht", "cartesia"
		vapiModel: varchar("vapi_model", { length: 100 }), // Provider-specific model
		sampleAudioUrl: varchar("sample_audio_url", { length: 1024 }), // URL for voice preview
		isDefault: boolean("is_default").default(false), // Default voice for language
		sortOrder: integer("sort_order").default(0), // Display ordering
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("voice_preset_codename_idx").on(table.codename),
		index("voice_preset_language_idx").on(table.language),
		index("voice_preset_gender_idx").on(table.gender),
		index("voice_preset_is_default_idx").on(table.isDefault),
		index("voice_preset_sort_order_idx").on(table.sortOrder)
	]
)

// Agent Roles table - stores pre-built business role configurations
export const agentRoles = pgTable(
	"agent_roles",
	{
		id: serial("id").primaryKey(),
		roleName: varchar("role_name", { length: 100 }).notNull().unique(), // "customer-service", "sales", "appointment-setting"
		displayName: varchar("display_name", { length: 100 }).notNull(), // "Customer Service", "Sales Representative"
		description: text("description").notNull(), // Business description of the role
		icon: varchar("icon", { length: 50 }).notNull(), // Lucide icon name
		systemPrompt: text("system_prompt").notNull(), // Optimized prompt for this role
		conversationStyle: text("conversation_style").notNull(), // Description of conversation style
		industryFocus: text("industry_focus"), // Target industries (optional)
		sampleConversation: text("sample_conversation"), // Example conversation
		// Default function configurations for this role
		defaultFunctions: jsonb("default_functions")
			.$type<
				Array<{
					name: string
					description: string
					webhook: string
					parameters: Array<{
						name: string
						type:
							| "string"
							| "number"
							| "boolean"
							| "object"
							| "array"
						description: string
						required: boolean
					}>
				}>
			>()
			.default([]),
		// Default configuration for agents with this role
		defaultConfiguration: jsonb("default_configuration")
			.$type<{
				flow?: {
					user_start_first?: boolean
					interruption?: {
						allowed?: boolean
						keep_interruption_message?: boolean
						first_message?: boolean
					}
					response_delay?: number
					auto_fill_responses?: {
						response_gap_threshold?: number
						messages?: string[]
					}
					agent_terminate_call?: {
						enabled?: boolean
						instruction?: string
						messages?: string[]
					}
					voicemail?: {
						action?: "hangup" | "continue"
						message?: string
						continue_on_voice_activity?: boolean
					}
					inactivity_handling?: {
						idle_time?: number
						message?: string
					}
				}
				llm?: {
					model?: string
					temperature?: number
				}
				session_timeout?: {
					max_duration?: number
					max_idle?: number
					message?: string
				}
			}>()
			.default({}),
		firstMessageTemplate: text("first_message_template"), // Default first message template
		isActive: boolean("is_active").default(true),
		sortOrder: integer("sort_order").default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("agent_role_name_idx").on(table.roleName),
		index("agent_role_display_name_idx").on(table.displayName),
		index("agent_role_is_active_idx").on(table.isActive),
		index("agent_role_sort_order_idx").on(table.sortOrder)
	]
)

// Voice Agents table - stores AI voice agent configurations
export const voiceAgents = pgTable(
	"voice_agents",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		// Business simplification layer references
		voicePresetId: integer("voice_preset_id").references(
			() => voicePresets.id
		), // Reference to simplified voice configuration
		agentRoleId: integer("agent_role_id").references(() => agentRoles.id), // Reference to business role
		// Legacy technical fields (deprecated in favor of presets)
		prompt: text("prompt"), // System prompt for the agent (now auto-generated from role)
		voice: jsonb("voice").$type<{
			provider: "elevenlabs" | "playht" | "cartesia"
			voice_id: string
			model?: string
			settings?: Record<string, unknown>
		}>(),
		language: varchar("language", { length: 10 }).default("en"), // Language code (en, es, fr, etc.)
		status: voiceAgentStatusEnum("status").default("inactive"),
		configuration: jsonb("configuration")
			.$type<{
				flow?: {
					user_start_first?: boolean
					interruption?: {
						allowed?: boolean
						keep_interruption_message?: boolean
						first_message?: boolean
					}
					response_delay?: number
					auto_fill_responses?: {
						response_gap_threshold?: number
						messages?: string[]
					}
					agent_terminate_call?: {
						enabled?: boolean
						instruction?: string
						messages?: string[]
					}
					voicemail?: {
						action?: "hangup" | "continue"
						message?: string
						continue_on_voice_activity?: boolean
					}
					call_transfer?: {
						phone?: string
						phones?: Array<{ phone: string; description: string }>
						instruction?: string
						messages?: string[]
					}
					inactivity_handling?: {
						idle_time?: number
						message?: string
					}
					dtmf_dial?: {
						enabled?: boolean
						instruction?: string
					}
				}
				llm?: {
					model?: string
					temperature?: number
					history_settings?: {
						history_message_limit?: number
						history_tool_result_limit?: number
					}
				}
				session_timeout?: {
					max_duration?: number
					max_idle?: number
					message?: string
				}
				privacy_settings?: {
					opt_out_data_collection?: boolean
					do_not_call_detection?: boolean
				}
				custom_vocabulary?: {
					keywords?: Record<string, unknown>
				}
				knowledge_base?: {
					files?: string[]
					messages?: string[]
				}
				speech_to_text?: {
					provider?: "deepgram"
					multilingual?: boolean
					model?: string
				}
				call_settings?: {
					enable_recording?: boolean
				}
				memory?: {
					user_identifier_key?: string
				}
				timezone?: string
			}>()
			.default({}),
		firstMessage: text("first_message"), // First message the agent says
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("voice_agent_name_idx").on(table.name),
		index("voice_agent_status_idx").on(table.status),
		index("voice_agent_voice_preset_idx").on(table.voicePresetId),
		index("voice_agent_role_idx").on(table.agentRoleId),
		index("voice_agent_user_id_idx").on(table.userId)
	]
)

// Voice Agent Functions table - stores function calls that agents can make
export const voiceAgentFunctions = pgTable(
	"voice_agent_functions",
	{
		id: serial("id").primaryKey(),
		agentId: integer("agent_id")
			.notNull()
			.references(() => voiceAgents.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description").notNull(),
		webhook: varchar("webhook", { length: 1024 }).notNull(), // Webhook URL
		method: varchar("method", { length: 10 }).default("POST"), // HTTP method
		headers: jsonb("headers").$type<Record<string, string>>().default({}), // HTTP headers
		parameters: jsonb("parameters")
			.$type<
				Array<{
					name: string
					type: "string" | "number" | "boolean" | "object" | "array"
					description: string
					required: boolean
				}>
			>()
			.default([]), // Function parameters
		timeout: integer("timeout").default(30), // Timeout in seconds
		runAfterCall: boolean("run_after_call").default(false), // Execute after call ends
		responseMode: varchar("response_mode", { length: 20 }).default(
			"strict"
		), // Response handling mode
		executeAfterMessage: boolean("execute_after_message").default(true),
		excludeSessionId: boolean("exclude_session_id").default(false),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("voice_function_agent_id_idx").on(table.agentId),
		index("voice_function_name_idx").on(table.name),
		index("voice_function_user_id_idx").on(table.userId)
	]
)

// Voice Sessions table - stores voice conversation sessions
export const voiceSessions = pgTable(
	"voice_sessions",
	{
		id: serial("id").primaryKey(),
		sessionId: varchar("session_id", { length: 255 }).unique().notNull(), // Voice session ID
		agentId: integer("agent_id")
			.notNull()
			.references(() => voiceAgents.id),
		leadId: integer("lead_id").references(() => leads.id), // Optional lead association
		phoneNumber: varchar("phone_number", { length: 50 }), // Caller's phone number
		direction: communicationTypeEnum("direction").notNull(), // incoming or outgoing
		status: voiceSessionStatusEnum("status").default("active"),
		startTime: timestamp("start_time").defaultNow().notNull(),
		endTime: timestamp("end_time"),
		duration: integer("duration"), // Duration in seconds
		metadata: jsonb("metadata")
			.$type<{
				user_agent?: string
				ip_address?: string
				custom_data?: Record<string, unknown>
			}>()
			.default({}), // Session metadata
		transcript: text("transcript"), // Full conversation transcript
		summary: text("summary"), // AI-generated summary
		sentiment: varchar("sentiment", { length: 20 }), // positive, negative, neutral
		recordingUrl: varchar("recording_url", { length: 1024 }), // Recording file URL
		cost: decimal("cost", { precision: 10, scale: 4 }).default("0.0000"), // Session cost
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("voice_session_session_id_idx").on(table.sessionId),
		index("voice_session_agent_id_idx").on(table.agentId),
		index("voice_session_lead_id_idx").on(table.leadId),
		index("voice_session_start_time_idx").on(table.startTime),
		index("voice_session_status_idx").on(table.status),
		index("voice_session_user_id_idx").on(table.userId)
	]
)

// Voice Recordings table - stores voice recording metadata and URLs
export const voiceRecordings = pgTable(
	"voice_recordings",
	{
		id: serial("id").primaryKey(),
		sessionId: integer("session_id")
			.notNull()
			.references(() => voiceSessions.id, { onDelete: "cascade" }),
		recordingUrl: varchar("recording_url", { length: 1024 }).notNull(),
		duration: integer("duration"), // Duration in seconds
		fileSize: integer("file_size"), // File size in bytes
		format: varchar("format", { length: 20 }).default("mp3"), // Audio format
		transcript: text("transcript"), // Transcription of the recording
		processingStatus: varchar("processing_status", { length: 20 }).default(
			"pending"
		), // pending, processing, completed, failed
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("voice_recording_session_id_idx").on(table.sessionId),
		index("voice_recording_status_idx").on(table.processingStatus),
		index("voice_recording_user_id_idx").on(table.userId)
	]
)

// Knowledge Base Sources Table
export const knowledgeBaseSources = pgTable(
	"knowledge_base_sources",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		type: text("type").notNull(), // "website_url", "pdf_upload", "gdoc", "image_upload", etc.
		uri: text("uri").notNull(), // URL or path to the source
		processingOptions: jsonb("processing_options").$type<{
			useMultimodal: boolean
			useHyde: boolean
			chunkingStrategy: "adaptive" | "layout-aware" | "standard"
			preserveLayout: boolean
			generateVisualDescriptions: boolean
		}>(),
		lastIndexedAt: timestamp("last_indexed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("kb_source_name_idx").on(table.name),
		index("kb_source_type_idx").on(table.type),
		index("kb_source_user_id_idx").on(table.userId)
	]
)

// Enhanced Knowledge Base Documents Table (chunks with multiple embedding types)
export const knowledgeBaseDocuments = pgTable(
	"knowledge_base_documents",
	{
		id: serial("id").primaryKey(),
		sourceId: integer("source_id").references(
			() => knowledgeBaseSources.id,
			{
				onDelete: "cascade"
			}
		),
		contentChunk: text("content_chunk").notNull(),
		chunkType: text("chunk_type").notNull().default("text"), // 'text', 'image', 'table', 'mixed'

		// Text embedding (voyage-3.5)
		textEmbeddingModel: text("text_embedding_model")
			.notNull()
			.default("voyage-3.5"),
		textEmbedding: vector("text_embedding", { dimensions: 1024 }),

		// Multimodal embedding (voyage-multimodal-3)
		multimodalEmbeddingModel: text("multimodal_embedding_model"),
		multimodalEmbedding: vector("multimodal_embedding", {
			dimensions: 1024
		}),

		// HyDE embeddings
		hydeEmbedding: vector("hyde_embedding", { dimensions: 1024 }),
		hydeQueries: jsonb("hyde_queries").$type<string[]>(),

		// Visual context and metadata
		visualContext: text("visual_context"), // Description of visual elements
		boundingBox: jsonb("bounding_box").$type<{
			x: number
			y: number
			width: number
			height: number
		}>(),

		pageNumber: integer("page_number"),
		processingMetadata: jsonb("processing_metadata").$type<{
			processingTime: number
			chunkingStrategy: string
			embeddingModels: string[]
			visualElementsDetected: boolean
			confidence: number
			retrievalStrategies?: string[]
		}>(),

		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("kb_document_source_id_idx").on(table.sourceId),
		index("kb_document_user_id_idx").on(table.userId),
		index("kb_document_chunk_type_idx").on(table.chunkType),
		index("kb_document_page_number_idx").on(table.pageNumber),

		// Vector indexes for different embedding types
		index("kb_document_text_embedding_hnsw_idx").using(
			"hnsw",
			table.textEmbedding.op("vector_cosine_ops")
		),
		index("kb_document_multimodal_embedding_hnsw_idx").using(
			"hnsw",
			table.multimodalEmbedding.op("vector_cosine_ops")
		),
		index("kb_document_hyde_embedding_hnsw_idx").using(
			"hnsw",
			table.hydeEmbedding.op("vector_cosine_ops")
		),

		// Composite indexes for hybrid search
		index("kb_document_source_type_idx").on(
			table.sourceId,
			table.chunkType
		),
		index("kb_document_metadata_gin_idx").using("gin", table.metadata)
	]
)

// Optional: Table for storing visual elements separately
export const visualElements = pgTable(
	"visual_elements",
	{
		id: serial("id").primaryKey(),
		documentId: integer("document_id").references(
			() => knowledgeBaseDocuments.id,
			{ onDelete: "cascade" }
		),
		elementType: text("element_type").notNull(), // 'image', 'table', 'chart', 'diagram'
		description: text("description"),
		extractedText: text("extracted_text"),
		imageData: text("image_data"), // Base64 encoded image or reference
		embedding: vector("embedding", { dimensions: 1024 }),
		boundingBox: jsonb("bounding_box").$type<{
			x: number
			y: number
			width: number
			height: number
		}>(),
		pageNumber: integer("page_number"),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull()
	},
	(table) => [
		index("visual_element_document_id_idx").on(table.documentId),
		index("visual_element_type_idx").on(table.elementType),
		index("visual_element_user_id_idx").on(table.userId),
		index("visual_element_embedding_hnsw_idx").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops")
		)
	]
)

// Admin Activity Logs table - tracks all admin actions for security and auditing
export const adminActivityLogs = pgTable(
	"admin_activity_logs",
	{
		id: serial("id").primaryKey(),
		adminUserId: varchar("admin_user_id", { length: 255 }).notNull(), // Authenticated user ID of admin
		actionType: varchar("action_type", { length: 100 }).notNull(), // e.g., 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'
		targetTable: varchar("target_table", { length: 100 }), // Which table was affected
		targetId: varchar("target_id", { length: 255 }), // ID of the affected record
		actionDetails: jsonb("action_details").$type<{
			description: string
			changes?: Record<
				string,
				{
					from?: string | number | boolean | null
					to?: string | number | boolean | null
				}
			>
			metadata?: Record<string, string | number | boolean | null>
		}>(),
		ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
		userAgent: text("user_agent"),
		sessionId: varchar("session_id", { length: 255 }),
		createdAt: timestamp("created_at").defaultNow().notNull()
	},
	(table) => [
		index("admin_activity_user_id_idx").on(table.adminUserId),
		index("admin_activity_action_type_idx").on(table.actionType),
		index("admin_activity_target_table_idx").on(table.targetTable),
		index("admin_activity_created_at_idx").on(table.createdAt),
		index("admin_activity_session_id_idx").on(table.sessionId)
	]
)

// Admin Sessions table - tracks admin login sessions
export const adminSessions = pgTable(
	"admin_sessions",
	{
		id: serial("id").primaryKey(),
		adminUserId: varchar("admin_user_id", { length: 255 }).notNull(), // Authenticated user ID
		sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
		ipAddress: varchar("ip_address", { length: 45 }),
		userAgent: text("user_agent"),
		loginAt: timestamp("login_at").defaultNow().notNull(),
		lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
		logoutAt: timestamp("logout_at"),
		isActive: boolean("is_active").default(true),
		expiresAt: timestamp("expires_at").notNull(),
		metadata: jsonb("metadata")
			.$type<{
				browser?: string
				os?: string
				device?: string
				location?: {
					country?: string
					city?: string
				}
			}>()
			.default({})
	},
	(table) => [
		index("admin_sessions_user_id_idx").on(table.adminUserId),
		index("admin_sessions_session_id_idx").on(table.sessionId),
		index("admin_sessions_is_active_idx").on(table.isActive),
		index("admin_sessions_expires_at_idx").on(table.expiresAt)
	]
)

// Admin Settings table - stores global configuration settings for voice agents and platform
export const adminSettings = pgTable(
	"admin_settings",
	{
		id: serial("id").primaryKey(),
		settingKey: varchar("setting_key", { length: 100 }).notNull().unique(), // e.g., 'default_system_prompt', 'default_model'
		settingValue: jsonb("setting_value").$type<{
			// System prompts
			systemPrompt?: string
			industryPrompts?: Record<string, string> // e.g., { "sales": "You are a sales agent...", "support": "You are a support agent..." }

			// Model configurations
			defaultModel?: string
			availableModels?: Array<{
				id: string
				name: string
				provider: string
				description: string
				costPerToken?: number
				maxTokens?: number
			}>

			// Voice agent defaults
			defaultVoiceSettings?: {
				provider?: string
				voiceId?: string
				speed?: number
				stability?: number
				similarityBoost?: number
			}

			// A/B testing configurations
			abTestConfigs?: Array<{
				name: string
				variants: Array<{
					name: string
					weight: number
					config: Record<string, unknown>
				}>
				isActive: boolean
			}>

			// Global prompt templates
			promptTemplates?: Array<{
				id: string
				name: string
				category: string
				template: string
				variables: string[]
			}>

			// Platform configurations
			platformSettings?: {
				maxAgentsPerUser?: number
				defaultLanguage?: string
				enableAnalytics?: boolean
				enableRecording?: boolean
			}

			// Any other configuration data
			[key: string]: unknown
		}>(),
		description: text("description"), // Human-readable description of the setting
		isActive: boolean("is_active").default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		createdBy: varchar("created_by", { length: 255 }).notNull() // Admin user ID
	},
	(table) => [
		index("admin_settings_key_idx").on(table.settingKey),
		index("admin_settings_is_active_idx").on(table.isActive),
		index("admin_settings_created_by_idx").on(table.createdBy)
	]
)

// Tool Calls table - tracks tool API calls for monitoring and analytics
export const toolCalls = pgTable(
	"tool_calls",
	{
		id: serial("id").primaryKey(),
		toolCallId: varchar("tool_call_id", { length: 255 }).notNull(), // Tool call ID
		callId: varchar("call_id", { length: 255 }), // Call ID
		sessionId: varchar("session_id", { length: 255 }), // Voice session ID
		toolName: varchar("tool_name", { length: 100 }).notNull(), // e.g., 'updateLeadScore', 'sendFollowUpEmail'
		parameters: jsonb("parameters").$type<Record<string, unknown>>(), // Tool call parameters
		result: jsonb("result").$type<{
			success: boolean
			message: string
			data?: Record<string, unknown>
			error?: string
		}>(), // Tool execution result
		executionTime: integer("execution_time"), // Execution time in milliseconds
		userId: varchar("user_id", { length: 255 }).notNull(), // User who triggered the call
		ipAddress: varchar("ip_address", { length: 45 }), // Request IP address
		userAgent: text("user_agent"), // Request user agent
		createdAt: timestamp("created_at").defaultNow().notNull()
	},
	(table) => [
		index("tool_calls_tool_call_id_idx").on(table.toolCallId),
		index("tool_calls_call_id_idx").on(table.callId),
		index("tool_calls_tool_name_idx").on(table.toolName),
		index("tool_calls_user_id_idx").on(table.userId),
		index("tool_calls_created_at_idx").on(table.createdAt)
	]
)

// Tasks table - stores follow-up tasks and activities for leads
export const tasks = pgTable(
	"tasks",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		priority: taskPriorityEnum("priority").default("medium"),
		status: taskStatusEnum("status").default("pending"),
		taskType: taskTypeEnum("task_type").default("follow_up"),
		dueDate: timestamp("due_date"),
		completedAt: timestamp("completed_at"),
		assignedTo: varchar("assigned_to", { length: 255 }), // User ID assigned to
		createdBy: varchar("created_by", { length: 255 }).notNull(), // User ID who created
		notes: text("notes"), // Additional notes or completion notes
		metadata: jsonb("metadata").$type<{
			source?: string // e.g., 'tool', 'manual', 'automation'
			toolCallId?: string
			callId?: string
			sessionId?: string
			automation_trigger?: string
			[key: string]: unknown
		}>(),
		userId: varchar("user_id", { length: 255 }).notNull(), // Owner/context user
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull()
	},
	(table) => [
		index("tasks_lead_id_idx").on(table.leadId),
		index("tasks_status_idx").on(table.status),
		index("tasks_priority_idx").on(table.priority),
		index("tasks_assigned_to_idx").on(table.assignedTo),
		index("tasks_due_date_idx").on(table.dueDate),
		index("tasks_user_id_idx").on(table.userId),
		index("tasks_created_at_idx").on(table.createdAt)
	]
)

// Lead Interactions table - tracks automated updates and interactions with leads
export const leadInteractions = pgTable(
	"lead_interactions",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id, { onDelete: "cascade" }),
		interactionType: varchar("interaction_type", { length: 100 }).notNull(), // e.g., 'score_update', 'note_added', 'email_sent', 'status_change'
		source: varchar("source", { length: 100 }).notNull(), // e.g., 'tool', 'manual', 'automation'
		sourceId: varchar("source_id", { length: 255 }), // Reference to source (tool call ID, user ID, etc.)
		oldValue: jsonb("old_value").$type<Record<string, unknown>>(), // Previous value before interaction
		newValue: jsonb("new_value").$type<Record<string, unknown>>(), // New value after interaction
		metadata: jsonb("metadata").$type<{
			toolCallId?: string
			callId?: string
			sessionId?: string
			reason?: string
			confidence?: number
			automation_rules?: string[]
			[key: string]: unknown
		}>(), // Additional interaction metadata
		userId: varchar("user_id", { length: 255 }).notNull(), // User context
		createdAt: timestamp("created_at").defaultNow().notNull()
	},
	(table) => [
		index("lead_interactions_lead_id_idx").on(table.leadId),
		index("lead_interactions_type_idx").on(table.interactionType),
		index("lead_interactions_source_idx").on(table.source),
		index("lead_interactions_user_id_idx").on(table.userId),
		index("lead_interactions_created_at_idx").on(table.createdAt)
	]
)

// Campaign Leads table - junction table for many-to-many relationship between campaigns and leads
export const campaignLeads = pgTable(
	"campaign_leads",
	{
		id: serial("id").primaryKey(),
		campaignId: integer("campaign_id")
			.notNull()
			.references(() => campaigns.id, { onDelete: "cascade" }),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id, { onDelete: "cascade" }),
		status: campaignLeadStatusEnum("status").default("pending"),
		priority: integer("priority").default(0), // 0 = normal, higher numbers = higher priority
		assignedAt: timestamp("assigned_at").defaultNow().notNull(),
		lastAttemptAt: timestamp("last_attempt_at"),
		nextAttemptAt: timestamp("next_attempt_at"), // Scheduled time for next call attempt
		attemptCount: integer("attempt_count").default(0),
		maxAttempts: integer("max_attempts").default(3),
		notes: text("notes"), // Campaign-specific notes for this lead
		metadata: jsonb("metadata")
			.$type<{
				customFields?: Record<string, unknown>
				campaignContext?: string
				skipReasons?: string[]
				successMetrics?: Record<string, unknown>
			}>()
			.default({}),
		completedAt: timestamp("completed_at"),
		excludedAt: timestamp("excluded_at"),
		excludeReason: text("exclude_reason"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("campaign_leads_campaign_id_idx").on(table.campaignId),
		index("campaign_leads_lead_id_idx").on(table.leadId),
		index("campaign_leads_status_idx").on(table.status),
		index("campaign_leads_priority_idx").on(table.priority),
		index("campaign_leads_next_attempt_idx").on(table.nextAttemptAt),
		index("campaign_leads_user_id_idx").on(table.userId),
		// Unique constraint to prevent duplicate lead assignments to same campaign
		index("campaign_leads_unique_idx").on(table.campaignId, table.leadId)
	]
)

// Call Queue table - manages manual call queue for leads
export const callQueue = pgTable(
	"call_queue",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id, { onDelete: "cascade" }),
		voiceAgentId: integer("voice_agent_id").references(
			() => voiceAgents.id
		),
		status: callQueueStatusEnum("status").default("pending"),
		priority: integer("priority").default(0), // Higher numbers = higher priority
		scheduledTime: timestamp("scheduled_time"), // When this call should be made (optional)
		instructions: text("instructions"), // Special instructions for the call
		phoneNumber: varchar("phone_number", { length: 50 }), // Override phone number if needed
		startedAt: timestamp("started_at"), // When call processing started
		completedAt: timestamp("completed_at"), // When call was completed or failed
		retryCount: integer("retry_count").default(0),
		maxRetries: integer("max_retries").default(3),
		retryInterval: integer("retry_interval").default(60), // Minutes between retries
		lastError: text("last_error"), // Error message if call failed
		callResult: jsonb("call_result")
			.$type<{
				callId?: string
				sessionId?: string
				duration?: number
				outcome?: string // answered, voicemail, busy, no_answer, failed
				notes?: string
				followUpRequired?: boolean
				nextContactDate?: string
			}>()
			.default({}),
		metadata: jsonb("metadata")
			.$type<{
				callConfiguration?: Record<string, unknown>
				context?: Record<string, unknown>
				userNotes?: string
			}>()
			.default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("call_queue_lead_id_idx").on(table.leadId),
		index("call_queue_voice_agent_id_idx").on(table.voiceAgentId),
		index("call_queue_status_idx").on(table.status),
		index("call_queue_priority_idx").on(table.priority),
		index("call_queue_scheduled_time_idx").on(table.scheduledTime),
		index("call_queue_user_id_idx").on(table.userId)
	]
)

// Communication Logs table - tracks all communication attempts and their outcomes
export const communicationLogs = pgTable(
	"communication_logs",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id, { onDelete: "cascade" }),
		type: communicationTypeEnum("type").notNull(), // incoming, outgoing
		method: varchar("method", { length: 50 }).notNull(), // call, email, text, appointment
		status: varchar("status", { length: 50 }).notNull(), // pending, sent, delivered, failed, opened, clicked
		details: jsonb("details")
			.$type<{
				subject?: string
				content?: string
				duration?: number
				outcome?: string
				templateId?: number
				voiceAgentId?: number
				phoneNumber?: string
				errorMessage?: string
				deliveryTime?: string
				openTime?: string
				clickTime?: string
			}>()
			.default({}),
		relatedRecordId: integer("related_record_id"), // ID in calls, textMessages, appointments table
		relatedRecordType: varchar("related_record_type", { length: 50 }), // "call", "text_message", "appointment"
		notes: text("notes"), // User-added notes about this communication
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("communication_logs_lead_id_idx").on(table.leadId),
		index("communication_logs_type_idx").on(table.type),
		index("communication_logs_method_idx").on(table.method),
		index("communication_logs_status_idx").on(table.status),
		index("communication_logs_related_record_idx").on(
			table.relatedRecordId,
			table.relatedRecordType
		),
		index("communication_logs_user_id_idx").on(table.userId)
	]
)

// Campaign Queue table - manages call scheduling and execution queue
export const campaignQueue = pgTable(
	"campaign_queue",
	{
		id: serial("id").primaryKey(),
		campaignId: integer("campaign_id")
			.notNull()
			.references(() => campaigns.id, { onDelete: "cascade" }),
		campaignLeadId: integer("campaign_lead_id")
			.notNull()
			.references(() => campaignLeads.id, { onDelete: "cascade" }),
		status: campaignQueueStatusEnum("status").default("queued"),
		priority: integer("priority").default(0), // Higher numbers = higher priority
		scheduledTime: timestamp("scheduled_time").notNull(), // When this call should be made
		startedAt: timestamp("started_at"), // When call processing started
		completedAt: timestamp("completed_at"), // When call was completed or failed
		retryCount: integer("retry_count").default(0),
		maxRetries: integer("max_retries").default(3),
		retryInterval: integer("retry_interval").default(60), // Minutes between retries
		lastError: text("last_error"), // Error message if call failed
		callResult: jsonb("call_result")
			.$type<{
				callId?: string
				sessionId?: string
				duration?: number
				outcome?: string // answered, voicemail, busy, no_answer, failed
				nextAction?: string
				reschedule?: {
					scheduledTime: string
					reason: string
				}
			}>()
			.default({}),
		metadata: jsonb("metadata")
			.$type<{
				voiceAgentId?: number
				phoneNumberId?: number
				callConfiguration?: Record<string, unknown>
				context?: Record<string, unknown>
			}>()
			.default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Authenticated user ID
	},
	(table) => [
		index("campaign_queue_campaign_id_idx").on(table.campaignId),
		index("campaign_queue_campaign_lead_id_idx").on(table.campaignLeadId),
		index("campaign_queue_status_idx").on(table.status),
		index("campaign_queue_priority_idx").on(table.priority),
		index("campaign_queue_scheduled_time_idx").on(table.scheduledTime),
		index("campaign_queue_retry_count_idx").on(table.retryCount),
		index("campaign_queue_user_id_idx").on(table.userId)
	]
)

// Define relationships
export const knowledgeBaseSourcesRelations = relations(
	knowledgeBaseSources,
	({ many }) => ({
		documents: many(knowledgeBaseDocuments)
	})
)

export const knowledgeBaseDocumentsRelations = relations(
	knowledgeBaseDocuments,
	({ one, many }) => ({
		source: one(knowledgeBaseSources, {
			fields: [knowledgeBaseDocuments.sourceId],
			references: [knowledgeBaseSources.id]
		}),
		visualElements: many(visualElements)
	})
)

export const visualElementsRelations = relations(visualElements, ({ one }) => ({
	document: one(knowledgeBaseDocuments, {
		fields: [visualElements.documentId],
		references: [knowledgeBaseDocuments.id]
	})
}))

// Voice agent relations
export const voiceAgentsRelations = relations(voiceAgents, ({ one, many }) => ({
	voicePreset: one(voicePresets, {
		fields: [voiceAgents.voicePresetId],
		references: [voicePresets.id]
	}),
	agentRole: one(agentRoles, {
		fields: [voiceAgents.agentRoleId],
		references: [agentRoles.id]
	}),
	functions: many(voiceAgentFunctions),
	sessions: many(voiceSessions)
}))

export const voiceAgentFunctionsRelations = relations(
	voiceAgentFunctions,
	({ one }) => ({
		agent: one(voiceAgents, {
			fields: [voiceAgentFunctions.agentId],
			references: [voiceAgents.id]
		})
	})
)

export const voiceSessionsRelations = relations(
	voiceSessions,
	({ one, many }) => ({
		agent: one(voiceAgents, {
			fields: [voiceSessions.agentId],
			references: [voiceAgents.id]
		}),
		lead: one(leads, {
			fields: [voiceSessions.leadId],
			references: [leads.id]
		}),
		recordings: many(voiceRecordings)
	})
)

export const voiceRecordingsRelations = relations(
	voiceRecordings,
	({ one }) => ({
		session: one(voiceSessions, {
			fields: [voiceRecordings.sessionId],
			references: [voiceSessions.id]
		})
	})
)

// Voice Presets relations
export const voicePresetsRelations = relations(voicePresets, ({ many }) => ({
	voiceAgents: many(voiceAgents)
}))

// Agent Roles relations
export const agentRolesRelations = relations(agentRoles, ({ many }) => ({
	voiceAgents: many(voiceAgents)
}))

// Tool Calls relations
export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
	voiceSession: one(voiceSessions, {
		fields: [toolCalls.sessionId],
		references: [voiceSessions.sessionId]
	})
}))

// Lead Interactions relations
export const leadInteractionsRelations = relations(
	leadInteractions,
	({ one }) => ({
		lead: one(leads, {
			fields: [leadInteractions.leadId],
			references: [leads.id]
		})
	})
)

// Tasks relations
export const tasksRelations = relations(tasks, ({ one }) => ({
	lead: one(leads, {
		fields: [tasks.leadId],
		references: [leads.id]
	})
}))

// Campaign Leads relations
export const campaignLeadsRelations = relations(
	campaignLeads,
	({ one, many }) => ({
		campaign: one(campaigns, {
			fields: [campaignLeads.campaignId],
			references: [campaigns.id]
		}),
		lead: one(leads, {
			fields: [campaignLeads.leadId],
			references: [leads.id]
		}),
		queueEntries: many(campaignQueue)
	})
)

// Campaign Queue relations
export const campaignQueueRelations = relations(campaignQueue, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [campaignQueue.campaignId],
		references: [campaigns.id]
	}),
	campaignLead: one(campaignLeads, {
		fields: [campaignQueue.campaignLeadId],
		references: [campaignLeads.id]
	})
}))

// Call Queue relations
export const callQueueRelations = relations(callQueue, ({ one }) => ({
	lead: one(leads, {
		fields: [callQueue.leadId],
		references: [leads.id]
	}),
	voiceAgent: one(voiceAgents, {
		fields: [callQueue.voiceAgentId],
		references: [voiceAgents.id]
	})
}))

// Communication Logs relations
export const communicationLogsRelations = relations(
	communicationLogs,
	({ one }) => ({
		lead: one(leads, {
			fields: [communicationLogs.leadId],
			references: [leads.id]
		})
	})
)
