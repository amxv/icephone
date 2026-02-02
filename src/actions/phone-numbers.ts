"use server"

import { currentUser } from "@clerk/nextjs/server"
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db_ws as db } from "@/db"
import { phoneNumberUsage, phoneNumbers, calls } from "@/db/schema"
import { vapiPhoneClient } from "@/lib/vapi-phone-client"
import type {
	PhoneNumber,
	PhoneNumberCapabilities,
	PhoneNumberConfiguration,
	PhoneNumberCreateRequest,
	PhoneNumberStatus,
	PhoneNumberType,
	PhoneNumberUpdateRequest,
	PhoneNumberUsage
} from "@/types"

// Export PhoneNumber type for use in other components
export type { PhoneNumber }

// Database return types (with possible null values)
type DbPhoneNumber = {
	id: number
	number: string
	friendlyName: string
	type: PhoneNumberType
	status: PhoneNumberStatus | null
	isDefault: boolean | null
	provider: string | null
	providerSid: string | null
	capabilities: PhoneNumberCapabilities | null
	configuration: PhoneNumberConfiguration | null
	costPerMinute: string | null
	createdAt: Date
	updatedAt: Date
	userId: string
}

type DbPhoneNumberUsage = {
	id: number
	phoneNumberId: number
	date: string | Date
	inboundCalls: number | null
	outboundCalls: number | null
	totalMinutes: number | null
	totalCost: string | null
	createdAt: Date
	userId: string
}

// Helper function to normalize phone number data from database
function normalizePhoneNumber(dbNumber: DbPhoneNumber): PhoneNumber {
	return {
		...dbNumber,
		status: dbNumber.status || "active",
		isDefault: dbNumber.isDefault || false,
		capabilities: dbNumber.capabilities || {
			voice: true,
			sms: false,
			mms: false,
			fax: false
		},
		configuration: dbNumber.configuration || {},
		costPerMinute: dbNumber.costPerMinute || "0.0000"
	}
}

// Helper function to normalize phone number usage data from database
function normalizePhoneNumberUsage(
	dbUsage: DbPhoneNumberUsage
): PhoneNumberUsage {
	return {
		...dbUsage,
		inboundCalls: dbUsage.inboundCalls || 0,
		outboundCalls: dbUsage.outboundCalls || 0,
		totalMinutes: dbUsage.totalMinutes || 0,
		totalCost: dbUsage.totalCost || "0.0000"
	} as PhoneNumberUsage
}

// Validation schemas
const phoneNumberCreateSchema = z.object({
	number: z
		.string()
		.regex(/^\+[1-9]\d{1,14}$/, "Invalid E.164 phone number format"),
	friendlyName: z.string().min(1, "Friendly name is required").max(255),
	type: z.enum(["inbound", "outbound", "both"]),
	status: z.enum(["active", "inactive", "pending", "suspended"]).optional(),
	isDefault: z.boolean().optional(),
	provider: z.string().max(100).optional(),
	providerSid: z.string().max(255).optional(),
	capabilities: z
		.object({
			voice: z.boolean(),
			sms: z.boolean(),
			mms: z.boolean(),
			fax: z.boolean()
		})
		.optional(),
	configuration: z
		.object({
			routingRules: z
				.object({
					businessHours: z
						.object({
							enabled: z.boolean(),
							timezone: z.string(),
							schedule: z.record(
								z.string(),
								z
									.object({
										start: z.string(),
										end: z.string()
									})
									.nullable()
							)
						})
						.optional(),
					voicemail: z
						.object({
							enabled: z.boolean(),
							greeting: z.string()
						})
						.optional(),
					fallback: z
						.object({
							enabled: z.boolean(),
							forwardTo: z.string()
						})
						.optional()
				})
				.optional(),
			callerIdName: z.string().optional(),
			recordCalls: z.boolean().optional()
		})
		.optional(),
	costPerMinute: z
		.string()
		.regex(/^\d+(\.\d{1,4})?$/, "Invalid cost format")
		.optional()
})

const phoneNumberUpdateSchema = z.object({
	friendlyName: z.string().min(1).max(255).optional(),
	type: z.enum(["inbound", "outbound", "both"]).optional(),
	status: z.enum(["active", "inactive", "pending", "suspended"]).optional(),
	isDefault: z.boolean().optional(),
	configuration: z
		.object({
			routingRules: z
				.object({
					businessHours: z
						.object({
							enabled: z.boolean(),
							timezone: z.string(),
							schedule: z.record(
								z.string(),
								z
									.object({
										start: z.string(),
										end: z.string()
									})
									.nullable()
							)
						})
						.optional(),
					voicemail: z
						.object({
							enabled: z.boolean(),
							greeting: z.string()
						})
						.optional(),
					fallback: z
						.object({
							enabled: z.boolean(),
							forwardTo: z.string()
						})
						.optional()
				})
				.optional(),
			callerIdName: z.string().optional(),
			recordCalls: z.boolean().optional()
		})
		.optional(),
	costPerMinute: z
		.string()
		.regex(/^\d+(\.\d{1,4})?$/, "Invalid cost format")
		.optional()
})

