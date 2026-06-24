import type { Config } from "drizzle-kit"
import { loadEnvFile } from "./drizzle.env"

loadEnvFile()

export default {
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DEV_DB_URL || ""
	}
} satisfies Config
