"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
	BarChart3,
	TrendingUp,
	Clock,
	Phone,
	Users,
	Activity,
	Download,
	Calendar,
	PhoneCall
} from "lucide-react"
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
	ResponsiveContainer,
	Tooltip,
	PieChart,
	Pie,
	Cell
} from "recharts"
import { format } from "date-fns"

interface CallAnalytics {
	totalCalls: number
	totalDuration: number
	averageDuration: number
	totalCost: number
	averageCost: number
	successfulCalls: number
	failedCalls: number
	successRate: number
	sentimentBreakdown: {
		positive: number
		negative: number
		neutral: number
	}
	topPerformingAgents: Array<{
		agentId: number
		agentName: string
		callCount: number
		averageDuration: number
		successRate: number
	}>
	dailyCallVolume: Array<{
		date: string
		calls: number
		duration: number
		cost: number
	}>
}

interface AgentMetrics {
	agentId: number
	agentName: string
	totalCalls: number
	successfulCalls: number
	failedCalls: number
	totalDuration: number
	averageDuration: number
	totalCost: number
	averageCost: number
	sentimentDistribution: {
		positive: number
		negative: number
		neutral: number
	}
	leadsGenerated: number
	conversionsCount: number
	conversionRate: number
}

interface VoiceAgent {
	id: number
	name: string
	description: string | null
	status: "active" | "inactive"
}

interface RecentCall {
	id: string
	agentId: number
	phoneNumber: string | null
	status: string
	startTime: Date
	duration: number | null
	sentiment: string | null
	agent?: {
		id: number
		name: string
	}
}

interface Props {
	initialAnalytics: CallAnalytics
	voiceAgents: VoiceAgent[]
	recentCalls: RecentCall[]
	agentMetrics: AgentMetrics | null
	initialTimeRange: string
	initialAgentId?: number
}

const timeRangeOptions = [
	{ value: "today", label: "Today" },
	{ value: "week", label: "This Week" },
	{ value: "month", label: "This Month" },
	{ value: "quarter", label: "This Quarter" }
]

const SENTIMENT_COLORS = {
	positive: "#10b981",
	negative: "#ef4444",
	neutral: "#6b7280"
}

