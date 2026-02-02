"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, sql } from "drizzle-orm"

import { db_ws } from "@/db"
import { campaigns, voiceAgents } from "@/db/schema"
import type { EnhancedCampaignData } from "./basic"

// Validate campaign configuration and check for conflicts
export async function validateCampaignConfiguration(
	campaignData: EnhancedCampaignData,
	campaignId?: number
) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, conflicts: [] }
		}

		const conflicts: string[] = []

		// Validate voice agent assignment
		if (campaignData.voiceAgentId) {
			const voiceAgent = await db_ws
				.select({
					id: voiceAgents.id,
					name: voiceAgents.name,
					status: voiceAgents.status,
					phoneNumberId: voiceAgents.phoneNumberId
				})
				.from(voiceAgents)
				.where(
					and(
						eq(voiceAgents.id, campaignData.voiceAgentId),
						eq(voiceAgents.userId, userId)
					)
				)
				.limit(1)

			if (!voiceAgent || voiceAgent.length === 0) {
				conflicts.push("Selected voice agent not found or unauthorized")
			} else {
				const agent = voiceAgent[0]

				// Check if voice agent is active
				if (agent.status !== "active") {
					conflicts.push(
						`Voice agent "${agent.name}" is not active (current status: ${agent.status})`
					)
				}

				// Check if voice agent has a phone number assigned
				if (!agent.phoneNumberId) {
					conflicts.push(
						`Voice agent "${agent.name}" does not have a phone number assigned`
					)
				}

				// Check for conflicting campaigns using the same voice agent at the same time
				if (campaignData.startDate && campaignData.endDate) {
					const conflictingCampaigns = await db_ws
						.select({
							id: campaigns.id,
							name: campaigns.name,
							startDate: campaigns.startDate,
							endDate: campaigns.endDate
						})
						.from(campaigns)
						.where(
							and(
								eq(
									campaigns.voiceAgentId,
									campaignData.voiceAgentId
								),
								eq(campaigns.userId, userId),
								eq(campaigns.status, "running"),
								campaignId
									? sql`${campaigns.id} != ${campaignId}`
									: sql`true`,
								// Check for date overlap
								sql`(
									(${campaigns.startDate} <= ${campaignData.endDate} AND ${campaigns.endDate} >= ${campaignData.startDate})
									OR (${campaigns.startDate} IS NULL OR ${campaigns.endDate} IS NULL)
								)`
							)
						)

					if (conflictingCampaigns.length > 0) {
						const conflictNames = conflictingCampaigns
							.map((c) => c.name)
							.join(", ")
						conflicts.push(
							`Voice agent "${agent.name}" is already assigned to active campaigns: ${conflictNames}`
						)
					}
				}
			}
		}

		// Validate campaign timing settings
		if (campaignData.campaignSettings?.callTiming?.businessHours?.enabled) {
			const schedule =
				campaignData.campaignSettings.callTiming.businessHours.schedule
			let hasValidSchedule = false

			// Check if at least one day is enabled with valid times
			for (const [day, times] of Object.entries(schedule)) {
				if (times?.start && times.end) {
					hasValidSchedule = true
					// Validate time format
					const startTime = new Date(`2000-01-01T${times.start}:00`)
					const endTime = new Date(`2000-01-01T${times.end}:00`)
					if (startTime >= endTime) {
						conflicts.push(
							`Invalid time range for ${day}: start time must be before end time`
						)
					}
				}
			}

			if (!hasValidSchedule) {
				conflicts.push(
					"Business hours are enabled but no valid schedule is defined"
				)
			}
		}

		// Validate retry logic
		if (campaignData.campaignSettings?.retryLogic) {
			const retryLogic = campaignData.campaignSettings.retryLogic
			if (retryLogic.maxAttempts < 1 || retryLogic.maxAttempts > 10) {
				conflicts.push("Max attempts must be between 1 and 10")
			}

			if (retryLogic.retryIntervals.length < retryLogic.maxAttempts - 1) {
				conflicts.push(
					"Number of retry intervals must be at least (max attempts - 1)"
				)
			}

			if (retryLogic.retryIntervals.some((interval) => interval < 1)) {
				conflicts.push("All retry intervals must be at least 1 hour")
			}
		}

		// Validate date ranges
		if (campaignData.startDate && campaignData.endDate) {
			if (campaignData.startDate >= campaignData.endDate) {
				conflicts.push("Start date must be before end date")
			}

			// Check if start date is in the past (for new campaigns)
			if (!campaignId && campaignData.startDate < new Date()) {
				conflicts.push("Start date cannot be in the past")
			}
		}

		return {
			success: true,
			conflicts,
			error: null
		}
	} catch (error) {
		console.error("Error validating campaign configuration:", error)
		return {
			success: false,
			error: "Failed to validate campaign configuration",
			conflicts: []
		}
	}
}
