"use client"

import { getCampaigns } from "@/actions/campaigns" // Changed from getCalls
import { CampaignsTable } from "@/components/campaigns-table" // Changed from CallsTable
import type { CampaignItem } from "@/components/campaigns-table" // Changed from CallItem
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ColumnFiltersState } from "@tanstack/react-table"
import { ListChecksIcon, PlusIcon, SpeakerIcon, ZapIcon } from "lucide-react" // Using different icons
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// Skeleton component for the campaigns table
function CampaignsTableSkeleton() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
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
					<div className="flex flex-row items-center justify-end space-x-2 py-4">
						<div className="hidden items-center space-x-2 lg:flex">
							<Skeleton className="h-4 w-24 rounded" />
							<Skeleton className="h-8 w-[70px] rounded" />
						</div>
						<Skeleton className="h-4 w-32 rounded" />
						<div className="flex items-center space-x-2">
							<Skeleton className="h-8 w-8 rounded hidden lg:block" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded hidden lg:block" />
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
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Campaigns
				</h1>
			</div>
			<Button className="rounded-xl" variant="outline">
				<PlusIcon className="mr-2 h-4 w-4" /> Create Campaign
			</Button>
		</div>
	)
}

// Main Campaigns Page Client Component
export function CampaignsPageClient() {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const [loading, setLoading] = useState(true)
	const [campaignsData, setCampaignsData] = useState<CampaignItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState<string>(
		searchParams.get("search") || ""
	)

	// Handle window resize
	useEffect(() => {
		const checkMobile = () => {
			const height = window.innerHeight
			let newRowsPerPage = 12 // Default value
			if (height < 700) {
				newRowsPerPage = 5
			} else if (height < 900) {
				newRowsPerPage = 8
			}

			const currentStoredRows = Number.parseInt(
				localStorage.getItem("tableRowsPerPage") || "12",
				10
			)
			if (currentStoredRows !== newRowsPerPage) {
				localStorage.setItem(
					"tableRowsPerPage",
					newRowsPerPage.toString()
				)
			}
		}

		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	const statusParam = searchParams.get("status")
	const searchQueryParam = searchParams.get("search")

	useEffect(() => {
		if (searchQueryParam !== null) {
			setSearchQuery(searchQueryParam)
		}
	}, [searchQueryParam])

	const initialColumnFilters = useState<ColumnFiltersState>(() => {
		const filters: ColumnFiltersState = []
		if (statusParam) {
			filters.push({
				id: "status",
				value: statusParam.split(",")
			})
		}
		return filters
	})[0]

	const handleFilterChange = useCallback(
		(filters: ColumnFiltersState) => {
			const params = new URLSearchParams(searchParams.toString())

			const statusFilter = filters.find((f) => f.id === "status")
			if (
				statusFilter?.value &&
				Array.isArray(statusFilter.value) &&
				statusFilter.value.length > 0
			) {
				params.set("status", statusFilter.value.join(","))
			} else {
				params.delete("status")
			}

			if (searchQuery) {
				params.set("search", searchQuery)
			} else {
				params.delete("search")
			}

			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, searchQuery]
	)

	const handleSearchChange = useCallback(
		(query: string) => {
			setSearchQuery(query)
			const params = new URLSearchParams(searchParams.toString())
			if (query) {
				params.set("search", query)
			} else {
				params.delete("search")
			}
			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router]
	)

	// Fetch campaigns data
	useEffect(() => {
		async function fetchData() {
			setLoading(true)
			try {
				const result = await getCampaigns()

				if (result.success && result.data) {
					const transformedData = result.data.map((campaign) => ({
						id: campaign.id,
						name: campaign.name,
						status: campaign.status || null,
						leadsCount: campaign.leadsCount,
						leadsConverted: campaign.leadsConverted,
						updatedAt: campaign.updatedAt.toISOString() // Convert Date to string
					}))
					setCampaignsData(transformedData as CampaignItem[])
				} else {
					setError(result.error || "Failed to fetch campaigns data")
				}
			} catch (err) {
				console.error("Error fetching campaigns:", err)
				setError("An unexpected error occurred")
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	return (
		<div className="container flex flex-col h-full overflow-hidden">
			<div className="flex flex-col gap-4 h-full overflow-hidden">
				<PageHeader />

				{loading ? (
					<CampaignsTableSkeleton />
				) : error ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-10">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
									<SpeakerIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									Error Loading Campaigns
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									{error}
								</p>
							</div>
						</CardContent>
					</Card>
				) : campaignsData.length === 0 ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-12">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full p-3 border border-border/40 shadow-sm">
									<ListChecksIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									No Campaigns Yet
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									Create your first campaign to start reaching
									out to leads.
								</p>
								<Button className="mt-6 rounded-xl">
									<ZapIcon className="mr-2 h-4 w-4" /> Create
									First Campaign
								</Button>
							</div>
						</CardContent>
					</Card>
				) : (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-1 flex flex-col overflow-hidden">
						<CardContent className="px-6 pb-3 h-full flex flex-col overflow-hidden">
							<div className="custom-campaigns-table overflow-y-auto">
								<CampaignsTable
									data={campaignsData}
									initialColumnFilters={initialColumnFilters}
									onFilterChange={handleFilterChange}
									onRowClick={(row: CampaignItem) => {
										router.push(`/campaigns/${row.id}`)
									}}
									searchQuery={searchQuery}
									onSearchChange={handleSearchChange}
								/>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	)
}
