"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Database,
	Search,
	RefreshCw,
	Download,
	BarChart3,
	HardDrive,
	Activity,
	Users,
	Phone,
	Bot,
	Calendar,
	MessageSquare,
	Mail,
	Megaphone,
	FileText
} from "lucide-react"

interface DatabaseOverview {
	leads: number
	calls: number
	appointments: number
	campaigns: number
	phoneNumbers: number
	voiceAgents: number
	textMessages: number
	emails: number
	chats: number
	knowledgeDocuments: number
}

interface AdminDatabaseClientProps {
	initialData: DatabaseOverview
}

// Table metadata with icons and descriptions
const tableMetadata = {
	leads: {
		icon: Users,
		description: "Customer leads and prospects",
		color: "text-blue-500",
		priority: "high"
	},
	calls: {
		icon: Phone,
		description: "Voice call records and transcripts",
		color: "text-green-500",
		priority: "high"
	},
	voiceAgents: {
		icon: Bot,
		description: "AI voice agents and configurations",
		color: "text-purple-500",
		priority: "high"
	},
	phoneNumbers: {
		icon: Phone,
		description: "Phone number inventory",
		color: "text-orange-500",
		priority: "medium"
	},
	appointments: {
		icon: Calendar,
		description: "Scheduled appointments",
		color: "text-indigo-500",
		priority: "medium"
	},
	campaigns: {
		icon: Megaphone,
		description: "Marketing campaigns",
		color: "text-pink-500",
		priority: "medium"
	},
	textMessages: {
		icon: MessageSquare,
		description: "SMS and text communications",
		color: "text-cyan-500",
		priority: "low"
	},
	emails: {
		icon: Mail,
		description: "Email communications",
		color: "text-yellow-500",
		priority: "low"
	},
	chats: {
		icon: MessageSquare,
		description: "Chat conversations",
		color: "text-emerald-500",
		priority: "low"
	},
	knowledgeDocuments: {
		icon: FileText,
		description: "Knowledge base documents",
		color: "text-violet-500",
		priority: "medium"
	}
} as const

export function AdminDatabaseClient({ initialData }: AdminDatabaseClientProps) {
	const [searchQuery, setSearchQuery] = useState("")

	// Transform database overview into table format
	const tables = useMemo(() => {
		return Object.entries(initialData)
			.map(([tableName, recordCount]) => {
				const metadata =
					tableMetadata[tableName as keyof typeof tableMetadata]
				return {
					name: tableName,
					records: recordCount,
					status: "healthy" as const,
					icon: metadata?.icon || Database,
					description: metadata?.description || "Database table",
					color: metadata?.color || "text-gray-500",
					priority: metadata?.priority || "low"
				}
			})
			.sort((a, b) => {
				// Sort by priority, then by record count
				const priorityOrder = { high: 3, medium: 2, low: 1 }
				const priorityDiff =
					priorityOrder[b.priority] - priorityOrder[a.priority]
				if (priorityDiff !== 0) return priorityDiff
				return b.records - a.records
			})
	}, [initialData])

	const filteredTables = tables.filter((table) =>
		table.name.toLowerCase().includes(searchQuery.toLowerCase())
	)

	// Calculate summary statistics
	const stats = useMemo(() => {
		const totalTables = tables.length
		const totalRecords = tables.reduce(
			(sum, table) => sum + table.records,
			0
		)
		const highPriorityTables = tables.filter(
			(t) => t.priority === "high"
		).length
		const healthyTables = tables.filter(
			(t) => t.status === "healthy"
		).length

		return {
			totalTables,
			totalRecords,
			highPriorityTables,
			healthyTables
		}
	}, [tables])

	const StatusBadge = ({ status }: { status: string }) => {
		const statusColors: Record<string, string> = {
			healthy: "bg-green-100 text-green-800 hover:bg-green-100",
			warning: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
			error: "bg-red-100 text-red-800 hover:bg-red-100"
		}

		return (
			<Badge
				className={`px-3 py-1 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}
			>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</Badge>
		)
	}

	const handleRefresh = () => {
		// Refresh the page to get updated data
		window.location.reload()
	}

	const handleExport = () => {
		// Export schema (placeholder functionality)
		const dataStr = JSON.stringify(initialData, null, 2)
		const dataBlob = new Blob([dataStr], { type: "application/json" })
		const url = URL.createObjectURL(dataBlob)
		const link = document.createElement("a")
		link.href = url
		link.download = "database-overview.json"
		link.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="space-y-6">
			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<Database className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium text-muted-foreground">
								Total Tables
							</span>
						</div>
						<div className="text-2xl font-bold mt-2">
							{stats.totalTables}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Active database tables
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<BarChart3 className="h-4 w-4 text-blue-500" />
							<span className="text-sm font-medium text-muted-foreground">
								Total Records
							</span>
						</div>
						<div className="text-2xl font-bold mt-2 text-blue-600">
							{stats.totalRecords.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Across all tables
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<HardDrive className="h-4 w-4 text-purple-500" />
							<span className="text-sm font-medium text-muted-foreground">
								Core Tables
							</span>
						</div>
						<div className="text-2xl font-bold mt-2 text-purple-600">
							{stats.highPriorityTables}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							High priority tables
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<Activity className="h-4 w-4 text-green-500" />
							<span className="text-sm font-medium text-muted-foreground">
								Healthy Tables
							</span>
						</div>
						<div className="text-2xl font-bold mt-2 text-green-600">
							{stats.healthyTables}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							System status: Good
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Search and Actions */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-6">
					<div className="flex items-center gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
							<Input
								placeholder="Search database tables..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10 bg-background/50"
							/>
						</div>
						<Button
							variant="outline"
							className="gap-2"
							onClick={handleRefresh}
						>
							<RefreshCw className="h-4 w-4" />
							Refresh
						</Button>
						<Button
							variant="outline"
							className="gap-2"
							onClick={handleExport}
						>
							<Download className="h-4 w-4" />
							Export Data
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Tables Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredTables.map((table) => {
					const IconComponent = table.icon
					return (
						<Card
							key={table.name}
							className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow"
						>
							<CardContent className="p-6">
								<div className="flex items-start justify-between mb-4">
									<div>
										<div className="flex items-center gap-2 mb-2">
											<IconComponent
												className={`h-5 w-5 ${table.color}`}
											/>
											<h3 className="font-semibold text-lg">
												{table.name}
											</h3>
										</div>
										<StatusBadge status={table.status} />
									</div>
								</div>

								<div className="space-y-3">
									<p className="text-sm text-muted-foreground">
										{table.description}
									</p>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											Records:
										</span>
										<span className="font-medium">
											{table.records.toLocaleString()}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											Priority:
										</span>
										<Badge
											variant="outline"
											className="text-xs"
										>
											{table.priority}
										</Badge>
									</div>
								</div>
							</CardContent>
						</Card>
					)
				})}
			</div>

			{filteredTables.length === 0 && (
				<div className="text-center py-8">
					<Database className="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 className="mt-4 text-lg font-medium">
						No tables found
					</h3>
					<p className="mt-2 text-muted-foreground">
						Try adjusting your search criteria.
					</p>
				</div>
			)}
		</div>
	)
}