/**
 * Get all phone numbers for the current user
 */
export async function getPhoneNumbers(): Promise<PhoneNumber[]> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	try {
		const numbers = await db.query.phoneNumbers.findMany({
			where: eq(phoneNumbers.userId, user.id),
			orderBy: [
				desc(phoneNumbers.isDefault),
				asc(phoneNumbers.friendlyName)
			]
		})

		return numbers.map(normalizePhoneNumber)
	} catch (error) {
		console.error("Error fetching phone numbers:", error)
		throw new Error("Failed to fetch phone numbers")
	}
}

/**
 * Get a specific phone number by ID
 */
export async function getPhoneNumberById(
	id: number
): Promise<PhoneNumber | null> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	try {
		const number = await db.query.phoneNumbers.findFirst({
			where: and(
				eq(phoneNumbers.id, id),
				eq(phoneNumbers.userId, user.id)
			)
		})

		if (!number) {
			return null
		}

		return normalizePhoneNumber(number)
	} catch (error) {
		console.error("Error fetching phone number:", error)
		throw new Error("Failed to fetch phone number")
	}
}

/**
 * Create a new phone number
 */
export async function createPhoneNumber(
	data: PhoneNumberCreateRequest
): Promise<PhoneNumber> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	// Validate input
	const validated = phoneNumberCreateSchema.parse(data)

	try {
		// Check if number already exists
		const existingNumber = await db.query.phoneNumbers.findFirst({
			where: eq(phoneNumbers.number, validated.number)
		})

		if (existingNumber) {
			throw new Error("Phone number already exists")
		}

		// If this is being set as default, unset any existing default for the same type
		if (validated.isDefault) {
			await db
				.update(phoneNumbers)
				.set({ isDefault: false })
				.where(
					and(
						eq(phoneNumbers.userId, user.id),
						eq(phoneNumbers.type, validated.type)
					)
				)
		}

		// Create the phone number
		const [newNumber] = await db
			.insert(phoneNumbers)
			.values({
				...validated,
				userId: user.id,
				capabilities: validated.capabilities || {
					voice: true,
					sms: false,
					mms: false,
					fax: false
				},
				configuration: validated.configuration || {},
				costPerMinute: validated.costPerMinute || "0.0000"
			})
			.returning()

		revalidatePath("/phone-numbers")

		return normalizePhoneNumber(newNumber)
	} catch (error) {
		console.error("Error creating phone number:", error)
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to create phone number")
	}
}

/**
 * Update an existing phone number
 */
export async function updatePhoneNumber(
	id: number,
	data: PhoneNumberUpdateRequest
): Promise<PhoneNumber> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	// Validate input
	const validated = phoneNumberUpdateSchema.parse(data)

	try {
		// Check if phone number exists and belongs to user
		const existingNumber = await db.query.phoneNumbers.findFirst({
			where: and(
				eq(phoneNumbers.id, id),
				eq(phoneNumbers.userId, user.id)
			)
		})

		if (!existingNumber) {
			throw new Error("Phone number not found")
		}

		// If this is being set as default, unset any existing default for the same type
		if (validated.isDefault && validated.type) {
			await db
				.update(phoneNumbers)
				.set({ isDefault: false })
				.where(
					and(
						eq(phoneNumbers.userId, user.id),
						eq(phoneNumbers.type, validated.type)
					)
				)
		}

		// Update the phone number
		const [updatedNumber] = await db
			.update(phoneNumbers)
			.set({
				...validated,
				updatedAt: new Date()
			})
			.where(
				and(eq(phoneNumbers.id, id), eq(phoneNumbers.userId, user.id))
			)
			.returning()

		revalidatePath("/phone-numbers")

		return normalizePhoneNumber(updatedNumber)
	} catch (error) {
		console.error("Error updating phone number:", error)
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to update phone number")
	}
}

/**
 * Delete a phone number
 */
