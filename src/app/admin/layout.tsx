import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { requireAdminPageAccess } from "@/lib/admin-check"

export default async function AdminLayout({
	children
}: {
	children: React.ReactNode
}) {
	const user = await requireAdminPageAccess()

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
