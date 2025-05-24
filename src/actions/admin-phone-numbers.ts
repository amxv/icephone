"use server"

import { currentUser } from "@clerk/nextjs/server"
import { count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db_ws as db } from "@/db"
import { phoneNumbers } from "@/db/schema"
import { vapiPhoneClient } from "@/lib/vapi-phone-client"
import type { IcePhoneNumber } from "@/lib/vapi-phone-client"

// Admin check helper using proper Clerk API
async function requireAdmin() {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}

	// Check if user is admin using environment variable
	const adminUserId = process.env.OWNER_USER_ID
	if (!adminUserId || user.id !== adminUserId) {
		throw new Error("Admin access required")
	}

	return user
}

// Schema for admin phone number operations
const adminPhoneNumberSchema = z.object({
	number: z.string().min(1, "Phone number is required"),
	friendlyName: z.string().optional(),
	userId: z.string().min(1, "User ID is required"),
	providerSid: z.string().optional(),
	type: z.enum(["inbound", "outbound", "both"]).default("both"),
	status: z
		.enum(["active", "inactive", "pending", "suspended"])
		.default("active"),
	provider: z.string().optional(),
	capabilities: z
		.object({
			voice: z.boolean().default(true),
			sms: z.boolean().default(false),
			mms: z.boolean().default(false),
			fax: z.boolean().default(false)
		})
		.optional()
})

// Get all phone numbers across all users (admin only)
export async function getAllPhoneNumbers() {
	await requireAdmin()

	try {
		const numbers = await db
			.select()
			.from(phoneNumbers)
			.orderBy(desc(phoneNumbers.createdAt))

		return numbers
	} catch (error) {
		console.error("Error fetching all phone numbers:", error)
		throw new Error("Failed to fetch phone numbers")
	}
}

// Get phone numbers by user (admin only)
export async function getPhoneNumbersByUser(userId: string) {
	await requireAdmin()

	try {
		const numbers = await db
			.select()
			.from(phoneNumbers)
			.where(eq(phoneNumbers.userId, userId))
			.orderBy(desc(phoneNumbers.createdAt))

		return numbers
	} catch (error) {
		console.error("Error fetching phone numbers by user:", error)
		throw new Error("Failed to fetch user phone numbers")
	}
}

// Assign phone number to user (admin only)
export async function assignPhoneNumberToUser(
	phoneNumberId: number,
	userId: string
) {
	await requireAdmin()

	try {
		const [updatedNumber] = await db
			.update(phoneNumbers)
			.set({
				userId: userId,
				status: "active",
				updatedAt: new Date()
			})
			.where(eq(phoneNumbers.id, phoneNumberId))
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return updatedNumber
	} catch (error) {
		console.error("Error assigning phone number:", error)
		throw new Error("Failed to assign phone number")
	}
}

// Update phone number status (admin only)
export async function updatePhoneNumberStatus(
	phoneNumberId: number,
	status: "active" | "inactive" | "pending" | "suspended"
) {
	await requireAdmin()

	try {
		const [updatedNumber] = await db
			.update(phoneNumbers)
			.set({
				status: status,
				updatedAt: new Date()
			})
			.where(eq(phoneNumbers.id, phoneNumberId))
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return updatedNumber
	} catch (error) {
		console.error("Error updating phone number status:", error)
		throw new Error("Failed to update phone number status")
	}
}

// Import phone number from Vapi (admin only) - Now uses real Vapi API
export async function importPhoneNumberFromVapi(
	vapiPhoneNumberId: string,
	assignToUserId: string
) {
	await requireAdmin()

	try {
		// Check if already imported by provider SID
		const existing = await db
			.select()
			.from(phoneNumbers)
			.where(eq(phoneNumbers.providerSid, vapiPhoneNumberId))
			.limit(1)

		if (existing.length > 0) {
			throw new Error("Phone number already imported")
		}

		// Fetch phone number details from Vapi API
		const vapiPhoneNumber =
			await vapiPhoneClient.getPhoneNumber(vapiPhoneNumberId)

		// Create new phone number record with actual Vapi data
		const [newNumber] = await db
			.insert(phoneNumbers)
			.values({
				number: vapiPhoneNumber.phoneNumber,
				friendlyName:
					vapiPhoneNumber.name || vapiPhoneNumber.phoneNumber,
				type: "both",
				status: "active",
				provider: "vapi",
				providerSid: vapiPhoneNumber.id,
				userId: assignToUserId,
				capabilities: {
					voice: true,
					sms: false,
					mms: false,
					fax: false
				},
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
				costPerMinute: "0.0000"
			})
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return newNumber
	} catch (error) {
		console.error("Error importing phone number from Vapi:", error)
		throw new Error(
			`Failed to import phone number from Vapi: ${error instanceof Error ? error.message : "Unknown error"}`
		)
	}
}

