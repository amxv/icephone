"use client"

import { useState, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
	Activity,
	ArrowUpRight,
	BarChart3,
	Calendar,
	Clock,
	PhoneCall,
	RefreshCw,
	User,
	Users
} from "lucide-react"
import Link from "next/link"
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	Pie,
	LineChart as RechartsLineChart,
	PieChart as RechartsPieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from "recharts"
import { getDashboardData } from "@/actions/dashboard-analytics"
import { filterDataByTimeRange } from "@/lib/dashboard-utils"
import type {
	LeadFunnelData,
	LeadAcquisitionData,
	CallActivityData,
	LeadSourceData,
	AgentPerformanceData
} from "@/actions/dashboard-analytics"
import { useAuthUser } from "@/lib/auth/use-auth-user"

interface DashboardClientProps {
	initialData: {
		leadFunnelData: LeadFunnelData[]
		leadAcquisitionData: LeadAcquisitionData[]
		callActivityData: CallActivityData[]
		leadSourceData: LeadSourceData[]
		agentPerformanceData: AgentPerformanceData[]
	}
}

// Time range options
const timeRangeOptions = [
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
	{ value: "90d", label: "Last 3 months" }
]

export default function DashboardClient({ initialData }: DashboardClientProps) {
	const { user, isLoading: isSessionLoading } = useAuthUser()
	const isMobile = useIsMobile()
	const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d")
	const [isLoading, setIsLoading] = useState(false)
	const [dashboardData, setDashboardData] = useState(initialData)

	// Filter data based on selected time range
	const filteredLeadData = filterDataByTimeRange(
		dashboardData.leadAcquisitionData,
		timeRange
	)
	const filteredCallData = filterDataByTimeRange(
		dashboardData.callActivityData,
		timeRange
	)

	useEffect(() => {
		if (isMobile && timeRange === "90d") {
			setTimeRange("30d")
		}
	}, [isMobile, timeRange])

	// Fetch new data when time range changes
	useEffect(() => {
		async function fetchData() {
			if (isSessionLoading || !user) return
			setIsLoading(true)
			try {
				const newData = await getDashboardData(timeRange)
				setDashboardData(newData)
			} catch (error) {
				console.error("Error fetching dashboard data:", error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchData()
	}, [timeRange, isSessionLoading, user])

	// Calculate lead stats from funnel data
	const leadStats = {
		total: dashboardData.leadFunnelData.reduce(
			(sum, item) => sum + item.value,
			0
		),
		new:
			dashboardData.leadFunnelData.find((item) => item.name === "New")
				?.value || 0,
		contacted:
			dashboardData.leadFunnelData.find(
				(item) => item.name === "Contacted"
			)?.value || 0,
		qualified:
			dashboardData.leadFunnelData.find(
				(item) => item.name === "Qualified"
			)?.value || 0,
		converted:
			dashboardData.leadFunnelData.find(
				(item) => item.name === "Converted"
			)?.value || 0,
		lost:
			dashboardData.leadFunnelData.find((item) => item.name === "Lost")
				?.value || 0
	}

	// Get current time for greeting
	const currentHour = new Date().getHours()
	let greeting = "Good evening"
	if (currentHour < 12) {
		greeting = "Good morning"
	} else if (currentHour < 18) {
		greeting = "Good afternoon"
	}

	// Custom colors for the pie chart
	const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

	// Chart config for lead acquisition
	const leadChartConfig = {
		newLeads: {
			label: "New Leads",
			color: "hsl(var(--chart-1))"
		},
		qualifiedLeads: {
			label: "Qualified Leads",
			color: "hsl(var(--chart-2))"
		}
	}

	// Chart config for call activity
	const callChartConfig = {
		inbound: {
			label: "Inbound Calls",
			color: "hsl(var(--chart-3))"
		},
		outbound: {
			label: "Outbound Calls",
			color: "hsl(var(--chart-4))"
		}
	}

	const refreshData = async () => {
		setIsLoading(true)
		try {
			const newData = await getDashboardData(timeRange)
			setDashboardData(newData)
		} catch (error) {
			console.error("Error refreshing dashboard data:", error)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						{greeting}, {user?.name?.split(" ")[0] || "User"}
					</h1>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={refreshData}
						disabled={isLoading}
						className="flex items-center text-sm gap-1 px-3 py-2 border rounded-2xl hover:bg-primary/5 disabled:opacity-50"
					>
						<RefreshCw
							className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
						/>
						<span>Refresh</span>
					</button>
				</div>
			</div>

			{/* Stats Overview */}
			<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Leads
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isLoading ? "..." : leadStats.total}
							</div>
							<BarChart3 className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							New Leads
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isLoading ? "..." : leadStats.new}
							</div>
							<User className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Qualified Leads
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isLoading ? "..." : leadStats.qualified}
							</div>
							<Users className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Converted
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{isLoading ? "..." : leadStats.converted}
							</div>
							<ArrowUpRight className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Conversion Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="text-2xl font-bold">
								{leadStats.total > 0
									? `${Math.round((leadStats.converted / leadStats.total) * 100)}%`
									: "0%"}
							</div>
							<Activity className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Time Range Selector */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-medium">Analytics</h2>
					<p className="text-sm text-muted-foreground">
						Track your lead generation and call performance
					</p>
				</div>
				<Select
					value={timeRange}
					onValueChange={(value: "7d" | "30d" | "90d") =>
						setTimeRange(value)
					}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Select range" />
					</SelectTrigger>
					<SelectContent>
						{timeRangeOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Charts Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
				{/* Lead Acquisition Chart */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle>Lead Acquisition</CardTitle>
						<CardDescription>
							New and qualified leads over time
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							config={leadChartConfig}
							className="min-h-[200px] w-full"
						>
							<ResponsiveContainer width="100%" height={200}>
								<AreaChart data={filteredLeadData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="date"
										tickFormatter={(value) =>
											new Date(value).toLocaleDateString()
										}
									/>
									<YAxis />
									<ChartTooltip />
									<Area
										type="monotone"
										dataKey="newLeads"
										stackId="1"
										stroke={leadChartConfig.newLeads.color}
										fill={leadChartConfig.newLeads.color}
										fillOpacity={0.6}
									/>
									<Area
										type="monotone"
										dataKey="qualifiedLeads"
										stackId="1"
										stroke={
											leadChartConfig.qualifiedLeads.color
										}
										fill={
											leadChartConfig.qualifiedLeads.color
										}
										fillOpacity={0.6}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Call Activity Chart */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle>Call Activity</CardTitle>
						<CardDescription>
							Inbound and outbound calls over time
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							config={callChartConfig}
							className="min-h-[200px] w-full"
						>
							<ResponsiveContainer width="100%" height={200}>
								<BarChart data={filteredCallData}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis
										dataKey="date"
										tickFormatter={(value) =>
											new Date(value).toLocaleDateString()
										}
									/>
									<YAxis />
									<ChartTooltip />
									<Bar
										dataKey="inbound"
										fill={callChartConfig.inbound.color}
									/>
									<Bar
										dataKey="outbound"
										fill={callChartConfig.outbound.color}
									/>
								</BarChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Lead Sources Chart */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle>Lead Sources</CardTitle>
						<CardDescription>
							Distribution of leads by source
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							config={{}}
							className="min-h-[200px] w-full"
						>
							<ResponsiveContainer width="100%" height={200}>
								<RechartsPieChart>
									<Pie
										data={dashboardData.leadSourceData}
										cx="50%"
										cy="50%"
										outerRadius={60}
										fill="#8884d8"
										dataKey="value"
										label
									>
										{dashboardData.leadSourceData.map(
											(entry, index) => (
												<Cell
													key={`cell-${index}`}
													fill={
														COLORS[
															index %
																COLORS.length
														]
													}
												/>
											)
										)}
									</Pie>
									<Tooltip />
									<Legend />
								</RechartsPieChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Agent Performance Chart */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle>Agent Performance</CardTitle>
						<CardDescription>
							Calls, appointments, and conversions by agent
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							config={{}}
							className="min-h-[200px] w-full"
						>
							<ResponsiveContainer width="100%" height={200}>
								<BarChart
									data={dashboardData.agentPerformanceData}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="name" />
									<YAxis />
									<Tooltip />
									<Legend />
									<Bar dataKey="calls" fill="#8884d8" />
									<Bar
										dataKey="appointments"
										fill="#82ca9d"
									/>
									<Bar dataKey="conversions" fill="#ffc658" />
								</BarChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="rounded-full p-3 bg-primary/10">
								<PhoneCall className="h-6 w-6 text-primary" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium">Start a Call</h3>
								<p className="text-sm text-muted-foreground">
									Begin a voice conversation with a lead
								</p>
							</div>
							<Link
								href="/voice-agents"
								className="text-sm text-primary hover:text-primary/80"
							>
								Start →
							</Link>
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="rounded-full p-3 bg-primary/10">
								<User className="h-6 w-6 text-primary" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium">Add Lead</h3>
								<p className="text-sm text-muted-foreground">
									Add a new lead to your pipeline
								</p>
							</div>
							<Link
								href="/leads"
								className="text-sm text-primary hover:text-primary/80"
							>
								Add →
							</Link>
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="rounded-full p-3 bg-primary/10">
								<Calendar className="h-6 w-6 text-primary" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium">Schedule</h3>
								<p className="text-sm text-muted-foreground">
									Book an appointment or meeting
								</p>
							</div>
							<Link
								href="/appointments"
								className="text-sm text-primary hover:text-primary/80"
							>
								Schedule →
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</>
	)
}
