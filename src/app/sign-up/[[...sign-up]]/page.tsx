import Link from "next/link"
import { SignUpForm } from "@/components/auth/sign-up-form"

export default function Page() {
	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background z-50 px-4">
			<SignUpForm />
			<p className="text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href="/sign-in" className="text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</div>
	)
}
