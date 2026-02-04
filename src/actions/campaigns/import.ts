"use server"

import { requireTeam } from "@/lib/auth/session"
import { teamScope, withTeamId } from "@/lib/team-scope"
import { and, eq } from "drizzle-orm"

import { db_ws } from "@/db"
import { leads } from "@/db/schema"
import { assignLeadsToCampaign } from "./core"

export interface CSVLeadData {
	name: string
	email?: string
	phone?: string
	source?: string
	notes?: string
	dealValue?: number
	expectedCloseDate?: string
}

export interface CSVImportResult {
	success: boolean
	totalRows: number
	successCount: number
	errorCount: number
	errors: Array<{
		row: number
		field?: string
		message: string
		data?: Partial<CSVLeadData>
	}>
	createdLeads: Array<{ id: number; name: string }>
	duplicatesFound: number
}

// Validate individual lead data from CSV
function validateCSVLeadData(
	data: Record<string, unknown>,
	rowIndex: number
): {
	isValid: boolean
	errors: Array<{ row: number; field?: string; message: string }>
	cleanData?: CSVLeadData
} {
	const errors: Array<{ row: number; field?: string; message: string }> = []

	// Required fields validation
	if (
		!data.name ||
		typeof data.name !== "string" ||
		data.name.trim().length === 0
	) {
		errors.push({
			row: rowIndex,
			field: "name",
			message: "Name is required and cannot be empty"
		})
	}

	// Phone validation - at least one contact method required
	const hasPhone =
		data.phone &&
		typeof data.phone === "string" &&
		data.phone.trim().length > 0
	const hasEmail =
		data.email &&
		typeof data.email === "string" &&
		data.email.trim().length > 0

	if (!hasPhone && !hasEmail) {
		errors.push({
			row: rowIndex,
			field: "contact",
			message: "At least one contact method (phone or email) is required"
		})
	}

	// Phone format validation
	if (hasPhone && typeof data.phone === "string") {
		const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
		const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, "")
		if (!phoneRegex.test(cleanPhone)) {
			errors.push({
				row: rowIndex,
				field: "phone",
				message: "Invalid phone number format"
			})
		}
	}

	// Email validation
	if (hasEmail && typeof data.email === "string") {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(data.email.trim())) {
			errors.push({
				row: rowIndex,
				field: "email",
				message: "Invalid email address format"
			})
		}
	}

	// Deal value validation
	if (
		data.dealValue !== undefined &&
		data.dealValue !== null &&
		data.dealValue !== ""
	) {
		const dealValue = Number(data.dealValue)
		if (Number.isNaN(dealValue) || dealValue < 0) {
			errors.push({
				row: rowIndex,
				field: "dealValue",
				message: "Deal value must be a non-negative number"
			})
		}
	}

	// Date validation
	if (
		data.expectedCloseDate &&
		typeof data.expectedCloseDate === "string" &&
		data.expectedCloseDate.trim().length > 0
	) {
		const date = new Date(data.expectedCloseDate.trim())
		if (Number.isNaN(date.getTime())) {
			errors.push({
				row: rowIndex,
				field: "expectedCloseDate",
				message: "Invalid date format for expected close date"
			})
		}
	}

	if (errors.length > 0) {
		return { isValid: false, errors }
	}

	// Return clean data
	const cleanData: CSVLeadData = {
		name: typeof data.name === "string" ? data.name.trim() : "",
		email:
			hasEmail && typeof data.email === "string"
				? data.email.trim()
				: undefined,
		phone:
			hasPhone && typeof data.phone === "string"
				? data.phone.replace(/[\s\-\(\)]/g, "")
				: undefined,
		source:
			data.source && typeof data.source === "string"
				? data.source.trim()
				: undefined,
		notes:
			data.notes && typeof data.notes === "string"
				? data.notes.trim()
				: undefined,
		dealValue:
			data.dealValue !== undefined &&
			data.dealValue !== null &&
			data.dealValue !== ""
				? Number(data.dealValue)
				: undefined,
		expectedCloseDate:
			data.expectedCloseDate &&
			typeof data.expectedCloseDate === "string" &&
			data.expectedCloseDate.trim().length > 0
				? data.expectedCloseDate.trim()
				: undefined
	}

	return { isValid: true, errors: [], cleanData }
}

// Detect and handle duplicate leads
async function findDuplicateLeads(
	leadData: CSVLeadData[],
	teamId: string
): Promise<{
	duplicates: Array<{
		csvIndex: number
		existingLeadId: number
		field: string
	}>
	uniqueLeads: Array<{ csvIndex: number; data: CSVLeadData }>
}> {
	const duplicates: Array<{
		csvIndex: number
		existingLeadId: number
		field: string
	}> = []
	const uniqueLeads: Array<{ csvIndex: number; data: CSVLeadData }> = []

	for (let i = 0; i < leadData.length; i++) {
		const lead = leadData[i]
		let isDuplicate = false

		// Check for email duplicates
		if (lead.email) {
			const existingLead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(eq(leads.email, lead.email), teamScope(leads, teamId))
				)
				.limit(1)

			if (existingLead.length > 0) {
				duplicates.push({
					csvIndex: i,
					existingLeadId: existingLead[0].id,
					field: "email"
				})
				isDuplicate = true
			}
		}

		// Check for phone duplicates (only if not already duplicate by email)
		if (!isDuplicate && lead.phone) {
			const existingLead = await db_ws
				.select({ id: leads.id })
				.from(leads)
				.where(
					and(eq(leads.phone, lead.phone), teamScope(leads, teamId))
				)
				.limit(1)

			if (existingLead.length > 0) {
				duplicates.push({
					csvIndex: i,
					existingLeadId: existingLead[0].id,
					field: "phone"
				})
				isDuplicate = true
			}
		}

		if (!isDuplicate) {
			uniqueLeads.push({ csvIndex: i, data: lead })
		}
	}

	return { duplicates, uniqueLeads }
}

