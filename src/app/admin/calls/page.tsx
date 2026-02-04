import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function AdminCallsLoading() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-10 w-48 mb-2" />
					<Skeleton className="h-4 w-64" />
				</div>
			</div>
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
		</div>
	)
}

export default function AdminCallsPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						Call Records
					</h1>
					<p className="text-muted-foreground">
						View all call records, transcripts, and call analytics
						across users
					</p>
				</div>
			</div>

			<Suspense fallback={<AdminCallsLoading />}>
				<div className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-8 text-center">
					<h3 className="text-lg font-medium mb-2">
						Call Management
					</h3>
					<p className="text-muted-foreground">
						Call records and transcripts management interface will
						be implemented here. This will connect to the voice API
						to fetch call data.
					</p>
				</div>
			</Suspense>
		</div>
	)
}
