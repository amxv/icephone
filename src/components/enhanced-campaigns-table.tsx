"use client"

import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState,
	RowSelectionState
} from "@tanstack/react-table"
import {
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable
} from "@tanstack/react-table"
import { format } from "date-fns"
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CalendarDaysIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	ColumnsIcon,
	FileEditIcon,
	FilterIcon,
	HistoryIcon,
	ListChecksIcon,
	MoreVerticalIcon,
	PauseCircleIcon,
	PlayIcon,
	SearchIcon,
	StopCircleIcon,
	UsersIcon,
	TrendingUpIcon,
	PhoneIcon,
	TimerIcon,
	TargetIcon,
	Trash2Icon
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
	Popover,
	PopoverContent,
	PopoverTrigger
} from "@/components/ui/popover"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { useSettings } from "@/contexts/settings-context"
import {
	startCampaign,
	pauseCampaign,
	resumeCampaign,
	stopCampaign
} from "@/actions/campaigns/execution"
import { toast } from "sonner"

// Enhanced campaign schema with additional metrics
export const enhancedCampaignSchema = z.object({
	id: z.number(),
	name: z.string(),
	status: z.string().nullable(),
	leadsCount: z.number(),
	leadsConverted: z.number(),
	leadsContacted: z.number().optional().default(0),
	callsCompleted: z.number().optional().default(0),
	conversionRate: z.number().optional().default(0),
	avgCallDuration: z.number().optional().default(0),
	updatedAt: z.string(),
	createdAt: z.string().optional(),
	voiceAgentName: z.string().optional().nullable()
})

export type EnhancedCampaignItem = z.infer<typeof enhancedCampaignSchema>

