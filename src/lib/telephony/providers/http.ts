import type { TelephonyProvider } from "@/lib/telephony/types"

type TelephonyRequestOptions = RequestInit & {
	timeoutMs?: number
}

export class TelephonyProviderError extends Error {
	readonly provider: TelephonyProvider
	readonly statusCode?: number
	readonly retryable: boolean
	readonly details?: unknown

	constructor(params: {
		provider: TelephonyProvider
		message: string
		statusCode?: number
		retryable?: boolean
		details?: unknown
	}) {
		super(params.message)
		this.name = "TelephonyProviderError"
		this.provider = params.provider
		this.statusCode = params.statusCode
		this.retryable = params.retryable ?? false
		this.details = params.details
	}
}

function inferRetryableStatus(statusCode: number) {
	return (
		statusCode === 408 ||
		statusCode === 409 ||
		statusCode === 429 ||
		statusCode >= 500
	)
}

function parseJsonIfPossible(raw: string): unknown {
	if (!raw) {
		return null
	}

	try {
		return JSON.parse(raw)
	} catch {
		return raw
	}
}

export function buildBasicAuthHeader(username: string, password: string) {
	const token = Buffer.from(`${username}:${password}`).toString("base64")
	return `Basic ${token}`
}

export async function performTelephonyRequest(
	provider: TelephonyProvider,
	url: string,
	options: TelephonyRequestOptions
) {
	const controller = new AbortController()
	const timeoutMs = options.timeoutMs ?? 15_000
	const timeout = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		})
		const responseText = await response.text()
		const parsedBody = parseJsonIfPossible(responseText)

		if (!response.ok) {
			throw new TelephonyProviderError({
				provider,
				message: `${provider} request failed (${response.status})`,
				statusCode: response.status,
				retryable: inferRetryableStatus(response.status),
				details: parsedBody
			})
		}

		return parsedBody
	} catch (error) {
		if (error instanceof TelephonyProviderError) {
			throw error
		}

		if (error instanceof DOMException && error.name === "AbortError") {
			throw new TelephonyProviderError({
				provider,
				message: `${provider} request timed out`,
				retryable: true
			})
		}

		throw new TelephonyProviderError({
			provider,
			message:
				error instanceof Error
					? error.message
					: `${provider} request failed`,
			retryable: true
		})
	} finally {
		clearTimeout(timeout)
	}
}
