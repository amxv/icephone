"use client"

import { getLeads } from "@/actions/leads"
import { AddLeadDialog } from "@/components/add-lead-dialog"
import { LeadsTable } from "@/components/leads-table"
import type { LeadItem } from "@/components/leads-table"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ColumnFiltersState } from "@tanstack/react-table"
import { PlusIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import React from "react"

// Skeleton component for the leads table
function LeadsTableSkeleton() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="px-6 pb-4">
				<Skeleton className="h-6 w-1/4 mb-2" />
				<Skeleton className="h-4 w-2/5" />
			</CardHeader>
			<CardContent className="px-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
						<Skeleton className="h-10 w-64" />
						<div className="flex gap-2">
							<Skeleton className="h-10 w-20" />
							<Skeleton className="h-10 w-24" />
							<Skeleton className="h-10 w-24" />
						</div>
					</div>
					<div className="overflow-x-auto rounded-2xl border">
						<Skeleton className="h-[300px] w-full" />
					</div>
					<div className="flex items-center justify-end">
						<div className="flex items-center gap-2">
							<Skeleton className="h-8 w-24 rounded" />
							<Skeleton className="h-8 w-32 rounded" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded" />
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Main page component with title and description
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-500">
					Leads
				</h1>
				<p className="text-sm md:text-base text-muted-foreground mt-2">
					View and manage your leads and opportunities
				</p>
			</div>
			<AddLeadDialog />
		</div>
	)
}

// Wrapper component for the LeadsTable that syncs URL params
function LeadsTableWithURLParams({
	data
}: {
	data: LeadItem[]
}) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	// Get filters from URL
	const statusParam = searchParams.get("status")
	const sourceParam = searchParams.get("source")
	const scoreParam = searchParams.get("score")

	// Create initial column filters based on URL params
	const initialColumnFilters = React.useMemo(() => {
		const filters: ColumnFiltersState = []

		if (statusParam) {
			filters.push({
				id: "status",
				value: statusParam.split(",") // Split comma-separated values into array
			})
		}

		if (sourceParam) {
			filters.push({
				id: "source",
				value: sourceParam.split(",") // Split comma-separated values into array
			})
		}

		if (scoreParam) {
			const [min, max] = scoreParam.split("-").map(Number)
			if (!Number.isNaN(min) && !Number.isNaN(max)) {
				filters.push({
					id: "score",
					value: [min, max]
				})
			}
		}

		return filters
	}, [statusParam, sourceParam, scoreParam])

	// Function to update the URL with filter params
	const onFilterChange = useCallback(
		(filters: ColumnFiltersState) => {
			// Create a new URLSearchParams object from the current search params
			const params = new URLSearchParams(searchParams.toString())

			// Check for status filter
			const statusFilter = filters.find(
				(filter) => filter.id === "status"
			)
			if (
				statusFilter?.value &&
				Array.isArray(statusFilter.value) &&
				statusFilter.value.length > 0
			) {
				params.set("status", statusFilter.value.join(","))
			} else {
				params.delete("status")
			}

			// Check for source filter
			const sourceFilter = filters.find(
				(filter) => filter.id === "source"
			)
			if (
				sourceFilter?.value &&
				Array.isArray(sourceFilter.value) &&
				sourceFilter.value.length > 0
			) {
				params.set("source", sourceFilter.value.join(","))
			} else {
				params.delete("source")
			}

			// Check for score filter
			const scoreFilter = filters.find((filter) => filter.id === "score")
			if (
				scoreFilter?.value &&
				Array.isArray(scoreFilter.value) &&
				scoreFilter.value.length === 2
			) {
				params.set(
					"score",
					`${scoreFilter.value[0]}-${scoreFilter.value[1]}`
				)
			} else {
				params.delete("score")
			}

			// Update the URL without causing a navigation/full reload
			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router]
	)

	return (
		<LeadsTable
			data={data}
			initialColumnFilters={initialColumnFilters}
			onFilterChange={onFilterChange}
		/>
	)
}

// Main content component that fetches and displays leads data
function LeadsContent() {
	const [loading, setLoading] = useState(true)
	const [leadsData, setLeadsData] = useState<LeadItem[]>([])
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		async function fetchData() {
			setLoading(true)
			try {
				const result = await getLeads()

				if (result.success && result.data) {
					// Transform data for the leads table
					const transformedData = result.data.map((lead) => ({
						id: lead.id,
						name: lead.name,
						email: lead.email || null,
						phone: lead.phone || null,
						score: lead.score || 0, // Ensure score is not null
						status: lead.status || "new", // Ensure status is not null
						source: lead.source || null,
						notes: lead.notes || null,
						createdAt: lead.createdAt.toISOString(),
						updatedAt: lead.updatedAt.toISOString()
					}))
					setLeadsData(transformedData as LeadItem[])
				} else {
					setError(result.error || "Failed to fetch leads data")
				}
			} catch (err) {
				console.error("Error fetching leads:", err)
				setError("An unexpected error occurred")
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	if (loading) {
		return <LeadsTableSkeleton />
	}

	if (error) {
		return (
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="py-10">
					<div className="flex flex-col items-center justify-center text-center">
						<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
							<UserIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="mt-4 text-lg font-medium">
							Error Loading Leads
						</h3>
						<p className="mt-2 text-sm text-muted-foreground max-w-xs">
							{error}
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (leadsData.length === 0) {
		return (
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="py-12">
					<div className="flex flex-col items-center justify-center text-center">
						<div className="rounded-full p-3 border border-border/40 shadow-sm">
							<UserIcon className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="mt-4 text-lg font-medium">
							No Leads Yet
						</h3>
						<p className="mt-2 text-sm text-muted-foreground max-w-xs">
							You haven't added any leads yet. Get started by
							adding your first lead.
						</p>
						<div className="mt-4">
							<AddLeadDialog buttonText="Add Your First Lead" />
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="px-6 pb-4">
				<CardTitle className="text-xl font-medium">All Leads</CardTitle>
			</CardHeader>
			<CardContent className="px-6 pb-6">
				<LeadsTableWithURLParams data={leadsData} />
			</CardContent>
		</Card>
	)
}

// Main page component
export default function LeadsPage() {
	return (
		<div className="container py-8">
			<div className="flex flex-col gap-8">
				<PageHeader />
				<LeadsContent />
			</div>
		</div>
	)
}