export async function deletePhoneNumber(id: number): Promise<void> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	try {
		// Check if phone number exists and belongs to user
		const existingNumber = await db.query.phoneNumbers.findFirst({
			where: and(
				eq(phoneNumbers.id, id),
				eq(phoneNumbers.userId, user.id)
			)
		})

		if (!existingNumber) {
			throw new Error("Phone number not found")
		}

		// Delete the phone number (cascade will handle usage records)
		await db
			.delete(phoneNumbers)
			.where(
				and(eq(phoneNumbers.id, id), eq(phoneNumbers.userId, user.id))
			)

		revalidatePath("/phone-numbers")
	} catch (error) {
		console.error("Error deleting phone number:", error)
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to delete phone number")
	}
}

/**
 * Set a phone number as the default for its type
 */
export async function setDefaultPhoneNumber(id: number): Promise<PhoneNumber> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	try {
		// Get the phone number to determine its type
		const phoneNumber = await db.query.phoneNumbers.findFirst({
			where: and(
				eq(phoneNumbers.id, id),
				eq(phoneNumbers.userId, user.id)
			)
		})

		if (!phoneNumber) {
			throw new Error("Phone number not found")
		}

		// Unset any existing default for this type
		await db
			.update(phoneNumbers)
			.set({ isDefault: false })
			.where(
				and(
					eq(phoneNumbers.userId, user.id),
					eq(phoneNumbers.type, phoneNumber.type)
				)
			)

		// Set this number as default
		const [updatedNumber] = await db
			.update(phoneNumbers)
			.set({
				isDefault: true,
				updatedAt: new Date()
			})
			.where(
				and(eq(phoneNumbers.id, id), eq(phoneNumbers.userId, user.id))
			)
			.returning()

		revalidatePath("/phone-numbers")

		return normalizePhoneNumber(updatedNumber)
	} catch (error) {
		console.error("Error setting default phone number:", error)
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to set default phone number")
	}
}

/**
 * Validate phone number format (E.164)
 */
export async function validatePhoneNumber(
	number: string
): Promise<{ valid: boolean; formatted?: string; error?: string }> {
	try {
		// Basic E.164 validation
		const e164Regex = /^\+[1-9]\d{1,14}$/

		if (!e164Regex.test(number)) {
			return {
				valid: false,
				error: "Phone number must be in E.164 format (e.g., +1234567890)"
			}
		}

		// Check if number already exists
		const existingNumber = await db.query.phoneNumbers.findFirst({
			where: eq(phoneNumbers.number, number)
		})

		if (existingNumber) {
			return {
				valid: false,
				error: "Phone number already exists in the system"
			}
		}

		return {
			valid: true,
			formatted: number
		}
	} catch (error) {
		console.error("Error validating phone number:", error)
		return {
			valid: false,
			error: "Failed to validate phone number"
		}
	}
}

/**
 * Get phone number usage statistics for a specific number
 */
export async function getPhoneNumberUsage(
	phoneNumberId: number,
	startDate?: string,
	endDate?: string
): Promise<PhoneNumberUsage[]> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	try {
		// Verify phone number belongs to user
		const phoneNumber = await db.query.phoneNumbers.findFirst({
			where: and(
				eq(phoneNumbers.id, phoneNumberId),
				eq(phoneNumbers.userId, user.id)
			)
		})

		if (!phoneNumber) {
			throw new Error("Phone number not found")
		}

		// Build query conditions
		const conditions = [
			eq(phoneNumberUsage.phoneNumberId, phoneNumberId),
			eq(phoneNumberUsage.userId, user.id)
		]

		// Add date range filters if provided
		if (startDate) {
			conditions.push(eq(phoneNumberUsage.date, startDate)) // Simplified for now
		}

		const usage = await db.query.phoneNumberUsage.findMany({
			where: and(...conditions),
			orderBy: desc(phoneNumberUsage.date)
		})

		return usage.map(normalizePhoneNumberUsage)
	} catch (error) {
		console.error("Error fetching phone number usage:", error)
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to fetch phone number usage")
	}
}

/**
 * Get cost breakdown for all phone numbers in a date range
 */
