"use client"

import { Button } from "@/components/ui/button"
import type { Table } from "@tanstack/react-table"
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight
} from "lucide-react"

interface DataTablePaginationProps<TData> {
	table: Table<TData>
	showControls?: boolean
	showInfo?: boolean
}

export function DataTablePagination<TData>({
	table,
	showControls = false,
	showInfo = false
}: DataTablePaginationProps<TData>) {
	return (
		<div className="flex items-center justify-end space-x-2 py-4">
			{showControls && (
				<div className="hidden items-center space-x-2 lg:flex">
					<p className="text-sm text-muted-foreground">
						Rows per page
					</p>
					<select
						value={table.getState().pagination.pageSize}
						onChange={(e) => {
							table.setPageSize(Number(e.target.value))
						}}
						className="h-8 w-[70px] rounded-md border border-input bg-background px-2 text-sm"
					>
						{[10, 25, 50, 100].map((pageSize) => (
							<option key={pageSize} value={pageSize}>
								{pageSize}
							</option>
						))}
					</select>
				</div>
			)}

			{showInfo && (
				<div className="text-sm text-muted-foreground">
					Page {table.getState().pagination.pageIndex + 1} of{" "}
					{table.getPageCount()}
				</div>
			)}

			<div className="flex items-center space-x-2">
				<Button
					variant="outline"
					size="icon"
					className="hidden h-8 w-8 lg:flex"
					onClick={() => table.setPageIndex(0)}
					disabled={!table.getCanPreviousPage()}
				>
					<span className="sr-only">Go to first page</span>
					<ChevronsLeft className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					<span className="sr-only">Go to previous page</span>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					<span className="sr-only">Go to next page</span>
					<ChevronRight className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					className="hidden h-8 w-8 lg:flex"
					onClick={() => table.setPageIndex(table.getPageCount() - 1)}
					disabled={!table.getCanNextPage()}
				>
					<span className="sr-only">Go to last page</span>
					<ChevronsRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
