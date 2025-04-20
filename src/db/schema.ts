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
	(table) => {
		return {
			nameIdx: index("lead_name_idx").on(table.name),
			emailIdx: index("lead_email_idx").on(table.email),
			statusIdx: index("lead_status_idx").on(table.status),
			userIdIdx: index("lead_user_id_idx").on(table.userId)
		}
	}
)

// Relations definition
export const leadsRelations = relations(leads, ({ one, many }) => ({
	// Define relations when needed
}))
