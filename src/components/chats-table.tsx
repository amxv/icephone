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
	MessageSquareIcon, // Changed from PhoneIcon
	MoreVerticalIcon,
	SearchIcon
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { z } from "zod"

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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { useSettings } from "@/contexts/settings-context"

// Define a schema for our chat data
export const chatSchema = z.object({
	id: z.number(),
	leadId: z.number().nullable(), // Assuming leadId can be nullable if a chat isn't linked to a lead
	leadName: z.string().nullable(),
	summary: z.string().nullable(),
	timestamp: z.string(), // Keep as string, will be parsed from ISO string to Date
	createdAt: z.string().optional(), // Optional, may not always be present in mock/transformed data
	updatedAt: z.string().optional() // Optional
})

// Infer the type from our schema
export type ChatItem = z.infer<typeof chatSchema>

// Helper function to format column name (retained from calls-table)
const formatColumnName = (columnId: string): string => {
	return columnId
		.replace(/([a-z])([A-Z])/g, "$1 $2") // Convert camelCase to space separated
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

export function ChatsTable({
	data: initialData,
	initialColumnFilters = [], // Keep for potential future filters, though not used now
	onFilterChange, // Keep for potential future filters
	onRowClick,
	selectedChatId,
	searchQuery,
	onSearchChange
}: {
	data: ChatItem[]
	initialColumnFilters?: ColumnFiltersState
	onFilterChange?: (filters: ColumnFiltersState) => void
	onRowClick: (chat: ChatItem) => void
	selectedChatId?: number
	searchQuery: string
	onSearchChange: (query: string) => void
}) {
	const [data, setData] = React.useState(() => initialData)
	const { tableRowsPerPage } = useSettings()

	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({})
	const [columnFilters, setColumnFilters] =
		React.useState<ColumnFiltersState>(initialColumnFilters)
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "timestamp", desc: true } // Default sort by timestamp
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
			setColumnFilters(initialColumnFilters)
		}
	}, [initialColumnFilters])

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
			try {
				lastNotifiedColumnFiltersRef.current =
					JSON.parse(currentFiltersString)
			} catch (e) {
				lastNotifiedColumnFiltersRef.current = columnFilters.map(
					(f) => ({
						...f,
						value: Array.isArray(f.value) ? [...f.value] : f.value
					})
				)
			}
		}
	}, [columnFilters, onFilterChange])

	const filteredData = React.useMemo(() => {
		if (!searchQuery.trim()) return data

		const lowerQuery = searchQuery.toLowerCase()
		return data.filter(
			(item) =>
				(item.leadName?.toLowerCase() || "").includes(lowerQuery) ||
				(item.summary?.toLowerCase() || "").includes(lowerQuery)
		)
	}, [data, searchQuery])

	const columns = React.useMemo<ColumnDef<ChatItem>[]>(
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
							e.stopPropagation() // Prevent row click if lead name is clicked
							if (row.original.leadId) {
								// Only navigate if leadId exists
								router.push(`/leads/${row.original.leadId}`)
							}
						}}
					>
						{row.original.leadName || "Unknown Lead"}
					</button>
				),
				size: 150 // Explicit size for lead name
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
					<div className="max-w-none truncate">
						{row.original.summary || (
							<span className="text-muted-foreground italic">
								No summary available
							</span>
						)}
					</div>
				),
				minSize: 300, // Give summary more space
				size: 500, // Generous size for summary
				maxSize: 700
			},
			{
				accessorKey: "timestamp",
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
							Time
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
							new Date(row.original.timestamp),
							"MMM d, yyyy h:mm a"
						)}
					</div>
				),
				size: 200 // Explicit size for timestamp
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
								onClick={(e) => e.stopPropagation()} // Prevent row click when opening menu
							>
								<MoreVerticalIcon className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-[160px]"
							onClick={(e) => e.stopPropagation()} // Prevent row click inside menu
						>
							<DropdownMenuItem
								onClick={() => onRowClick(row.original)}
							>
								View Details
							</DropdownMenuItem>
							{/* Add other chat-specific actions here if needed */}
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
		getFacetedUniqueValues: getFacetedUniqueValues(),
		defaultColumn: {
			minSize: 20, // Smallest column size
			size: 150, // Default column size
			maxSize: 700 // Largest column size
		}
	})

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
				<div className="relative">
					<SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Search chats..."
						className="pl-8 w-64"
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
					/>
				</div>

				<div className="flex gap-2">
					{/* Removed Type and Status Popovers as they are not relevant for chats */}
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
										style={{
											width:
												header.getSize() ===
												Number.MAX_SAFE_INTEGER
													? "auto"
													: header.getSize()
										}}
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
									className={`hover:bg-accent/20 transition-colors cursor-pointer ${selectedChatId === row.original.id ? "bg-accent/40" : ""}`}
									onClick={() => onRowClick(row.original)}
								>
									{row
										.getVisibleCells()
										.map((cell, index) => (
											<TableCell
												key={cell.id}
												className={`${index === 0 ? "pl-6" : ""} ${index === row.getVisibleCells().length - 1 ? "pr-6 w-[60px]" : ""}`}
												style={{
													width:
														cell.column.getSize() ===
														Number.MAX_SAFE_INTEGER
															? "auto"
															: cell.column.getSize()
												}}
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
