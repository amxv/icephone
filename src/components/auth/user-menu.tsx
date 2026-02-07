"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { useAuthUser } from "@/lib/auth/use-auth-user"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

function getInitials(name: string | null, email?: string) {
	if (name) {
		const parts = name.trim().split(/\s+/)
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
		}
		return parts[0].slice(0, 2).toUpperCase()
	}
	if (email) {
		return email.slice(0, 2).toUpperCase()
	}
	return "U"
}

export function UserMenu() {
	const { user, isAuthenticated } = useAuthUser()
	const [isSigningOut, setIsSigningOut] = useState(false)

	if (!isAuthenticated || !user) return null

	const initials = getInitials(user.name, user.email)

	const handleSignOut = async () => {
		setIsSigningOut(true)
		try {
			await authClient.signOut()
			window.location.href = "/sign-in"
		} catch (error) {
			console.error("Failed to sign out", error)
			setIsSigningOut(false)
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="rounded-full">
					<Avatar className="h-7 w-7">
						{user.image ? (
							<AvatarImage
								src={user.image}
								alt={user.name || "User"}
							/>
						) : null}
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuItem disabled>
					{user.name || user.email}
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={(e) => {
						e.preventDefault()
						handleSignOut()
					}}
					disabled={isSigningOut}
				>
					{isSigningOut ? "Signing out..." : "Sign out"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