export async function getPhoneNumberCosts(
	startDate?: string,
	endDate?: string
): Promise<{
	totalCost: string
	breakdown: Array<{
		phoneNumberId: number
		phoneNumber: string
		friendlyName: string
		totalCost: string
		totalMinutes: number
		inboundCalls: number
		outboundCalls: number
	}>
}> {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	try {
		// Get all user's phone numbers
		const userPhoneNumbers = await db.query.phoneNumbers.findMany({
			where: eq(phoneNumbers.userId, user.id)
		})

		// Get usage data (simplified query for now)
		const allUsage = await db.query.phoneNumberUsage.findMany({
			where: eq(phoneNumberUsage.userId, user.id),
			orderBy: desc(phoneNumberUsage.date)
		})

		// Calculate breakdown
		const breakdown = userPhoneNumbers.map((phone) => {
			const phoneUsage = allUsage.filter(
				(usage) => usage.phoneNumberId === phone.id
			)

			const totalCost = phoneUsage.reduce((sum, usage) => {
				return sum + Number.parseFloat(usage.totalCost || "0")
			}, 0)

			const totalMinutes = phoneUsage.reduce(
				(sum, usage) => sum + (usage.totalMinutes || 0),
				0
			)
			const inboundCalls = phoneUsage.reduce(
				(sum, usage) => sum + (usage.inboundCalls || 0),
				0
			)
			const outboundCalls = phoneUsage.reduce(
				(sum, usage) => sum + (usage.outboundCalls || 0),
				0
			)

			return {
				phoneNumberId: phone.id,
				phoneNumber: phone.number,
				friendlyName: phone.friendlyName,
				totalCost: totalCost.toFixed(4),
				totalMinutes,
				inboundCalls,
				outboundCalls
			}
		})

		const totalCost = breakdown.reduce(
			(sum, item) => sum + Number.parseFloat(item.totalCost),
			0
		)

		return {
			totalCost: totalCost.toFixed(4),
			breakdown
		}
	} catch (error) {
		console.error("Error fetching phone number costs:", error)
		throw new Error("Failed to fetch phone number costs")
	}
}

// Sync phone number status with VAPI
export async function syncVapiPhoneStatus(phoneNumberId: number) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Get the phone number from our database
		const [phoneNumber] = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.id, phoneNumberId),
					eq(phoneNumbers.userId, user.id)
				)
			)
			.limit(1)

		if (!phoneNumber) {
			throw new Error("Phone number not found")
		}

		if (phoneNumber.provider !== "vapi" || !phoneNumber.providerSid) {
			throw new Error("Phone number is not managed by VAPI")
		}

		// Get fresh data from VAPI
		const vapiPhoneNumber = await vapiPhoneClient.getPhoneNumber(
			phoneNumber.providerSid
		)

		// Update our database with fresh VAPI data
		const [updatedNumber] = await db
			.update(phoneNumbers)
			.set({
				friendlyName: vapiPhoneNumber.name,
				status:
					vapiPhoneNumber.status === "active" ? "active" : "inactive",
				configuration: {
					routingRules: {
						fallback: vapiPhoneNumber.fallbackDestination
							? {
									enabled: true,
									forwardTo:
										vapiPhoneNumber.fallbackDestination
											.value
								}
							: undefined
					}
				},
				updatedAt: new Date()
			})
			.where(eq(phoneNumbers.id, phoneNumberId))
			.returning()

		revalidatePath("/phone-numbers")
		return { success: true, phoneNumber: updatedNumber }
	} catch (error) {
		console.error("Error syncing with VAPI:", error)
		throw new Error("Failed to sync phone number status with VAPI")
	}
}

// Test VAPI connectivity for a phone number
export async function testVapiPhoneConnectivity(phoneNumberId: number) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Get the phone number from our database
		const [phoneNumber] = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.id, phoneNumberId),
					eq(phoneNumbers.userId, user.id)
				)
			)
			.limit(1)

		if (!phoneNumber) {
			throw new Error("Phone number not found")
		}

		if (phoneNumber.provider !== "vapi" || !phoneNumber.providerSid) {
			throw new Error("Phone number is not managed by VAPI")
		}

		// Test VAPI connectivity by fetching phone number details
		const vapiPhoneNumber = await vapiPhoneClient.getPhoneNumber(
			phoneNumber.providerSid
		)

		// Test health check
		const healthCheck = await vapiPhoneClient.healthCheck()

		return {
			success: true,
			connectivity: {
				phoneNumber: vapiPhoneNumber.phoneNumber,
				status: vapiPhoneNumber.status,
				provider: vapiPhoneNumber.provider,
				lastChecked: new Date().toISOString()
			},
			vapiHealth: healthCheck
		}
	} catch (error) {
		console.error("Error testing VAPI connectivity:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		}
	}
}

