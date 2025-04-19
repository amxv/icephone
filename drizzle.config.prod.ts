import * as fs from "node:fs"
import * as path from "node:path"
import * as dotenv from "dotenv"
import type { Config } from "drizzle-kit"

// Try to load .env.local first, then fall back to .env
const envLocalPath = path.resolve(process.cwd(), ".env.local")
const envPath = path.resolve(process.cwd(), ".env")

if (fs.existsSync(envLocalPath)) {
	console.log("Loading environment from .env.local")
	dotenv.config({ path: envLocalPath })
} else {
	console.log("Loading environment from .env")
	dotenv.config({ path: envPath })
}

export default {
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.PROD_DB_URL || ""
	}
} satisfies Config
