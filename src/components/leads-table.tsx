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

	// Capitalize the first letter of the status
	const displayStatus = status.charAt(0).toUpperCase() + status.slice(1)

	return <Badge variant={variant}>{displayStatus}</Badge>
}

// ScoreRangeSlider component
function ScoreRangeSlider({
	value,
	onChange
}: {
	value: [number, number]
	onChange: (value: [number, number]) => void
}) {
	// Use local state to track slider values
	const [sliderValue, setSliderValue] =
		React.useState<[number, number]>(value)
	// Track whether the value is being changed to avoid unnecessary updates
	const [isChanging, setIsChanging] = React.useState(false)

	// Update local state when external value changes
	React.useEffect(() => {
		// Only update local state if not currently changing
		if (!isChanging) {
			setSliderValue(value)
		}
	}, [value, isChanging])

	// Debounce value changes before sending to parent
	React.useEffect(() => {
		// Skip the initial render
		if (sliderValue === value) return

		const timer = setTimeout(() => {
			onChange(sliderValue)
			setIsChanging(false)
		}, 400) // 400ms debounce delay

		return () => clearTimeout(timer)
	}, [sliderValue, onChange, value])

	// Handle value change without immediately updating parent
	const handleValueChange = (newValue: number[]) => {
		setIsChanging(true)
		const typedValue: [number, number] = [newValue[0], newValue[1]]
		setSliderValue(typedValue)
	}

	return (
		<div className="space-y-2">
			<div className="flex justify-between mb-1">
				<div className="font-medium text-sm">{sliderValue[0]}</div>
				<div className="font-medium text-sm">{sliderValue[1]}</div>
			</div>
			<Slider
				min={0}
				max={100}
				step={1}
				value={sliderValue}
				onValueChange={handleValueChange}
				className="w-full"
			/>
		</div>
	)
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
		{ id: "score", desc: true }
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
							Name
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
							router.push(`/leads/${row.original.id}`)
						}}
					>
						{row.original.name}
					</button>
				)
			},
			{
				accessorKey: "score",
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
							Score
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
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
				accessorKey: "email",
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
							Email
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
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
							Phone
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
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
							Source
							{column.getIsSorted() === "asc" ? (
								<ArrowUpIcon className="ml-1.5 h-4 w-4" />
							) : column.getIsSorted() === "desc" ? (
								<ArrowDownIcon className="ml-1.5 h-4 w-4" />
							) : null}
						</Button>
					)
				},
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
							Last Updated
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
				),
				enableSorting: false,
				enableHiding: false,
				size: 50,
				maxSize: 50
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
				((Array.isArray(filter.value) && filter.value.length > 0) ||
					(columnId === "score" &&
						Array.isArray(filter.value) &&
						filter.value.length === 2))
		)
	}

	// Get the active filter value as array
	const getFilterValues = (columnId: string): string[] => {
		const filter = columnFilters.find((filter) => filter.id === columnId)
		return filter && Array.isArray(filter.value) ? filter.value : []
	}

	// Get score filter value
	const getScoreFilterValue = (): [number, number] => {
		const filter = columnFilters.find((filter) => filter.id === "score")
		return filter &&
			Array.isArray(filter.value) &&
			filter.value.length === 2
			? [filter.value[0] as number, filter.value[1] as number]
			: [0, 100]
	}

	// Get score filter range as string
	const getScoreFilterRange = (): string => {
		const [min, max] = getScoreFilterValue()
		return `${min}-${max}`
	}

	// Set score filter
	const setScoreFilter = (value: [number, number]) => {
		table.getColumn("score")?.setFilterValue(value)
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
											className="flex w-full items-center space-x-2 px-2 py-1 hover:bg-accent/50 rounded-2xl"
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
											className="flex w-full items-center space-x-2 px-2 py-1 hover:bg-accent/50 rounded-2xl"
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

					{/* Score Filter */}
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className={`h-8 gap-1 ${isFilterActive("score") ? "bg-accent/30" : ""}`}
							>
								<FilterIcon className="h-3.5 w-3.5" />
								<span>
									{isFilterActive("score")
										? `Score (${getScoreFilterRange()})`
										: "Score"}
								</span>
								{isFilterActive("score") && (
									<Badge
										variant="secondary"
										className="ml-1 px-1 font-normal"
									>
										{getScoreFilterRange()}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-64 p-0" align="end">
							<div className="bg-muted py-2 px-3 border-b">
								<div className="font-medium">Score Range</div>
							</div>
							<div className="p-4 space-y-4">
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-full justify-start font-normal text-xs"
									onClick={() => clearFilter("score")}
								>
									Clear filter
								</Button>

								<div className="space-y-4">
									<ScoreRangeSlider
										value={getScoreFilterValue()}
										onChange={(value) =>
											setScoreFilter(value)
										}
									/>
									<div className="flex justify-between text-xs text-muted-foreground mt-1">
										<span>0</span>
										<span>100</span>
									</div>
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
