"use client"

import { useState, useEffect, useCallback } from "react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	generateCampaignReport,
	getCampaignHealth,
	checkPerformanceAlerts,
	type CampaignReport,
	type CampaignHealth,
	type PerformanceAlert
} from "@/actions/campaigns"
import {
	BarChart,
	Bar,
	LineChart,
	Line,
	PieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Area,
	AreaChart
} from "recharts"
import {
	Activity,
	AlertTriangle,
	TrendingUp,
	TrendingDown,
	Clock,
	Phone,
	Target,
	DollarSign,
	Users,
	CheckCircle2,
	XCircle,
	AlertCircle,
	Download,
	RefreshCw
} from "lucide-react"
import { format } from "date-fns"

interface CampaignAnalyticsDashboardProps {
	campaignId: string
	campaignName?: string
}

const COLORS = {
	primary: "#3b82f6",
	success: "#10b981",
	warning: "#f59e0b",
	danger: "#ef4444",
	muted: "#6b7280"
}

const HEALTH_COLORS = {
	healthy: "#10b981",
	warning: "#f59e0b",
	critical: "#ef4444"
}

export function CampaignAnalyticsDashboard({
	campaignId,
	campaignName
}: CampaignAnalyticsDashboardProps) {
	const [report, setReport] = useState<CampaignReport | null>(null)
	const [health, setHealth] = useState<CampaignHealth | null>(null)
	const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [activeTab, setActiveTab] = useState("overview")

	const fetchAnalytics = useCallback(
		async (showRefreshing = false) => {
			if (showRefreshing) setRefreshing(true)
			else setLoading(true)

			try {
				const [reportResult, healthResult, alertsResult] =
					await Promise.all([
						generateCampaignReport(parseInt(campaignId)),
						getCampaignHealth(parseInt(campaignId)),
						checkPerformanceAlerts(parseInt(campaignId))
					])

				if (reportResult.success && reportResult.data) {
					setReport(reportResult.data)
				}

				if (healthResult.success && healthResult.data) {
					setHealth(healthResult.data)
				}

				if (alertsResult.success && alertsResult.data) {
					setAlerts(alertsResult.data)
				}
			} catch (error) {
				console.error("Error fetching campaign analytics:", error)
			} finally {
				setLoading(false)
				setRefreshing(false)
			}
		},
		[campaignId]
	)

	useEffect(() => {
		fetchAnalytics()

		// Auto-refresh every 30 seconds
		const interval = setInterval(() => fetchAnalytics(true), 30000)
		return () => clearInterval(interval)
	}, [fetchAnalytics])

	const exportReport = () => {
		if (!report) return

		const csvData = [
			["Campaign Analytics Report"],
			["Campaign", report.name],
			[
				"Period",
				`${format(report.period.startDate, "MMM dd, yyyy")} - ${format(report.period.endDate, "MMM dd, yyyy")}`
			],
			[""],
			["Summary Metrics"],
			["Total Leads", report.summary.totalLeads.toString()],
			["Calls Attempted", report.summary.callsAttempted.toString()],
			["Calls Completed", report.summary.callsCompleted.toString()],
			["Success Rate", `${report.summary.successRate.toFixed(1)}%`],
			["Conversion Rate", `${report.summary.conversionRate.toFixed(1)}%`],
			[
				"Average Call Duration",
				`${Math.round(report.summary.avgCallDuration)} seconds`
			],
			["Total Call Cost", `$${report.summary.totalCallCost.toFixed(2)}`],
			[
				"Converted Revenue",
				`$${report.summary.convertedRevenue.toFixed(2)}`
			],
			["Cost per Lead", `$${report.summary.costPerLead.toFixed(2)}`],
			[
				"Cost per Conversion",
				`$${report.summary.costPerConversion.toFixed(2)}`
			],
			["ROI", `${report.summary.roi.toFixed(1)}%`],
			[""],
			["Daily Breakdown"],
			["Date", "Calls Attempted", "Calls Completed", "Success Rate"],
			...report.dailyBreakdown.map((day) => [
				day.date,
				day.callsAttempted.toString(),
				day.callsCompleted.toString(),
				`${day.successRate.toFixed(1)}%`
			])
		]

		const csvContent = csvData.map((row) => row.join(",")).join("\n")
		const blob = new Blob([csvContent], { type: "text/csv" })
		const url = URL.createObjectURL(blob)

		const a = document.createElement("a")
		a.href = url
		a.download = `campaign-${campaignId}-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	if (loading && !report) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-semibold tracking-tight">
						Campaign Analytics
					</h2>
				</div>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Card key={i} className="rounded-2xl animate-pulse">
							<CardContent className="p-6">
								<div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
								<div className="h-8 bg-muted rounded w-1/2"></div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		)
	}

	if (!report || !health) {
		return (
			<Card className="rounded-2xl">
				<CardContent className="p-6 text-center">
					<AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
					<p className="text-muted-foreground">
						Unable to load campaign analytics
					</p>
					<Button
						variant="outline"
						className="mt-4"
						onClick={() => fetchAnalytics()}
					>
						Try Again
					</Button>
				</CardContent>
			</Card>
		)
	}

	// Prepare chart data
	const dailyChartData = report.dailyBreakdown.map((day) => ({
		date: format(new Date(day.date), "MMM dd"),
		attempted: day.callsAttempted,
		completed: day.callsCompleted,
		successRate: day.successRate
	}))

	const leadProgressData = [
		{
			name: "Contacted",
			value: report.leadProgress.contacted,
			color: COLORS.primary
		},
		{
			name: "Qualified",
			value: report.leadProgress.qualified,
			color: COLORS.warning
		},
		{
			name: "Converted",
			value: report.leadProgress.converted,
			color: COLORS.success
		},
		{
			name: "Failed",
			value: report.leadProgress.failed,
			color: COLORS.danger
		}
	].filter((item) => item.value > 0)

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-semibold tracking-tight">
						Campaign Analytics
					</h2>
					<p className="text-muted-foreground">
						Performance metrics for{" "}
						{campaignName || `Campaign ${campaignId}`}
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => fetchAnalytics(true)}
						disabled={refreshing}
						className="rounded-lg"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={exportReport}
						className="rounded-lg"
					>
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
				</div>
			</div>

			{/* Health Status & Alerts */}
			{(health.healthScore < 80 || alerts.length > 0) && (
				<Card className="rounded-2xl border-warning bg-warning/5">
					<CardContent className="p-4">
						<div className="flex items-start gap-3">
							<AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
							<div className="flex-1">
								<h3 className="font-medium">
									Campaign Health Alerts
								</h3>
								<div className="mt-2 space-y-1">
									{health.issues.map((issue, i) => (
										<p
											key={i}
											className="text-sm text-muted-foreground"
										>
											• {issue}
										</p>
									))}
									{alerts.map((alert, i) => (
										<p
											key={`alert-${i}`}
											className="text-sm text-muted-foreground"
										>
											• {alert.message}
										</p>
									))}
								</div>
							</div>
							<Badge
								variant="outline"
								style={{
									borderColor: HEALTH_COLORS[health.status],
									color: HEALTH_COLORS[health.status]
								}}
							>
								Health: {health.healthScore}/100
							</Badge>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Key Metrics Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card className="rounded-2xl">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Success Rate
								</p>
								<div className="flex items-center gap-2">
									<p className="text-2xl font-bold">
										{report.summary.successRate.toFixed(1)}%
									</p>
									{report.summary.successRate >= 50 ? (
										<TrendingUp className="h-4 w-4 text-success" />
									) : (
										<TrendingDown className="h-4 w-4 text-danger" />
									)}
								</div>
							</div>
							<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
								<Target className="h-6 w-6 text-primary" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-2xl">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Conversion Rate
								</p>
								<div className="flex items-center gap-2">
									<p className="text-2xl font-bold">
										{report.summary.conversionRate.toFixed(
											1
										)}
										%
									</p>
									{report.summary.conversionRate >= 10 ? (
										<TrendingUp className="h-4 w-4 text-success" />
									) : (
										<TrendingDown className="h-4 w-4 text-warning" />
									)}
								</div>
							</div>
							<div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
								<CheckCircle2 className="h-6 w-6 text-success" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-2xl">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Cost per Lead
								</p>
								<p className="text-2xl font-bold">
									${report.summary.costPerLead.toFixed(2)}
								</p>
							</div>
							<div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
								<DollarSign className="h-6 w-6 text-warning" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-2xl">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Avg Call Duration
								</p>
								<p className="text-2xl font-bold">
									{Math.round(report.summary.avgCallDuration)}
									s
								</p>
							</div>
							<div className="h-12 w-12 rounded-full bg-muted/10 flex items-center justify-center">
								<Clock className="h-6 w-6 text-muted-foreground" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Analytics Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 mb-6 h-auto">
					<TabsTrigger
						value="overview"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<Activity className="h-4 w-4 mr-2" />
						Overview
					</TabsTrigger>
					<TabsTrigger
						value="performance"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<TrendingUp className="h-4 w-4 mr-2" />
						Performance
					</TabsTrigger>
					<TabsTrigger
						value="leads"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<Users className="h-4 w-4 mr-2" />
						Lead Progress
					</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6">
					<div className="grid gap-6 md:grid-cols-2">
						{/* Daily Performance Chart */}
						<Card className="rounded-2xl">
							<CardHeader>
								<CardTitle className="text-lg">
									Daily Call Performance
								</CardTitle>
								<CardDescription>
									Call attempts and completions over time
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer width="100%" height={300}>
									<AreaChart data={dailyChartData}>
										<CartesianGrid
											strokeDasharray="3 3"
											className="opacity-30"
										/>
										<XAxis
											dataKey="date"
											className="text-xs"
										/>
										<YAxis className="text-xs" />
										<Tooltip
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
													return (
														<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
															<p className="font-medium">
																{label}
															</p>
															{payload.map(
																(
																	entry,
																	index
																) => (
																	<p
																		key={
																			index
																		}
																		style={{
																			color: entry.color
																		}}
																	>
																		{
																			entry.dataKey
																		}
																		:{" "}
																		{
																			entry.value
																		}
																	</p>
																)
															)}
														</div>
													)
												}
												return null
											}}
										/>
										<Area
											type="monotone"
											dataKey="attempted"
											stackId="1"
											stroke={COLORS.primary}
											fill={COLORS.primary}
											fillOpacity={0.3}
										/>
										<Area
											type="monotone"
											dataKey="completed"
											stackId="2"
											stroke={COLORS.success}
											fill={COLORS.success}
											fillOpacity={0.5}
										/>
									</AreaChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>

						{/* Summary Stats */}
						<Card className="rounded-2xl">
							<CardHeader>
								<CardTitle className="text-lg">
									Campaign Summary
								</CardTitle>
								<CardDescription>
									{format(report.period.startDate, "MMM dd")}{" "}
									-{" "}
									{format(
										report.period.endDate,
										"MMM dd, yyyy"
									)}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="text-center p-3 rounded-lg bg-blue-50">
										<Phone className="h-5 w-5 text-blue-600 mx-auto mb-1" />
										<p className="text-2xl font-bold text-blue-600">
											{report.summary.callsAttempted}
										</p>
										<p className="text-xs text-blue-600/80">
											Calls Attempted
										</p>
									</div>
									<div className="text-center p-3 rounded-lg bg-green-50">
										<CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
										<p className="text-2xl font-bold text-green-600">
											{report.summary.callsCompleted}
										</p>
										<p className="text-xs text-green-600/80">
											Calls Completed
										</p>
									</div>
									<div className="text-center p-3 rounded-lg bg-purple-50">
										<Users className="h-5 w-5 text-purple-600 mx-auto mb-1" />
										<p className="text-2xl font-bold text-purple-600">
											{report.summary.totalLeads}
										</p>
										<p className="text-xs text-purple-600/80">
											Total Leads
										</p>
									</div>
									<div className="text-center p-3 rounded-lg bg-orange-50">
										<Target className="h-5 w-5 text-orange-600 mx-auto mb-1" />
										<p className="text-2xl font-bold text-orange-600">
											{report.leadProgress.converted}
										</p>
										<p className="text-xs text-orange-600/80">
											Converted
										</p>
									</div>
								</div>

								{/* Financial Metrics */}
								<div className="pt-4 border-t space-y-2">
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											Cost per Lead
										</span>
										<span className="font-medium">
											$
											{report.summary.costPerLead.toFixed(
												2
											)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											Cost per Conversion
										</span>
										<span className="font-medium">
											$
											{report.summary.costPerConversion.toFixed(
												2
											)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											Converted Revenue
										</span>
										<span className="font-medium">
											$
											{report.summary.convertedRevenue.toFixed(
												2
											)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											ROI
										</span>
										<span
											className={`font-medium ${report.summary.roi >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{report.summary.roi >= 0 ? "+" : ""}
											{report.summary.roi.toFixed(1)}%
										</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="performance" className="space-y-6">
					<Card className="rounded-2xl">
						<CardHeader>
							<CardTitle className="text-lg">
								Success Rate Trends
							</CardTitle>
							<CardDescription>
								Daily success rate performance
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ResponsiveContainer width="100%" height={400}>
								<LineChart data={dailyChartData}>
									<CartesianGrid
										strokeDasharray="3 3"
										className="opacity-30"
									/>
									<XAxis dataKey="date" className="text-xs" />
									<YAxis className="text-xs" />
									<Tooltip
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
												const value = payload[0].value
												const formattedValue =
													typeof value === "number"
														? value.toFixed(1)
														: value
												return (
													<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
														<p className="font-medium">
															{label}
														</p>
														<p
															style={{
																color: payload[0]
																	.color
															}}
														>
															Success Rate:{" "}
															{formattedValue}%
														</p>
													</div>
												)
											}
											return null
										}}
									/>
									<Line
										type="monotone"
										dataKey="successRate"
										stroke={COLORS.success}
										strokeWidth={3}
										dot={{
											fill: COLORS.success,
											strokeWidth: 2,
											r: 4
										}}
									/>
								</LineChart>
							</ResponsiveContainer>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="leads" className="space-y-6">
					<div className="grid gap-6 md:grid-cols-2">
						{/* Lead Progress Pie Chart */}
						<Card className="rounded-2xl">
							<CardHeader>
								<CardTitle className="text-lg">
									Lead Status Distribution
								</CardTitle>
								<CardDescription>
									Current status of all campaign leads
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer width="100%" height={300}>
									<PieChart>
										<Pie
											data={leadProgressData}
											cx="50%"
											cy="50%"
											innerRadius={60}
											outerRadius={120}
											paddingAngle={2}
											dataKey="value"
										>
											{leadProgressData.map(
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
																Count:{" "}
																{data.value}
															</p>
														</div>
													)
												}
												return null
											}}
										/>
									</PieChart>
								</ResponsiveContainer>

								{/* Legend */}
								<div className="flex flex-wrap justify-center gap-4 mt-4">
									{leadProgressData.map((item) => (
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
												{item.name} ({item.value})
											</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Lead Progress Table */}
						<Card className="rounded-2xl">
							<CardHeader>
								<CardTitle className="text-lg">
									Lead Pipeline Metrics
								</CardTitle>
								<CardDescription>
									Detailed breakdown of lead progression
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex justify-between items-center p-3 rounded-lg bg-blue-50">
										<div>
											<p className="font-medium text-blue-900">
												Contacted
											</p>
											<p className="text-sm text-blue-700">
												Successful outreach
											</p>
										</div>
										<div className="text-right">
											<p className="text-xl font-bold text-blue-600">
												{report.leadProgress.contacted}
											</p>
											<p className="text-xs text-blue-600">
												{report.summary.totalLeads > 0
													? (
															(report.leadProgress
																.contacted /
																report.summary
																	.totalLeads) *
															100
														).toFixed(1)
													: 0}
												%
											</p>
										</div>
									</div>

									<div className="flex justify-between items-center p-3 rounded-lg bg-yellow-50">
										<div>
											<p className="font-medium text-yellow-900">
												Qualified
											</p>
											<p className="text-sm text-yellow-700">
												Meeting criteria
											</p>
										</div>
										<div className="text-right">
											<p className="text-xl font-bold text-yellow-600">
												{report.leadProgress.qualified}
											</p>
											<p className="text-xs text-yellow-600">
												{report.leadProgress.contacted >
												0
													? (
															(report.leadProgress
																.qualified /
																report
																	.leadProgress
																	.contacted) *
															100
														).toFixed(1)
													: 0}
												%
											</p>
										</div>
									</div>

									<div className="flex justify-between items-center p-3 rounded-lg bg-green-50">
										<div>
											<p className="font-medium text-green-900">
												Converted
											</p>
											<p className="text-sm text-green-700">
												Successful outcomes
											</p>
										</div>
										<div className="text-right">
											<p className="text-xl font-bold text-green-600">
												{report.leadProgress.converted}
											</p>
											<p className="text-xs text-green-600">
												{report.leadProgress.qualified >
												0
													? (
															(report.leadProgress
																.converted /
																report
																	.leadProgress
																	.qualified) *
															100
														).toFixed(1)
													: 0}
												%
											</p>
										</div>
									</div>

									<div className="flex justify-between items-center p-3 rounded-lg bg-red-50">
										<div>
											<p className="font-medium text-red-900">
												Failed
											</p>
											<p className="text-sm text-red-700">
												Unsuccessful attempts
											</p>
										</div>
										<div className="text-right">
											<p className="text-xl font-bold text-red-600">
												{report.leadProgress.failed}
											</p>
											<p className="text-xs text-red-600">
												{report.summary.totalLeads > 0
													? (
															(report.leadProgress
																.failed /
																report.summary
																	.totalLeads) *
															100
														).toFixed(1)
													: 0}
												%
											</p>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
