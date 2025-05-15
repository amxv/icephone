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
	ChevronDownIcon,
	ColumnsIcon,
	FilterIcon,
	MoreVerticalIcon,
	PhoneCallIcon,
	PhoneIcon,
	PhoneIncomingIcon,
	PhoneOutgoingIcon,
	SearchIcon
} from "lucide-react"
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { useSettings } from "@/contexts/settings-context"

// Define a schema for our call data
export const callSchema = z.object({
	id: z.number(),
	leadId: z.number(),
	leadName: z.string().nullable(),
	type: z.enum(["incoming", "outgoing"]),
	duration: z.number().nullable(),
	startTime: z.string(),
	summary: z.string().nullable(),
	transcript: z.string().nullable(),
	recordingUrl: z.string().nullable(),
	status: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
})

// Infer the type from our schema
export type CallItem = z.infer<typeof callSchema>

// Helper functions
const formatDuration = (seconds: number | null): string => {
	if (seconds === null) return "N/A"

	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const formatColumnName = (columnId: string): string => {
	return columnId
		.replace(/([a-z])([A-Z])/g, "$1 $2") // Convert camelCase to space separated
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

// Type Badge Component
const TypeBadge = ({ type }: { type: "incoming" | "outgoing" }) => {
	if (type === "incoming") {
		return (
			<Badge
				variant="outline"
				className="bg-green-100 text-green-800 border-green-200"
			>
				<PhoneIncomingIcon className="h-3 w-3 mr-1" /> Incoming
			</Badge>
		)
	}

	return (
		<Badge
			variant="outline"
			className="bg-blue-100 text-blue-800 border-blue-200"
		>
			<PhoneOutgoingIcon className="h-3 w-3 mr-1" /> Outgoing
		</Badge>
	)
}

// Status Badge Component
const StatusBadge = ({ status }: { status: string | null }) => {
	if (!status)
		return <span className="text-muted-foreground italic">Unknown</span>

	const statusConfig: Record<string, { color: string; label: string }> = {
		answered: {
			color: "bg-green-100 text-green-800 border-green-200",
			label: "Answered"
		},
		voicemail: {
			color: "bg-orange-100 text-orange-800 border-orange-200",
			label: "Voicemail"
		},
		missed: {
			color: "bg-red-100 text-red-800 border-red-200",
			label: "Missed"
		},
		busy: {
			color: "bg-yellow-100 text-yellow-800 border-yellow-200",
			label: "Busy"
		},
		failed: {
			color: "bg-red-100 text-red-800 border-red-200",
			label: "Failed"
		}
	}

	const config = statusConfig[status.toLowerCase()] || {
		color: "bg-gray-100 text-gray-800 border-gray-200",
		label: status
	}

	return (
		<Badge variant="outline" className={config.color}>
			{config.label}
		</Badge>
	)
}

export function CallsTable({
	data: initialData,
	initialColumnFilters = [],
	onFilterChange,
	onRowClick,
	selectedCallId
}: {
	data: CallItem[]
	initialColumnFilters?: ColumnFiltersState
	onFilterChange?: (filters: ColumnFiltersState) => void
	onRowClick: (call: CallItem) => void
	selectedCallId?: number
}) {
	const [data, setData] = React.useState(() => initialData)
	// Get global table rows per page setting
	const { tableRowsPerPage } = useSettings()

	// Process initial column filters to ensure arrays
	const processedInitialFilters = React.useMemo(() => {
		return initialColumnFilters.map((filter) => {
			// Make sure all filter values are arrays
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
		{ id: "startTime", desc: true }
	])
	const [searchQuery, setSearchQuery] = React.useState("")
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: tableRowsPerPage
	})
	const router = useRouter()

	// Update data when initialData changes
	React.useEffect(() => {
		setData(initialData)
	}, [initialData])

	// Update column filters when initialColumnFilters change
	React.useEffect(() => {
		// Only update if initialColumnFilters have values
		if (initialColumnFilters.length > 0) {
			setColumnFilters(processedInitialFilters)
		}
	}, [initialColumnFilters, processedInitialFilters])

	// Call onFilterChange when columnFilters change
	React.useEffect(() => {
		if (onFilterChange) {
			onFilterChange(columnFilters)
		}
	}, [columnFilters, onFilterChange])

	// Get unique types for filters
	const uniqueTypes = React.useMemo(() => {
		const types = new Set<string>()
		for (const item of data) {
			if (item.type) types.add(item.type)
		}
		return Array.from(types)
	}, [data])

	// Get unique statuses for filters
	const uniqueStatuses = React.useMemo(() => {
		const statuses = new Set<string>()
		for (const item of data) {
			if (item.status) statuses.add(item.status)
		}
		return Array.from(statuses)
	}, [data])

	// Filter data based on search query
	const filteredData = React.useMemo(() => {
		if (!searchQuery.trim()) return data

		const lowerQuery = searchQuery.toLowerCase()
		return data.filter(
			(item) =>
				(item.leadName?.toLowerCase() || "").includes(lowerQuery) ||
				(item.summary?.toLowerCase() || "").includes(lowerQuery) ||
				(item.status?.toLowerCase() || "").includes(lowerQuery)
		)
	}, [data, searchQuery])

	// Define columns for our calls table
	const columns = React.useMemo<ColumnDef<CallItem>[]>(
		() => [
			{
				accessorKey: "leadName",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(
									column.getIsSorted() === "asc"
								)
							}
							className="hover:bg-transparent p-0 font-medium"
						>
							Lead
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
				cell: ({ row }) => (
					<button
						type="button"
						className="font-medium cursor-pointer text-black hover:underline text-left bg-transparent border-none"
						onClick={(e) => {
							e.stopPropagation()
							router.push(`/leads/${row.original.leadId}`)
						}}
					>
						{row.original.leadName || "Unknown"}
					</button>
				)
			},
			{
				accessorKey: "type",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(
									column.getIsSorted() === "asc"
								)
							}
							className="hover:bg-transparent p-0 font-medium"
						>
							Type
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
				cell: ({ row }) => <TypeBadge type={row.original.type} />,
				filterFn: (row, id, filterValue) => {
					if (
						!filterValue ||
						(Array.isArray(filterValue) && filterValue.length === 0)
					) {
						return true
					}

					return (
						Array.isArray(filterValue) &&
						filterValue.includes(String(row.getValue(id)))
					)
				}
			},
			{
				accessorKey: "startTime",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(
									column.getIsSorted() === "asc"
								)
							}
							className="hover:bg-transparent p-0 font-medium"
						>
							Date & Time
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
				cell: ({ row }) => (
					<div className="font-medium">
						{format(
							new Date(row.original.startTime),
							"MMM d, yyyy h:mm a"
						)}
					</div>
				)
			},
			{
				accessorKey: "duration",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(
									column.getIsSorted() === "asc"
								)
							}
							className="hover:bg-transparent p-0 font-medium"
						>
							Duration
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
				cell: ({ row }) => (
					<div>{formatDuration(row.original.duration)}</div>
				)
			},
			{
				accessorKey: "status",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(
									column.getIsSorted() === "asc"
								)
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
					)
				},
				cell: ({ row }) => <StatusBadge status={row.original.status} />,
				filterFn: (row, id, filterValue) => {
					if (
						!filterValue ||
						(Array.isArray(filterValue) && filterValue.length === 0)
					) {
						return true
					}

					return (
						Array.isArray(filterValue) &&
						filterValue.includes(String(row.getValue(id)))
					)
				}
			},
			{
				accessorKey: "summary",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(
									column.getIsSorted() === "asc"
								)
							}
							className="hover:bg-transparent p-0 font-medium"
						>
							Summary
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
				cell: ({ row }) => (
					<div className="max-w-[300px] truncate">
						{row.original.summary || (
							<span className="text-muted-foreground italic">
								No summary available
							</span>
						)}
					</div>
				)
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
								onClick={(e) => e.stopPropagation()}
							>
								<MoreVerticalIcon className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-[160px]"
							onClick={(e) => e.stopPropagation()}
						>
							<DropdownMenuItem
								onClick={() => onRowClick(row.original)}
							>
								View Details
							</DropdownMenuItem>
							{row.original.recordingUrl && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => {
											if (row.original.recordingUrl) {
												window.open(
													row.original.recordingUrl,
													"_blank"
												)
											}
										}}
									>
										Play Recording
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				),
				enableSorting: false,
				enableHiding: false,
				size: 50,
				maxSize: 50
			}
		],
		[router, onRowClick]
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
		getFacetedUniqueValues: getFacetedUniqueValues()
	})

	// Helper function to check if a filter is active
	const isFilterActive = (columnId: string) => {
		return columnFilters.some(
			(filter) =>
				filter.id === columnId &&
				Array.isArray(filter.value) &&
				filter.value.length > 0
		)
	}

	// Get the active filter value as array
	const getFilterValues = (columnId: string): string[] => {
		const filter = columnFilters.find((filter) => filter.id === columnId)
		return filter && Array.isArray(filter.value) ? filter.value : []
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
				<div className="relative">
					<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Search calls..."
						className="pl-8 w-64"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<div className="flex gap-2">
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={
									isFilterActive("type") ? "text-primary" : ""
								}
							>
								<FilterIcon
									className={`mr-2 h-4 w-4 ${isFilterActive("type") ? "text-primary" : ""}`}
								/>
								Type
								<ChevronDownIcon className="ml-2 h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="p-4 w-[200px]">
							<div className="flex flex-col gap-3">
								<h4 className="font-medium text-sm">
									Call Type
								</h4>
								<div className="flex flex-col gap-2">
									{uniqueTypes.map((type) => (
										<div
											key={type}
											className="flex items-center gap-2"
										>
											<input
												type="checkbox"
												id={`type-${type}`}
												checked={getFilterValues(
													"type"
												).includes(type)}
												onChange={(e) => {
													const filterValues = [
														...getFilterValues(
															"type"
														)
													]
													if (e.target.checked) {
														filterValues.push(type)
													} else {
														const index =
															filterValues.indexOf(
																type
															)
														if (index !== -1) {
															filterValues.splice(
																index,
																1
															)
														}
													}
													table
														.getColumn("type")
														?.setFilterValue(
															filterValues
														)
												}}
												className="border-gray-300 rounded text-primary focus:ring-primary"
											/>
											<label
												htmlFor={`type-${type}`}
												className="text-sm"
											>
												{type === "incoming"
													? "Incoming"
													: "Outgoing"}
											</label>
										</div>
									))}
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={
									isFilterActive("status")
										? "text-primary"
										: ""
								}
							>
								<FilterIcon
									className={`mr-2 h-4 w-4 ${isFilterActive("status") ? "text-primary" : ""}`}
								/>
								Status
								<ChevronDownIcon className="ml-2 h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="p-4 w-[200px]">
							<div className="flex flex-col gap-3">
								<h4 className="font-medium text-sm">
									Call Status
								</h4>
								<div className="flex flex-col gap-2">
									{uniqueStatuses.map((status) => (
										<div
											key={status}
											className="flex items-center gap-2"
										>
											<input
												type="checkbox"
												id={`status-${status}`}
												checked={getFilterValues(
													"status"
												).includes(status)}
												onChange={(e) => {
													const filterValues = [
														...getFilterValues(
															"status"
														)
													]
													if (e.target.checked) {
														filterValues.push(
															status
														)
													} else {
														const index =
															filterValues.indexOf(
																status
															)
														if (index !== -1) {
															filterValues.splice(
																index,
																1
															)
														}
													}
													table
														.getColumn("status")
														?.setFilterValue(
															filterValues
														)
												}}
												className="border-gray-300 rounded text-primary focus:ring-primary"
											/>
											<label
												htmlFor={`status-${status}`}
												className="text-sm"
											>
												{status
													.charAt(0)
													.toUpperCase() +
													status.slice(1)}
											</label>
										</div>
									))}
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<ColumnsIcon className="h-4 w-4 mr-2" />
								Columns
								<ChevronDownIcon className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[180px]">
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
				</div>
			</div>

			<div className="rounded-2xl border overflow-hidden">
				<Table>
					<TableHeader className="bg-muted">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header, index) => (
									<TableHead
										key={header.id}
										colSpan={header.colSpan}
										className={`py-3 ${index === 0 ? "pl-6" : ""} ${index === headerGroup.headers.length - 1 ? "pr-6 w-[60px]" : ""}`}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef
														.header,
													header.getContext()
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className={`hover:bg-accent/20 transition-colors cursor-pointer ${selectedCallId === row.original.id ? "bg-accent/40" : ""}`}
									onClick={() => onRowClick(row.original)}
								>
									{row
										.getVisibleCells()
										.map((cell, index) => (
											<TableCell
												key={cell.id}
												className={`${index === 0 ? "pl-6" : ""} ${index === row.getVisibleCells().length - 1 ? "pr-6 w-[60px]" : ""}`}
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
									className="h-24 text-center px-6"
								>
									No results found.
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
