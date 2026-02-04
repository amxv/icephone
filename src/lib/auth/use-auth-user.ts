"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"

export interface AuthSessionUser {
	id: string
	name: string | null
	email: string
	image?: string | null
	defaultTeamId?: string | null
	isActive?: boolean
}

export interface AuthSession {
	user: AuthSessionUser
}

function extractSession(response: unknown): AuthSession | null {
	if (!response) return null
	const maybeResponse = response as { data?: unknown; error?: unknown }
	if (maybeResponse?.error) {
		return null
	}
	const data = maybeResponse?.data ?? response
	if (!data || typeof data !== "object") return null
	const session = data as AuthSession
	if (!session?.user) return null
	if (session.user.isActive === false) return null
	return session
}

export function useAuthUser() {
	const [session, setSession] = useState<AuthSession | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		let isActive = true
		const load = async () => {
			setIsLoading(true)
			try {
				const response = await authClient.getSession()
				if (!isActive) return
				setSession(extractSession(response))
			} catch (error) {
				if (!isActive) return
				console.error("Failed to load session", error)
				setSession(null)
			} finally {
				if (isActive) setIsLoading(false)
			}
		}
		load()
		return () => {
			isActive = false
		}
	}, [])

	return {
		user: session?.user ?? null,
		isLoading,
		isAuthenticated: Boolean(session?.user)
	}
}
