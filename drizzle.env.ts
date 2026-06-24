import * as fs from "node:fs"
import * as path from "node:path"
import * as dotenv from "dotenv"

export function loadEnvFile() {
	const configuredPath = process.env.ICEPHONE_ENV_FILE?.trim()
	const envPath = path.resolve(process.cwd(), configuredPath || ".env")

	if (!fs.existsSync(envPath)) {
		console.warn(
			`Environment file not found at ${envPath}. Continuing with existing process environment.`
		)
		return
	}

	dotenv.config({ path: envPath })
}
