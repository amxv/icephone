import type { CRMProvider } from "@/lib/crm/types"

export class CRMProviderError extends Error {
	constructor(
		readonly provider: CRMProvider,
		message: string,
		readonly status?: number,
		readonly details?: unknown
	) {
		super(message)
		this.name = "CRMProviderError"
	}
}

export async function requestJson<T>(
	provider: CRMProvider,
	url: string,
	init: RequestInit
): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: {
			Accept: "application/json",
			...(init.headers || {})
		},
		cache: "no-store"
	})

	const text = await response.text()
	const maybeJson = text ? safeParseJson(text) : null

	if (!response.ok) {
		throw new CRMProviderError(
			provider,
			`${provider} request failed (${response.status})`,
			response.status,
			maybeJson ?? text
		)
	}

	if (maybeJson === null) {
		return {} as T
	}

	return maybeJson as T
}

function safeParseJson(payload: string) {
	try {
		return JSON.parse(payload)
	} catch {
		return null
	}
}

export function withBearerToken(
	token: string,
	extraHeaders?: Record<string, string>
) {
	return {
		Authorization: `Bearer ${token}`,
		...extraHeaders
	}
}

export function ensureToken(
	provider: CRMProvider,
	token?: string | null
): string {
	if (!token) {
		throw new CRMProviderError(provider, `${provider} token is not configured`)
	}

	return token
}
