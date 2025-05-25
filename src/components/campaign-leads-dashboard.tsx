"use client"

import { getCampaignLeads, removeLeadFromCampaign } from "@/actions/campaigns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import {
	SearchIcon,
	FilterIcon,
	TrashIcon,
	PhoneIcon,
	MailIcon,
	AlertCircleIcon,
	CalendarIcon,
	ClockIcon,
	UserIcon
} from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

interface CampaignLead {
	id: number
	campaignId: number
	leadId: number
	status: "pending" | "attempted" | "completed" | "failed"
	priority: number
	assignedAt: Date
	lastAttemptAt: Date | null
	nextAttemptAt: Date | null
	attemptCount: number
	maxAttempts: number
	notes: string | null
	completedAt: Date | null
	lead: {
		id: number
		name: string
		email: string | null
		phone: string | null
		status: "new" | "contacted" | "qualified" | "converted" | "lost"
		score: number | null
	}
}

interface CampaignLeadsDashboardProps {
	campaignId: string
	onLeadsChange?: () => void
}

const statusColors: Record<string, string> = {
	pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
	attempted: "bg-blue-100 text-blue-800 hover:bg-blue-100",
	completed: "bg-green-100 text-green-800 hover:bg-green-100",
	failed: "bg-red-100 text-red-800 hover:bg-red-100",
	new: "bg-gray-100 text-gray-800 hover:bg-gray-100",
	contacted: "bg-blue-100 text-blue-800 hover:bg-blue-100",
	qualified: "bg-orange-100 text-orange-800 hover:bg-orange-100",
	converted: "bg-green-100 text-green-800 hover:bg-green-100",
	lost: "bg-red-100 text-red-800 hover:bg-red-100"
}

