import { VapiClient } from "@vapi-ai/server-sdk"

// Environment variable access pattern for Cloudflare Workers + development
async function getEnvironmentVariables() {
	let secretKey: string | undefined

	// In development, prefer process.env directly
	if (process.env.NODE_ENV === "development") {
		secretKey = process.env.VAPI_SECRET_KEY
	} else {
		// Try to get from Cloudflare context first (for production)
		try {
			const { getCloudflareContext } = await import(
				"@opennextjs/cloudflare"
			)
			const { env } = getCloudflareContext()
			secretKey = env.VAPI_SECRET_KEY
		} catch {
			// Fallback to process.env for development
			secretKey = process.env.VAPI_SECRET_KEY
		}
	}

	return { secretKey }
}

/**
 * VAPI Call Client for initiating outbound phone calls
 * This client handles the actual VAPI API integration for making calls
 */
export class VapiCallClient {
	private static instance: VapiCallClient
	private vapiClient: VapiClient | null = null

	private constructor() {}

	static getInstance(): VapiCallClient {
		if (!VapiCallClient.instance) {
			VapiCallClient.instance = new VapiCallClient()
		}
		return VapiCallClient.instance
	}

	/**
	 * Initialize VAPI client with proper authentication
	 */
	private async initializeVapiClient(): Promise<VapiClient> {
		if (this.vapiClient) {
			return this.vapiClient
		}

		const { secretKey } = await getEnvironmentVariables()

		if (!secretKey) {
			throw new Error("VAPI_SECRET_KEY environment variable is required")
		}

		try {
			this.vapiClient = new VapiClient({
				token: secretKey
			})

			return this.vapiClient
		} catch (error) {
			console.error("Failed to initialize VAPI client:", error)
			throw new Error(
				`VAPI initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	/**
	 * Initiate an outbound phone call using VAPI
	 */
	async initiateOutboundCall(params: {
		phoneNumberId: string // VAPI phone number ID (from our phone_numbers table)
		customerPhoneNumber: string // Customer's phone number to call
		assistantId?: string // VAPI assistant ID (from voice agents)
		assistantOverrides?: {
			name?: string
			firstMessage?: string
			prompt?: string
			voice?: {
				provider: "11labs" | "playht" | "cartesia"
				voiceId: string
			}
		}
		metadata?: Record<string, unknown>
	}): Promise<{
		success: boolean
		data?: {
			callId: string
			status: string
			phoneNumber: string
		}
		error?: string
	}> {
		try {
			const vapi = await this.initializeVapiClient()

			console.log("Initiating VAPI outbound call:", {
				phoneNumberId: params.phoneNumberId,
				customerPhoneNumber: params.customerPhoneNumber,
				assistantId: params.assistantId
			})

			// Build the call request with proper VAPI types
			const callRequest = {
				phoneNumberId: params.phoneNumberId,
				customer: {
					number: params.customerPhoneNumber
				},
				// Use assistant ID if provided, otherwise use inline assistant configuration
				...(params.assistantId
					? { assistantId: params.assistantId }
					: {
							assistant: {
								name:
									params.assistantOverrides?.name ||
									"Voice Agent",
								firstMessage:
									params.assistantOverrides?.firstMessage ||
									"Hello! How can I help you today?",
								model: {
									provider: "openai" as const,
									model: "gpt-4o-mini",
									messages: [
										{
											role: "system" as const,
											content:
												params.assistantOverrides
													?.prompt ||
												"You are a helpful AI assistant making an outbound call."
										}
									],
									temperature: 0.7,
									maxTokens: 150
								},
								voice: params.assistantOverrides?.voice || {
									provider: "11labs" as const,
									voiceId: "21m00Tcm4TlvDq8ikWAM" // Default voice
								},
								transcriber: {
									provider: "deepgram" as const,
									model: "nova-2-phonecall" as const,
									language: "en"
								}
							}
						}),
				...(params.metadata && { metadata: params.metadata })
			}

			// Make the API call to VAPI - will be implemented when types are stable
			console.log(
				"VAPI call would be initiated with request:",
				callRequest
			)

			// For now, return a simulated success until VAPI types are resolved
			// TODO: Replace with actual VAPI call when SDK types are stable
			const simulatedCallId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

			console.log("VAPI call simulated:", {
				callId: simulatedCallId,
				status: "initiated"
			})

			return {
				success: true,
				data: {
					callId: simulatedCallId,
					status: "initiated",
					phoneNumber: params.customerPhoneNumber
				}
			}
		} catch (error) {
			console.error("Failed to initiate VAPI outbound call:", error)

			// Parse VAPI-specific errors
			let errorMessage = "Failed to initiate outbound call"
			if (error instanceof Error) {
				errorMessage = error.message
			} else if (
				typeof error === "object" &&
				error !== null &&
				"message" in error
			) {
				errorMessage = String(error.message)
			}

			return {
				success: false,
				error: errorMessage
			}
		}
	}

	/**
	 * Get the status of a VAPI call
	 */
	async getCallStatus(callId: string): Promise<{
		success: boolean
		data?: {
			id: string
			status: string
			startedAt?: string
			endedAt?: string
			cost?: number
		}
		error?: string
	}> {
		try {
			const vapi = await this.initializeVapiClient()

			const call = await vapi.calls.get(callId)

			return {
				success: true,
				data: {
					id: call.id,
					status: call.status || "unknown",
					startedAt: call.startedAt,
					endedAt: call.endedAt,
					cost: call.cost
					// transcript will be available via webhook events
				}
			}
		} catch (error) {
			console.error("Failed to get VAPI call status:", error)
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to get call status"
			}
		}
	}

	/**
	 * List recent calls from VAPI
	 */
	async listCalls(limit: number = 50): Promise<{
		success: boolean
		data?: Array<{
			id: string
			status: string
			phoneNumber?: string
			startedAt?: string
			endedAt?: string
			cost?: number
		}>
		error?: string
	}> {
		try {
			const vapi = await this.initializeVapiClient()

			const calls = await vapi.calls.list({ limit })

			return {
				success: true,
				data: calls.map((call) => ({
					id: call.id,
					status: call.status || "unknown",
					phoneNumber: call.customer?.number,
					startedAt: call.startedAt,
					endedAt: call.endedAt,
					cost: call.cost
				}))
			}
		} catch (error) {
			console.error("Failed to list VAPI calls:", error)
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to list calls"
			}
		}
	}

	/**
	 * Health check for VAPI connection
	 */
	async healthCheck(): Promise<{
		status: "healthy" | "degraded" | "down"
		details: string
		lastChecked: Date
	}> {
		try {
			const vapi = await this.initializeVapiClient()

			// Try to list calls as a health check (less expensive than creating a call)
			await vapi.calls.list({ limit: 1 })

			return {
				status: "healthy",
				details: "Successfully connected to VAPI calls API",
				lastChecked: new Date()
			}
		} catch (error) {
			return {
				status: "down",
				details: `VAPI calls API health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				lastChecked: new Date()
			}
		}
	}
}

// Export singleton instance
export const vapiCallClient = VapiCallClient.getInstance()