// Get VAPI phone number pricing (derived from typical provider rates)
export async function getVapiPhoneNumberPricing(
	country = "US",
	type = "local"
) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// VAPI doesn't expose specific pricing API endpoints, but we can provide
		// typical pricing based on common provider rates (Twilio, Vonage, etc.)
		// These are approximate rates that VAPI might charge through providers
		const pricingTables = {
			US: {
				local: {
					setupCost: "$1.00",
					monthlyCost: "$1.15",
					perMinuteCost: "$0.012",
					currency: "USD"
				},
				"toll-free": {
					setupCost: "$2.00",
					monthlyCost: "$2.00",
					perMinuteCost: "$0.022",
					currency: "USD"
				}
			},
			CA: {
				local: {
					setupCost: "$1.00",
					monthlyCost: "$1.15",
					perMinuteCost: "$0.012",
					currency: "USD"
				},
				"toll-free": {
					setupCost: "$2.00",
					monthlyCost: "$2.00",
					perMinuteCost: "$0.022",
					currency: "USD"
				}
			},
			GB: {
				local: {
					setupCost: "$1.50",
					monthlyCost: "$1.50",
					perMinuteCost: "$0.015",
					currency: "USD"
				},
				"toll-free": {
					setupCost: "$3.00",
					monthlyCost: "$3.00",
					perMinuteCost: "$0.025",
					currency: "USD"
				}
			}
		}

		const countryPricing =
			pricingTables[country as keyof typeof pricingTables] ||
			pricingTables.US
		const typePricing =
			countryPricing[type as keyof typeof countryPricing] ||
			countryPricing.local

		return {
			success: true,
			pricing: {
				country,
				type,
				...typePricing,
				note: "Pricing estimates based on typical provider rates. Actual costs may vary."
			}
		}
	} catch (error) {
		console.error("Error getting VAPI pricing:", error)
		throw new Error("Failed to get phone number pricing")
	}
}

// Get VAPI provider capabilities (based on real VAPI features)
export async function getVapiProviderCapabilities() {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Test VAPI health to ensure service is available
		const healthCheck = await vapiPhoneClient.healthCheck()

		// Get current VAPI phone numbers to understand supported providers
		const availableNumbers = await vapiPhoneClient.listPhoneNumbers()

		// Extract unique providers from available numbers
		const supportedProviders = [
			...new Set(availableNumbers.map((num) => num.provider))
		]

		// VAPI capabilities based on actual platform features
		const capabilities = {
			providers:
				supportedProviders.length > 0
					? supportedProviders
					: ["vapi", "twilio", "vonage", "telnyx"],
			features: {
				voice: true, // VAPI's core feature
				sms: false, // VAPI focuses on voice
				mms: false,
				fax: false,
				recording: true, // VAPI supports call recording
				transcription: true, // Real-time transcription
				sentiment: true, // AI analysis capabilities
				voiceAgents: true, // AI voice agents
				realTimeProcessing: true, // Real-time voice processing
				webhooks: true, // Event notifications
				fallbackRouting: true, // Call forwarding/routing
				businessHours: true, // Conditional routing
				analytics: true // Call analytics and insights
			},
			regions: ["US", "CA", "GB", "AU", "EU"], // Common VAPI supported regions
			numberTypes: ["local", "toll-free"],
			vapiHealth: {
				status: healthCheck.status,
				lastChecked: healthCheck.lastChecked
			},
			currentInventory: {
				totalNumbers: availableNumbers.length,
				byProvider: supportedProviders.reduce(
					(acc, provider) => {
						acc[provider] = availableNumbers.filter(
							(num) => num.provider === provider
						).length
						return acc
					},
					{} as Record<string, number>
				)
			}
		}

		return {
			success: true,
			capabilities
		}
	} catch (error) {
		console.error("Error getting VAPI capabilities:", error)

		// Return fallback capabilities if VAPI is unavailable
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			capabilities: {
				providers: ["vapi", "twilio", "vonage", "telnyx"],
				features: {
					voice: true,
					sms: false,
					mms: false,
					fax: false,
					recording: true,
					transcription: true,
					sentiment: true,
					voiceAgents: true,
					realTimeProcessing: true,
					webhooks: true,
					fallbackRouting: true,
					businessHours: true,
					analytics: true
				},
				regions: ["US", "CA", "GB", "AU", "EU"],
				numberTypes: ["local", "toll-free"],
				vapiHealth: {
					status: "unknown" as const,
					lastChecked: new Date()
				}
			}
		}
	}
}

// Bulk sync all VAPI phone statuses for a user
export async function syncAllVapiPhoneStatuses(userId?: string) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	const targetUserId = userId || user.id

	try {
		// Get all VAPI phone numbers for the user
		const vapiNumbers = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.userId, targetUserId),
					eq(phoneNumbers.provider, "vapi"),
					isNotNull(phoneNumbers.providerSid)
				)
			)

		const syncResults = []

		for (const phoneNumber of vapiNumbers) {
			try {
				const result = await syncVapiPhoneStatus(phoneNumber.id)
				syncResults.push({
					phoneNumberId: phoneNumber.id,
					success: true,
					result
				})
			} catch (error) {
				syncResults.push({
					phoneNumberId: phoneNumber.id,
					success: false,
					error:
						error instanceof Error ? error.message : "Unknown error"
				})
			}
		}

		return {
			success: true,
			results: syncResults,
			summary: {
				total: vapiNumbers.length,
				successful: syncResults.filter((r) => r.success).length,
				failed: syncResults.filter((r) => !r.success).length
			}
		}
	} catch (error) {
		console.error("Error bulk syncing VAPI statuses:", error)
		throw new Error("Failed to bulk sync VAPI phone number statuses")
	}
}

