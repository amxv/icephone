import Link from "next/link"
import { SignInForm } from "@/components/auth/sign-in-form"

export default function Page() {
	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background z-50 px-4">
			<SignInForm />
			<p className="text-sm text-muted-foreground">
				Don’t have an account?{" "}
				<Link href="/sign-up" className="text-primary hover:underline">
					Sign up
				</Link>
			</p>
		</div>
	)
}
