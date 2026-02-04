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

export function SignUpForm() {
	const router = useRouter()
	const [name, setName] = useState("")
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [isLoading, setIsLoading] = useState(false)

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setIsLoading(true)
		try {
			const result = await authClient.signUp.email({
				name,
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
						: error.message || "Failed to sign up"
				toast.error(message)
				return
			}

			await ensureDefaultTeam()
			router.push("/")
		} catch (err) {
			console.error("Sign up error:", err)
			toast.error("Failed to sign up")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Card className="w-full max-w-md rounded-3xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
			<CardHeader>
				<CardTitle className="text-2xl">Create account</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							type="text"
							autoComplete="name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							required
						/>
					</div>
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
							autoComplete="new-password"
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
						{isLoading ? "Creating account..." : "Create account"}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
