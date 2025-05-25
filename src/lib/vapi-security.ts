import type { NextRequest } from "next/server"

// Environment variable access helper for Cloudflare Workers
async function getEnvironmentVariable(
	key: string
): Promise<string | undefined> {
	try {
		// Try Cloudflare context first (production)
		const { getCloudflareContext } = await import("@opennextjs/cloudflare")
		const { env } = getCloudflareContext()
		return (env as Record<string, string>)[key]
	} catch {
		// Fallback to process.env (development)
		return process.env[key]
	}
}

// Request origin validation
export async function validateRequestOrigin(
	request: NextRequest
): Promise<boolean> {
	const origin = request.headers.get("origin")
	const referer = request.headers.get("referer")

	// Get allowed origins from environment
	const allowedOriginsStr = await getEnvironmentVariable(
		"VAPI_ALLOWED_ORIGINS"
	)
	if (!allowedOriginsStr) {
		console.warn(
			"VAPI_ALLOWED_ORIGINS not configured, allowing all origins"
		)
		return true
	}

	const allowedOrigins = allowedOriginsStr.split(",").map((o) => o.trim())

	// Check origin header
	if (origin) {
		return allowedOrigins.some(
			(allowed) =>
				origin === allowed ||
				origin.endsWith(allowed.replace("https://", ""))
		)
	}

	// Check referer header as fallback
	if (referer) {
		return allowedOrigins.some((allowed) => referer.startsWith(allowed))
	}

	// No origin or referer - could be server-to-server call
	// Allow if User-Agent suggests it's from Vapi
	const userAgent = request.headers.get("user-agent") || ""
	return (
		userAgent.toLowerCase().includes("vapi") ||
		userAgent.toLowerCase().includes("webhook")
	)
}

// API key authentication
export async function validateApiKey(request: NextRequest): Promise<boolean> {
	const apiKey =
		request.headers.get("x-api-key") ||
		request.headers.get("authorization")?.replace("Bearer ", "")

	if (!apiKey) {
		return false
	}

	const expectedApiKey = await getEnvironmentVariable("VAPI_TOOLS_API_KEY")
	if (!expectedApiKey) {
		console.warn(
			"VAPI_TOOLS_API_KEY not configured, skipping API key validation"
		)
		return true
	}

	return apiKey === expectedApiKey
}

// Request timeout wrapper
export function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs = 30000
): Promise<T> {
	const timeoutPromise = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
	)
	return Promise.race([promise, timeoutPromise])
}

// Security validation result
export interface SecurityValidationResult {
	valid: boolean
	error?: string
	statusCode?: number
}

// Comprehensive security validation
export async function validateSecurity(
	request: NextRequest
): Promise<SecurityValidationResult> {
	// Check request origin
	const originValid = await validateRequestOrigin(request)
	if (!originValid) {
		return {
			valid: false,
			error: "Invalid request origin",
			statusCode: 403
		}
	}

	// Check API key
	const apiKeyValid = await validateApiKey(request)
	if (!apiKeyValid) {
		return {
			valid: false,
			error: "Invalid or missing API key",
			statusCode: 401
		}
	}

	return { valid: true }
}

// Request size validation
export function validateRequestSize(
	request: NextRequest,
	maxSizeBytes: number = 1024 * 1024
): boolean {
	const contentLength = request.headers.get("content-length")
	if (contentLength) {
		const size = Number.parseInt(contentLength, 10)
		return size <= maxSizeBytes
	}
	return true
}

// Request method validation
export function validateRequestMethod(
	request: NextRequest,
	allowedMethods: string[] = ["POST"]
): boolean {
	return allowedMethods.includes(request.method)
}
