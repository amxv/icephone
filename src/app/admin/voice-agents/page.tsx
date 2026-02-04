import { Suspense } from "react"
import {
	getAllVoiceAgents,
	getVoiceAgentStats,
	getVoiceAgentCreationOptions
} from "@/actions/admin-voice-agents"
import { AdminVoiceAgentsClient } from "./AdminVoiceAgentsClient"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAdminPageAccess } from "@/lib/admin-check"

// Force dynamic rendering for admin pages
export const dynamic = "force-dynamic"

// Loading component for suspense
function AdminVoiceAgentsLoading() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				{/* Header skeleton */}
				<div className="flex items-center justify-between">
					<div>
						<Skeleton className="h-12 w-64 rounded-2xl" />
					</div>
					<Skeleton className="h-10 w-32 rounded-2xl" />
				</div>

				{/* Stats cards skeleton */}
				<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-3xl" />
					))}
				</div>

				{/* Search and filters skeleton */}
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-80 rounded-2xl" />
					<Skeleton className="h-10 w-32 rounded-2xl" />
				</div>

				{/* Table skeleton */}
				<div className="flex-1 space-y-4">
					<Skeleton className="h-10 w-full rounded-2xl" />
					{Array.from({ length: 8 }).map((_, i) => (
						<Skeleton key={i} className="h-16 w-full rounded-2xl" />
					))}
				</div>
			</div>
		</div>
	)
}

// Error state client component
function ErrorState() {
	return (
		<div className="flex flex-col items-center justify-center h-full text-center">
			<div className="rounded-full p-3 border border-border/40 shadow-sm mb-4">
				<svg
					className="h-6 w-6 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					aria-label="Warning icon"
				>
					<title>Warning icon</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
					/>
				</svg>
			</div>
			<h3 className="text-lg font-medium mb-2">
				Failed to Load Voice Agents
			</h3>
			<p className="text-sm text-muted-foreground mb-4">
				There was an error loading the voice agents data. Please try
				refreshing the page.
			</p>
		</div>
	)
}

export default async function AdminVoiceAgentsPage() {
	await requireAdminPageAccess()

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<Suspense fallback={<AdminVoiceAgentsLoading />}>
					<AdminVoiceAgentsData />
				</Suspense>
			</div>
		</div>
	)
}

async function AdminVoiceAgentsData() {
	try {
		// Fetch initial data
		const [voiceAgents, stats, creationOptions] = await Promise.all([
			getAllVoiceAgents(),
			getVoiceAgentStats(),
			getVoiceAgentCreationOptions()
		])

		return (
			<AdminVoiceAgentsClient
				initialVoiceAgents={voiceAgents}
				initialStats={stats}
				creationOptions={creationOptions}
			/>
		)
	} catch (error) {
		console.error("Error loading voice agents data:", error)

		// Error fallback without client-side onClick
		return <ErrorState />
	}
}
