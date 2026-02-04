import { currentUser } from "@/lib/auth/session"
import { redirect } from "next/navigation"

/**
 * Check if the current user is an admin (owner)
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
	try {
		const user = await currentUser()
		if (!user) return false

		const ownerUserId = process.env.OWNER_USER_ID
		return ownerUserId ? user.id === ownerUserId : false
	} catch (error) {
		console.error("Error checking admin status:", error)
		return false
	}
}

/**
 * Check if a user ID matches the admin (owner) user ID
 */
export function isUserAdmin(userId: string): boolean {
	const ownerUserId = process.env.OWNER_USER_ID
	return ownerUserId ? userId === ownerUserId : false
}

/**
 * Server component guard for admin routes.
 * Use this in admin pages to avoid firing admin data loaders for non-admin users.
 */
export async function requireAdminPageAccess() {
	const user = await currentUser()
	if (!user) {
		redirect("/sign-in")
	}

	if (!isUserAdmin(user.id)) {
		redirect("/")
	}

	return user
}
