"use server"

import { currentUser } from "@clerk/nextjs/server"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db_ws as db } from "@/db"
import { phoneNumberUsage, phoneNumbers } from "@/db/schema"
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
