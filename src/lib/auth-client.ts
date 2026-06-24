"use client"

import { createAuthClient } from "better-auth/react"
import { resolveAuthBaseUrl } from "@/lib/env"

const baseURL =
	typeof window !== "undefined"
		? window.location.origin
		: resolveAuthBaseUrl()

export const authClient = createAuthClient({
	baseURL
})

export const { useSession } = authClient
