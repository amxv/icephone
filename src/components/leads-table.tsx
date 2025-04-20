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
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	ColumnsIcon,
	FilterIcon,
	MoreVerticalIcon,
	SearchIcon,
	StarIcon
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"

// Define a schema for our lead data
export const leadSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	score: z.number(),
	status: z.string(),
	source: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
})

// Create a type for the lead item
export type LeadItem = z.infer<typeof leadSchema>

// ScoreBadge component to display lead score
function ScoreBadge({ score }: { score: number }) {
	let color = "bg-red-100 text-red-800"
	if (score >= 75) {
		color = "bg-green-100 text-green-800"
	} else if (score >= 50) {
		color = "bg-amber-100 text-amber-800"
	} else if (score >= 25) {
		color = "bg-orange-100 text-orange-800"
	}

	return (
		<span
			className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${color}`}
		>
			{score}
		</span>
	)
}

// StatusBadge component to display lead status
function StatusBadge({ status }: { status: string }) {
	let variant: "default" | "secondary" | "destructive" | "outline" = "default"

	switch (status) {
		case "new":
			variant = "default"
			break
		case "contacted":
			variant = "secondary"
			break
		case "qualified":
			// Use proper variant or cast if needed
			variant = "default"
			break
		case "converted":
			// Use proper variant or cast if needed
			variant = "default"
			break
		case "lost":
			variant = "destructive"
			break
		default:
			variant = "outline"
	}

	return <Badge variant={variant}>{status}</Badge>
}

export function LeadsTable({
	data: initialData,
	initialColumnFilters = [],
	onFilterChange
}: {
	data: LeadItem[]
	initialColumnFilters?: ColumnFiltersState
	onFilterChange?: (filters: ColumnFiltersState) => void
}) {
	const [data, setData] = React.useState(() => initialData)

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
		{ id: "updatedAt", desc: true }
	])
	const [searchQuery, setSearchQuery] = React.useState("")
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10
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

	// Get unique statuses for filters
	const uniqueStatuses = React.useMemo(() => {
		const statuses = new Set<string>()
		for (const item of data) {
			if (item.status) statuses.add(item.status)
		}
		return Array.from(statuses)
	}, [data])

	// Get unique sources for filters
	const uniqueSources = React.useMemo(() => {
		const sources = new Set<string>()
		for (const item of data) {
			if (item.source) sources.add(item.source)
		}
		return Array.from(sources)
	}, [data])

	// Filter data based on search query
	const filteredData = React.useMemo(() => {
		if (!searchQuery.trim()) return data

		const lowerQuery = searchQuery.toLowerCase()
		return data.filter(
			(item) =>
				(item.name?.toLowerCase() || "").includes(lowerQuery) ||
				(item.email?.toLowerCase() || "").includes(lowerQuery) ||
				(item.phone?.toLowerCase() || "").includes(lowerQuery) ||
				(item.source?.toLowerCase() || "").includes(lowerQuery) ||
				(item.notes?.toLowerCase() || "").includes(lowerQuery)
		)
	}, [data, searchQuery])

	// Define columns for our leads table
	const columns = React.useMemo<ColumnDef<LeadItem>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<button
						type="button"
						className="font-medium cursor-pointer text-primary hover:underline text-left bg-transparent border-none"
						onClick={(e) => {
							e.stopPropagation()
							router.push(`/leads/${row.original.id}`)
						}}
					>
						{row.original.name}
					</button>
				)
			},
			{
				accessorKey: "score",
				header: "Score",
				cell: ({ row }) => <ScoreBadge score={row.original.score} />,
				filterFn: (row, id, filterValue) => {
					if (
						!filterValue ||
						(Array.isArray(filterValue) && filterValue.length === 0)
					) {
						return true
					}

					const score = row.getValue<number>(id)
					const [min, max] = filterValue as [number, number]

					return score >= min && score <= max
				}
			},
			{
				accessorKey: "status",
				header: "Status",
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
				accessorKey: "email",
				header: "Email",
				cell: ({ row }) => (
					<div>
						{row.original.email || (
							<span className="text-muted-foreground italic">
								N/A
							</span>
						)}
					</div>
				)
			},
			{
				accessorKey: "phone",
				header: "Phone",
				cell: ({ row }) => (
					<div>
						{row.original.phone || (
							<span className="text-muted-foreground italic">
								N/A
							</span>
						)}
					</div>
				)
			},
			{
				accessorKey: "source",
				header: "Source",
				cell: ({ row }) => (
					<div>
						{row.original.source || (
							<span className="text-muted-foreground italic">
								Unknown
							</span>
						)}
					</div>
				),
				filterFn: (row, id, filterValue) => {
					if (
						!filterValue ||
						(Array.isArray(filterValue) && filterValue.length === 0)
					) {
						return true
					}

					return (
						Array.isArray(filterValue) &&
						row.getValue(id) !== null &&
						filterValue.includes(String(row.getValue(id)))
					)
				}
			},
			{
				accessorKey: "updatedAt",
				header: "Last Updated",
				cell: ({ row }) => (
					<div className="font-medium">
						{format(
							new Date(row.original.updatedAt),
							"MMM d, yyyy"
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
								onClick={() =>
									router.push(`/leads/${row.original.id}`)
								}
							>
								View Details
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() =>
									router.push(
										`/leads/${row.original.id}/edit`
									)
								}
							>
								Edit Lead
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									router.push(
										`/leads/${row.original.id}/delete`
									)
								}
							>
								Delete Lead
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)
			}
		],
		[router]
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

	// Handle toggling a filter value
	const toggleFilterValue = (columnId: string, value: string) => {
		const currentValues = getFilterValues(columnId)

		if (currentValues.includes(value)) {
			// Remove value if already selected
			table
				.getColumn(columnId)
				?.setFilterValue(currentValues.filter((v) => v !== value))
		} else {
			// Add value if not selected
			table.getColumn(columnId)?.setFilterValue([...currentValues, value])
		}
	}

	// Clear all values for a specific filter
	const clearFilter = (columnId: string) => {
		table.getColumn(columnId)?.setFilterValue([])
	}

	// Format column ID for display (e.g., "createdAt" to "Created At")
	const formatColumnName = (columnId: string): string => {
		// Handle special cases
		if (columnId === "updatedAt") return "Last Updated"

		// Add space before capitals and capitalize first letter
		return (
			columnId
				// Insert a space before all caps
				.replace(/([A-Z])/g, " $1")
				// Capitalize the first letter
				.replace(/^./, (str) => str.toUpperCase())
				.trim()
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
				<div className="relative w-full sm:w-64">
					<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search leads..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-8 w-full"
					/>
				</div>
				<div className="flex items-center gap-2">
					{/* Status Filter */}
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={`h-8 gap-1 ${isFilterActive("status") ? "bg-accent/30" : ""}`}
							>
								<FilterIcon className="h-3.5 w-3.5" />
								<span>
									{isFilterActive("status")
										? `Status (${getFilterValues("status").length})`
										: "Status"}
								</span>
								{isFilterActive("status") && (
									<Badge
										variant="secondary"
										className="ml-1 px-1 font-normal"
									>
										{getFilterValues("status").length}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-48 p-0" align="end">
							<div className="bg-muted py-2 px-3 border-b">
								<div className="font-medium">Status</div>
							</div>
							<div className="p-3 space-y-2">
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-full justify-start font-normal text-xs"
									onClick={() => clearFilter("status")}
								>
									Clear filter
								</Button>
								<div className="border-t my-1" />
								{uniqueStatuses.map((status) => {
									const isChecked =
										getFilterValues("status").includes(
											status
										)
									return (
										<div
											key={status}
											className="flex w-full items-center space-x-2 px-2 py-1 hover:bg-accent/50 rounded-md"
										>
											<div className="flex items-center gap-2 w-full">
												<span className="flex items-center justify-center">
													<Checkbox
														checked={isChecked}
														onCheckedChange={() =>
															toggleFilterValue(
																"status",
																status
															)
														}
														className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
													/>
												</span>
												<button
													type="button"
													className="flex-1 text-left text-sm font-medium capitalize bg-transparent border-none p-0 cursor-pointer"
													onClick={() =>
														toggleFilterValue(
															"status",
															status
														)
													}
												>
													{status}
												</button>
											</div>
										</div>
									)
								})}
							</div>
						</PopoverContent>
					</Popover>

					{/* Source Filter */}
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={`h-8 gap-1 ${isFilterActive("source") ? "bg-accent/30" : ""}`}
							>
								<FilterIcon className="h-3.5 w-3.5" />
								<span>
									{isFilterActive("source")
										? `Source (${getFilterValues("source").length})`
										: "Source"}
								</span>
								{isFilterActive("source") && (
									<Badge
										variant="secondary"
										className="ml-1 px-1 font-normal"
									>
										{getFilterValues("source").length}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-56 p-0" align="end">
							<div className="bg-muted py-2 px-3 border-b">
								<div className="font-medium">Source</div>
							</div>
							<div className="p-3 space-y-2">
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-full justify-start font-normal text-xs"
									onClick={() => clearFilter("source")}
								>
									Clear filter
								</Button>
								<div className="border-t my-1" />
								{uniqueSources.map((source) => {
									const isChecked =
										getFilterValues("source").includes(
											source
										)
									return (
										<div
											key={source}
											className="flex w-full items-center space-x-2 px-2 py-1 hover:bg-accent/50 rounded-md"
										>
											<div className="flex items-center gap-2 w-full">
												<span className="flex items-center justify-center">
													<Checkbox
														checked={isChecked}
														onCheckedChange={() =>
															toggleFilterValue(
																"source",
																source
															)
														}
														className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
													/>
												</span>
												<button
													type="button"
													className="flex-1 text-left text-sm font-medium bg-transparent border-none p-0 cursor-pointer"
													onClick={() =>
														toggleFilterValue(
															"source",
															source
														)
													}
												>
													{source}
												</button>
											</div>
										</div>
									)
								})}
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
										className={`py-3 ${index === 0 ? "pl-6" : ""} ${index === headerGroup.headers.length - 1 ? "pr-6" : ""}`}
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
									className="hover:bg-accent/20 transition-colors cursor-pointer"
									onClick={() =>
										router.push(`/leads/${row.original.id}`)
									}
								>
									{row
										.getVisibleCells()
										.map((cell, index) => (
											<TableCell
												key={cell.id}
												className={`${index === 0 ? "pl-6" : ""} ${index === row.getVisibleCells().length - 1 ? "pr-6" : ""}`}
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

			<div className="flex items-center justify-end">
				<div className="flex w-full items-center gap-6 lg:w-fit">
					<div className="hidden items-center gap-2 lg:flex">
						<Select
							value={`${table.getState().pagination.pageSize}`}
							onValueChange={(value) => {
								table.setPageSize(Number(value))
							}}
						>
							<SelectTrigger className="w-[100px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent side="top">
								{[10, 25, 50, 100].map((pageSize) => (
									<SelectItem
										key={pageSize}
										value={`${pageSize}`}
									>
										{pageSize} rows
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex w-fit items-center justify-center text-sm font-medium">
						Page {table.getState().pagination.pageIndex + 1} of{" "}
						{table.getPageCount()}
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							className="hidden h-8 w-8 p-0 lg:flex"
							onClick={() => table.setPageIndex(0)}
							disabled={!table.getCanPreviousPage()}
						>
							<span className="sr-only">Go to first page</span>
							<ChevronsLeftIcon className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="h-8 w-8 p-0"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							<span className="sr-only">Go to previous page</span>
							<ChevronLeftIcon className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="h-8 w-8 p-0"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							<span className="sr-only">Go to next page</span>
							<ChevronRightIcon className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="hidden h-8 w-8 p-0 lg:flex"
							onClick={() =>
								table.setPageIndex(table.getPageCount() - 1)
							}
							disabled={!table.getCanNextPage()}
						>
							<span className="sr-only">Go to last page</span>
							<ChevronsRightIcon className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
