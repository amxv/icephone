"use client"

import { getLeads } from "@/actions/leads"
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
import { useIsMobile } from "@/hooks/use-mobile"
import {
	callActivityData,
	filterDataByTimeRange,
	leadAcquisitionData,
	leadFunnelData,
	leadSourceData,
	timeRangeOptions
} from "@/lib/dashboard-data"
import { useUser } from "@clerk/nextjs"
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
import { useEffect, useState } from "react"
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

export default function Dashboard() {
	const { user, isLoaded } = useUser()
	const isMobile = useIsMobile()
	const [timeRange, setTimeRange] = useState("30d")
	const [leadStats, setLeadStats] = useState({
		total: 0,
		new: 0,
		contacted: 0,
		qualified: 0,
		converted: 0,
		lost: 0
	})
	const [isLoading, setIsLoading] = useState(true)

	// Filter data based on selected time range
	const filteredLeadData = filterDataByTimeRange(
		leadAcquisitionData,
		timeRange
	)
	const filteredCallData = filterDataByTimeRange(callActivityData, timeRange)

	useEffect(() => {
		if (isMobile && timeRange === "90d") {
			setTimeRange("30d")
		}
	}, [isMobile, timeRange])

	useEffect(() => {
		async function fetchLeadStats() {
			if (!isLoaded) return
			setIsLoading(true)
			try {
				const result = await getLeads()
				if (result.success && result.data) {
					const leads = result.data
					const stats = {
						total: leads.length,
						new: leads.filter((lead) => lead.status === "new")
							.length,
						contacted: leads.filter(
							(lead) => lead.status === "contacted"
						).length,
						qualified: leads.filter(
							(lead) => lead.status === "qualified"
						).length,
						converted: leads.filter(
							(lead) => lead.status === "converted"
						).length,
						lost: leads.filter((lead) => lead.status === "lost")
							.length
					}
					setLeadStats(stats)
				}
			} catch (error) {
				console.error("Error fetching lead stats:", error)
			} finally {
				setIsLoading(false)
			}
		}

		fetchLeadStats()
	}, [isLoaded])

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

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-8 p-2 md:px-8 md:py-4 h-full">
				{/* Header - following the leads page style */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
							{greeting}, {user?.firstName || "User"}
						</h1>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="flex items-center text-sm gap-1 px-3 py-2 border rounded-2xl hover:bg-primary/5"
						>
							<RefreshCw className="h-4 w-4" />
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
								<User className="h-5 w-5 text-muted-foreground" />
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
								<User className="h-5 w-5 text-muted-foreground" />
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Lost
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between">
								<div className="text-2xl font-bold">
									{isLoading ? "..." : leadStats.lost}
								</div>
								<User className="h-5 w-5 text-muted-foreground" />
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Lead acquisition chart */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm @container/card">
					<CardHeader className="relative">
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-muted-foreground" />
							Lead Acquisition
						</CardTitle>
						<CardDescription>
							<span className="@[540px]/card:block hidden">
								Lead acquisition trends over time
							</span>
							<span className="@[540px]/card:hidden">
								Acquisition trends
							</span>
						</CardDescription>
						<div className="absolute right-4 top-4">
							{/* Desktop version with Tabs */}
							<Tabs
								value={timeRange}
								onValueChange={setTimeRange}
								className="@[767px]/card:flex hidden"
							>
								<TabsList className="grid grid-cols-3 p-1 bg-card/50 backdrop-blur-sm rounded-3xl border border-border/30">
									{timeRangeOptions.map((option) => (
										<TabsTrigger
											key={option.value}
											value={option.value}
											className="rounded-2xl text-xs sm:text-sm py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
										>
											{option.label}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>

							{/* Mobile version with dropdown */}
							<Select
								value={timeRange}
								onValueChange={setTimeRange}
							>
								<SelectTrigger
									className="@[767px]/card:hidden flex w-44 rounded-3xl bg-card/50 backdrop-blur-sm border-border/30"
									aria-label="Select time range"
								>
									<SelectValue placeholder="Last 30 days" />
								</SelectTrigger>
								<SelectContent className="rounded-2xl">
									{timeRangeOptions.map((option) => (
										<SelectItem
											key={option.value}
											value={option.value}
											className="rounded-xl"
										>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</CardHeader>
					<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
						<ChartContainer
							config={leadChartConfig}
							className="aspect-auto h-[250px] w-full"
						>
							<AreaChart data={filteredLeadData}>
								<defs>
									<linearGradient
										id="fillNewLeads"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="var(--color-newLeads)"
											stopOpacity={1.0}
										/>
										<stop
											offset="95%"
											stopColor="var(--color-newLeads)"
											stopOpacity={0.1}
										/>
									</linearGradient>
									<linearGradient
										id="fillQualifiedLeads"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="var(--color-qualifiedLeads)"
											stopOpacity={0.8}
										/>
										<stop
											offset="95%"
											stopColor="var(--color-qualifiedLeads)"
											stopOpacity={0.1}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="date"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={32}
									tickFormatter={(value) => {
										const date = new Date(value)
										return date.toLocaleDateString(
											"en-US",
											{
												month: "short",
												day: "numeric"
											}
										)
									}}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									tickMargin={8}
								/>
								<ChartTooltip
									cursor={false}
									content={({ active, payload, label }) => {
										if (!active || !payload?.length)
											return null

										return (
											<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
												<div className="mb-2 text-sm font-medium">
													{new Date(
														label
													).toLocaleDateString(
														"en-US",
														{
															month: "short",
															day: "numeric"
														}
													)}
												</div>
												<div className="space-y-1">
													{payload.map((item) => (
														<div
															key={`${item.name}-${item.value}`}
															className="flex items-center text-xs justify-between gap-3"
														>
															<div className="flex items-center gap-1">
																<div
																	className="h-2 w-2 rounded-full"
																	style={{
																		backgroundColor:
																			item.stroke ||
																			item.fill
																	}}
																/>
																<div className="whitespace-nowrap text-muted-foreground">
																	{item.name}:
																</div>
															</div>
															<div className="font-medium">
																{item.value}
															</div>
														</div>
													))}
												</div>
											</div>
										)
									}}
								/>
								<Area
									name="Qualified Leads"
									dataKey="qualifiedLeads"
									type="monotone"
									fill="url(#fillQualifiedLeads)"
									stroke="var(--color-qualifiedLeads)"
									strokeWidth={2}
								/>
								<Area
									name="New Leads"
									dataKey="newLeads"
									type="monotone"
									fill="url(#fillNewLeads)"
									stroke="var(--color-newLeads)"
									strokeWidth={2}
								/>
							</AreaChart>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Charts Row */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Call Activity Chart */}
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3 className="h-5 w-5 text-muted-foreground" />
								Call Activity
							</CardTitle>
							<CardDescription>
								Inbound vs. outbound calls
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ChartContainer
								config={callChartConfig}
								className="aspect-auto h-[250px] w-full"
							>
								<BarChart data={filteredCallData}>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="date"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										minTickGap={isMobile ? 60 : 30}
										tickFormatter={(value) => {
											const date = new Date(value)
											return date.toLocaleDateString(
												"en-US",
												{
													month: "short",
													day: "numeric"
												}
											)
										}}
									/>
									<YAxis
										tickLine={false}
										axisLine={false}
										tickMargin={8}
									/>
									<Tooltip
										cursor={false}
										content={({
											active,
											payload,
											label
										}) => {
											if (!active || !payload?.length)
												return null

											return (
												<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
													<div className="mb-2 text-sm font-medium">
														{new Date(
															label
														).toLocaleDateString(
															"en-US",
															{
																month: "short",
																day: "numeric"
															}
														)}
													</div>
													<div className="space-y-1">
														{payload.map((item) => (
															<div
																key={`${item.name}-${item.value}`}
																className="flex items-center text-xs justify-between gap-3"
															>
																<div className="flex items-center gap-1">
																	<div
																		className="h-2 w-2 rounded-full"
																		style={{
																			backgroundColor:
																				item.fill
																		}}
																	/>
																	<div className="whitespace-nowrap text-muted-foreground">
																		{
																			item.name
																		}
																		:
																	</div>
																</div>
																<div className="font-medium">
																	{item.value}
																</div>
															</div>
														))}
													</div>
												</div>
											)
										}}
									/>
									<Bar
										name="Inbound Calls"
										dataKey="inbound"
										fill="var(--color-inbound)"
										radius={[4, 4, 0, 0]}
									/>
									<Bar
										name="Outbound Calls"
										dataKey="outbound"
										fill="var(--color-outbound)"
										radius={[4, 4, 0, 0]}
									/>
								</BarChart>
							</ChartContainer>
						</CardContent>
					</Card>

					{/* Lead Source Distribution Chart */}
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3 className="h-5 w-5 text-muted-foreground" />
								Lead Sources
							</CardTitle>
							<CardDescription>
								Distribution of leads by source
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-[250px] w-full">
								<ResponsiveContainer width="100%" height="100%">
									<RechartsPieChart>
										<Pie
											data={leadSourceData}
											cx="50%"
											cy="50%"
											innerRadius={60}
											outerRadius={90}
											paddingAngle={2}
											dataKey="value"
											label={({ name, percent }) =>
												`${name} (${(percent * 100).toFixed(0)}%)`
											}
											labelLine={false}
										>
											{leadSourceData.map((entry) => (
												<Cell
													key={`cell-${entry.name}`}
													fill={
														COLORS[
															leadSourceData.indexOf(
																entry
															) % COLORS.length
														]
													}
												/>
											))}
										</Pie>
										<Tooltip
											content={({ active, payload }) => {
												if (!active || !payload?.length)
													return null
												const data = payload[0].payload

												return (
													<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
														<div className="mb-1 text-sm font-medium">
															{data.name}
														</div>
														<div className="flex items-center gap-1 text-xs">
															<div
																className="h-2 w-2 rounded-full"
																style={{
																	backgroundColor:
																		COLORS[
																			leadSourceData.findIndex(
																				(
																					item
																				) =>
																					item.name ===
																					data.name
																			)
																		]
																}}
															/>
															<div className="whitespace-nowrap text-muted-foreground">
																Count:{" "}
																<span className="font-medium ml-1">
																	{data.value}
																</span>
															</div>
														</div>
													</div>
												)
											}}
										/>
									</RechartsPieChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Quick Actions */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5 text-muted-foreground" />
							Quick Actions
						</CardTitle>
						<CardDescription>Frequently used tasks</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Link
								href="/leads/new"
								className="flex items-center justify-between p-3 rounded-2xl border hover:bg-primary/5 transition"
							>
								<div className="flex items-center gap-2">
									<User className="h-5 w-5 text-primary" />
									<span>Add New Lead</span>
								</div>
								<ArrowUpRight className="h-4 w-4 text-muted-foreground" />
							</Link>

							<Link
								href="/appointments/new"
								className="flex items-center justify-between p-3 rounded-2xl border hover:bg-primary/5 transition"
							>
								<div className="flex items-center gap-2">
									<Calendar className="h-5 w-5 text-primary" />
									<span>Schedule Appointment</span>
								</div>
								<ArrowUpRight className="h-4 w-4 text-muted-foreground" />
							</Link>

							<Link
								href="/calls"
								className="flex items-center justify-between p-3 rounded-2xl border hover:bg-primary/5 transition"
							>
								<div className="flex items-center gap-2">
									<PhoneCall className="h-5 w-5 text-primary" />
									<span>Make a Call</span>
								</div>
								<ArrowUpRight className="h-4 w-4 text-muted-foreground" />
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Recent Activity */}
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>
							Your latest interactions
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs defaultValue="all">
							<TabsList className="mb-4">
								<TabsTrigger value="all" className="rounded-xl">
									All
								</TabsTrigger>
								<TabsTrigger
									value="calls"
									className="rounded-xl"
								>
									Calls
								</TabsTrigger>
								<TabsTrigger
									value="appointments"
									className="rounded-xl"
								>
									Appointments
								</TabsTrigger>
							</TabsList>

							<TabsContent value="all" className="space-y-4">
								<div className="flex items-center gap-3 p-3 border rounded-2xl">
									<div className="bg-primary/10 p-2 rounded-full">
										<PhoneCall className="h-5 w-5 text-primary" />
									</div>
									<div className="flex-1">
										<p className="font-medium">
											Call with John Doe
										</p>
										<p className="text-sm text-muted-foreground">
											Outgoing call, 5 minutes
										</p>
									</div>
									<div className="text-sm text-muted-foreground flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>10:30 AM</span>
									</div>
								</div>

								<div className="flex items-center gap-3 p-3 border rounded-2xl">
									<div className="bg-primary/10 p-2 rounded-full">
										<Calendar className="h-5 w-5 text-primary" />
									</div>
									<div className="flex-1">
										<p className="font-medium">
											Meeting with Sarah Smith
										</p>
										<p className="text-sm text-muted-foreground">
											Demo call scheduled
										</p>
									</div>
									<div className="text-sm text-muted-foreground flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>Yesterday</span>
									</div>
								</div>

								<div className="flex items-center gap-3 p-3 border rounded-2xl">
									<div className="bg-primary/10 p-2 rounded-full">
										<User className="h-5 w-5 text-primary" />
									</div>
									<div className="flex-1">
										<p className="font-medium">
											New lead created
										</p>
										<p className="text-sm text-muted-foreground">
											Michael Johnson from XYZ Corp
										</p>
									</div>
									<div className="text-sm text-muted-foreground flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>2 days ago</span>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="calls" className="space-y-4">
								<div className="flex items-center gap-3 p-3 border rounded-2xl">
									<div className="bg-primary/10 p-2 rounded-full">
										<PhoneCall className="h-5 w-5 text-primary" />
									</div>
									<div className="flex-1">
										<p className="font-medium">
											Call with John Doe
										</p>
										<p className="text-sm text-muted-foreground">
											Outgoing call, 5 minutes
										</p>
									</div>
									<div className="text-sm text-muted-foreground flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>10:30 AM</span>
									</div>
								</div>
							</TabsContent>

							<TabsContent
								value="appointments"
								className="space-y-4"
							>
								<div className="flex items-center gap-3 p-3 border rounded-2xl">
									<div className="bg-primary/10 p-2 rounded-full">
										<Calendar className="h-5 w-5 text-primary" />
									</div>
									<div className="flex-1">
										<p className="font-medium">
											Meeting with Sarah Smith
										</p>
										<p className="text-sm text-muted-foreground">
											Demo call scheduled
										</p>
									</div>
									<div className="text-sm text-muted-foreground flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>Yesterday</span>
									</div>
								</div>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
