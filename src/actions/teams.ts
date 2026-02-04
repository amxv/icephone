"use server"

import { nanoid } from "nanoid"
import { db_ws } from "@/db"
import { teams, teamMembers, users } from "@/db/schema"
import { currentUser } from "@/lib/auth/session"
import { eq } from "drizzle-orm"

function buildTeamSlug(name: string, suffix: string) {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")

	const safeBase = base.length > 0 ? base : "team"
	return `${safeBase}-${suffix}`
}

export async function ensureDefaultTeam() {
	const user = await currentUser()
	if (!user) {
		return { success: false, error: "Unauthorized", data: null }
	}

	const existing = await db_ws
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			defaultTeamId: users.defaultTeamId
		})
		.from(users)
		.where(eq(users.id, user.id))
		.limit(1)

	if (!existing.length) {
		return { success: false, error: "User not found", data: null }
	}

	const record = existing[0]
	if (record.defaultTeamId) {
		return { success: true, error: null, data: record.defaultTeamId }
	}

	const teamId = nanoid(12)
	const teamName = record.name || record.email?.split("@")[0] || "My Team"
	const slug = buildTeamSlug(teamName, teamId.slice(0, 6))

	await db_ws.insert(teams).values({
		id: teamId,
		name: teamName,
		slug,
		createdByUserId: user.id,
		createdAt: new Date(),
		updatedAt: new Date()
	})

	await db_ws.insert(teamMembers).values({
		id: nanoid(12),
		teamId,
		userId: user.id,
		role: "owner",
		createdAt: new Date()
	})

	await db_ws
		.update(users)
		.set({
			defaultTeamId: teamId,
			updatedAt: new Date()
		})
		.where(eq(users.id, user.id))

	return { success: true, error: null, data: teamId }
}
