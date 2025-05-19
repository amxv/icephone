import { relations } from "drizzle-orm"
import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
	varchar
} from "drizzle-orm/pg-core"

// Define lead status enum
export const leadStatusEnum = pgEnum("lead_status", [
	"new",
	"contacted",
	"qualified",
	"converted",
	"lost"
])

// Define communication type enum
export const communicationTypeEnum = pgEnum("communication_type", [
	"incoming",
	"outgoing"
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
		source: varchar("source", { length: 100 }),
		notes: text("notes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
	},
	(table) => [
		index("lead_name_idx").on(table.name),
		index("lead_email_idx").on(table.email),
		index("lead_status_idx").on(table.status),
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
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
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
		status: varchar("status", { length: 50 }).default("draft"), // e.g., draft, active, completed, archived
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
	},
	(table) => [
		index("campaign_name_idx").on(table.name),
		index("campaign_status_idx").on(table.status),
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
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
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
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
	},
	(table) => [
		index("text_lead_id_idx").on(table.leadId),
		index("text_sent_at_idx").on(table.sentAt),
		index("text_user_id_idx").on(table.userId)
	]
)

// Emails table - stores email records with leads
export const emails = pgTable(
	"emails",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id")
			.notNull()
			.references(() => leads.id),
		type: communicationTypeEnum("type").notNull(),
		subject: varchar("subject", { length: 255 }).notNull(),
		content: text("content").notNull(),
		sentAt: timestamp("sent_at").notNull(),
		openedAt: timestamp("opened_at"),
		clickedAt: timestamp("clicked_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
	},
	(table) => [
		index("email_lead_id_idx").on(table.leadId),
		index("email_sent_at_idx").on(table.sentAt),
		index("email_user_id_idx").on(table.userId)
	]
)

// Chats table - stores chat conversations or summaries with leads
export const chats = pgTable(
	"chats",
	{
		id: serial("id").primaryKey(),
		leadId: integer("lead_id").references(() => leads.id),
		summary: text("summary"), // Stores the main content or summary of the chat
		timestamp: timestamp("timestamp").notNull(), // When the chat occurred/was last updated
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
	},
	(table) => [
		index("chat_lead_id_idx").on(table.leadId),
		index("chat_timestamp_idx").on(table.timestamp),
		index("chat_user_id_idx").on(table.userId)
	]
)

// Relations definition
export const leadsRelations = relations(leads, ({ one, many }) => ({
	appointments: many(appointments),
	calls: many(calls),
	textMessages: many(textMessages),
	emails: many(emails),
	chats: many(chats)
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

export const emailsRelations = relations(emails, ({ one }) => ({
	lead: one(leads, {
		fields: [emails.leadId],
		references: [leads.id]
	})
}))

// Chat messages table - stores individual messages in a chat conversation
export const chatMessages = pgTable(
	"chat_messages",
	{
		id: serial("id").primaryKey(),
		chatId: integer("chat_id")
			.references(() => chats.id)
			.notNull(),
		content: text("content").notNull(),
		role: varchar("role", { length: 50 }).notNull(), // 'user' or 'assistant'
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		userId: varchar("user_id", { length: 255 }).notNull() // Clerk user ID
	},
	(table) => [
		index("chat_message_chat_id_idx").on(table.chatId),
		index("chat_message_timestamp_idx").on(table.timestamp),
		index("chat_message_user_id_idx").on(table.userId)
	]
)

export const chatsRelations = relations(chats, ({ one, many }) => ({
	lead: one(leads, {
		fields: [chats.leadId],
		references: [leads.id]
	}),
	messages: many(chatMessages)
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
	chat: one(chats, {
		fields: [chatMessages.chatId],
		references: [chats.id]
	})
}))

// Add campaign relations
export const campaignsRelations = relations(campaigns, ({ many }) => ({
	calls: many(calls)
}))
