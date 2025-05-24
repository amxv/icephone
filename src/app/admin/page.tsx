import { Suspense } from "react"
import { AdminStatsCards } from "@/components/admin/AdminStatsCards"
import { AdminActivityFeed } from "@/components/admin/AdminActivityFeed"
import { AdminQuickActions } from "@/components/admin/AdminQuickActions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminDashboard() {
	return (
		<div className="space-y-8">
			{/* Page Header */}
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Admin Dashboard
				</h1>
				<p className="text-muted-foreground">
					Complete overview and management of the IcePhone platform
				</p>
			</div>

			{/* Stats Cards */}
			<Suspense fallback={<StatsCardsSkeleton />}>
				<AdminStatsCards />
			</Suspense>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Quick Actions */}
				<div className="lg:col-span-4">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader>
							<CardTitle className="text-lg font-medium">
								Quick Actions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<AdminQuickActions />
						</CardContent>
					</Card>
				</div>

				{/* Activity Feed */}
				<div className="lg:col-span-8">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader>
							<CardTitle className="text-lg font-medium">
								Recent Activity
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Suspense fallback={<ActivityFeedSkeleton />}>
								<AdminActivityFeed />
							</Suspense>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}

function StatsCardsSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<Card
					key={i}
					className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm"
				>
					<CardContent className="p-6">
						<div className="space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-8 w-16" />
							<Skeleton className="h-3 w-24" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}

function ActivityFeedSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 5 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<Skeleton className="h-10 w-10 rounded-full" />
					<div className="space-y-1 flex-1">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
					<Skeleton className="h-3 w-16" />
				</div>
			))}
		</div>
	)
}
