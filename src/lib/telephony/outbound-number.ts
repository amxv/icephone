import { db_ws } from "@/db"
import { teamPhoneNumbers } from "@/db/schema"
import type { TelephonyProvider } from "@/lib/telephony/types"
import { and, desc, eq } from "drizzle-orm"

type ResolveOutboundPhoneNumberParams = {
	teamId: string
	provider: TelephonyProvider
	agentId?: number | null
}

export async function resolveTeamOutboundPhoneNumber(
	params: ResolveOutboundPhoneNumberParams
) {
	const rows = await db_ws
		.select({
			phoneNumber: teamPhoneNumbers.phoneNumber,
			isDefaultOutbound: teamPhoneNumbers.isDefaultOutbound,
			assignedAgentId: teamPhoneNumbers.assignedAgentId
		})
		.from(teamPhoneNumbers)
		.where(
			and(
				eq(teamPhoneNumbers.teamId, params.teamId),
				eq(teamPhoneNumbers.provider, params.provider),
				eq(teamPhoneNumbers.status, "active")
			)
		)
		.orderBy(
			desc(teamPhoneNumbers.isDefaultOutbound),
			desc(teamPhoneNumbers.updatedAt)
		)

	if (!rows.length) {
		return null
	}

	const assigned = rows.find(
		(row) =>
			params.agentId &&
			row.assignedAgentId &&
			row.assignedAgentId === params.agentId
	)
	if (assigned?.phoneNumber) {
		return assigned.phoneNumber
	}

	const defaultOutbound = rows.find((row) => row.isDefaultOutbound)
	if (defaultOutbound?.phoneNumber) {
		return defaultOutbound.phoneNumber
	}

	return rows[0]?.phoneNumber || null
}