const formatColumnName = (columnId: string): string => {
	return columnId
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

// Enhanced Status Badge Component with Progress
const CampaignStatusBadge = ({
	status,
	progress
}: {
	status: string | null
	progress?: number
}) => {
	if (!status)
		return <span className="text-muted-foreground italic">Unknown</span>

	const statusConfig: Record<
		string,
		{ color: string; label: string; icon?: React.ElementType }
	> = {
		running: {
			color: "bg-orange-100 text-orange-800 border-orange-200",
			label: "Running",
			icon: HistoryIcon
		},
		completed: {
			color: "bg-green-100 text-green-800 border-green-200",
			label: "Completed",
			icon: CheckCircle2Icon
		},
		paused: {
			color: "bg-red-100 text-red-800 border-red-200",
			label: "Paused",
			icon: PauseCircleIcon
		},
		draft: {
			color: "bg-gray-100 text-gray-800 border-gray-200",
			label: "Draft",
			icon: FileEditIcon
		},
		cancelled: {
			color: "bg-red-100 text-red-800 border-red-200",
			label: "Cancelled"
		}
	}

	const config = statusConfig[status.toLowerCase()] || {
		color: "bg-neutral-100 text-neutral-800 border-neutral-200",
		label: status.charAt(0).toUpperCase() + status.slice(1)
	}

	const IconComponent = config.icon

	return (
		<div className="flex flex-col gap-1">
			<Badge
				variant="outline"
				className={`${config.color} whitespace-nowrap`}
			>
				{IconComponent && (
					<IconComponent className="h-3.5 w-3.5 mr-1.5" />
				)}
				{config.label}
			</Badge>
			{progress !== undefined && status === "running" && (
				<div className="w-full">
					<Progress value={progress} className="h-1.5" />
					<span className="text-xs text-muted-foreground">
						{progress.toFixed(1)}%
					</span>
				</div>
			)}
		</div>
	)
}

// Quick Action Controls Component
const QuickActionControls = ({
	campaign,
	onActionComplete
}: {
	campaign: EnhancedCampaignItem
	onActionComplete: () => void
}) => {
	const [isLoading, setIsLoading] = React.useState(false)

	const handleAction = async (
		action: "start" | "pause" | "resume" | "stop"
	) => {
		setIsLoading(true)
		try {
			let rawResult: {
				success: boolean
				error: string | null
				data: unknown
			}
			switch (action) {
				case "start":
					rawResult = await startCampaign(campaign.id)
					break
				case "pause":
					rawResult = await pauseCampaign(campaign.id)
					break
				case "resume":
					rawResult = await resumeCampaign(campaign.id)
					break
				case "stop":
					rawResult = await stopCampaign(campaign.id)
					break
			}

			if (rawResult.success) {
				toast.success(`Campaign ${action}ed successfully`)
				onActionComplete()
			} else {
				toast.error(rawResult.error || `Failed to ${action} campaign`)
			}
		} catch (error) {
			console.error(`Error ${action}ing campaign:`, error)
			toast.error(`An error occurred while ${action}ing the campaign`)
		} finally {
			setIsLoading(false)
		}
	}

	const canStart = campaign.status === "draft" || campaign.status === "paused"
	const canPause = campaign.status === "running"
	const canResume = campaign.status === "paused"
	const canStop =
		campaign.status === "running" || campaign.status === "paused"

	return (
		<div className="flex gap-1 flex-wrap">
			{canStart && (
				<Button
					size="sm"
					variant="outline"
					onClick={(e) => {
						e.stopPropagation()
						handleAction("start")
					}}
					disabled={isLoading}
					className="h-8 w-8 p-0 rounded-lg shrink-0"
					title="Start Campaign"
				>
					<PlayIcon className="h-3.5 w-3.5" />
				</Button>
			)}
			{canPause && (
				<Button
					size="sm"
					variant="outline"
					onClick={(e) => {
						e.stopPropagation()
						handleAction("pause")
					}}
					disabled={isLoading}
					className="h-8 w-8 p-0 rounded-lg shrink-0"
					title="Pause Campaign"
				>
					<PauseCircleIcon className="h-3.5 w-3.5" />
				</Button>
			)}
			{canResume && (
				<Button
					size="sm"
					variant="outline"
					onClick={(e) => {
						e.stopPropagation()
						handleAction("resume")
					}}
					disabled={isLoading}
					className="h-8 w-8 p-0 rounded-lg shrink-0"
					title="Resume Campaign"
				>
					<PlayIcon className="h-3.5 w-3.5" />
				</Button>
			)}
			{canStop && (
				<Button
					size="sm"
					variant="outline"
					onClick={(e) => {
						e.stopPropagation()
						handleAction("stop")
					}}
					disabled={isLoading}
					className="h-8 w-8 p-0 rounded-lg shrink-0"
					title="Stop Campaign"
				>
					<StopCircleIcon className="h-3.5 w-3.5" />
				</Button>
			)}
		</div>
	)
}

// Performance Metrics Component
const PerformanceMetrics = ({
	campaign
}: { campaign: EnhancedCampaignItem }) => {
	const conversionRate =
		campaign.leadsCount > 0
			? (campaign.leadsConverted / campaign.leadsCount) * 100
			: 0

	const contactRate =
		campaign.leadsCount > 0
			? ((campaign.leadsContacted || 0) / campaign.leadsCount) * 100
			: 0

	return (
		<div className="flex flex-col gap-1 text-xs">
			<div className="flex items-center gap-1 text-muted-foreground">
				<TargetIcon className="h-3 w-3" />
				<span>{conversionRate.toFixed(1)}% conversion</span>
			</div>
			<div className="flex items-center gap-1 text-muted-foreground">
				<PhoneIcon className="h-3 w-3" />
				<span>{contactRate.toFixed(1)}% contacted</span>
			</div>
			{campaign.avgCallDuration && campaign.avgCallDuration > 0 && (
				<div className="flex items-center gap-1 text-muted-foreground">
					<TimerIcon className="h-3 w-3" />
					<span>
						{Math.floor(campaign.avgCallDuration / 60)}m{" "}
						{campaign.avgCallDuration % 60}s avg
					</span>
				</div>
			)}
		</div>
	)
}

export function EnhancedCampaignsTable({
	data: initialData,
	initialColumnFilters = [],
	onFilterChange,
	onRowClick,
	searchQuery,
	onSearchChange
}: {
	data: EnhancedCampaignItem[]
	initialColumnFilters?: ColumnFiltersState
	onFilterChange?: (filters: ColumnFiltersState) => void
	onRowClick?: (campaign: EnhancedCampaignItem) => void
	searchQuery: string
	onSearchChange: (query: string) => void
}) {
	const [data, setData] = React.useState(() => initialData)
	const { tableRowsPerPage } = useSettings()
	const [refreshing, setRefreshing] = React.useState(false)
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
		{}
	)

	const processedInitialFilters = React.useMemo(() => {
		return initialColumnFilters.map((filter) => {
			if (filter.value && !Array.isArray(filter.value)) {
				return { ...filter, value: [filter.value] }
			}
			return filter
		})
	}, [initialColumnFilters])

	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>(() => {
			// Hide some columns on mobile by default
			if (typeof window !== "undefined" && window.innerWidth < 768) {
				return {
					performance: false,
					updatedAt: false
				} as VisibilityState
			}
			return {} as VisibilityState
		})
	const [columnFilters, setColumnFilters] =
		React.useState<ColumnFiltersState>(processedInitialFilters)
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "updatedAt", desc: true }
	])
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: tableRowsPerPage
	})
	const router = useRouter()

	React.useEffect(() => {
		setPagination((prev) => ({
			...prev,
			pageSize: tableRowsPerPage,
			pageIndex: 0
		}))
	}, [tableRowsPerPage])

	React.useEffect(() => {
		setData(initialData)
	}, [initialData])

	React.useEffect(() => {
		if (initialColumnFilters.length > 0) {
			setColumnFilters(processedInitialFilters)
		}
	}, [initialColumnFilters, processedInitialFilters])

	const lastNotifiedColumnFiltersRef = React.useRef<
		ColumnFiltersState | undefined
	>(undefined)

	React.useEffect(() => {
		const current = JSON.stringify(columnFilters)
		const last = JSON.stringify(lastNotifiedColumnFiltersRef.current)

		if (current !== last && onFilterChange) {
			onFilterChange(columnFilters)
			lastNotifiedColumnFiltersRef.current = columnFilters
		}
	}, [columnFilters, onFilterChange])

	const handleRefresh = React.useCallback(() => {
		setRefreshing(true)
		// Add a small delay to show loading state
		setTimeout(() => {
			setRefreshing(false)
		}, 500)
	}, [])

	// Bulk actions
	const selectedRows = Object.keys(rowSelection).length
	const selectedCampaigns = Object.keys(rowSelection)
		.filter((key) => rowSelection[key])
		.map((key) => data[parseInt(key)])

	const handleBulkAction = React.useCallback(
		async (action: "start" | "pause" | "stop") => {
			const promises = selectedCampaigns.map((campaign) => {
				switch (action) {
					case "start":
						return startCampaign(campaign.id)
					case "pause":
						return pauseCampaign(campaign.id)
					case "stop":
						return stopCampaign(campaign.id)
					default:
						return Promise.resolve({
							success: false,
							error: "Invalid action",
							data: null
						})
				}
			})

			const results = await Promise.all(promises)
			const successful = results.filter((r) => r.success).length
			const failed = results.length - successful

			if (successful > 0) {
				toast.success(
					`${action} ${successful} campaign(s) successfully`
				)
			}
			if (failed > 0) {
				toast.error(`Failed to ${action} ${failed} campaign(s)`)
			}

			setRowSelection({})
			handleRefresh()
		},
		[selectedCampaigns, handleRefresh]
	)

	const columns: ColumnDef<EnhancedCampaignItem>[] = React.useMemo(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() &&
								"indeterminate")
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(!!value)
						}
						aria-label="Select all"
						className="translate-y-[2px]"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
						className="translate-y-[2px]"
						onClick={(e) => e.stopPropagation()}
					/>
				),
				enableSorting: false,
				enableHiding: false
			},
			{
				accessorKey: "name",
				header: ({ column }) => {
					return (
						<div className="flex items-center space-x-2">
							<ListChecksIcon className="h-4 w-4 text-muted-foreground" />
							<Button
								variant="ghost"
								onClick={() =>
									column.toggleSorting(
										column.getIsSorted() === "asc"
									)
								}
								className="h-auto p-0 font-medium hover:bg-transparent hover:text-foreground"
							>
								Campaign
								{column.getIsSorted() === "desc" ? (
									<ArrowDownIcon className="ml-2 h-4 w-4" />
								) : column.getIsSorted() === "asc" ? (
									<ArrowUpIcon className="ml-2 h-4 w-4" />
								) : null}
							</Button>
						</div>
					)
				},
				cell: ({ row }) => {
					const campaign = row.original
					return (
						<div className="flex flex-col gap-1">
							<div className="font-medium text-foreground">
								{campaign.name}
							</div>
							{campaign.voiceAgentName && (
								<div className="text-xs text-muted-foreground">
									Agent: {campaign.voiceAgentName}
								</div>
							)}
						</div>
					)
				}
			},
			{
				accessorKey: "status",
				header: ({ column }) => {
					return (
						<div className="flex items-center space-x-2">
							<HistoryIcon className="h-4 w-4 text-muted-foreground" />
							<Button
								variant="ghost"
								onClick={() =>
									column.toggleSorting(
										column.getIsSorted() === "asc"
									)
								}
								className="h-auto p-0 font-medium hover:bg-transparent hover:text-foreground"
							>
								Status
								{column.getIsSorted() === "desc" ? (
									<ArrowDownIcon className="ml-2 h-4 w-4" />
								) : column.getIsSorted() === "asc" ? (
									<ArrowUpIcon className="ml-2 h-4 w-4" />
								) : null}
							</Button>
						</div>
					)
				},
				cell: ({ row }) => {
					const campaign = row.original
					const progress =
						campaign.leadsCount > 0
							? ((campaign.leadsContacted || 0) /
									campaign.leadsCount) *
								100
							: 0
					return (
						<CampaignStatusBadge
							status={campaign.status}
							progress={progress}
						/>
					)
				},
				filterFn: (row, id, value) => {
					const cellValue = row.getValue(id) as string
					if (!cellValue) return false
					return value.includes(cellValue.toLowerCase())
				}
			},
			{
				accessorKey: "performance",
				header: () => {
					return (
						<div className="flex items-center space-x-2">
							<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium">Performance</span>
						</div>
					)
				},
				cell: ({ row }) => {
					const campaign = row.original
					return <PerformanceMetrics campaign={campaign} />
				},
				enableSorting: false
			},
			{
				accessorKey: "leadsCount",
				header: ({ column }) => {
					return (
						<div className="flex items-center space-x-2">
							<UsersIcon className="h-4 w-4 text-muted-foreground" />
							<Button
								variant="ghost"
								onClick={() =>
									column.toggleSorting(
										column.getIsSorted() === "asc"
									)
								}
								className="h-auto p-0 font-medium hover:bg-transparent hover:text-foreground"
							>
								Leads
								{column.getIsSorted() === "desc" ? (
									<ArrowDownIcon className="ml-2 h-4 w-4" />
								) : column.getIsSorted() === "asc" ? (
									<ArrowUpIcon className="ml-2 h-4 w-4" />
								) : null}
							</Button>
						</div>
					)
				},
				cell: ({ row }) => {
					const campaign = row.original
					return (
						<div className="flex flex-col gap-1 text-sm">
							<div className="font-medium">
								{campaign.leadsCount.toLocaleString()}
							</div>
							<div className="text-xs text-muted-foreground">
								{campaign.leadsConverted} converted
							</div>
						</div>
					)
				}
			},
			{
				accessorKey: "updatedAt",
				header: ({ column }) => {
					return (
						<div className="flex items-center space-x-2">
							<CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
							<Button
								variant="ghost"
								onClick={() =>
									column.toggleSorting(
										column.getIsSorted() === "asc"
									)
								}
								className="h-auto p-0 font-medium hover:bg-transparent hover:text-foreground"
							>
								Updated
								{column.getIsSorted() === "desc" ? (
									<ArrowDownIcon className="ml-2 h-4 w-4" />
								) : column.getIsSorted() === "asc" ? (
									<ArrowUpIcon className="ml-2 h-4 w-4" />
								) : null}
							</Button>
						</div>
					)
				},
				cell: ({ row }) => {
					const date = new Date(row.getValue("updatedAt"))
					return (
						<div className="text-sm text-muted-foreground">
							{format(date, "MMM d, yyyy")}
						</div>
					)
				}
			},
			{
				id: "actions",
				header: () => <span className="font-medium">Actions</span>,
				cell: ({ row }) => {
					const campaign = row.original
					return (
						<QuickActionControls
							campaign={campaign}
							onActionComplete={handleRefresh}
						/>
					)
				},
				enableSorting: false
			}
		],
		[handleRefresh]
	)

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: true,
		globalFilterFn: (row, columnId, filterValue) => {
			const searchValue = filterValue.toLowerCase()
			const campaignName = row.getValue("name") as string
			const status = row.getValue("status") as string

			return (
				campaignName?.toLowerCase().includes(searchValue) ||
				status?.toLowerCase().includes(searchValue)
			)
		},
		state: {
			sorting,
			columnVisibility,
			columnFilters,
			pagination,
			globalFilter: searchQuery,
			rowSelection
		}
	})

	const isFilterActive = (columnId: string) => {
		return columnFilters.some((filter) => filter.id === columnId)
	}

	const getFilterValues = (columnId: string): string[] => {
		const filter = columnFilters.find((f) => f.id === columnId)
		return Array.isArray(filter?.value) ? filter.value : []
	}

	const toggleFilterValue = (columnId: string, value: string) => {
		const currentValues = getFilterValues(columnId)
		const newValues = currentValues.includes(value)
			? currentValues.filter((v) => v !== value)
			: [...currentValues, value]

		setColumnFilters((prev) =>
			prev
				.filter((filter) => filter.id !== columnId)
				.concat(
					newValues.length > 0
						? [{ id: columnId, value: newValues }]
						: []
				)
		)
	}

	const clearFilters = () => {
		setColumnFilters([])
	}

	return (
		<div className="space-y-4">
			{selectedRows > 0 && (
				<div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium">
							{selectedRows} campaign{selectedRows > 1 ? "s" : ""}{" "}
							selected
						</span>
					</div>
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => handleBulkAction("start")}
							className="gap-1 rounded-lg"
						>
							<PlayIcon className="h-4 w-4" />
							Start
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => handleBulkAction("pause")}
							className="gap-1 rounded-lg"
						>
							<PauseCircleIcon className="h-4 w-4" />
							Pause
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => handleBulkAction("stop")}
							className="gap-1 rounded-lg"
						>
							<StopCircleIcon className="h-4 w-4" />
							Stop
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setRowSelection({})}
							className="gap-1 rounded-lg"
						>
							Clear Selection
						</Button>
					</div>
				</div>
			)}
			<div className="flex flex-col gap-3 sm:flex-row sm:gap-2 items-start sm:items-center justify-between">
				<div className="relative w-full sm:flex-1 sm:max-w-sm">
					<SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search campaigns..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						className="pl-8 rounded-lg w-full"
					/>
				</div>
				<div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={`gap-1 rounded-lg ${
									isFilterActive("status")
										? "bg-primary text-primary-foreground"
										: ""
								}`}
							>
								<FilterIcon className="h-4 w-4" />
								Status
								{isFilterActive("status") && (
									<Badge
										variant="secondary"
										className="ml-1 h-4 text-xs"
									>
										{getFilterValues("status").length}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-56" align="end">
							<div className="space-y-2">
								<h4 className="font-medium text-sm">Status</h4>
								{[
									"draft",
									"running",
									"paused",
									"completed",
									"cancelled"
								].map((status) => (
									<div
										key={status}
										className="flex items-center space-x-2"
									>
										<input
											type="checkbox"
											id={`status-${status}`}
											checked={getFilterValues(
												"status"
											).includes(status)}
											onChange={() =>
												toggleFilterValue(
													"status",
													status
												)
											}
											className="rounded border-gray-300"
										/>
										<label
											htmlFor={`status-${status}`}
											className="text-sm capitalize"
										>
											{status}
										</label>
									</div>
								))}
								{isFilterActive("status") && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setColumnFilters((prev) =>
												prev.filter(
													(f) => f.id !== "status"
												)
											)
										}}
										className="w-full text-xs"
									>
										Clear
									</Button>
								)}
							</div>
						</PopoverContent>
					</Popover>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="gap-1 rounded-lg"
							>
								<ColumnsIcon className="h-4 w-4" />
								Columns
								<ChevronDownIcon className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[200px]">
							{table
								.getAllColumns()
								.filter(
									(column) =>
										typeof column.accessorFn !==
											"undefined" && column.getCanHide()
								)
								.map((column) => {
									return (
										<DropdownMenuCheckboxItem
											key={column.id}
											className="capitalize"
											checked={column.getIsVisible()}
											onCheckedChange={(value) =>
												column.toggleVisibility(!!value)
											}
										>
											{formatColumnName(column.id)}
										</DropdownMenuCheckboxItem>
									)
								})}
						</DropdownMenuContent>
					</DropdownMenu>

					{(isFilterActive("status") || searchQuery) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								clearFilters()
								onSearchChange("")
							}}
							className="gap-1 rounded-lg"
						>
							Clear All
						</Button>
					)}
				</div>
			</div>

			<div className="overflow-x-auto rounded-2xl border border-border bg-card/40 backdrop-blur-sm">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow
								key={headerGroup.id}
								className="border-border"
							>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead
											key={header.id}
											className="px-2 sm:px-4 py-3 whitespace-nowrap"
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext()
													)}
										</TableHead>
									)
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && "selected"
									}
									className="border-border hover:bg-muted/50 cursor-pointer transition-colors"
									onClick={() => onRowClick?.(row.original)}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="px-2 sm:px-4 py-3"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center px-2 sm:px-4"
								>
									No campaigns found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<DataTablePagination table={table} />
		</div>
	)
}
