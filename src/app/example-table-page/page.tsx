"use client"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { useSettings } from "@/contexts/settings-context"
import type { ColumnDef } from "@tanstack/react-table"
import { Settings } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

// Define your data type
type Payment = {
	id: string
	amount: number
	status: "pending" | "processing" | "success" | "failed"
	email: string
}

// Sample data
const payments: Payment[] = [
	{
		id: "728ed52f",
		amount: 100,
		status: "pending",
		email: "m@example.com"
	},
	{
		id: "489e1d42",
		amount: 125,
		status: "processing",
		email: "example@gmail.com"
	},
	{
		id: "901e3f34",
		amount: 235,
		status: "success",
		email: "user@example.com"
	},
	{
		id: "572b9eac",
		amount: 150,
		status: "failed",
		email: "test@example.com"
	},
	{
		id: "845e7d2b",
		amount: 300,
		status: "success",
		email: "sales@example.com"
	}
]

// Define your columns
const columns: ColumnDef<Payment>[] = [
	{
		accessorKey: "status",
		header: "Status"
	},
	{
		accessorKey: "email",
		header: "Email"
	},
	{
		accessorKey: "amount",
		header: "Amount",
		cell: ({ row }) => {
			const amount = Number.parseFloat(row.getValue("amount"))
			const formatted = new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD"
			}).format(amount)
			return <div className="text-right font-medium">{formatted}</div>
		}
	}
]

export default function ExampleTablePage() {
	const { tableRowsPerPage } = useSettings()

	return (
		<div className="container mx-auto py-10">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-bold">
					Example Table with Pagination Buttons Only
				</h1>
				<Link href="/settings">
					<Button variant="outline" size="sm" className="gap-2">
						<Settings className="h-4 w-4" />
						<span>Table Settings</span>
					</Button>
				</Link>
			</div>

			<div className="mb-6 text-sm text-muted-foreground">
				Currently showing <strong>{tableRowsPerPage}</strong> rows per
				page. Change this in{" "}
				<Link href="/settings" className="underline">
					Settings
				</Link>
				.
			</div>

			<DataTable
				columns={columns}
				data={payments}
				showPagination={true}
				showPaginationControls={false}
				showPaginationInfo={false}
			/>
		</div>
	)
}
