"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { ensureDefaultTeam } from "@/actions/teams"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function SignInForm() {
	const router = useRouter()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [isLoading, setIsLoading] = useState(false)

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setIsLoading(true)
		try {
			const result = await authClient.signIn.email({
				email,
				password
			})

			const error =
				(result as { error?: { message?: string } | string })?.error ||
				null
			if (error) {
				const message =
					typeof error === "string"
						? error
						: error.message || "Failed to sign in"
				toast.error(message)
				return
			}

			await ensureDefaultTeam()
			router.push("/dashboard")
		} catch (err) {
			console.error("Sign in error:", err)
			toast.error("Failed to sign in")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Card className="w-full max-w-md rounded-3xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
			<CardHeader>
				<CardTitle className="text-2xl">Sign in</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(event) =>
								setPassword(event.target.value)
							}
							required
						/>
					</div>
					<Button
						type="submit"
						className="w-full"
						disabled={isLoading}
					>
						{isLoading && (
							<Loader2 className="animate-spin" />
						)}
						{isLoading ? "Signing in..." : "Sign in"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