function LeadStatusBadge({ status }: { status: string }) {
	return (
		<Badge
			className={`px-3 py-1 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}
		>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</Badge>
	)
}

function CampaignLeadRow({
	campaignLead,
	onRemove
}: {
	campaignLead: CampaignLead
	onRemove: (leadId: number) => void
}) {
	const [showRemoveDialog, setShowRemoveDialog] = useState(false)
	const [isRemoving, setIsRemoving] = useState(false)

	const handleRemove = async () => {
		setIsRemoving(true)
		try {
			const result = await removeLeadFromCampaign(
				campaignLead.campaignId,
				campaignLead.leadId
			)
			if (result.success) {
				toast.success("Lead removed from campaign")
				onRemove(campaignLead.leadId)
				setShowRemoveDialog(false)
			} else {
				toast.error(result.error || "Failed to remove lead")
			}
		} catch (error) {
			console.error("Error removing lead:", error)
			toast.error("Failed to remove lead")
		} finally {
			setIsRemoving(false)
		}
	}

	return (
		<>
			<TableRow className="hover:bg-muted/50">
				<TableCell>
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-primary/10 p-2">
							<UserIcon className="h-4 w-4 text-primary" />
						</div>
						<div>
							<div className="font-medium">
								{campaignLead.lead.name}
							</div>
							<div className="text-sm text-muted-foreground">
								ID: {campaignLead.lead.id}
							</div>
						</div>
					</div>
				</TableCell>
				<TableCell>
					<div className="space-y-1">
						{campaignLead.lead.phone && (
							<div className="flex items-center gap-1 text-sm">
								<PhoneIcon className="h-3 w-3 text-muted-foreground" />
								{campaignLead.lead.phone}
							</div>
						)}
						{campaignLead.lead.email && (
							<div className="flex items-center gap-1 text-sm">
								<MailIcon className="h-3 w-3 text-muted-foreground" />
								{campaignLead.lead.email}
							</div>
						)}
					</div>
				</TableCell>
				<TableCell>
					<LeadStatusBadge status={campaignLead.status} />
				</TableCell>
				<TableCell>
					<LeadStatusBadge status={campaignLead.lead.status} />
				</TableCell>
				<TableCell>
					<div className="flex items-center gap-1">
						<span className="text-sm font-medium">
							{campaignLead.attemptCount}
						</span>
						<span className="text-sm text-muted-foreground">
							/ {campaignLead.maxAttempts}
						</span>
					</div>
				</TableCell>
				<TableCell>
					<div className="space-y-1">
						<div className="flex items-center gap-1 text-sm">
							<CalendarIcon className="h-3 w-3 text-muted-foreground" />
							{format(
								new Date(campaignLead.assignedAt),
								"MMM dd, yyyy"
							)}
						</div>
						{campaignLead.lastAttemptAt && (
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<ClockIcon className="h-3 w-3" />
								Last:{" "}
								{formatDistanceToNow(
									new Date(campaignLead.lastAttemptAt),
									{ addSuffix: true }
								)}
							</div>
						)}
					</div>
				</TableCell>
				<TableCell>
					{campaignLead.lead.score && (
						<div className="text-sm font-medium text-center">
							{campaignLead.lead.score}/100
						</div>
					)}
				</TableCell>
				<TableCell>
					<Button
						variant="outline"
						size="sm"
						className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
						onClick={() => setShowRemoveDialog(true)}
					>
						<TrashIcon className="h-4 w-4" />
					</Button>
				</TableCell>
			</TableRow>

			{/* Remove Confirmation Dialog */}
			<Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
				<DialogContent className="sm:max-w-lg p-6 border border-border bg-white shadow-lg rounded-3xl">
					<DialogHeader className="pb-4">
						<DialogTitle className="text-xl font-medium tracking-tight flex items-center gap-2">
							<AlertCircleIcon className="h-5 w-5 text-red-600" />
							Remove Lead from Campaign
						</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							Are you sure you want to remove "
							{campaignLead.lead.name}" from this campaign? This
							action cannot be undone and any scheduled calls will
							be cancelled.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="mt-6">
						<Button
							variant="outline"
							onClick={() => setShowRemoveDialog(false)}
							className="rounded-lg"
							disabled={isRemoving}
						>
							Cancel
						</Button>
						<Button
							onClick={handleRemove}
							className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
							disabled={isRemoving}
						>
							{isRemoving ? "Removing..." : "Remove Lead"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

function CampaignLeadsSkeleton() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="flex gap-4">
						<Skeleton className="h-10 w-64" />
						<Skeleton className="h-10 w-48" />
					</div>
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export function CampaignLeadsDashboard({
	campaignId,
	onLeadsChange
}: CampaignLeadsDashboardProps) {
	const [leads, setLeads] = useState<CampaignLead[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState("")
	const [statusFilter, setStatusFilter] = useState<string>("all")
	const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all")

	const fetchLeads = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const result = await getCampaignLeads(parseInt(campaignId))
			if (result.success && result.data) {
				setLeads(result.data as CampaignLead[])
			} else {
				setError(result.error || "Failed to load campaign leads")
			}
		} catch (error) {
			console.error("Error fetching campaign leads:", error)
			setError("Failed to load campaign leads")
		} finally {
			setIsLoading(false)
		}
	}, [campaignId])

	useEffect(() => {
		fetchLeads()
	}, [fetchLeads])

	const handleLeadRemoved = (leadId: number) => {
		setLeads((prev) => prev.filter((lead) => lead.leadId !== leadId))
		onLeadsChange?.()
	}

	// Filter leads based on search and status filters
	const filteredLeads = useMemo(() => {
		return leads.filter((campaignLead) => {
			const matchesSearch =
				!searchQuery ||
				campaignLead.lead.name
					.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				campaignLead.lead.email
					?.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				campaignLead.lead.phone?.includes(searchQuery)

			const matchesStatus =
				statusFilter === "all" || campaignLead.status === statusFilter

			const matchesLeadStatus =
				leadStatusFilter === "all" ||
				campaignLead.lead.status === leadStatusFilter

			return matchesSearch && matchesStatus && matchesLeadStatus
		})
	}, [leads, searchQuery, statusFilter, leadStatusFilter])

	// Calculate stats
	const stats = useMemo(() => {
		return {
			total: leads.length,
			pending: leads.filter((l) => l.status === "pending").length,
			attempted: leads.filter((l) => l.status === "attempted").length,
			completed: leads.filter((l) => l.status === "completed").length,
			failed: leads.filter((l) => l.status === "failed").length
		}
	}, [leads])

	if (isLoading) {
		return <CampaignLeadsSkeleton />
	}

	if (error) {
		return (
			<Card className="rounded-3xl border-destructive bg-destructive/10 p-6 text-center">
				<h3 className="text-lg font-semibold text-destructive">
					Error loading leads
				</h3>
				<p className="text-destructive/80">{error}</p>
				<Button variant="outline" className="mt-4" onClick={fetchLeads}>
					Try Again
				</Button>
			</Card>
		)
	}

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-xl font-semibold">
						Campaign Leads ({stats.total})
					</CardTitle>
					<div className="flex gap-2">
						<Badge variant="outline" className="bg-yellow-50">
							Pending: {stats.pending}
						</Badge>
						<Badge variant="outline" className="bg-blue-50">
							Attempted: {stats.attempted}
						</Badge>
						<Badge variant="outline" className="bg-green-50">
							Completed: {stats.completed}
						</Badge>
						<Badge variant="outline" className="bg-red-50">
							Failed: {stats.failed}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{/* Filters */}
				<div className="flex flex-col sm:flex-row gap-4 mb-6">
					<div className="flex-1">
						<div className="relative">
							<SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search leads by name, email, or phone..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 rounded-lg"
							/>
						</div>
					</div>
					<Select
						value={statusFilter}
						onValueChange={setStatusFilter}
					>
						<SelectTrigger className="w-48 rounded-lg">
							<div className="flex items-center gap-2">
								<FilterIcon className="h-4 w-4" />
								<SelectValue placeholder="Campaign Status" />
							</div>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="attempted">Attempted</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="failed">Failed</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={leadStatusFilter}
						onValueChange={setLeadStatusFilter}
					>
						<SelectTrigger className="w-48 rounded-lg">
							<div className="flex items-center gap-2">
								<FilterIcon className="h-4 w-4" />
								<SelectValue placeholder="Lead Status" />
							</div>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								All Lead Statuses
							</SelectItem>
							<SelectItem value="new">New</SelectItem>
							<SelectItem value="contacted">Contacted</SelectItem>
							<SelectItem value="qualified">Qualified</SelectItem>
							<SelectItem value="converted">Converted</SelectItem>
							<SelectItem value="lost">Lost</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Leads Table */}
				{filteredLeads.length === 0 ? (
					<div className="text-center py-12">
						<div className="rounded-full p-3 border border-border/40 shadow-sm mx-auto w-fit">
							<UserIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="mt-4 text-lg font-medium">
							{leads.length === 0
								? "No leads in this campaign"
								: "No leads match your filters"}
						</h3>
						<p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
							{leads.length === 0
								? "Add leads to this campaign to start making calls."
								: "Try adjusting your search or filter criteria."}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto rounded-2xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Lead</TableHead>
									<TableHead>Contact Info</TableHead>
									<TableHead>Campaign Status</TableHead>
									<TableHead>Lead Status</TableHead>
									<TableHead>Attempts</TableHead>
									<TableHead>Timeline</TableHead>
									<TableHead>Score</TableHead>
									<TableHead className="w-12" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredLeads.map((campaignLead) => (
									<CampaignLeadRow
										key={campaignLead.id}
										campaignLead={campaignLead}
										onRemove={handleLeadRemoved}
									/>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
