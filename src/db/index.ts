import { Pool } from "@neondatabase/serverless"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/neon-serverless"
import * as schema from "./schema"

config({ path: ".env.local" }) // or .env.local

const connectionString =
	process.env.NODE_ENV === "production"
		? process.env.PROD_DB_URL
		: process.env.DEV_DB_URL
const pool = new Pool({ connectionString })

export const db_ws = drizzle(pool, { schema })
