import { Suspense } from "react"
import { AdminDatabaseClient } from "./AdminDatabaseClient"
import { Skeleton } from "@/components/ui/skeleton"
import { getDatabaseOverview } from "@/actions/admin"
import { requireAdminPageAccess } from "@/lib/admin-check"

function AdminDatabaseLoading() {
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

			{/* Tables Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-6"
					>
						<Skeleton className="h-6 w-32 mb-4" />
						<div className="space-y-2">
							<div className="flex justify-between">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-12" />
							</div>
							<div className="flex justify-between">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-4 w-16" />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

async function AdminDatabaseContent() {
	const databaseOverview = await getDatabaseOverview()

	return <AdminDatabaseClient initialData={databaseOverview} />
}

export default async function AdminDatabasePage() {
	await requireAdminPageAccess()

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						Database Overview
					</h1>
					<p className="text-muted-foreground">
						Monitor database tables, record counts, and system
						health
					</p>
				</div>
			</div>

			<Suspense fallback={<AdminDatabaseLoading />}>
				<AdminDatabaseContent />
			</Suspense>
		</div>
	)
}