// Get available Vapi phone numbers (admin only) - Now uses real Vapi API
export async function getAvailableVapiPhoneNumbers() {
	await requireAdmin()

	try {
		// Fetch phone numbers directly from Vapi API
		const vapiPhoneNumbers = await vapiPhoneClient.listPhoneNumbers()

		// Get already imported phone numbers from our database
		const importedNumbers = await db
			.select({ providerSid: phoneNumbers.providerSid })
			.from(phoneNumbers)
			.where(eq(phoneNumbers.provider, "vapi"))

		const importedSids = new Set(
			importedNumbers.map((n) => n.providerSid).filter(Boolean)
		)

		// Filter out already imported numbers and format for frontend
		const availableNumbers = vapiPhoneNumbers
			.filter((phone) => !importedSids.has(phone.id))
			.map((phone) => ({
				id: phone.id,
				name: phone.name,
				phoneNumber: phone.phoneNumber,
				provider: phone.provider,
				createdAt: phone.createdAt
			}))

		return availableNumbers
	} catch (error) {
		console.error("Error fetching Vapi phone numbers:", error)
		throw new Error(
			`Failed to fetch Vapi phone numbers: ${error instanceof Error ? error.message : "Unknown error"}`
		)
	}
}

// Import phone number from Vapi with enhanced details (admin only)
export async function importPhoneNumberFromVapiEnhanced(
	vapiPhoneNumber: {
		id: string
		name: string
		phoneNumber: string
	},
	assignToUserId: string
) {
	await requireAdmin()

	try {
		// Check if already imported by provider SID
		const existing = await db
			.select()
			.from(phoneNumbers)
			.where(eq(phoneNumbers.providerSid, vapiPhoneNumber.id))
			.limit(1)

		if (existing.length > 0) {
			throw new Error("Phone number already imported")
		}

		// Get full details from Vapi API
		const fullVapiDetails = await vapiPhoneClient.getPhoneNumber(
			vapiPhoneNumber.id
		)

		// Create new phone number record with actual Vapi data
		const [newNumber] = await db
			.insert(phoneNumbers)
			.values({
				number: fullVapiDetails.phoneNumber,
				friendlyName:
					fullVapiDetails.name || fullVapiDetails.phoneNumber,
				type: "both",
				status: "active",
				provider: "vapi",
				providerSid: fullVapiDetails.id,
				userId: assignToUserId,
				capabilities: {
					voice: true,
					sms: false,
					mms: false,
					fax: false
				},
				configuration: {
					routingRules: {
						fallback: fullVapiDetails.fallbackDestination
							? {
									enabled: true,
									forwardTo:
										fullVapiDetails.fallbackDestination
											.value
								}
							: undefined
					}
				},
				costPerMinute: "0.0000"
			})
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return newNumber
	} catch (error) {
		console.error("Error importing phone number from Vapi:", error)
		throw new Error("Failed to import phone number from Vapi")
	}
}

// Purchase a new phone number through Vapi (admin only)
export async function purchasePhoneNumberFromVapi(request: {
	areaCode?: string
	provider: "vapi" | "twilio" | "vonage"
	name?: string
	assignToUserId: string
}) {
	await requireAdmin()

	try {
		// Purchase phone number through Vapi API
		const purchasedNumber = await vapiPhoneClient.purchasePhoneNumber({
			areaCode: request.areaCode,
			provider: request.provider,
			name: request.name
		})

		// Import the purchased number to our database
		const [newNumber] = await db
			.insert(phoneNumbers)
			.values({
				number: purchasedNumber.phoneNumber,
				friendlyName:
					purchasedNumber.name || purchasedNumber.phoneNumber,
				type: "both",
				status: "active",
				provider: "vapi",
				providerSid: purchasedNumber.id,
				userId: request.assignToUserId,
				capabilities: {
					voice: true,
					sms: false,
					mms: false,
					fax: false
				},
				configuration: {
					routingRules: {
						fallback: purchasedNumber.fallbackDestination
							? {
									enabled: true,
									forwardTo:
										purchasedNumber.fallbackDestination
											.value
								}
							: undefined
					}
				},
				costPerMinute: "0.0000"
			})
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return newNumber
	} catch (error) {
		console.error("Error purchasing phone number from Vapi:", error)
		throw new Error(
			`Failed to purchase phone number: ${error instanceof Error ? error.message : "Unknown error"}`
		)
	}
}

