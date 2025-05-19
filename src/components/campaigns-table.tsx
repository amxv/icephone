"use client"

import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState
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
	CalendarDaysIcon, // For last updated
	CheckCircle2Icon, // For leads converted
	ChevronDownIcon,
	ColumnsIcon,
	FileEditIcon, // For draft status
	FilterIcon,
	HistoryIcon, // For running status (waiting)
	ListChecksIcon, // For status
	MoreVerticalIcon,
	PauseCircleIcon, // For paused status
	SearchIcon,
	UsersIcon // For leads count
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
import { useSettings } from "@/contexts/settings-context"

// Define a schema for our campaign data
export const campaignSchema = z.object({
	id: z.number(),
	name: z.string(),
	status: z.string().nullable(), // e.g., running, completed, paused, draft, cancelled
	leadsCount: z.number(),
	leadsConverted: z.number(),
	updatedAt: z.string() // ISO date string
})

// Infer the type from our schema
export type CampaignItem = z.infer<typeof campaignSchema>

const formatColumnName = (columnId: string): string => {
	return columnId
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

// Status Badge Component for Campaigns
const CampaignStatusBadge = ({ status }: { status: string | null }) => {
	if (!status)
		return <span className="text-muted-foreground italic">Unknown</span>

	const statusConfig: Record<
		string,
		{ color: string; label: string; icon?: React.ElementType }
	> = {
		running: {
			color: "bg-orange-100 text-orange-800 border-orange-200", // Changed to orange
			label: "Running",
			icon: HistoryIcon // Changed to HistoryIcon
		},
		completed: {
			color: "bg-green-100 text-green-800 border-green-200",
			label: "Completed",
			icon: CheckCircle2Icon
		},
		paused: {
			color: "bg-red-100 text-red-800 border-red-200", // Changed to red
			label: "Paused",
			icon: PauseCircleIcon // Added PauseCircleIcon
		},
		draft: {
			color: "bg-gray-100 text-gray-800 border-gray-200",
			label: "Draft",
			icon: FileEditIcon // Added FileEditIcon
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
		<Badge
			variant="outline"
			className={`${config.color} whitespace-nowrap`}
		>
			{IconComponent && <IconComponent className="h-3.5 w-3.5 mr-1.5" />}
			{config.label}
		</Badge>
	)
}

export function CampaignsTable({
	data: initialData,
	initialColumnFilters = [],
	onFilterChange,
	// onRowClick, // Removed as per requirement
	// selectedCampaignId, // Removed
	searchQuery,
	onSearchChange
}: {
	data: CampaignItem[]
	initialColumnFilters?: ColumnFiltersState
	onFilterChange?: (filters: ColumnFiltersState) => void
	// onRowClick?: (campaign: CampaignItem) => void; // Removed
	// selectedCampaignId?: number; // Removed
	searchQuery: string
	onSearchChange: (query: string) => void
}) {
	const [data, setData] = React.useState(() => initialData)
	const { tableRowsPerPage } = useSettings()

	const processedInitialFilters = React.useMemo(() => {
		return initialColumnFilters.map((filter) => {
			if (filter.value && !Array.isArray(filter.value)) {
				return { ...filter, value: [filter.value] }
			}
			return filter
		})
	}, [initialColumnFilters])

	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({})
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
		const currentFiltersString = JSON.stringify(columnFilters)
		const lastNotifiedFiltersString = JSON.stringify(
			lastNotifiedColumnFiltersRef.current
		)

		if (
			onFilterChange &&
			currentFiltersString !== lastNotifiedFiltersString
		) {
			onFilterChange(columnFilters)
			lastNotifiedColumnFiltersRef.current = columnFilters
		}
	}, [columnFilters, onFilterChange])

	const [globalFilter, setGlobalFilter] = React.useState(searchQuery)

	React.useEffect(() => {
		setGlobalFilter(searchQuery)
	}, [searchQuery])

	const filteredData = React.useMemo(() => {
		if (!globalFilter) return data
		return data.filter((item) =>
			item.name.toLowerCase().includes(globalFilter.toLowerCase())
		)
	}, [data, globalFilter])

	// Define columns for campaigns table
	const columns = React.useMemo<ColumnDef<CampaignItem>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
						className="hover:bg-muted/50 pl-0"
					>
						Name
						{column.getIsSorted() === "asc" ? (
							<ArrowUpIcon className="ml-2 h-4 w-4" />
						) : column.getIsSorted() === "desc" ? (
							<ArrowDownIcon className="ml-2 h-4 w-4" />
						) : null}
					</Button>
				),
				cell: ({ row }) => (
					<Link
						href={`/campaigns/${row.original.id}`}
						className="hover:underline"
					>
						{row.getValue("name")}
					</Link>
				),
				size: 300
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
						className="hover:bg-transparent p-0 font-medium"
					>
						Status
						{column.getIsSorted() === "asc" ? (
							<ArrowUpIcon className="ml-1.5 h-4 w-4" />
						) : column.getIsSorted() === "desc" ? (
							<ArrowDownIcon className="ml-1.5 h-4 w-4" />
						) : null}
					</Button>
				),
				cell: ({ row }) => (
					<CampaignStatusBadge status={row.original.status} />
				),
				filterFn: (row, id, filterValue) => {
					if (
						!filterValue ||
						(Array.isArray(filterValue) && filterValue.length === 0)
					)
						return true
					return (
						Array.isArray(filterValue) &&
						filterValue.includes(String(row.getValue(id)))
					)
				},
				size: 150
			},
			{
				accessorKey: "leadsCount",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
						className="hover:bg-transparent p-0 font-medium w-full justify-center"
					>
						<UsersIcon className="mr-1.5 h-4 w-4" /> Leads
						{column.getIsSorted() === "asc" ? (
							<ArrowUpIcon className="ml-1.5 h-4 w-4" />
						) : column.getIsSorted() === "desc" ? (
							<ArrowDownIcon className="ml-1.5 h-4 w-4" />
						) : null}
					</Button>
				),
				cell: ({ row }) => (
					<div className="text-center">
						{row.original.leadsCount.toLocaleString()}
					</div>
				),
				size: 100 // Made smaller
			},
			{
				accessorKey: "leadsConverted",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
						className="hover:bg-transparent p-0 font-medium w-full justify-center"
					>
						<CheckCircle2Icon className="mr-1.5 h-4 w-4" /> Leads
						Converted
						{column.getIsSorted() === "asc" ? (
							<ArrowUpIcon className="ml-1.5 h-4 w-4" />
						) : column.getIsSorted() === "desc" ? (
							<ArrowDownIcon className="ml-1.5 h-4 w-4" />
						) : null}
					</Button>
				),
				cell: ({ row }) => (
					<div className="text-center">
						{row.original.leadsConverted.toLocaleString()}
					</div>
				),
				size: 150 // Made smaller
			},
			{
				accessorKey: "updatedAt",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
						className="hover:bg-transparent p-0 font-medium w-full justify-center"
					>
						<CalendarDaysIcon className="mr-1.5 h-4 w-4" /> Last
						Updated
						{column.getIsSorted() === "asc" ? (
							<ArrowUpIcon className="ml-1.5 h-4 w-4" />
						) : column.getIsSorted() === "desc" ? (
							<ArrowDownIcon className="ml-1.5 h-4 w-4" />
						) : null}
					</Button>
				),
				cell: ({ row }) => (
					<div className="text-center">
						{format(
							new Date(row.original.updatedAt),
							"MMM d, yyyy h:mm a"
						)}
					</div>
				),
				size: 200 // Adjusted size
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
								size="icon"
								onClick={(e) => e.stopPropagation()} // Prevent row click if any
							>
								<MoreVerticalIcon className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-[160px]"
							onClick={(e) => e.stopPropagation()} // Prevent row click if any
						>
							<DropdownMenuItem
								// onClick={() => onRowClick && onRowClick(row.original)} // Removed
								onClick={() =>
									router.push(`/campaigns/${row.original.id}`)
								} // Navigate to campaign details page
							>
								View Campaign
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem>Edit</DropdownMenuItem>
							<DropdownMenuItem className="text-red-600 hover:!text-red-600 focus:text-red-600">
								Archive
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableHiding: false,
				size: 50,
				maxSize: 50
			}
		],
		[router /*, onRowClick*/] // Removed onRowClick
	)

	const table = useReactTable({
		data: filteredData,
		columns,
		state: {
			sorting,
			columnVisibility,
			columnFilters,
			pagination
		},
		getRowId: (row) => row.id.toString(),
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		manualFiltering: true, // Server-side filtering for global search is often manual
		manualPagination: false, // Assuming client-side pagination for now
		manualSorting: false // Assuming client-side sorting for now
	})

	const isAnyFilterActive = columnFilters.length > 0
	const statusFilterOptions = React.useMemo(() => {
		const statuses = new Set(
			data.map((item) => item.status).filter(Boolean) as string[]
		)
		return Array.from(statuses).map((status) => ({
			value: status,
			label: formatColumnName(status)
		}))
	}, [data])

	const isFilterActive = (columnId: string) => {
		return columnFilters.some((filter) => filter.id === columnId)
	}

	const getFilterValues = (columnId: string): string[] => {
		const filter = columnFilters.find((filter) => filter.id === columnId)
		return filter && Array.isArray(filter.value) ? filter.value : []
	}

	const toggleFilterValue = (columnId: string, value: string) => {
		setColumnFilters((prev) => {
			const newFilters = prev.filter((f) => f.id !== columnId)
			const currentValues = getFilterValues(columnId)
			const newValues = currentValues.includes(value)
				? currentValues.filter((v) => v !== value)
				: [...currentValues, value]

			if (newValues.length > 0) {
				newFilters.push({ id: columnId, value: newValues })
			}
			return newFilters
		})
	}

	const clearFilters = () => {
		setColumnFilters([])
	}

	return (
		<div className="space-y-4 h-full flex flex-col overflow-hidden">
			{/* Table Toolbar */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<div className="relative w-full max-w-sm">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search campaigns..."
							value={globalFilter ?? ""}
							onChange={(event) =>
								onSearchChange(event.target.value)
							}
							className="pl-10 h-10 rounded-xl focus-visible:ring-offset-0 focus-visible:ring-primary/30"
						/>
					</div>

					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={`h-10 rounded-xl ${isFilterActive("status") ? "border-primary/50 ring-1 ring-primary/50" : ""}`}
							>
								<FilterIcon className="mr-2 h-4 w-4" />
								Status
								{getFilterValues("status").length > 0 && (
									<Badge
										variant="secondary"
										className="ml-2 rounded-md px-1.5 py-0.5 text-xs"
									>
										{getFilterValues("status").length}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[220px] p-0" align="start">
							<div className="p-2">
								<p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
									Filter by status
								</p>
								<div className="mt-1 space-y-1">
									{statusFilterOptions.map((option) => (
										<Button
											key={option.value}
											variant={
												getFilterValues(
													"status"
												).includes(option.value)
													? "secondary"
													: "ghost"
											}
											className="w-full justify-start h-8 text-sm rounded-md"
											onClick={() =>
												toggleFilterValue(
													"status",
													option.value
												)
											}
										>
											<span
												className={`mr-2 h-2 w-2 rounded-full ${getFilterValues("status").includes(option.value) ? "bg-primary" : "bg-muted-foreground/30"}`}
											/>
											{option.label}
										</Button>
									))}
								</div>
							</div>
							{getFilterValues("status").length > 0 && (
								<>
									<DropdownMenuSeparator />
									<div className="p-1">
										<Button
											variant="ghost"
											className="w-full justify-center h-8 text-sm rounded-md text-primary hover:text-primary"
											onClick={clearFilters}
										>
											Clear filters
										</Button>
									</div>
								</>
							)}
						</PopoverContent>
					</Popover>

					{isAnyFilterActive && (
						<Button
							variant="ghost"
							onClick={clearFilters}
							className="h-10 rounded-xl px-3 text-muted-foreground hover:text-primary"
						>
							Reset
						</Button>
					)}
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="h-10 rounded-xl">
							<ColumnsIcon className="mr-2 h-4 w-4" />
							View
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-[180px]">
						<div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
							Toggle columns
						</div>
						<DropdownMenuSeparator />
						{table
							.getAllColumns()
							.filter((column) => column.getCanHide())
							.map((column) => {
								return (
									<DropdownMenuCheckboxItem
										key={column.id}
										className="capitalize rounded-md"
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
			</div>

			{/* Table Body */}
			<div className="rounded-2xl border overflow-hidden flex-1 flex flex-col">
				<div className="overflow-y-auto flex-1">
					<Table>
						<TableHeader className="bg-muted sticky top-0 z-10">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map(
										(header, index) => (
											<TableHead
												key={header.id}
												colSpan={header.colSpan}
												style={{
													width:
														header.getSize() !== 150
															? `${header.getSize()}px`
															: undefined
												}}
												className={`py-3 ${index === 0 ? "pl-6" : ""} ${index === headerGroup.headers.length - 1 ? "pr-6" : ""}`}
											>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column
																.columnDef
																.header,
															header.getContext()
														)}
											</TableHead>
										)
									)}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										// onClick={() => onRowClick && onRowClick(row.original)} // Removed
										className="hover:bg-accent/20 transition-colors cursor-pointer"
										// selectedCampaignId === row.original.id ? "bg-accent/40" : "" // Removed
									>
										{row
											.getVisibleCells()
											.map((cell, index) => (
												<TableCell
													key={cell.id}
													style={{
														width:
															cell.column.getSize() !==
															150
																? `${cell.column.getSize()}px`
																: undefined
													}}
													className={`${index === 0 ? "pl-6" : ""} ${index === row.getVisibleCells().length - 1 ? "pr-6" : ""}`}
												>
													{flexRender(
														cell.column.columnDef
															.cell,
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
										className="h-24 text-center px-6"
									>
										No campaigns found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			<DataTablePagination table={table} />
		</div>
	)
}
