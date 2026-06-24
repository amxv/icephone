import Link from "next/link"
import { SignInForm } from "@/components/auth/sign-in-form"
import { isSignUpEnabled } from "@/lib/env"

export default function Page() {
	const signUpEnabled = isSignUpEnabled()

	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background z-50 px-4">
			<SignInForm />
			{signUpEnabled ? (
				<p className="text-sm text-muted-foreground">
					Don’t have an account?{" "}
					<Link
						href="/sign-up"
						className="text-primary hover:underline"
					>
						Sign up
					</Link>
				</p>
			) : (
				<p className="text-sm text-muted-foreground">
					New signups are currently disabled.
				</p>
			)}
		</div>
	)
}
