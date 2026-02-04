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

type ResolveTelephonyProviderParams = {
	teamId: string
	agentId?: number | null
	preferredProvider?: TelephonyProvider | null
}

export async function resolveTeamTelephonyProvider(
	params: ResolveTelephonyProviderParams
): Promise<TelephonyProvider> {
	const rows = await db_ws
		.select({
			provider: teamPhoneNumbers.provider,
			isDefaultOutbound: teamPhoneNumbers.isDefaultOutbound,
			assignedAgentId: teamPhoneNumbers.assignedAgentId
		})
		.from(teamPhoneNumbers)
		.where(
			and(
				eq(teamPhoneNumbers.teamId, params.teamId),
				eq(teamPhoneNumbers.status, "active")
			)
		)
		.orderBy(
			desc(teamPhoneNumbers.isDefaultOutbound),
			desc(teamPhoneNumbers.updatedAt)
		)

	if (!rows.length) {
		return params.preferredProvider || "mock"
	}

	const byPreferredProvider = params.preferredProvider
		? rows.filter((row) => row.provider === params.preferredProvider)
		: rows

	const assignedRow = byPreferredProvider.find(
		(row) =>
			params.agentId &&
			row.assignedAgentId &&
			row.assignedAgentId === params.agentId
	)
	if (assignedRow) {
		return assignedRow.provider
	}

	const defaultRow = byPreferredProvider.find((row) => row.isDefaultOutbound)
	if (defaultRow) {
		return defaultRow.provider
	}

	if (byPreferredProvider.length) {
		return byPreferredProvider[0].provider
	}

	const assignedAnyProvider = rows.find(
		(row) =>
			params.agentId &&
			row.assignedAgentId &&
			row.assignedAgentId === params.agentId
	)
	if (assignedAnyProvider) {
		return assignedAnyProvider.provider
	}

	return rows[0]?.provider || params.preferredProvider || "mock"
}
