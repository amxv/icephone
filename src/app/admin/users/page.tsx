import { Suspense } from "react"
import { AdminUsersClient } from "./AdminUsersClient"
import { Skeleton } from "@/components/ui/skeleton"
import { getAllUsers, getUserStats } from "@/actions/admin-users"
import { requireAdminPageAccess } from "@/lib/admin-check"

function AdminUsersLoading() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-10 w-48 mb-2" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-10 w-32" />
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-6"
					>
						<Skeleton className="h-4 w-20 mb-2" />
						<Skeleton className="h-8 w-16 mb-1" />
						<Skeleton className="h-3 w-24" />
					</div>
				))}
			</div>

			{/* Table */}
			<div className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<div className="p-6">
					<Skeleton className="h-6 w-32 mb-4" />
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
							className="flex items-center space-x-4 py-3"
						>
							<Skeleton className="h-10 w-10 rounded-full" />
							<div className="space-y-2 flex-1">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-3 w-32" />
							</div>
							<Skeleton className="h-6 w-16" />
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

async function AdminUsersContent() {
	const [users, userStats] = await Promise.all([
		getAllUsers(),
		getUserStats()
	])

	return <AdminUsersClient initialUsers={users} initialStats={userStats} />
}

export default async function AdminUsersPage() {
	await requireAdminPageAccess()

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						User Management
					</h1>
					<p className="text-muted-foreground">
						Manage all platform users, their access, and account
						details
					</p>
				</div>
			</div>

			<Suspense fallback={<AdminUsersLoading />}>
				<AdminUsersContent />
			</Suspense>
		</div>
	)
}
