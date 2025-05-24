import { VapiClient } from "@vapi-ai/server-sdk"
import type {
	PhoneNumbersGetResponse,
	PhoneNumbersListResponseItem,
	PhoneNumbersCreateRequest,
	PhoneNumbersCreateResponse,
	PhoneNumbersUpdateRequest,
	PhoneNumbersUpdateResponse,
	TransferDestinationNumber,
	TransferDestinationSip,
	CreateVapiPhoneNumberDto,
	CreateTwilioPhoneNumberDto,
	CreateVonagePhoneNumberDto
} from "@vapi-ai/server-sdk/api"

// Environment variable access pattern for Cloudflare Workers + development
async function getEnvironmentVariables() {
	let publicKey: string | undefined
	let secretKey: string | undefined
	let endPoint: string | undefined

	// In development, prefer process.env directly
	if (process.env.NODE_ENV === "development") {
		publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
		secretKey = process.env.VAPI_SECRET_KEY
		endPoint =
			process.env.NEXT_PUBLIC_VAPI_ENDPOINT || "https://api.vapi.ai"
	} else {
		// Try to get from Cloudflare context first (for production)
		try {
			const { getCloudflareContext } = await import(
				"@opennextjs/cloudflare"
			)
			const { env } = getCloudflareContext()
			publicKey = env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
			secretKey = env.VAPI_SECRET_KEY
			endPoint = env.NEXT_PUBLIC_VAPI_ENDPOINT || "https://api.vapi.ai"
		} catch {
			// Fallback to process.env for development
			publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
			secretKey = process.env.VAPI_SECRET_KEY
			endPoint =
				process.env.NEXT_PUBLIC_VAPI_ENDPOINT || "https://api.vapi.ai"
		}
	}

	return { publicKey, secretKey, endPoint }
}

// Our simplified phone number interface for IcePhone
export interface IcePhoneNumber {
	id: string
	name: string
	phoneNumber: string
	provider: "vapi" | "twilio" | "vonage" | "byo-phone-number" | "telnyx"
	fallbackDestination?: {
		type: "number" | "sip"
		value: string
	}
	createdAt: string
	updatedAt: string
	status?: string
}

// Helper function to extract phone number from different provider types
function getPhoneNumberFromVapiResponse(
	response: PhoneNumbersListResponseItem | PhoneNumbersGetResponse
): string {
	// Different provider types have different property names for phone number
	if ("number" in response && response.number) {
		return response.number
	}
	// For BYO phone numbers, might not have a number field
	return `${response.provider}-${response.id}`
}

// Helper function to convert Vapi transfer destination to our format
function convertFallbackDestination(
	fallbackDestination:
		| TransferDestinationNumber
		| TransferDestinationSip
		| undefined
): { type: "number" | "sip"; value: string } | undefined {
	if (!fallbackDestination) return undefined

	if (fallbackDestination.type === "number") {
		return {
			type: "number",
			value: fallbackDestination.number
		}
	}

	if (fallbackDestination.type === "sip") {
		return {
			type: "sip",
			value: fallbackDestination.sipUri
		}
	}

	return undefined
}

// Helper function to convert our format to Vapi transfer destination
function convertToVapiFallbackDestination(
	fallbackDestination: { type: "number" | "sip"; value: string } | undefined
): TransferDestinationNumber | TransferDestinationSip | undefined {
	if (!fallbackDestination) return undefined

	if (fallbackDestination.type === "number") {
		return {
			type: "number",
			number: fallbackDestination.value
		}
	}

	if (fallbackDestination.type === "sip") {
		return {
			type: "sip",
			sipUri: fallbackDestination.value
		}
	}

	return undefined
}

// Helper function to convert Vapi response to our format
function convertVapiResponseToIcePhone(
	response: PhoneNumbersListResponseItem | PhoneNumbersGetResponse
): IcePhoneNumber {
	return {
		id: response.id,
		name: response.name || getPhoneNumberFromVapiResponse(response),
		phoneNumber: getPhoneNumberFromVapiResponse(response),
		provider: response.provider,
		fallbackDestination: convertFallbackDestination(
			response.fallbackDestination
		),
		createdAt: response.createdAt,
		updatedAt: response.updatedAt,
		status: response.status || undefined
	}
}

// Purchase request types
export interface IcePhoneNumberPurchaseRequest {
	areaCode?: string
	provider: "twilio" | "vonage" | "vapi"
	name?: string
	fallbackDestination?: {
		type: "number" | "sip"
		value: string
	}
}

/**
 * Vapi Phone Number API Client
 * Handles all phone number operations with Vapi API
 */
export class VapiPhoneClient {
	private static instance: VapiPhoneClient
	private vapiClient: VapiClient | null = null

