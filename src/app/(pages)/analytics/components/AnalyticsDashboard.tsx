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
	PhoneCall,
	DollarSign,
	ArrowUpIcon,
	ArrowDownIcon
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
	pickupRate: number
	outcomeBreakdown: Record<string, number>
	directionBreakdown: {
		incoming: number
		outgoing: number
		unknown: number
	}
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
	hourlyCallVolume: Array<{
		hour: string
		calls: number
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

// New interfaces for enhanced analytics
interface PerformanceTrends {
	timeRange: string
	weeklyTrends: Array<{
		week: string
		totalCalls: number
		successRate: number
		averageDuration: number
		totalCost: number
		positiveCallsPercent: number
		growthRates: {
			calls: number
			cost: number
			duration: number
		}
	}>
	overallTrend: {
		totalPeriodCalls: number
		averageSuccessRate: number
		totalPeriodCost: number
		averagePositiveSentiment: number
	}
}

interface CostAnalytics {
	timeRange: string
	summary: {
		totalCost: number
		totalCalls: number
		averageCostPerCall: number
		costPerMinute: number
	}
	agentBreakdown: Array<{
		agentId: number | null
		agentName: string | null
		totalCost: number
		callCount: number
		averageCostPerCall: number
		totalDuration: number
		costShare: number
	}>
	directionBreakdown: Array<{
		direction: string | null
		totalCost: number
		callCount: number
		averageCostPerCall: number
	}>
}

interface CallActivityData {
	date: string
	inbound: number
	outbound: number
}

interface LeadAcquisitionData {
	date: string
	newLeads: number
	qualifiedLeads: number
}

interface Props {
	initialAnalytics: CallAnalytics
	voiceAgents: VoiceAgent[]
	recentCalls: RecentCall[]
	agentMetrics: AgentMetrics | null
	initialTimeRange: string
	initialAgentId?: number
	performanceTrends: PerformanceTrends
	costAnalytics: CostAnalytics
	callActivityData: CallActivityData[]
	leadAcquisitionData: LeadAcquisitionData[]
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

const OUTCOME_COLORS: Record<string, string> = {
	completed: "#22c55e",
	answered: "#10b981",
	failed: "#ef4444",
	voicemail: "#f97316",
	no_answer: "#f59e0b",
	busy: "#facc15",
	timeout: "#8b5cf6",
	unknown: "#94a3b8",
	active: "#38bdf8"
}

export default function AnalyticsDashboard({
	initialAnalytics,
	voiceAgents,
	recentCalls,
	agentMetrics,
	initialTimeRange,
	initialAgentId,
	performanceTrends,
	costAnalytics,
	callActivityData,
	leadAcquisitionData
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

	const formatGrowthRate = (rate: number) => {
		const isPositive = rate > 0
		return (
			<span
				className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}
			>
				{isPositive ? (
					<ArrowUpIcon className="h-3 w-3" />
				) : (
					<ArrowDownIcon className="h-3 w-3" />
				)}
				{Math.abs(rate)}%
			</span>
		)
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

	const formatOutcomeLabel = (value: string) =>
		value
			.replace(/_/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase())

	const outcomeData = Object.entries(initialAnalytics.outcomeBreakdown)
		.map(([key, value]) => ({
			key,
			name: formatOutcomeLabel(key),
			value,
			color: OUTCOME_COLORS[key] ?? "#94a3b8"
		}))
		.filter((item) => item.value > 0)
		.sort((a, b) => b.value - a.value)

	const answeredCalls =
		(initialAnalytics.outcomeBreakdown.completed || 0) +
		(initialAnalytics.outcomeBreakdown.answered || 0)

	const directionData = [
		{
			name: "Inbound",
			value: initialAnalytics.directionBreakdown.incoming
		},
		{
			name: "Outbound",
			value: initialAnalytics.directionBreakdown.outgoing
		}
	].filter((item) => item.value > 0)

	// Prepare cost breakdown data for pie chart
	const costByAgentData = costAnalytics.agentBreakdown
		.filter((agent) => agent.totalCost > 0)
		.map((agent, index) => ({
			name: agent.agentName || "Unknown Agent",
			value: agent.totalCost,
			color: `hsl(${(index * 45) % 360}, 70%, 50%)`
		}))

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

			{/* Enhanced Metrics Cards with Trends */}
			<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								{initialAnalytics.successfulCalls} successful
							</p>
							{performanceTrends.weeklyTrends.length > 1 && (
								<div className="text-xs">
									{formatGrowthRate(
										performanceTrends.weeklyTrends[
											performanceTrends.weeklyTrends
												.length - 1
										]?.growthRates.calls || 0
									)}
								</div>
							)}
						</div>
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
							{Math.round(initialAnalytics.successRate)}%
						</div>
						<p className="text-xs text-muted-foreground">
							{initialAnalytics.failedCalls} failed calls
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<PhoneCall className="h-4 w-4" />
							Pickup Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{Math.round(initialAnalytics.pickupRate)}%
						</div>
						<p className="text-xs text-muted-foreground">
							{answeredCalls} answered of {initialAnalytics.totalCalls}
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
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								{formatDuration(
									Math.round(initialAnalytics.totalDuration)
								)}{" "}
								total
							</p>
							{performanceTrends.weeklyTrends.length > 1 && (
								<div className="text-xs">
									{formatGrowthRate(
										performanceTrends.weeklyTrends[
											performanceTrends.weeklyTrends
												.length - 1
										]?.growthRates.duration || 0
									)}
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
							<DollarSign className="h-4 w-4" />
							Total Cost
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatCurrency(initialAnalytics.totalCost)}
						</div>
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								{formatCurrency(initialAnalytics.averageCost)}{" "}
								avg per call
							</p>
							{performanceTrends.weeklyTrends.length > 1 && (
								<div className="text-xs">
									{formatGrowthRate(
										performanceTrends.weeklyTrends[
											performanceTrends.weeklyTrends
												.length - 1
										]?.growthRates.cost || 0
									)}
								</div>
							)}
						</div>
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

			{/* Enhanced Charts Grid */}
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

				{/* Cost Breakdown by Agent */}
				{costByAgentData.length > 0 && (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<DollarSign className="h-5 w-5 text-muted-foreground" />
								Cost by Agent
							</CardTitle>
							<CardDescription>
								Cost distribution across voice agents
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-[300px] w-full">
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={costByAgentData}
											cx="50%"
											cy="50%"
											innerRadius={60}
											outerRadius={100}
											paddingAngle={2}
											dataKey="value"
										>
											{costByAgentData.map(
												(entry, index) => (
													<Cell
														key={`cell-${index}`}
														fill={entry.color}
													/>
												)
											)}
										</Pie>
										<Tooltip
											content={({ active, payload }) => {
												if (
													active &&
													payload &&
													payload.length
												) {
													const data =
														payload[0].payload
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
																Cost:{" "}
																{formatCurrency(
																	data.value
																)}
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
							<div className="flex flex-wrap justify-center gap-2 mt-4">
								{costByAgentData.slice(0, 4).map((item) => (
									<div
										key={item.name}
										className="flex items-center gap-2"
									>
										<div
											className="w-3 h-3 rounded-full"
											style={{
												backgroundColor: item.color
											}}
										/>
										<span className="text-sm text-muted-foreground">
											{item.name}
										</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

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

				{/* Call Outcomes */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<PhoneCall className="h-5 w-5 text-muted-foreground" />
							Call Outcomes
						</CardTitle>
						<CardDescription>
							Pickup and outcome distribution
						</CardDescription>
					</CardHeader>
					<CardContent>
						{outcomeData.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No outcome data available for this range.
							</p>
						) : (
							<>
								<div className="h-[260px] w-full">
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={outcomeData}
												cx="50%"
												cy="50%"
												innerRadius={55}
												outerRadius={95}
												paddingAngle={2}
												dataKey="value"
											>
												{outcomeData.map((entry) => (
													<Cell
														key={entry.key}
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
														const data =
															payload[0].payload
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

								<div className="flex flex-wrap justify-center gap-2 mt-4">
									{outcomeData.map((item) => (
										<div
											key={item.key}
											className="flex items-center gap-2"
										>
											<div
												className="w-3 h-3 rounded-full"
												style={{
													backgroundColor: item.color
												}}
											/>
											<span className="text-sm text-muted-foreground">
												{item.name} ({item.value})
											</span>
										</div>
									))}
								</div>

								{directionData.length > 0 && (
									<div className="flex flex-wrap justify-center gap-2 mt-4">
										{directionData.map((item) => (
											<Badge
												key={item.name}
												variant="outline"
												className="rounded-full"
											>
												{item.name}: {item.value}
											</Badge>
										))}
									</div>
								)}
							</>
						)}
					</CardContent>
				</Card>

				{/* Hourly Call Volume */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-muted-foreground" />
							Call Volume by Hour
						</CardTitle>
						<CardDescription>
							When calls happen across the day
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer className="h-[300px] w-full" config={{}}>
							<BarChart data={initialAnalytics.hourlyCallVolume}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="hour" interval={3} />
								<YAxis />
								<ChartTooltip
									content={({ active, payload }) => {
										if (active && payload && payload.length) {
											return (
												<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
													<p className="font-medium">
														{payload[0].payload.hour}
													</p>
													<p className="text-primary">
														Calls: {payload[0].value}
													</p>
												</div>
											)
										}
										return null
									}}
								/>
								<Bar
									dataKey="calls"
									fill="hsl(var(--primary))"
									radius={[6, 6, 0, 0]}
								/>
							</BarChart>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* User Activity Trends - Calls and Leads */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5 text-muted-foreground" />
							Activity Trends
						</CardTitle>
						<CardDescription>
							Call activity and lead acquisition over time
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							className="h-[300px] w-full"
							config={{}}
						>
							<LineChart data={callActivityData.slice(-14)}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									dataKey="date"
									tickFormatter={(value) =>
										format(new Date(value), "MM/dd")
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
													{payload.map(
														(entry, index) => (
															<p
																key={index}
																style={{
																	color: entry.color
																}}
															>
																{entry.dataKey}:{" "}
																{entry.value}
															</p>
														)
													)}
												</div>
											)
										}
										return null
									}}
								/>
								<Line
									type="monotone"
									dataKey="inbound"
									stroke="#10b981"
									strokeWidth={2}
								/>
								<Line
									type="monotone"
									dataKey="outbound"
									stroke="#3b82f6"
									strokeWidth={2}
								/>
							</LineChart>
						</ChartContainer>
					</CardContent>
				</Card>
			</div>

			{/* Performance Trends Analysis */}
			{performanceTrends.weeklyTrends.length > 0 && (
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5 text-muted-foreground" />
							Performance Trends Analysis
						</CardTitle>
						<CardDescription>
							Weekly performance trends with growth rates
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{/* Overall Trend Summary */}
							<div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/20">
								<div className="text-center">
									<p className="text-sm text-muted-foreground">
										Total Period Calls
									</p>
									<p className="text-lg font-bold">
										{
											performanceTrends.overallTrend
												.totalPeriodCalls
										}
									</p>
								</div>
								<div className="text-center">
									<p className="text-sm text-muted-foreground">
										Avg Success Rate
									</p>
									<p className="text-lg font-bold">
										{Math.round(
											performanceTrends.overallTrend
												.averageSuccessRate
										)}
										%
									</p>
								</div>
								<div className="text-center">
									<p className="text-sm text-muted-foreground">
										Total Period Cost
									</p>
									<p className="text-lg font-bold">
										{formatCurrency(
											performanceTrends.overallTrend
												.totalPeriodCost
										)}
									</p>
								</div>
								<div className="text-center">
									<p className="text-sm text-muted-foreground">
										Avg Positive Sentiment
									</p>
									<p className="text-lg font-bold">
										{Math.round(
											performanceTrends.overallTrend
												.averagePositiveSentiment
										)}
										%
									</p>
								</div>
							</div>

							{/* Weekly Performance Chart */}
							<ChartContainer
								className="h-[300px] w-full"
								config={{}}
							>
								<LineChart
									data={performanceTrends.weeklyTrends}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="week"
										tickFormatter={(value) =>
											format(new Date(value), "MMM dd")
										}
									/>
									<YAxis />
									<ChartTooltip
										content={({
											active,
											payload,
											label
										}) => {
											if (
												active &&
												payload &&
												payload.length
											) {
												const data = payload[0].payload
												return (
													<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
														<p className="font-medium">
															Week of{" "}
															{format(
																new Date(label),
																"MMM dd, yyyy"
															)}
														</p>
														<p className="text-blue-600">
															Calls:{" "}
															{data.totalCalls}
														</p>
														<p className="text-green-600">
															Success Rate:{" "}
															{Math.round(
																data.successRate
															)}
															%
														</p>
														<p className="text-purple-600">
															Cost:{" "}
															{formatCurrency(
																data.totalCost
															)}
														</p>
													</div>
												)
											}
											return null
										}}
									/>
									<Line
										type="monotone"
										dataKey="totalCalls"
										stroke="#3b82f6"
										strokeWidth={2}
									/>
									<Line
										type="monotone"
										dataKey="successRate"
										stroke="#10b981"
										strokeWidth={2}
									/>
								</LineChart>
							</ChartContainer>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Cost Analytics */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<DollarSign className="h-5 w-5 text-muted-foreground" />
						Cost Analytics
					</CardTitle>
					<CardDescription>
						Detailed cost breakdown and efficiency metrics
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						{/* Cost Summary */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="p-4 rounded-2xl bg-muted/20">
								<p className="text-sm text-muted-foreground">
									Total Cost
								</p>
								<p className="text-xl font-bold">
									{formatCurrency(
										costAnalytics.summary.totalCost
									)}
								</p>
							</div>
							<div className="p-4 rounded-2xl bg-muted/20">
								<p className="text-sm text-muted-foreground">
									Avg Cost Per Call
								</p>
								<p className="text-xl font-bold">
									{formatCurrency(
										costAnalytics.summary.averageCostPerCall
									)}
								</p>
							</div>
							<div className="p-4 rounded-2xl bg-muted/20">
								<p className="text-sm text-muted-foreground">
									Cost Per Minute
								</p>
								<p className="text-xl font-bold">
									{formatCurrency(
										costAnalytics.summary.costPerMinute
									)}
								</p>
							</div>
						</div>

						{/* Agent Cost Breakdown */}
						{costAnalytics.agentBreakdown.length > 0 && (
							<div className="space-y-3">
								<h4 className="font-medium">Cost by Agent</h4>
								{costAnalytics.agentBreakdown.map((agent) => (
									<div
										key={agent.agentId}
										className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 hover:bg-muted/20 transition-colors"
									>
										<div className="flex items-center gap-3">
											<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
												{agent.agentName?.charAt(0) ||
													"U"}
											</div>
											<div>
												<p className="font-medium">
													{agent.agentName ||
														"Unknown Agent"}
												</p>
												<p className="text-sm text-muted-foreground">
													{agent.callCount} calls •{" "}
													{formatDuration(
														agent.totalDuration || 0
													)}
												</p>
											</div>
										</div>
										<div className="text-right">
											<p className="font-bold">
												{formatCurrency(
													agent.totalCost || 0
												)}
											</p>
											<p className="text-sm text-muted-foreground">
												{formatCurrency(
													agent.averageCostPerCall ||
														0
												)}{" "}
												avg
											</p>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

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
