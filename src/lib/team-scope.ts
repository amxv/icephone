import { eq } from "drizzle-orm"

export function teamScope<T extends { teamId: unknown }>(
	table: T,
	teamId: string
) {
	return eq(table.teamId as never, teamId)
}

export function withTeamId<T extends Record<string, unknown>>(
	values: T,
	teamId: string
) {
	return {
		...values,
		teamId
	} as T & { teamId: string }
}