	private constructor() {}

	static getInstance(): VapiPhoneClient {
		if (!VapiPhoneClient.instance) {
			VapiPhoneClient.instance = new VapiPhoneClient()
		}
		return VapiPhoneClient.instance
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
	 * List all available phone numbers from Vapi
	 */
	async listPhoneNumbers(): Promise<IcePhoneNumber[]> {
		try {
			const vapi = await this.initializeVapiClient()

			// Get phone numbers from Vapi API
			const response = await vapi.phoneNumbers.list({
				limit: 100 // Get up to 100 phone numbers
			})

			// Transform Vapi response to our format
			return response.map(convertVapiResponseToIcePhone)
		} catch (error) {
			console.error("Error fetching Vapi phone numbers:", error)
			throw new Error("Failed to fetch phone numbers from Vapi")
		}
	}

	/**
	 * Get details of a specific phone number
	 */
	async getPhoneNumber(phoneNumberId: string): Promise<IcePhoneNumber> {
		try {
			const vapi = await this.initializeVapiClient()

			const phoneNumber = await vapi.phoneNumbers.get(phoneNumberId)

			return convertVapiResponseToIcePhone(phoneNumber)
		} catch (error) {
			console.error("Error fetching Vapi phone number details:", error)
			throw new Error("Failed to fetch phone number details from Vapi")
		}
	}

	/**
	 * Purchase a new phone number through Vapi
	 */
	async purchasePhoneNumber(
		request: IcePhoneNumberPurchaseRequest
	): Promise<IcePhoneNumber> {
		try {
			const vapi = await this.initializeVapiClient()

			// Build provider-specific create request
			let createRequest: PhoneNumbersCreateRequest

			const fallbackDestination = convertToVapiFallbackDestination(
				request.fallbackDestination
			)

			if (request.provider === "vapi") {
				createRequest = {
					provider: "vapi",
					name: request.name,
					fallbackDestination,
					...(request.areaCode && {
						numberDesiredAreaCode: request.areaCode
					})
				} as CreateVapiPhoneNumberDto
			} else if (request.provider === "twilio") {
				createRequest = {
					provider: "twilio",
					name: request.name,
					fallbackDestination
					// Add other Twilio-specific fields as needed
				} as CreateTwilioPhoneNumberDto
			} else if (request.provider === "vonage") {
				createRequest = {
					provider: "vonage",
					name: request.name,
					fallbackDestination
					// Add other Vonage-specific fields as needed
				} as CreateVonagePhoneNumberDto
			} else {
				throw new Error(`Unsupported provider: ${request.provider}`)
			}

			const phoneNumber = await vapi.phoneNumbers.create(createRequest)

			return convertVapiResponseToIcePhone(phoneNumber)
		} catch (error) {
			console.error("Error purchasing phone number:", error)
			throw new Error("Failed to purchase phone number through Vapi")
		}
	}

	/**
	 * Update a phone number configuration
	 */
	async updatePhoneNumber(
		phoneNumberId: string,
		updates: Partial<Pick<IcePhoneNumber, "name" | "fallbackDestination">>
	): Promise<IcePhoneNumber> {
		try {
			const vapi = await this.initializeVapiClient()

			const updateRequest: PhoneNumbersUpdateRequest = {
				name: updates.name,
				fallbackDestination: convertToVapiFallbackDestination(
					updates.fallbackDestination
				)
			}

			const phoneNumber = await vapi.phoneNumbers.update(
				phoneNumberId,
				updateRequest
			)

			return convertVapiResponseToIcePhone(phoneNumber)
		} catch (error) {
			console.error("Error updating phone number:", error)
			throw new Error("Failed to update phone number configuration")
		}
	}

	/**
	 * Delete a phone number
	 */
	async deletePhoneNumber(phoneNumberId: string): Promise<void> {
		try {
			const vapi = await this.initializeVapiClient()

			await vapi.phoneNumbers.delete(phoneNumberId)
		} catch (error) {
			console.error("Error deleting phone number:", error)
			throw new Error("Failed to delete phone number")
		}
	}

	/**
	 * Health check for Vapi connection
	 */
	async healthCheck(): Promise<{
		status: "healthy" | "degraded" | "down"
		details: string
		lastChecked: Date
	}> {
		try {
			const vapi = await this.initializeVapiClient()

			// Try to list phone numbers as a health check
			await vapi.phoneNumbers.list({ limit: 1 })

			return {
				status: "healthy",
				details: "Successfully connected to Vapi API",
				lastChecked: new Date()
			}
		} catch (error) {
			return {
				status: "down",
				details: `Vapi health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				lastChecked: new Date()
			}
		}
	}
}

// Export singleton instance
export const vapiPhoneClient = VapiPhoneClient.getInstance()