// Main CSV processing function
export async function processCSVImport(
	csvData: string,
	campaignId?: number,
	options?: {
		skipDuplicates?: boolean
		validateOnly?: boolean
	}
): Promise<CSVImportResult> {
	try {
		const { teamId, user } = await requireTeam()
		if (!teamId || !user) {
			throw new Error("Unauthorized")
		}

		// Parse CSV data (using papaparse)
		const Papa = await import("papaparse")
		const parseResult = Papa.parse(csvData, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header: string) => {
				// Normalize common header variations
				const normalized = header.toLowerCase().trim()
				const headerMap: Record<string, string> = {
					"full name": "name",
					fullname: "name",
					"lead name": "name",
					"customer name": "name",
					"contact name": "name",
					"phone number": "phone",
					telephone: "phone",
					mobile: "phone",
					cell: "phone",
					"email address": "email",
					"e-mail": "email",
					mail: "email",
					"lead source": "source",
					comments: "notes",
					description: "notes",
					"deal amount": "dealValue",
					value: "dealValue",
					amount: "dealValue",
					"close date": "expectedCloseDate",
					"expected close": "expectedCloseDate"
				}
				return headerMap[normalized] || normalized
			}
		})

		if (parseResult.errors.length > 0) {
			return {
				success: false,
				totalRows: 0,
				successCount: 0,
				errorCount: 1,
				errors: [
					{
						row: 0,
						message: `CSV parsing error: ${parseResult.errors[0].message}`
					}
				],
				createdLeads: [],
				duplicatesFound: 0
			}
		}

		const rawData = parseResult.data as Record<string, unknown>[]
		const totalRows = rawData.length
		const errors: CSVImportResult["errors"] = []
		const validLeads: CSVLeadData[] = []

		// Validate each row
		for (let i = 0; i < rawData.length; i++) {
			const validation = validateCSVLeadData(rawData[i], i + 1)
			if (validation.isValid && validation.cleanData) {
				validLeads.push(validation.cleanData)
			} else {
				errors.push(
					...validation.errors.map((error) => ({
						...error,
						data: rawData[i]
					}))
				)
			}
		}

		// If validation only, return early
		if (options?.validateOnly) {
			return {
				success: true,
				totalRows,
				successCount: validLeads.length,
				errorCount: errors.length,
				errors,
				createdLeads: [],
				duplicatesFound: 0
			}
		}

		// Check for duplicates
		const { duplicates, uniqueLeads } = await findDuplicateLeads(
			validLeads,
			teamId
		)

		// Filter out duplicates if skipDuplicates is true
		const leadsToCreate = options?.skipDuplicates
			? uniqueLeads.map((item) => item.data)
			: validLeads

		// Add duplicate errors if not skipping
		if (!options?.skipDuplicates) {
			for (const dup of duplicates) {
				errors.push({
					row: dup.csvIndex + 1,
					field: dup.field,
					message: `Duplicate ${dup.field} found (existing lead ID: ${dup.existingLeadId})`
				})
			}
		}

		// Create leads in database
		const createdLeads: Array<{ id: number; name: string }> = []

		if (leadsToCreate.length > 0) {
			const leadInsertData = leadsToCreate.map((lead) => ({
				name: lead.name,
				email: lead.email || null,
				phone: lead.phone || null,
				source: lead.source || "CSV Import",
				notes: lead.notes || null,
				dealValue: lead.dealValue ? lead.dealValue.toString() : null,
				expectedCloseDate: lead.expectedCloseDate
					? new Date(lead.expectedCloseDate)
					: null,
				status: "new" as const,
				createdByUserId: user.id,
				userId: user.id,
				teamId
			}))

			const insertedLeads = await db_ws
				.insert(leads)
				.values(leadInsertData)
				.returning({ id: leads.id, name: leads.name })

			createdLeads.push(...insertedLeads)

			// If campaignId is provided, assign leads to the campaign
			if (campaignId && insertedLeads.length > 0) {
				const leadIds = insertedLeads.map((lead) => lead.id)
				await assignLeadsToCampaign(campaignId, leadIds, {
					priority: 0,
					notes: "Added via CSV import"
				})
			}
		}

		return {
			success: true,
			totalRows,
			successCount: createdLeads.length,
			errorCount: errors.length,
			errors,
			createdLeads,
			duplicatesFound: duplicates.length
		}
	} catch (error) {
		console.error("Error processing CSV import:", error)
		return {
			success: false,
			totalRows: 0,
			successCount: 0,
			errorCount: 1,
			errors: [
				{
					row: 0,
					message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			],
			createdLeads: [],
			duplicatesFound: 0
		}
	}
}
