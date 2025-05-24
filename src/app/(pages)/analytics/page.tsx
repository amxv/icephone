import { Suspense } from "react"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import {
	getCallAnalytics,
	getAgentPerformanceMetrics,
	getRecentCalls
} from "@/actions/call-analytics"
import { getVoiceAgents } from "@/actions/voice-agents"
import AnalyticsDashboard from "./components/AnalyticsDashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface SearchParams {
	timeRange?: "today" | "week" | "month" | "quarter"
	agentId?: string
}

function MetricsSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
			{Array.from({ length: 5 }).map((_, i) => (
				<div
					key={i}
					className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-6"
				>
					<Skeleton className="h-4 w-20 mb-4" />
					<Skeleton className="h-8 w-12" />
				</div>
			))}
		</div>
	)
}

function ChartsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-6">
					<Skeleton className="h-6 w-32 mb-4" />
					<Skeleton className="h-[300px] w-full" />
				</div>
				<div className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-6">
					<Skeleton className="h-6 w-32 mb-4" />
					<Skeleton className="h-[300px] w-full" />
				</div>
			</div>
		</div>
	)
}

export default async function AnalyticsPage({
	searchParams
}: {
	searchParams: Promise<SearchParams>
}) {
	const user = await currentUser()
	if (!user) {
		redirect("/sign-in")
	}

	// Await search params in Next.js 15
	const params = await searchParams

	// Parse search params with defaults
	const timeRange = params.timeRange || "week"
	const agentId = params.agentId
		? Number.parseInt(params.agentId)
		: undefined

	// Fetch initial data
	const [analyticsResult, voiceAgentsResult, recentCallsResult] =
		await Promise.all([
			getCallAnalytics(timeRange),
			getVoiceAgents(),
			getRecentCalls(10)
		])

	const analytics = analyticsResult

	// Transform voiceAgents to match expected interface
	const voiceAgents = (voiceAgentsResult.data || []).map((agent) => ({
		id: agent.id,
		name: agent.name,
		description: agent.description,
		status: (agent.status || "inactive") as "active" | "inactive"
	}))

	// Transform recentCalls to match expected interface
	const recentCalls = recentCallsResult.map((call) => ({
		id: call.sessionId || call.id.toString(),
		agentId: call.id, // Use the session id as a proxy for agentId
		phoneNumber: call.phoneNumber,
		status: call.status || "unknown",
		startTime: call.startTime,
		duration: call.duration,
		sentiment: call.sentiment,
		agent: call.agentName
			? {
					id: call.id,
					name: call.agentName
				}
			: undefined
	}))

	// Get detailed metrics for specific agent if selected
	let agentMetrics = null
	if (agentId) {
		agentMetrics = await getAgentPerformanceMetrics(agentId)
	}

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-8 p-2 md:px-8 md:py-4 h-full">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
							Voice Analytics
						</h1>
						<p className="text-muted-foreground">
							Monitor your voice agent performance and call
							metrics
						</p>
					</div>
				</div>

				{/* Main Analytics Dashboard */}
				<Suspense fallback={<MetricsSkeleton />}>
					<Suspense fallback={<ChartsSkeleton />}>
						<AnalyticsDashboard
							initialAnalytics={analytics}
							voiceAgents={voiceAgents}
							recentCalls={recentCalls}
							agentMetrics={agentMetrics}
							initialTimeRange={timeRange}
							initialAgentId={agentId}
						/>
					</Suspense>
				</Suspense>
			</div>
		</div>
	)
}
