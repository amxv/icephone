function trimToNull(value: string | null | undefined) {
	if (typeof value !== "string") {
		return null
	}

	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

export function getEnv(name: string) {
	return trimToNull(process.env[name])
}

export function requireEnv(name: string) {
	const value = getEnv(name)
	if (!value) {
		throw new Error(`${name} is required`)
	}
	return value
}

export function isNextBuildPhase() {
	return process.env.NEXT_PHASE === "phase-production-build"
}

export function resolveAppBaseUrl() {
	return (
		getEnv("APP_BASE_URL") ||
		getEnv("APP_URL") ||
		getEnv("NEXT_PUBLIC_APP_URL") ||
		getEnv("BETTER_AUTH_URL") ||
		getEnv("NEXT_PUBLIC_BETTER_AUTH_URL") ||
		null
	)
}

export function resolveAuthBaseUrl() {
	return resolveAppBaseUrl() || "http://localhost:3000"
}

export function resolveAppDisplayName() {
	return getEnv("APP_NAME") || "IcePhone"
}
