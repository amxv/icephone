"use server"

import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, calls, leads } from "@/db/schema"

// Define the campaign filter interface
export interface CampaignFilter {
	search?: string
	status?: string[]
	startDate?: Date
	endDate?: Date
	orderBy?: "name" | "startDate" | "status" | "updatedAt"
	orderDir?: "asc" | "desc"
}

// Get all campaigns with optional filtering
export async function getCampaigns(filter: CampaignFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [eq(campaigns.userId, userId)]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(
				sql`(${campaigns.name} ILIKE ${searchPattern} OR ${campaigns.description} ILIKE ${searchPattern})`
			)
		}

		if (filter.status && filter.status.length > 0) {
			whereConditions.push(
				sql`${campaigns.status} = ANY(${filter.status})`
			)
		}

		if (filter.startDate) {
			whereConditions.push(gte(campaigns.startDate, filter.startDate))
		}

		if (filter.endDate) {
			whereConditions.push(lte(campaigns.endDate, filter.endDate))
		}

		const condition = and(...whereConditions)

		// Get campaigns with aggregated lead counts
		const campaignsData = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				description: campaigns.description,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate,
				createdAt: campaigns.createdAt,
				updatedAt: campaigns.updatedAt,
				leadsCount: sql<number>`COUNT(DISTINCT ${calls.leadId})`.as(
					"leadsCount"
				),
				leadsConverted:
					sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} = 'converted' THEN ${calls.leadId} END)`.as(
						"leadsConverted"
					)
			})
			.from(campaigns)
			.leftJoin(calls, eq(calls.campaignId, campaigns.id))
			.leftJoin(leads, eq(leads.id, calls.leadId))
			.where(condition)
			.groupBy(campaigns.id)
			.orderBy(desc(campaigns.updatedAt))

		return { success: true, data: campaignsData }
	} catch (error) {
		console.error("Error fetching campaigns:", error)
		return { success: false, error: "Failed to fetch campaigns" }
	}
}

// Get a single campaign by ID with detailed metrics
export async function getCampaignById(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const campaignResult = await db_ws
			.select({
				id: campaigns.id,
				name: campaigns.name,
				description: campaigns.description,
				status: campaigns.status,
				startDate: campaigns.startDate,
				endDate: campaigns.endDate,
				createdAt: campaigns.createdAt,
				updatedAt: campaigns.updatedAt,
				userId: campaigns.userId
			})
			.from(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.limit(1)

		if (!campaignResult || campaignResult.length === 0) {
			return { success: false, error: "Campaign not found", data: null }
		}

		const campaign = campaignResult[0]

		// Get campaign metrics
		const metricsResult = await db_ws
			.select({
				totalCalls: sql<number>`COUNT(*)`.as("totalCalls"),
				totalLeads: sql<number>`COUNT(DISTINCT ${calls.leadId})`.as(
					"totalLeads"
				),
				convertedLeads:
					sql<number>`COUNT(DISTINCT CASE WHEN ${leads.status} = 'converted' THEN ${calls.leadId} END)`.as(
						"convertedLeads"
					),
				avgDuration: sql<number>`AVG(${calls.duration})`.as(
					"avgDuration"
				)
			})
			.from(calls)
			.leftJoin(leads, eq(leads.id, calls.leadId))
			.where(
				and(eq(calls.campaignId, campaignId), eq(calls.userId, userId))
			)

		const metrics = metricsResult[0] || {
			totalCalls: 0,
			totalLeads: 0,
			convertedLeads: 0,
			avgDuration: 0
		}

		return {
			success: true,
			data: {
				...campaign,
				metrics
			},
			error: null
		}
	} catch (error) {
		console.error("Error fetching campaign by ID:", error)
		return { success: false, error: "Failed to fetch campaign", data: null }
	}
}

// Create a new campaign
export async function createCampaign(campaignData: {
	name: string
	description?: string
	startDate?: Date
	endDate?: Date
	status?: string
}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const newCampaign = await db_ws
			.insert(campaigns)
			.values({
				...campaignData,
				userId,
				status: campaignData.status || "draft"
			})
			.returning()

		return { success: true, data: newCampaign[0], error: null }
	} catch (error) {
		console.error("Error creating campaign:", error)
		return {
			success: false,
			error: "Failed to create campaign",
			data: null
		}
	}
}

// Update an existing campaign
export async function updateCampaign(
	campaignId: number,
	campaignData: {
		name?: string
		description?: string
		startDate?: Date
		endDate?: Date
		status?: string
	}
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const updatedCampaign = await db_ws
			.update(campaigns)
			.set({
				...campaignData,
				updatedAt: new Date()
			})
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!updatedCampaign || updatedCampaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized",
				data: null
			}
		}

		return { success: true, data: updatedCampaign[0], error: null }
	} catch (error) {
		console.error("Error updating campaign:", error)
		return {
			success: false,
			error: "Failed to update campaign",
			data: null
		}
	}
}

// Delete a campaign
export async function deleteCampaign(campaignId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false }
		}

		const deletedCampaign = await db_ws
			.delete(campaigns)
			.where(
				and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))
			)
			.returning()

		if (!deletedCampaign || deletedCampaign.length === 0) {
			return {
				success: false,
				error: "Campaign not found or unauthorized"
			}
		}

		return { success: true, error: null }
	} catch (error) {
		console.error("Error deleting campaign:", error)
		return { success: false, error: "Failed to delete campaign" }
	}
}