export default function AnalyticsDashboard({
	initialAnalytics,
	voiceAgents,
	recentCalls,
	agentMetrics,
	initialTimeRange,
	initialAgentId
}: Props) {
	const [timeRange, setTimeRange] = useState(initialTimeRange)
	const [selectedAgentId, setSelectedAgentId] = useState<string>(
		initialAgentId ? initialAgentId.toString() : "all"
	)
	const [isPending, startTransition] = useTransition()
	const router = useRouter()

	const handleTimeRangeChange = (newTimeRange: string) => {
		setTimeRange(newTimeRange)
		updateURL(newTimeRange, selectedAgentId)
	}

	const handleAgentChange = (newAgentId: string) => {
		setSelectedAgentId(newAgentId)
		updateURL(timeRange, newAgentId)
	}

	const updateURL = (newTimeRange: string, newAgentId: string) => {
		const params = new URLSearchParams()
		params.set("timeRange", newTimeRange)
		if (newAgentId !== "all") {
			params.set("agentId", newAgentId)
		}

		startTransition(() => {
			router.push(`/analytics?${params.toString()}`)
		})
	}

	const formatDuration = (seconds: number) => {
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return `${minutes}m ${remainingSeconds}s`
	}

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD"
		}).format(amount)
	}

	const exportData = () => {
		const csvData = [
			["Date", "Calls", "Duration (min)", "Cost"],
			...initialAnalytics.dailyCallVolume.map((day) => [
				day.date,
				day.calls.toString(),
				Math.round(day.duration / 60).toString(),
				day.cost.toFixed(2)
			])
		]

		const csvContent = csvData.map((row) => row.join(",")).join("\n")
		const blob = new Blob([csvContent], { type: "text/csv" })
		const url = URL.createObjectURL(blob)

		const a = document.createElement("a")
		a.href = url
		a.download = `voice-analytics-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	// Prepare sentiment data for pie chart
	const sentimentData = [
		{
			name: "Positive",
			value: initialAnalytics.sentimentBreakdown.positive,
			color: SENTIMENT_COLORS.positive
		},
		{
			name: "Neutral",
			value: initialAnalytics.sentimentBreakdown.neutral,
			color: SENTIMENT_COLORS.neutral
		},
		{
			name: "Negative",
			value: initialAnalytics.sentimentBreakdown.negative,
			color: SENTIMENT_COLORS.negative
		}
	].filter((item) => item.value > 0)

	return (
		<div className="space-y-6">
			{/* Controls */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div className="flex flex-col sm:flex-row gap-4">
					<Select
						value={timeRange}
						onValueChange={handleTimeRangeChange}
					>
						<SelectTrigger className="w-[180px] rounded-2xl">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{timeRangeOptions.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={selectedAgentId}
						onValueChange={handleAgentChange}
					>
						<SelectTrigger className="w-[200px] rounded-2xl">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Agents</SelectItem>
							{voiceAgents.map((agent) => (
								<SelectItem
									key={agent.id}
									value={agent.id.toString()}
								>
									{agent.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Button
					onClick={exportData}
					variant="outline"
					className="gap-2 rounded-2xl"
					disabled={isPending}
				>
					<Download className="h-4 w-4" />
					Export Data
				</Button>
			</div>

			{/* Metrics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<Phone className="h-4 w-4" />
							Total Calls
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{initialAnalytics.totalCalls}
						</div>
						<p className="text-xs text-muted-foreground">
							{initialAnalytics.successfulCalls} successful
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<TrendingUp className="h-4 w-4" />
							Success Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{Math.round(initialAnalytics.successRate * 100)}%
						</div>
						<p className="text-xs text-muted-foreground">
							{initialAnalytics.failedCalls} failed calls
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<Clock className="h-4 w-4" />
							Avg Duration
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatDuration(
								Math.round(initialAnalytics.averageDuration)
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							{formatDuration(
								Math.round(initialAnalytics.totalDuration)
							)}{" "}
							total
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<Activity className="h-4 w-4" />
							Total Cost
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatCurrency(initialAnalytics.totalCost)}
						</div>
						<p className="text-xs text-muted-foreground">
							{formatCurrency(initialAnalytics.averageCost)} avg
							per call
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<Users className="h-4 w-4" />
							Active Agents
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{
								voiceAgents.filter(
									(agent) => agent.status === "active"
								).length
							}
						</div>
						<p className="text-xs text-muted-foreground">
							{voiceAgents.length} total agents
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Call Volume Over Time */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-muted-foreground" />
							Call Volume
						</CardTitle>
						<CardDescription>Daily call activity</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							className="h-[300px] w-full"
							config={{}}
						>
							<AreaChart data={initialAnalytics.dailyCallVolume}>
								<defs>
									<linearGradient
										id="fillCalls"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="hsl(var(--primary))"
											stopOpacity={0.8}
										/>
										<stop
											offset="95%"
											stopColor="hsl(var(--primary))"
											stopOpacity={0.1}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									dataKey="date"
									tickFormatter={(value) =>
										format(new Date(value), "MMM dd")
									}
								/>
								<YAxis />
								<ChartTooltip
									content={({ active, payload, label }) => {
										if (
											active &&
											payload &&
											payload.length
										) {
											return (
												<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
													<p className="font-medium">
														{format(
															new Date(label),
															"MMM dd, yyyy"
														)}
													</p>
													<p className="text-primary">
														Calls:{" "}
														{payload[0].value}
													</p>
												</div>
											)
										}
										return null
									}}
								/>
								<Area
									type="monotone"
									dataKey="calls"
									stroke="hsl(var(--primary))"
									fill="url(#fillCalls)"
									strokeWidth={2}
								/>
							</AreaChart>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Sentiment Distribution */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5 text-muted-foreground" />
							Call Sentiment
						</CardTitle>
						<CardDescription>
							Distribution of call sentiment
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="h-[300px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={sentimentData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={100}
										paddingAngle={2}
										dataKey="value"
									>
										{sentimentData.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={entry.color}
											/>
										))}
									</Pie>
									<Tooltip
										content={({ active, payload }) => {
											if (
												active &&
												payload &&
												payload.length
											) {
												const data = payload[0].payload
												return (
													<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
														<p className="font-medium">
															{data.name}
														</p>
														<p
															style={{
																color: data.color
															}}
														>
															Count: {data.value}
														</p>
													</div>
												)
											}
											return null
										}}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>

						{/* Legend */}
						<div className="flex justify-center gap-4 mt-4">
							{sentimentData.map((item) => (
								<div
									key={item.name}
									className="flex items-center gap-2"
								>
									<div
										className="w-3 h-3 rounded-full"
										style={{ backgroundColor: item.color }}
									/>
									<span className="text-sm text-muted-foreground">
										{item.name} ({item.value})
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Top Performing Agents */}
			{initialAnalytics.topPerformingAgents.length > 0 && (
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-muted-foreground" />
							Top Performing Agents
						</CardTitle>
						<CardDescription>
							Agent performance rankings
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{initialAnalytics.topPerformingAgents.map(
								(agent, index) => (
									<div
										key={agent.agentId}
										className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 hover:bg-muted/30 transition-colors"
									>
										<div className="flex items-center gap-3">
											<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
												{index + 1}
											</div>
											<div>
												<p className="font-medium">
													{agent.agentName}
												</p>
												<p className="text-sm text-muted-foreground">
													{agent.callCount} calls •{" "}
													{formatDuration(
														agent.averageDuration
													)}{" "}
													avg
												</p>
											</div>
										</div>
										<Badge
											variant="outline"
											className="bg-green-50 text-green-700 border-green-200"
										>
											{agent.successRate}% success
										</Badge>
									</div>
								)
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Recent Calls */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PhoneCall className="h-5 w-5 text-muted-foreground" />
						Recent Calls
					</CardTitle>
					<CardDescription>Latest call activity</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{recentCalls.map((call) => (
							<div
								key={call.id}
								className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 hover:bg-muted/20 transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
										<Phone className="h-4 w-4" />
									</div>
									<div>
										<p className="font-medium">
											{call.agent?.name ||
												"Unknown Agent"}
										</p>
										<p className="text-sm text-muted-foreground">
											{call.phoneNumber ||
												"Unknown Number"}{" "}
											•{" "}
											{format(
												call.startTime,
												"MMM dd, HH:mm"
											)}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									{call.sentiment && (
										<Badge
											variant="outline"
											style={{
												backgroundColor: `${SENTIMENT_COLORS[call.sentiment as keyof typeof SENTIMENT_COLORS]}20`,
												borderColor:
													SENTIMENT_COLORS[
														call.sentiment as keyof typeof SENTIMENT_COLORS
													],
												color: SENTIMENT_COLORS[
													call.sentiment as keyof typeof SENTIMENT_COLORS
												]
											}}
										>
											{call.sentiment}
										</Badge>
									)}
									<span className="text-sm text-muted-foreground">
										{call.duration
											? formatDuration(call.duration)
											: "In progress"}
									</span>
								</div>
							</div>
						))}

						{recentCalls.length === 0 && (
							<div className="text-center py-6 text-muted-foreground">
								No recent calls found
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
