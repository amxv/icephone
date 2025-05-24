import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import * as schema from "./schema"

let connectionString: string | undefined

// Use the appropriate connection string based on environment
if (typeof process !== "undefined") {
	connectionString =
		process.env.NODE_ENV === "production"
			? process.env.PROD_DB_URL
			: process.env.DEV_DB_URL
}

// Create a database connection pool
const pool = new Pool({ connectionString })

// Export the database client with schema
export const db = drizzle(pool, { schema })