// Update phone number configuration in Vapi (admin only)
export async function updateVapiPhoneNumber(
	phoneNumberId: number,
	updates: {
		name?: string
		fallbackDestination?: {
			type: "number" | "sip"
			value: string
		}
	}
) {
	await requireAdmin()

	try {
		// Get the phone number from our database
		const [phoneNumber] = await db
			.select()
			.from(phoneNumbers)
			.where(eq(phoneNumbers.id, phoneNumberId))
			.limit(1)

		if (!phoneNumber) {
			throw new Error("Phone number not found")
		}

		if (phoneNumber.provider !== "vapi" || !phoneNumber.providerSid) {
			throw new Error("Phone number is not managed by Vapi")
		}

		// Update the phone number in Vapi
		const updatedVapiNumber = await vapiPhoneClient.updatePhoneNumber(
			phoneNumber.providerSid,
			updates
		)

		// Update our database record
		const [updatedNumber] = await db
			.update(phoneNumbers)
			.set({
				friendlyName: updatedVapiNumber.name,
				configuration: {
					routingRules: {
						fallback: updatedVapiNumber.fallbackDestination
							? {
									enabled: true,
									forwardTo:
										updatedVapiNumber.fallbackDestination
											.value
								}
							: undefined
					}
				},
				updatedAt: new Date()
			})
			.where(eq(phoneNumbers.id, phoneNumberId))
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return updatedNumber
	} catch (error) {
		console.error("Error updating Vapi phone number:", error)
		throw new Error("Failed to update phone number configuration")
	}
}

// Delete phone number from both our DB and Vapi (admin only)
export async function deleteVapiPhoneNumber(phoneNumberId: number) {
	await requireAdmin()

	try {
		// Get the phone number from our database
		const [phoneNumber] = await db
			.select()
			.from(phoneNumbers)
			.where(eq(phoneNumbers.id, phoneNumberId))
			.limit(1)

		if (!phoneNumber) {
			throw new Error("Phone number not found")
		}

		// If it's a Vapi phone number, delete from Vapi first
		if (phoneNumber.provider === "vapi" && phoneNumber.providerSid) {
			try {
				await vapiPhoneClient.deletePhoneNumber(phoneNumber.providerSid)
			} catch (vapiError) {
				console.warn(
					"Failed to delete from Vapi (may already be deleted):",
					vapiError
				)
				// Continue with local deletion even if Vapi deletion fails
			}
		}

		// Delete from our database
		await db.delete(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId))

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return { success: true }
	} catch (error) {
		console.error("Error deleting phone number:", error)
		throw new Error("Failed to delete phone number")
	}
}