// Transfer phone number between providers (Phase 5 missing function)
export async function transferVapiPhoneNumber(
	phoneNumberId: number,
	newProvider: "twilio" | "vonage" | "telnyx"
) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Get the phone number from database
		const phoneNumber = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.id, phoneNumberId),
					eq(phoneNumbers.userId, user.id)
				)
			)
			.limit(1)

		if (phoneNumber.length === 0) {
			throw new Error("Phone number not found")
		}

		const number = phoneNumber[0]

		if (!number.providerSid || number.provider !== "vapi") {
			throw new Error("Only VAPI phone numbers can be transferred")
		}

		// Note: VAPI doesn't currently support direct provider transfers
		// This would need to be implemented when VAPI adds this feature
		// For now, we'll return an informative error
		throw new Error(
			"Phone number transfer between providers is not yet available through VAPI. Please contact support for manual transfer assistance."
		)

		// Future implementation would look like:
		// 1. Request transfer through VAPI API
		// 2. Update database with new provider information
		// 3. Monitor transfer status
		// 4. Update phone number record when complete

	} catch (error) {
		console.error("Error transferring phone number:", error)
		throw new Error(
			error instanceof Error ? error.message : "Failed to transfer phone number"
		)
	}
}

// Get VAPI phone number usage statistics (Phase 5 missing function)
export async function getVapiPhoneUsageStats(
	phoneNumberId: number,
	dateRange: { startDate: string; endDate: string }
) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Get the phone number from database
		const phoneNumber = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.id, phoneNumberId),
					eq(phoneNumbers.userId, user.id)
				)
			)
			.limit(1)

		if (phoneNumber.length === 0) {
			throw new Error("Phone number not found")
		}

		const number = phoneNumber[0]

		if (!number.providerSid || number.provider !== "vapi") {
			throw new Error("Usage stats only available for VAPI phone numbers")
		}

		// Query usage data from database
		const usageData = await db
			.select()
			.from(phoneNumberUsage)
			.where(
				and(
					eq(phoneNumberUsage.phoneNumberId, phoneNumberId),
					eq(phoneNumberUsage.userId, user.id)
				)
			)
			.orderBy(desc(phoneNumberUsage.date))

		// Calculate statistics
		const totalInbound = usageData.reduce((sum, record) => sum + (record.inboundCalls || 0), 0)
		const totalOutbound = usageData.reduce((sum, record) => sum + (record.outboundCalls || 0), 0)
		const totalMinutes = usageData.reduce((sum, record) => sum + (record.totalMinutes || 0), 0)
		const totalCost = usageData.reduce((sum, record) => sum + parseFloat(record.totalCost || "0"), 0)

		// Get call analytics from calls table
		// Note: Current schema doesn't link calls directly to phone numbers
		// This is a placeholder implementation that would need proper schema enhancement
		const callAnalytics = await db
			.select({
				status: calls.status,
				duration: calls.duration,
				createdAt: calls.createdAt
			})
			.from(calls)
			.where(eq(calls.userId, user.id))

		// Calculate success rates and averages
		// Note: Status values may need adjustment based on actual schema
		const completedCalls = callAnalytics.filter(call => call.status === "completed" || call.status === "answered")
		const averageDuration = completedCalls.length > 0
			? completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / completedCalls.length
			: 0

		const successRate = callAnalytics.length > 0
			? (completedCalls.length / callAnalytics.length) * 100
			: 0

		return {
			success: true,
			phoneNumber: number.number,
			dateRange,
			usage: {
				totalCalls: totalInbound + totalOutbound,
				inboundCalls: totalInbound,
				outboundCalls: totalOutbound,
				totalMinutes,
				totalCost: totalCost.toFixed(4),
				averageDuration: Math.round(averageDuration),
				successRate: Math.round(successRate * 100) / 100
			},
			daily: usageData.map(record => ({
				date: record.date,
				inboundCalls: record.inboundCalls || 0,
				outboundCalls: record.outboundCalls || 0,
				totalMinutes: record.totalMinutes || 0,
				cost: record.totalCost || "0.0000"
			})),
			trends: {
				averageCallsPerDay: usageData.length > 0 ? (totalInbound + totalOutbound) / usageData.length : 0,
				peakUsageDay: usageData.reduce((peak, current) => {
					const currentTotal = (current.inboundCalls || 0) + (current.outboundCalls || 0)
					const peakTotal = (peak.inboundCalls || 0) + (peak.outboundCalls || 0)
					return currentTotal > peakTotal ? current : peak
				}, usageData[0] || {})
			}
		}
	} catch (error) {
		console.error("Error getting VAPI usage stats:", error)
		throw new Error(
			error instanceof Error ? error.message : "Failed to get usage statistics"
		)
	}
}

