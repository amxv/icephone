import Link from "next/link"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { isSignUpEnabled } from "@/lib/env"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Page() {
	const signUpEnabled = isSignUpEnabled()

	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background z-50 px-4">
			{signUpEnabled ? (
				<SignUpForm />
			) : (
				<Card className="w-full max-w-md rounded-3xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="text-2xl">
							Sign up is disabled
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							New account creation is closed right now. Use an
							existing account to sign in.
						</p>
					</CardContent>
				</Card>
			)}
			<p className="text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href="/sign-in" className="text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</div>
	)
}
