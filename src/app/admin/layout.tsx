import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { currentUser } from "@/lib/auth/session"

export default async function AdminLayout({
	children
}: {
	children: React.ReactNode
}) {
	// Get current user
	const user = await currentUser()

	// Check if user is authenticated
	if (!user) {
		redirect("/sign-in")
	}

	// Check if user is the admin (owner)
	const ownerUserId = process.env.OWNER_USER_ID
	if (user.id !== ownerUserId) {
		redirect("/")
	}

	// Extract only the plain data we need for the client component
	const userData = {
		name: user.name ?? null,
		email: user.email
	}

	return (
		<div className="h-screen flex overflow-hidden">
			{/* Admin Sidebar - Fixed width with scroll */}
			<AdminSidebar user={userData} />

			{/* Main Content Area - Takes remaining space */}
			<div className="flex-1 flex flex-col min-h-0">
				{/* Page Content - Scrollable */}
				<main className="flex-1 overflow-y-auto bg-background">
					<div className="container mx-auto px-6 py-8">
						{children}
					</div>
				</main>
			</div>
		</div>
	)
}
