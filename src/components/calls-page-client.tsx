"use client"

import { getCalls } from "@/actions/calls"
import { CallsTable } from "@/components/calls-table"
import type { CallItem } from "@/components/calls-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { ColumnFiltersState } from "@tanstack/react-table"
import { format } from "date-fns"
import {
	ClockIcon,
	FileTextIcon,
	MessageSquareIcon,
	PhoneCallIcon,
	PhoneIcon,
	PhoneIncomingIcon,
	PhoneOutgoingIcon,
	XIcon
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// Skeleton component for the calls table
function CallsTableSkeleton() {
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
					Calls
				</h1>
			</div>
		</div>
	)
}

// Format duration in seconds to MM:SS format
function formatDuration(seconds: number | null): string {
	if (seconds === null) return "N/A"

	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

// Type Badge Component
function TypeBadge({ type }: { type: "incoming" | "outgoing" }) {
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
function StatusBadge({ status }: { status: string | null }) {
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

// Call details component
function CallDetails({ call }: { call: CallItem }) {
	const [showTranscript, setShowTranscript] = useState(false)

	return (
		<div className="flex-1 overflow-hidden flex flex-col">
			<div className="p-4 overflow-y-auto h-full">
				{/* Header with call info */}
				<div className="mb-4">
					<div className="flex items-center gap-2 mb-3">
						<div className="rounded-full bg-card p-2 border border-border/40 shadow-sm">
							{call.type === "incoming" ? (
								<PhoneIncomingIcon className="h-5 w-5 text-green-600" />
							) : (
								<PhoneOutgoingIcon className="h-5 w-5 text-blue-600" />
							)}
						</div>
						<div>
							<h2 className="text-xl font-semibold">
								{call.leadName || "Unknown Lead"}
							</h2>
							<div className="text-sm text-muted-foreground">
								{format(
									new Date(call.startTime),
									"MMMM d, yyyy 'at' h:mm a"
								)}
							</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 mb-2">
						<TypeBadge type={call.type} />
						<StatusBadge status={call.status} />
						<Badge
							variant="outline"
							className="bg-purple-50 text-purple-800 hover:bg-purple-50 border-purple-200"
						>
							<ClockIcon className="h-3.5 w-3.5 mr-1" />
							{formatDuration(call.duration)}
						</Badge>
					</div>
				</div>

				{/* Main content card with integrated sections */}
				<div className="bg-card/40 backdrop-blur-sm rounded-3xl border border-border/40 shadow-sm overflow-hidden">
					{/* Recording player */}
					{call.recordingUrl && (
						<div className="p-4 border-b border-border/30">
							<div className="flex items-center gap-3 mb-3">
								<div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
									<PhoneCallIcon className="h-5 w-5 text-blue-800" />
								</div>
								<h3 className="font-medium">Recording</h3>
							</div>
							<audio
								src={call.recordingUrl}
								controls
								className="w-full rounded-xl shadow-sm"
							>
								<track kind="captions" src="" label="English" />
								Your browser does not support the audio element.
							</audio>
						</div>
					)}

					{/* Call Summary */}
					<div className="p-4 border-b border-border/30">
						<div className="flex items-center gap-3 mb-3">
							<div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
								<FileTextIcon className="h-5 w-5 text-amber-800" />
							</div>
							<h3 className="font-medium">Summary</h3>
						</div>
						<div className="bg-background/60 p-3 rounded-xl shadow-sm">
							{call.summary || (
								<span className="text-muted-foreground italic">
									No summary available
								</span>
							)}
						</div>
					</div>

					{/* Call Transcript with Collapsible Content */}
					{call.transcript && (
						<div className="p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-3">
									<div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
										<MessageSquareIcon className="h-5 w-5 text-green-800" />
									</div>
									<h3 className="font-medium">Transcript</h3>
								</div>
								<Button
									variant="outline"
									size="sm"
									className="rounded-xl"
									onClick={() =>
										setShowTranscript(!showTranscript)
									}
								>
									{showTranscript
										? "Hide Transcript"
										: "Show Transcript"}
								</Button>
							</div>

							{showTranscript && (
								<div className="bg-background/60 p-3 rounded-xl shadow-sm max-h-64 overflow-y-auto">
									<pre className="whitespace-pre-wrap text-sm font-normal">
										{call.transcript}
									</pre>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// Main Calls Page Client Component
export function CallsPageClient() {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const [loading, setLoading] = useState(true)
	const [callsData, setCallsData] = useState<CallItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [selectedCall, setSelectedCall] = useState<CallItem | null>(null)
	const [isMobile, setIsMobile] = useState(false)
	const [searchQuery, setSearchQuery] = useState<string>(
		searchParams.get("search") || ""
	)

	// Handle window resize
	useEffect(() => {
		const checkMobile = () => {
			const width = window.innerWidth
			setIsMobile(width < 768)

			// Dynamically adjust rows per page based on screen height
			const height = window.innerHeight
			let newRowsPerPage = 12 // Default value
			if (height < 700) {
				newRowsPerPage = 5
			} else if (height < 900) {
				newRowsPerPage = 8
			} // Else it remains 12 (the default)

			// Update localStorage. The table should react to tableRowsPerPage from useSettings context.
			const currentStoredRows = Number.parseInt(
				localStorage.getItem("tableRowsPerPage") || "12",
				10
			)
			if (currentStoredRows !== newRowsPerPage) {
				localStorage.setItem(
					"tableRowsPerPage",
					newRowsPerPage.toString()
				)
				// The useSettings context should pick up this localStorage change and update,
				// which will then flow to CallsTable.
			}
		}

		// Initial check
		checkMobile()

		// Add event listener
		window.addEventListener("resize", checkMobile)

		// Cleanup
		return () => window.removeEventListener("resize", checkMobile)
	}, []) // Empty dependency array: runs on mount and cleans up on unmount

	// Get the call ID from URL
	const callIdParam = searchParams.get("callId")

	// Get other filter params
	const typeParam = searchParams.get("type")
	const statusParam = searchParams.get("status")
	const searchQueryParam = searchParams.get("search")

	// Load call from URL param
	useEffect(() => {
		if (callIdParam && callsData.length > 0) {
			const callId = Number.parseInt(callIdParam, 10)
			const call = callsData.find((c) => c.id === callId)

			if (call) {
				setSelectedCall(call)
			}
		}
	}, [callIdParam, callsData])

	// Update search query state from URL
	useEffect(() => {
		if (searchQueryParam !== null) {
			setSearchQuery(searchQueryParam)
		}
	}, [searchQueryParam])

	// Create column filters
	const initialColumnFilters = useState<ColumnFiltersState>(() => {
		const filters: ColumnFiltersState = []

		if (typeParam) {
			filters.push({
				id: "type",
				value: typeParam.split(",")
			})
		}

		if (statusParam) {
			filters.push({
				id: "status",
				value: statusParam.split(",")
			})
		}

		return filters
	})[0]

	// Handle filter changes
	const handleFilterChange = useCallback(
		(filters: ColumnFiltersState) => {
			const params = new URLSearchParams(searchParams.toString())

			// Handle type filter
			const typeFilter = filters.find((f) => f.id === "type")
			if (
				typeFilter?.value &&
				Array.isArray(typeFilter.value) &&
				typeFilter.value.length > 0
			) {
				params.set("type", typeFilter.value.join(","))
			} else {
				params.delete("type")
			}

			// Handle status filter
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

			// Keep selected call ID
			if (selectedCall) {
				params.set("callId", selectedCall.id.toString())
			}

			// Keep search query
			if (searchQuery) {
				params.set("search", searchQuery)
			} else {
				params.delete("search")
			}

			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, selectedCall, searchQuery]
	)

	// Handle search query change
	const handleSearchChange = useCallback(
		(query: string) => {
			setSearchQuery(query)

			const params = new URLSearchParams(searchParams.toString())

			if (query) {
				params.set("search", query)
			} else {
				params.delete("search")
			}

			// Keep other params
			if (selectedCall) {
				params.set("callId", selectedCall.id.toString())
			}

			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, selectedCall]
	)

	// Handle row click
	const handleRowClick = useCallback(
		(call: CallItem) => {
			setSelectedCall(call)

			// Update URL
			const params = new URLSearchParams(searchParams.toString())
			params.set("callId", call.id.toString())

			// Keep search query
			if (searchQuery) {
				params.set("search", searchQuery)
			}

			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, searchQuery]
	)

	// Handle closing the details panel
	const handleClosePanel = useCallback(() => {
		setSelectedCall(null)

		// Update URL
		const params = new URLSearchParams(searchParams.toString())
		params.delete("callId")

		// Keep search query
		if (searchQuery) {
			params.set("search", searchQuery)
		}

		router.replace(`${pathname}?${params.toString()}`, { scroll: false })
	}, [searchParams, pathname, router, searchQuery])

	// Fetch calls data
	useEffect(() => {
		async function fetchData() {
			setLoading(true)
			try {
				const result = await getCalls()

				if (result.success && result.data) {
					// Transform data for the calls table
					const transformedData = result.data.map((call) => ({
						id: call.id,
						leadId: call.leadId,
						leadName: call.leadName || null,
						type: call.type,
						duration: call.duration,
						startTime:
							typeof call.startTime === "string"
								? call.startTime
								: call.startTime.toISOString(),
						summary: call.summary || null,
						transcript: call.transcript || null,
						recordingUrl: call.recordingUrl || null,
						status: call.status || null,
						createdAt:
							typeof call.createdAt === "string"
								? call.createdAt
								: call.createdAt.toISOString(),
						updatedAt:
							typeof call.updatedAt === "string"
								? call.updatedAt
								: call.updatedAt.toISOString()
					}))
					setCallsData(transformedData as CallItem[])
				} else {
					setError(result.error || "Failed to fetch calls data")
				}
			} catch (err) {
				console.error("Error fetching calls:", err)
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
					<CallsTableSkeleton />
				) : error ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-10">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
									<PhoneIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									Error Loading Calls
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									{error}
								</p>
							</div>
						</CardContent>
					</Card>
				) : callsData.length === 0 ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-12">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full p-3 border border-border/40 shadow-sm">
									<PhoneCallIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									No Calls Yet
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									No calls have been made by your voice agent
									yet. As calls are made, they will appear
									here.
								</p>
							</div>
						</CardContent>
					</Card>
				) : (
					<>
						{/* Mobile Dialog for Call Details */}
						<Dialog
							open={!!selectedCall && isMobile}
							onOpenChange={(open) => {
								if (!open) handleClosePanel()
							}}
						>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>Call Details</DialogTitle>
								</DialogHeader>
								{selectedCall && (
									<div className="max-h-[60vh] overflow-y-auto">
										<CallDetails call={selectedCall} />
									</div>
								)}
							</DialogContent>
						</Dialog>

						{/* Desktop Layout */}
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-1 flex flex-col overflow-hidden">
							<CardContent className="px-6 pb-3 h-full flex flex-col overflow-hidden">
								<div className="flex h-full overflow-hidden">
									<div
										className={
											selectedCall && !isMobile
												? "w-2/3 pr-4 flex flex-col overflow-hidden"
												: "w-full flex flex-col overflow-hidden"
										}
									>
										<div className="custom-calls-table flex-1 flex flex-col overflow-y-auto">
											<CallsTable
												data={callsData}
												initialColumnFilters={
													initialColumnFilters
												}
												onFilterChange={
													handleFilterChange
												}
												onRowClick={handleRowClick}
												selectedCallId={
													selectedCall?.id
												}
												searchQuery={searchQuery}
												onSearchChange={
													handleSearchChange
												}
											/>
										</div>
									</div>

									{selectedCall && !isMobile && (
										<div className="w-1/3 border-l border-border pl-4 h-full flex flex-col overflow-hidden">
											<div className="flex items-center justify-between mb-2 py-1 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
												<h3 className="font-medium text-lg">
													Call Details
												</h3>
												<Button
													size="sm"
													variant="outline"
													onClick={handleClosePanel}
													className="h-8 w-8 p-0 rounded-full"
													aria-label="Close panel"
												>
													<XIcon className="h-4 w-4" />
												</Button>
											</div>
											<CallDetails call={selectedCall} />
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</div>
	)
}
