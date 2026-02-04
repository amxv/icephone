import { auth as authServer } from "@/lib/auth"
import { headers } from "next/headers"

export async function getSession() {
	return authServer.api.getSession({ headers: await headers() })
}

export async function currentUser() {
	const session = await getSession()
	if (session?.user?.isActive === false) {
		return null
	}
	return session?.user ?? null
}

export async function requireUser() {
	const user = await currentUser()
	if (!user) {
		throw new Error("Unauthorized")
	}
	return user
}

export async function requireSession() {
	const session = await getSession()
	if (!session?.user || session.user.isActive === false) {
		throw new Error("Unauthorized")
	}
	return session
}

export async function requireTeam() {
	const session = await requireSession()
	const teamId = session.user.defaultTeamId
	if (!teamId) {
		throw new Error("No team configured")
	}
	return {
		teamId,
		user: session.user,
		session
	}
}

export async function auth() {
	const session = await getSession()
	if (session?.user?.isActive === false) {
		return { userId: null, session: null }
	}
	return {
		userId: session?.user?.id ?? null,
		session
	}
}