// Check Vapi health status (admin only)
export async function getVapiHealthStatus() {
	await requireAdmin()

	try {
		const healthCheck = await vapiPhoneClient.healthCheck()
		return healthCheck
	} catch (error) {
		console.error("Error checking Vapi health:", error)
		return {
			status: "down" as const,
			details: `Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			lastChecked: new Date()
		}
	}
}

// Create phone number manually (admin only)
export async function createPhoneNumber(
	input: z.infer<typeof adminPhoneNumberSchema>
) {
	await requireAdmin()

	try {
		const validated = adminPhoneNumberSchema.parse(input)

		// Check if phone number already exists
		const existing = await db
			.select()
			.from(phoneNumbers)
			.where(eq(phoneNumbers.number, validated.number))
			.limit(1)

		if (existing.length > 0) {
			throw new Error("Phone number already exists")
		}

		const [newNumber] = await db
			.insert(phoneNumbers)
			.values({
				number: validated.number,
				friendlyName: validated.friendlyName || validated.number,
				type: validated.type,
				status: validated.status,
				provider: validated.provider || "manual",
				providerSid: validated.providerSid,
				userId: validated.userId,
				capabilities: validated.capabilities || {
					voice: true,
					sms: false,
					mms: false,
					fax: false
				},
				configuration: {},
				costPerMinute: "0.0000"
			})
			.returning()

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return newNumber
	} catch (error) {
		console.error("Error creating phone number:", error)
		throw new Error("Failed to create phone number")
	}
}

// Delete phone number (admin only) - fallback for non-Vapi numbers
export async function deletePhoneNumber(phoneNumberId: number) {
	await requireAdmin()

	try {
		await db.delete(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId))

		revalidatePath("/admin/phone-numbers")
		revalidatePath("/admin")

		return { success: true }
	} catch (error) {
		console.error("Error deleting phone number:", error)
		throw new Error("Failed to delete phone number")
	}
}

// Get phone number statistics (admin only)
export async function getPhoneNumberStats() {
	await requireAdmin()

	try {
		const [stats] = await db
			.select({
				total: count(),
				active: count(
					sql`CASE WHEN ${phoneNumbers.status} = 'active' THEN 1 END`
				),
				inactive: count(
					sql`CASE WHEN ${phoneNumbers.status} = 'inactive' THEN 1 END`
				),
				pending: count(
					sql`CASE WHEN ${phoneNumbers.status} = 'pending' THEN 1 END`
				),
				suspended: count(
					sql`CASE WHEN ${phoneNumbers.status} = 'suspended' THEN 1 END`
				),
				inboundOnly: count(
					sql`CASE WHEN ${phoneNumbers.type} = 'inbound' THEN 1 END`
				),
				outboundOnly: count(
					sql`CASE WHEN ${phoneNumbers.type} = 'outbound' THEN 1 END`
				),
				both: count(
					sql`CASE WHEN ${phoneNumbers.type} = 'both' THEN 1 END`
				)
			})
			.from(phoneNumbers)

		return stats
	} catch (error) {
		console.error("Error fetching phone number stats:", error)
		throw new Error("Failed to fetch phone number statistics")
	}
}

// Search phone numbers (admin only)
export async function searchPhoneNumbers(query: string) {
	await requireAdmin()

	try {
		const numbers = await db
			.select()
			.from(phoneNumbers)
			.where(
				or(
					ilike(phoneNumbers.number, `%${query}%`),
					ilike(phoneNumbers.friendlyName, `%${query}%`),
					ilike(phoneNumbers.userId, `%${query}%`),
					ilike(phoneNumbers.provider, `%${query}%`)
				)
			)
			.orderBy(desc(phoneNumbers.createdAt))
			.limit(50)

		return numbers
	} catch (error) {
		console.error("Error searching phone numbers:", error)
		throw new Error("Failed to search phone numbers")
	}
}

// Debug function to test Vapi connection
export async function debugVapiConnection() {
	await requireAdmin()

	try {
		console.log("=== VAPI DEBUG START ===")

		// Check environment variables directly
		const directSecretKey = process.env.VAPI_SECRET_KEY
		console.log("Direct VAPI_SECRET_KEY exists:", !!directSecretKey)
		console.log(
			"Direct VAPI_SECRET_KEY length:",
			directSecretKey?.length || 0
		)

		// Test health check first
		console.log("Testing Vapi health check...")
		const healthCheck = await vapiPhoneClient.healthCheck()
		console.log("Health check result:", healthCheck)

		// Test listing phone numbers
		console.log("Testing list phone numbers...")
		const phoneNumbers = await vapiPhoneClient.listPhoneNumbers()
		console.log(
			"Phone numbers result:",
			phoneNumbers.length,
			"numbers found"
		)

		console.log("=== VAPI DEBUG END ===")

		return {
			healthCheck,
			phoneNumbers,
			envVarExists: !!directSecretKey
		}
	} catch (error) {
		console.error("Debug error:", error)
		throw error
	}
}

// Simple direct test of Vapi SDK
export async function testVapiDirect() {
	await requireAdmin()

	try {
		console.log("=== DIRECT VAPI TEST START ===")

		// Test direct SDK usage
		const { VapiClient } = await import("@vapi-ai/server-sdk")
		const secretKey = process.env.VAPI_SECRET_KEY

		console.log("Secret key exists:", !!secretKey)
		console.log("Secret key length:", secretKey?.length || 0)

		if (!secretKey) {
			throw new Error("No secret key found")
		}

		const client = new VapiClient({
			token: secretKey
		})

		console.log("Client created successfully")

		// Try to list phone numbers
		const phoneNumbers = await client.phoneNumbers.list({ limit: 10 })
		console.log("Phone numbers fetched:", phoneNumbers.length)

		console.log("=== DIRECT VAPI TEST END ===")

		return {
			success: true,
			count: phoneNumbers.length,
			phoneNumbers
		}
	} catch (error) {
		console.error("Direct test error:", error)
		throw error
	}
}
