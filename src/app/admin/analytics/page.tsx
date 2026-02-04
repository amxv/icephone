import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
	Activity,
	TrendingUp,
	Clock,
	AlertTriangle,
	Users,
	Phone,
	Mail,
	Calendar,
	MessageSquare,
	Search,
	Brain,
	Zap,
	Download
} from "lucide-react"
type ToolUsageStat = {
	toolName: string
	totalCalls: number
	successRate: number
	averageExecutionTime: number
	errorCount: number
}

type SystemHealth = {
	totalToolCalls: number
	overallSuccessRate: number
	averageResponseTime: number
	activeUsers: number
	slowQueries: Array<{
		toolName: string
		averageTime: number
	}>
}

// Tool icon mapping
const TOOL_ICONS = {
	updateLeadScore: TrendingUp,
	updateLeadNotes: MessageSquare,
	sendFollowUpEmail: Mail,
	sendFollowUpSMS: MessageSquare,
	searchCallTranscripts: Search,
	getLeadHistory: Users,
	scheduleAppointment: Calendar,
	createTask: Activity,
	updateDealStage: TrendingUp,
	searchKnowledgeBase: Brain,
	analyzeConversation: Brain,
	setReminder: Clock
}

async function ToolUsageStatsCard() {
	const stats: ToolUsageStat[] = []

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Activity className="h-5 w-5" />
					Tool Usage Statistics
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{stats.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>No tool usage data available yet</p>
						</div>
					) : (
						stats.map((tool) => {
							const IconComponent =
								TOOL_ICONS[
									tool.toolName as keyof typeof TOOL_ICONS
								] || Zap
							return (
								<div
									key={tool.toolName}
									className="flex items-center justify-between p-3 rounded-2xl bg-muted/20"
								>
									<div className="flex items-center gap-3">
										<div className="p-2 rounded-lg bg-primary/10">
											<IconComponent className="h-4 w-4 text-primary" />
										</div>
										<div>
											<p className="font-medium">
												{tool.toolName}
											</p>
											<p className="text-sm text-muted-foreground">
												{tool.totalCalls} calls •{" "}
												{tool.successRate.toFixed(1)}%
												success
											</p>
										</div>
									</div>
									<div className="text-right">
										<p className="text-sm font-medium">
											{tool.averageExecutionTime.toFixed(
												0
											)}
											ms
										</p>
										<Badge
											variant={
												tool.successRate > 95
													? "default"
													: tool.successRate > 85
														? "secondary"
														: "destructive"
											}
											className="text-xs"
										>
											{tool.errorCount} errors
										</Badge>
									</div>
								</div>
							)
						})
					)}
				</div>
			</CardContent>
		</Card>
	)
}

async function SystemHealthCard() {
	const health: SystemHealth = {
		totalToolCalls: 0,
		overallSuccessRate: 0,
		averageResponseTime: 0,
		activeUsers: 0,
		slowQueries: []
	}

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Activity className="h-5 w-5" />
					System Health
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Total Tool Calls
						</p>
						<p className="text-2xl font-bold">
							{health.totalToolCalls.toLocaleString()}
						</p>
					</div>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Success Rate
						</p>
						<p className="text-2xl font-bold text-green-600">
							{health.overallSuccessRate.toFixed(1)}%
						</p>
					</div>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Avg Response Time
						</p>
						<p className="text-2xl font-bold">
							{health.averageResponseTime.toFixed(0)}ms
						</p>
					</div>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Active Users
						</p>
						<p className="text-2xl font-bold">
							{health.activeUsers}
						</p>
					</div>
				</div>

				{health.slowQueries.length > 0 && (
					<div className="mt-6">
						<h4 className="font-medium mb-3 flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-amber-500" />
							Slow Queries
						</h4>
						<div className="space-y-2">
							{health.slowQueries.map((query, index) => (
								<div
									key={index}
									className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20"
								>
									<span className="text-sm">
										{query.toolName}
									</span>
									<Badge
										variant="secondary"
										className="text-xs"
									>
										{query.averageTime.toFixed(0)}ms avg
									</Badge>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function LoadingSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{[...Array(4)].map((_, i) => (
					<Card
						key={i}
						className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm"
					>
						<CardContent className="p-6">
							<Skeleton className="h-4 w-20 mb-2" />
							<Skeleton className="h-8 w-16" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<Skeleton className="h-6 w-40" />
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{[...Array(5)].map((_, i) => (
								<div
									key={i}
									className="flex items-center justify-between"
								>
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-16" />
								</div>
							))}
						</div>
					</CardContent>
				</Card>
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<Skeleton className="h-6 w-32" />
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							{[...Array(4)].map((_, i) => (
								<div key={i} className="space-y-2">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-8 w-16" />
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

export default function AdminAnalyticsPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						Platform Analytics
					</h1>
					<p className="text-muted-foreground">
						Platform-wide analytics and system health insights
					</p>
				</div>
				<Button variant="outline" className="rounded-2xl">
					<Download className="h-4 w-4 mr-2" />
					Export Report
				</Button>
			</div>

			<Suspense fallback={<LoadingSkeleton />}>
				<div className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<ToolUsageStatsCard />
						<SystemHealthCard />
					</div>
				</div>
			</Suspense>

			<div className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm p-8 text-center">
				<h3 className="text-lg font-medium mb-2">
					Additional Analytics
				</h3>
				<p className="text-muted-foreground">
					Revenue analytics, user behavior patterns, and advanced
					performance monitoring will be added in future phases.
				</p>
			</div>
		</div>
	)
}
