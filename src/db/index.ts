import { Pool } from "@neondatabase/serverless"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/neon-serverless"
import { drizzle as drizzleHttp } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

config({ path: ".env.local" }) // or .env.local

const connectionString =
	process.env.NODE_ENV === "production"
		? process.env.PROD_DB_URL
		: process.env.DEV_DB_URL
const pool = new Pool({ connectionString })

export const db_ws = drizzle(pool, { schema })

export function db_http({
	env,
	cache = true
}: {
	env: CloudflareEnv
	cache?: boolean
}) {
	const connectionString = cache
		? env.HYPERDRIVE_CACHE.connectionString
		: env.HYPERDRIVE_NOCACHE.connectionString
	return drizzleHttp(connectionString, { schema })
}

export type DrizzleHTTPClient = ReturnType<typeof db_http>
