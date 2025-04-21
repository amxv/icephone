"use client"

import type {
	ColumnDef,
	ColumnFiltersState,
	PaginationState,
	SortingState,
	VisibilityState
} from "@tanstack/react-table"
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable
} from "@tanstack/react-table"
import React from "react"

import { DataTablePagination } from "@/components/ui/data-table-pagination"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { useSettings } from "@/contexts/settings-context"

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	pagination?: {
		pageIndex: number
		pageSize: number
	}
	setPagination?: React.Dispatch<React.SetStateAction<PaginationState>>
	sorting?: SortingState
	setSorting?: React.Dispatch<React.SetStateAction<SortingState>>
	columnFilters?: ColumnFiltersState
	setColumnFilters?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
	columnVisibility?: VisibilityState
	setColumnVisibility?: React.Dispatch<React.SetStateAction<VisibilityState>>
	showPagination?: boolean
	showPaginationControls?: boolean
	showPaginationInfo?: boolean
}

export function DataTable<TData, TValue>({
	columns,
	data,
	pagination,
	setPagination,
	sorting = [],
	setSorting,
	columnFilters = [],
	setColumnFilters,
	columnVisibility = {},
	setColumnVisibility,
	showPagination = true,
	showPaginationControls = false,
	showPaginationInfo = false
}: DataTableProps<TData, TValue>) {
	// Get rows per page from settings
	const { tableRowsPerPage } = useSettings()

	// Create internal state if not provided
	const [internalPagination, setInternalPagination] =
		React.useState<PaginationState>({
			pageIndex: 0,
			pageSize: pagination?.pageSize || tableRowsPerPage
		})
	const [internalSorting, setInternalSorting] =
		React.useState<SortingState>(sorting)
	const [internalColumnFilters, setInternalColumnFilters] =
		React.useState<ColumnFiltersState>(columnFilters)
	const [internalColumnVisibility, setInternalColumnVisibility] =
		React.useState<VisibilityState>(columnVisibility)

	// Use the state values if provided, otherwise use the internal state
	const paginationValue = setPagination ? pagination : internalPagination
	const setPaginationValue = setPagination || setInternalPagination
	const sortingValue = setSorting ? sorting : internalSorting
	const setSortingValue = setSorting || setInternalSorting
	const columnFiltersValue = setColumnFilters
		? columnFilters
		: internalColumnFilters
	const setColumnFiltersValue = setColumnFilters || setInternalColumnFilters
	const columnVisibilityValue = setColumnVisibility
		? columnVisibility
		: internalColumnVisibility
	const setColumnVisibilityValue =
		setColumnVisibility || setInternalColumnVisibility

	const table = useReactTable({
		data,
		columns,
		state: {
			pagination: paginationValue,
			sorting: sortingValue,
			columnFilters: columnFiltersValue,
			columnVisibility: columnVisibilityValue
		},
		onPaginationChange: setPaginationValue,
		onSortingChange: setSortingValue,
		onColumnFiltersChange: setColumnFiltersValue,
		onColumnVisibilityChange: setColumnVisibilityValue,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
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
									data-state={
										row.getIsSelected() && "selected"
									}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
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
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{showPagination && (
				<DataTablePagination
					table={table}
					showControls={showPaginationControls}
					showInfo={showPaginationInfo}
				/>
			)}
		</div>
	)
}