// Monitor VAPI phone number health (Phase 5 missing function)
export async function monitorVapiPhoneHealth() {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Get all VAPI phone numbers for the user
		const vapiNumbers = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.userId, user.id),
					eq(phoneNumbers.provider, "vapi"),
					isNotNull(phoneNumbers.providerSid)
				)
			)

		if (vapiNumbers.length === 0) {
			return {
				success: true,
				message: "No VAPI phone numbers to monitor",
				overall: "healthy" as const,
				numbers: []
			}
		}

		// Check VAPI service health
		const vapiHealth = await vapiPhoneClient.healthCheck()

		const healthResults = []
		let healthyCount = 0
		let totalNumbers = vapiNumbers.length

		// Check each phone number
		for (const phoneNumber of vapiNumbers) {
			try {
				// Test connectivity for each number
				const connectivity = await testVapiPhoneConnectivity(phoneNumber.id)

				const numberHealth = {
					phoneNumberId: phoneNumber.id,
					number: phoneNumber.number,
					friendlyName: phoneNumber.friendlyName,
					status: connectivity.success ? "healthy" : "degraded",
					lastChecked: new Date(),
					details: connectivity.success ? "Health check passed" : (connectivity.error || "Health check failed"),
					vapiId: phoneNumber.providerSid
				}

				if (connectivity.success) {
					healthyCount++
				}

				healthResults.push(numberHealth)
			} catch (error) {
				healthResults.push({
					phoneNumberId: phoneNumber.id,
					number: phoneNumber.number,
					friendlyName: phoneNumber.friendlyName,
					status: "down" as const,
					lastChecked: new Date(),
					details: error instanceof Error ? error.message : "Health check failed",
					vapiId: phoneNumber.providerSid
				})
			}
		}

		// Determine overall health
		let overall: "healthy" | "degraded" | "down"
		if (healthyCount === totalNumbers) {
			overall = "healthy"
		} else if (healthyCount > 0) {
			overall = "degraded"
		} else {
			overall = "down"
		}

		return {
			success: true,
			overall,
			vapiService: vapiHealth,
			summary: {
				total: totalNumbers,
				healthy: healthyCount,
				degraded: totalNumbers - healthyCount,
				down: healthResults.filter(r => r.status === "down").length
			},
			numbers: healthResults,
			recommendations: generateHealthRecommendations(healthResults, vapiHealth)
		}
	} catch (error) {
		console.error("Error monitoring VAPI health:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Health monitoring failed",
			overall: "down" as const,
			numbers: []
		}
	}
}

