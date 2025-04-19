import { SignIn } from "@clerk/nextjs"

//hide sign up button
export default function Page() {
	return (
		<>
			<div className="fixed inset-0 flex justify-center items-center bg-background z-50">
				<SignIn
					appearance={{
						elements: {
							footer: "hidden"
						}
					}}
				/>
			</div>
		</>
	)
}