// Get VAPI call analytics for phone number (Phase 6 missing function)
export async function getVapiCallAnalytics(
	phoneNumberId: number,
	dateRange: { startDate: string; endDate: string }
) {
	const user = await currentUser()
	if (!user) throw new Error("Unauthorized")

	try {
		// Get the phone number from database
		const phoneNumber = await db
			.select()
			.from(phoneNumbers)
			.where(
				and(
					eq(phoneNumbers.id, phoneNumberId),
					eq(phoneNumbers.userId, user.id)
				)
			)
			.limit(1)

		if (phoneNumber.length === 0) {
			throw new Error("Phone number not found")
		}

		const number = phoneNumber[0]

		// Get call data from database
		// Note: Current schema doesn't link calls directly to phone numbers
		// This implementation gets all calls for the user as a placeholder
		const startDate = new Date(dateRange.startDate)
		const endDate = new Date(dateRange.endDate)

		const callsData = await db
			.select()
			.from(calls)
			.where(
				and(
					eq(calls.userId, user.id),
					sql`${calls.createdAt} >= ${startDate}`,
					sql`${calls.createdAt} <= ${endDate}`
				)
			)
			.orderBy(desc(calls.createdAt))

		// Calculate analytics
		const totalCalls = callsData.length
		const completedCalls = callsData.filter(call => call.status === "completed" || call.status === "answered")
		const failedCalls = callsData.filter(call => call.status === "failed" || call.status === "missed")
		const incomingCalls = callsData.filter(call => call.type === "incoming")
		const outgoingCalls = callsData.filter(call => call.type === "outgoing")

		const totalDuration = completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0)
		const averageDuration = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0

		// Note: Cost field doesn't exist in current schema
		const totalCost = 0
		const averageCost = 0

		// Calculate success rates
		const successRate = totalCalls > 0 ? (completedCalls.length / totalCalls) * 100 : 0
		const answerRate = incomingCalls.length > 0
			? (incomingCalls.filter(call => call.status === "completed" || call.status === "answered").length / incomingCalls.length) * 100
			: 0

		// Quality metrics (from transcripts/analysis)
		const callsWithTranscripts = callsData.filter(call => call.transcript)
		const averageTranscriptLength = callsWithTranscripts.length > 0
			? callsWithTranscripts.reduce((sum, call) => sum + (call.transcript?.length || 0), 0) / callsWithTranscripts.length
			: 0

		// Daily breakdown
		const dailyStats = callsData.reduce((acc, call) => {
			const date = call.createdAt.toISOString().split('T')[0]
			if (!acc[date]) {
				acc[date] = { date, total: 0, completed: 0, failed: 0, inbound: 0, outbound: 0, duration: 0, cost: 0 }
			}
			acc[date].total++
			if (call.status === "completed" || call.status === "answered") acc[date].completed++
			if (call.status === "failed" || call.status === "missed") acc[date].failed++
			if (call.type === "incoming") acc[date].inbound++
			if (call.type === "outgoing") acc[date].outbound++
			acc[date].duration += call.duration || 0
			// Note: Cost field doesn't exist in current schema
			acc[date].cost += 0
			return acc
		}, {} as Record<string, {
			date: string
			total: number
			completed: number
			failed: number
			inbound: number
			outbound: number
			duration: number
			cost: number
		}>)

		return {
			success: true,
			phoneNumber: number.number,
			dateRange,
			overview: {
				totalCalls,
				completedCalls: completedCalls.length,
				failedCalls: failedCalls.length,
				inboundCalls: incomingCalls.length,
				outboundCalls: outgoingCalls.length,
				totalDuration: Math.round(totalDuration),
				averageDuration: Math.round(averageDuration),
				totalCost: totalCost.toFixed(4),
				averageCost: averageCost.toFixed(4),
				successRate: Math.round(successRate * 100) / 100,
				answerRate: Math.round(answerRate * 100) / 100
			},
			quality: {
				callsWithTranscripts: callsWithTranscripts.length,
				transcriptCoverage: totalCalls > 0 ? (callsWithTranscripts.length / totalCalls) * 100 : 0,
				averageTranscriptLength: Math.round(averageTranscriptLength)
			},
			daily: Object.values(dailyStats),
			trends: {
				peakDay: Object.values(dailyStats).reduce((peak, current) =>
					current.total > peak.total ? current : peak,
					Object.values(dailyStats)[0] || {}
				),
				averageCallsPerDay: Object.keys(dailyStats).length > 0
					? totalCalls / Object.keys(dailyStats).length
					: 0
			}
		}
	} catch (error) {
		console.error("Error getting VAPI call analytics:", error)
		throw new Error(
			error instanceof Error ? error.message : "Failed to get call analytics"
		)
	}
}

// Helper function to generate health recommendations
function generateHealthRecommendations(
	healthResults: Array<{ status: string; details: string }>,
	vapiHealth: { status: string; details: string }
): string[] {
	const recommendations: string[] = []

	const downNumbers = healthResults.filter(r => r.status === "down")
	const degradedNumbers = healthResults.filter(r => r.status === "degraded")

	if (vapiHealth.status === "down") {
		recommendations.push("VAPI service is experiencing issues. Monitor service status and contact support if issues persist.")
	} else if (vapiHealth.status === "degraded") {
		recommendations.push("VAPI service is experiencing reduced performance. Consider implementing fallback routes.")
	}

	if (downNumbers.length > 0) {
		recommendations.push(`${downNumbers.length} phone number(s) are down. Check VAPI dashboard and verify number configuration.`)
	}

	if (degradedNumbers.length > 0) {
		recommendations.push(`${degradedNumbers.length} phone number(s) showing degraded performance. Consider syncing status or testing connectivity.`)
	}

	if (healthResults.length > 5 && downNumbers.length === 0 && degradedNumbers.length === 0) {
		recommendations.push("All phone numbers are healthy. Consider setting up automated monitoring for proactive issue detection.")
	}

	if (recommendations.length === 0) {
		recommendations.push("All systems operating normally. No action required.")
	}

	return recommendations
}
