"use client"

import { getCallQueue, cancelQueuedCall } from "@/actions/lead-communication"
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import {
	ClockIcon,
	PhoneCallIcon,
	PhoneIcon,
	AlertCircleIcon,
	XIcon,
	PlayIcon,
	PauseIcon,
	RefreshCcwIcon,
	Trash2Icon
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

// Types for call queue data
interface CallQueueEntry {
	id: number
	status:
		| "pending"
		| "queued"
		| "calling"
		| "completed"
		| "failed"
		| "cancelled"
		| null
	priority: number | null
	scheduledTime: Date | null
	instructions: string | null
	phoneNumber: string | null
	startedAt: Date | null
	completedAt: Date | null
	retryCount: number | null
	maxRetries: number | null
	lastError: string | null
	callResult: Record<string, unknown> | null
	createdAt: Date
	updatedAt: Date
	lead: {
		id: number
		name: string
		phone: string | null
		status: string | null
	} | null
	voiceAgent: {
		id: number
		name: string
	} | null
}

// Skeleton component for the call queue table
function CallQueueTableSkeleton() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardContent className="px-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
						<Skeleton className="h-10 w-64" />
						<div className="flex gap-2">
							<Skeleton className="h-10 w-20" />
							<Skeleton className="h-10 w-24" />
						</div>
					</div>
					<div className="overflow-x-auto rounded-2xl border">
						<Skeleton className="h-[300px] w-full" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Page header component
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Call Queue
				</h1>
			</div>
		</div>
	)
}

// Status badge component
function StatusBadge({ status }: { status: string | null }) {
	const statusColors: Record<string, string> = {
		pending: "bg-blue-100 text-blue-800 hover:bg-blue-100",
		queued: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
		calling: "bg-purple-100 text-purple-800 hover:bg-purple-100",
		completed: "bg-green-100 text-green-800 hover:bg-green-100",
		failed: "bg-red-100 text-red-800 hover:bg-red-100",
		cancelled: "bg-gray-100 text-gray-800 hover:bg-gray-100"
	}

	const displayStatus = status || "unknown"

	return (
		<Badge
			className={`px-3 py-1 ${statusColors[displayStatus] || "bg-gray-100 text-gray-800"}`}
		>
			{displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
		</Badge>
	)
}

// Priority badge component
function PriorityBadge({ priority }: { priority: number | null }) {
	const priorityColors: Record<number, string> = {
		0: "bg-gray-100 text-gray-800",
		1: "bg-yellow-100 text-yellow-800",
		2: "bg-orange-100 text-orange-800",
		3: "bg-red-100 text-red-800"
	}

	const priorityLabels: Record<number, string> = {
		0: "Normal",
		1: "Low",
		2: "High",
		3: "Urgent"
	}

	const displayPriority = priority ?? 0

	return (
		<Badge
			className={`px-2 py-1 text-xs ${priorityColors[displayPriority] || "bg-gray-100 text-gray-800"}`}
		>
			{priorityLabels[displayPriority] || `Priority ${displayPriority}`}
		</Badge>
	)
}

// Queue entry details component
function QueueEntryDetails({ entry }: { entry: CallQueueEntry }) {
	return (
		<div className="flex-1 overflow-hidden flex flex-col">
			<div className="p-4 overflow-y-auto h-full">
				{/* Header with entry info */}
				<div className="mb-4">
					<div className="flex items-center gap-2 mb-3">
						<div className="rounded-full bg-card p-2 border border-border/40 shadow-sm">
							<PhoneCallIcon className="h-5 w-5 text-blue-600" />
						</div>
						<div>
							<h2 className="text-xl font-semibold">
								{entry.lead?.name || "Unknown Lead"}
							</h2>
							<div className="text-sm text-muted-foreground">
								{entry.createdAt &&
									format(
										new Date(entry.createdAt),
										"MMMM d, yyyy 'at' h:mm a"
									)}
							</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 mb-2">
						<StatusBadge status={entry.status} />
						<PriorityBadge priority={entry.priority} />
						{(entry.retryCount || 0) > 0 && (
							<Badge
								variant="outline"
								className="bg-orange-50 text-orange-800 hover:bg-orange-50 border-orange-200"
							>
								<RefreshCcwIcon className="h-3.5 w-3.5 mr-1" />
								Retry {entry.retryCount || 0}/
								{entry.maxRetries || 0}
							</Badge>
						)}
					</div>
				</div>

				{/* Details */}
				<div className="space-y-4">
					{/* Lead Information */}
					<div className="bg-muted/40 rounded-2xl p-4">
						<h3 className="font-medium mb-2">Lead Details</h3>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Name:
								</span>
								<span>{entry.lead?.name || "Unknown"}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Phone:
								</span>
								<span>
									{entry.phoneNumber ||
										entry.lead?.phone ||
										"N/A"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Status:
								</span>
								<span>{entry.lead?.status || "N/A"}</span>
							</div>
						</div>
					</div>

					{/* Voice Agent */}
					{entry.voiceAgent && (
						<div className="bg-muted/40 rounded-2xl p-4">
							<h3 className="font-medium mb-2">Voice Agent</h3>
							<div className="text-sm">
								<span>{entry.voiceAgent.name}</span>
							</div>
						</div>
					)}

					{/* Call Instructions */}
					{entry.instructions && (
						<div className="bg-muted/40 rounded-2xl p-4">
							<h3 className="font-medium mb-2">Instructions</h3>
							<div className="text-sm text-muted-foreground">
								{entry.instructions}
							</div>
						</div>
					)}

					{/* Timing Information */}
					<div className="bg-muted/40 rounded-2xl p-4">
						<h3 className="font-medium mb-2">Timing</h3>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Created:
								</span>
								<span>
									{entry.createdAt &&
										format(
											new Date(entry.createdAt),
											"MMM d, h:mm a"
										)}
								</span>
							</div>
							{entry.scheduledTime && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Scheduled:
									</span>
									<span>
										{format(
											new Date(entry.scheduledTime),
											"MMM d, h:mm a"
										)}
									</span>
								</div>
							)}
							{entry.startedAt && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Started:
									</span>
									<span>
										{format(
											new Date(entry.startedAt),
											"MMM d, h:mm a"
										)}
									</span>
								</div>
							)}
							{entry.completedAt && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Completed:
									</span>
									<span>
										{format(
											new Date(entry.completedAt),
											"MMM d, h:mm a"
										)}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Error Information */}
					{entry.lastError && (
						<div className="bg-red-50 rounded-2xl p-4 border border-red-200">
							<h3 className="font-medium mb-2 text-red-800">
								Last Error
							</h3>
							<div className="text-sm text-red-700">
								{entry.lastError}
							</div>
						</div>
					)}

					{/* Call Result */}
					{entry.callResult &&
						Object.keys(entry.callResult).length > 0 && (
							<div className="bg-muted/40 rounded-2xl p-4">
								<h3 className="font-medium mb-2">
									Call Result
								</h3>
								<div className="text-sm text-muted-foreground">
									<pre className="whitespace-pre-wrap">
										{JSON.stringify(
											entry.callResult,
											null,
											2
										)}
									</pre>
								</div>
							</div>
						)}
				</div>
			</div>
		</div>
	)
}

// Main Call Queue Page Client Component
export function CallQueuePageClient() {
	const [loading, setLoading] = useState(true)
	const [queueData, setQueueData] = useState<CallQueueEntry[]>([])
	const [error, setError] = useState<string | null>(null)
	const [selectedEntry, setSelectedEntry] = useState<CallQueueEntry | null>(
		null
	)
	const [isMobile, setIsMobile] = useState(false)

	// Handle window resize
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768)
		}

		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	// Fetch queue data
	const fetchQueueData = useCallback(async () => {
		setLoading(true)
		try {
			const result = await getCallQueue()

			if (result.success && result.data) {
				setQueueData(result.data)
				setError(null)
			} else {
				setError(result.error || "Failed to fetch call queue data")
			}
		} catch (err) {
			console.error("Error fetching call queue:", err)
			setError("An unexpected error occurred")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchQueueData()
	}, [fetchQueueData])

	// Handle cancel call
	const handleCancelCall = async (queueId: number) => {
		try {
			const result = await cancelQueuedCall(queueId)

			if (result.success) {
				toast({
					title: "Call Cancelled",
					description:
						result.message ||
						"Call has been cancelled successfully."
				})

				// Refresh data
				await fetchQueueData()

				// Clear selection if the cancelled call was selected
				if (selectedEntry?.id === queueId) {
					setSelectedEntry(null)
				}
			} else {
				toast({
					title: "Error",
					description: result.error || "Failed to cancel call.",
					variant: "destructive"
				})
			}
		} catch (error) {
			console.error("Error cancelling call:", error)
			toast({
				title: "Error",
				description:
					"An unexpected error occurred while cancelling the call.",
				variant: "destructive"
			})
		}
	}

	// Handle row click
	const handleRowClick = (entry: CallQueueEntry) => {
		setSelectedEntry(entry)
	}

	// Handle closing the details panel
	const handleClosePanel = () => {
		setSelectedEntry(null)
	}

	return (
		<div className="container flex flex-col h-full overflow-hidden">
			<div className="flex flex-col gap-4 h-full overflow-hidden">
				<PageHeader />

				{loading ? (
					<CallQueueTableSkeleton />
				) : error ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-10">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
									<AlertCircleIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									Error Loading Call Queue
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									{error}
								</p>
								<Button
									onClick={fetchQueueData}
									className="mt-4"
									variant="outline"
								>
									Try Again
								</Button>
							</div>
						</CardContent>
					</Card>
				) : queueData.length === 0 ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-12">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full p-3 border border-border/40 shadow-sm">
									<PhoneCallIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									No Calls in Queue
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									No calls are currently queued. When you
									schedule calls from lead pages, they will
									appear here.
								</p>
							</div>
						</CardContent>
					</Card>
				) : (
					<>
						{/* Mobile Dialog for Queue Entry Details */}
						<Dialog
							open={!!selectedEntry && isMobile}
							onOpenChange={(open) => {
								if (!open) handleClosePanel()
							}}
						>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>
										Queue Entry Details
									</DialogTitle>
								</DialogHeader>
								{selectedEntry && (
									<div className="max-h-[60vh] overflow-y-auto">
										<QueueEntryDetails
											entry={selectedEntry}
										/>
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
											selectedEntry && !isMobile
												? "w-2/3 pr-4 flex flex-col overflow-hidden"
												: "w-full flex flex-col overflow-hidden"
										}
									>
										<div className="flex-1 flex flex-col overflow-hidden">
											{/* Header */}
											<div className="flex items-center justify-between mb-4 py-2">
												<h2 className="text-lg font-medium">
													Queue Entries
												</h2>
												<Button
													onClick={fetchQueueData}
													variant="outline"
													size="sm"
													className="gap-2"
												>
													<RefreshCcwIcon className="h-4 w-4" />
													Refresh
												</Button>
											</div>

											{/* Table */}
											<div className="rounded-2xl border overflow-hidden flex-1 overflow-y-auto">
												<Table>
													<TableHeader className="bg-muted">
														<TableRow>
															<TableHead className="pl-6">
																Lead
															</TableHead>
															<TableHead>
																Status
															</TableHead>
															<TableHead>
																Priority
															</TableHead>
															<TableHead>
																Scheduled
															</TableHead>
															<TableHead>
																Retries
															</TableHead>
															<TableHead className="pr-6 w-[100px]">
																Actions
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{queueData.map(
															(entry) => (
																<TableRow
																	key={
																		entry.id
																	}
																	className={`hover:bg-accent/20 transition-colors cursor-pointer ${selectedEntry?.id === entry.id ? "bg-accent/40" : ""}`}
																	onClick={() =>
																		handleRowClick(
																			entry
																		)
																	}
																>
																	<TableCell className="pl-6">
																		<div>
																			<div className="font-medium">
																				{entry
																					.lead
																					?.name ||
																					"Unknown Lead"}
																			</div>
																			<div className="text-sm text-muted-foreground">
																				{entry.phoneNumber ||
																					entry
																						.lead
																						?.phone ||
																					"No phone"}
																			</div>
																		</div>
																	</TableCell>
																	<TableCell>
																		<StatusBadge
																			status={
																				entry.status
																			}
																		/>
																	</TableCell>
																	<TableCell>
																		<PriorityBadge
																			priority={
																				entry.priority
																			}
																		/>
																	</TableCell>
																	<TableCell>
																		{entry.scheduledTime ? (
																			<div className="text-sm">
																				{format(
																					new Date(
																						entry.scheduledTime
																					),
																					"MMM d, h:mm a"
																				)}
																			</div>
																		) : (
																			<span className="text-muted-foreground">
																				ASAP
																			</span>
																		)}
																	</TableCell>
																	<TableCell>
																		{(entry.retryCount ||
																			0) >
																		0 ? (
																			<Badge
																				variant="outline"
																				className="text-xs"
																			>
																				{entry.retryCount ||
																					0}
																				/
																				{entry.maxRetries ||
																					0}
																			</Badge>
																		) : (
																			<span className="text-muted-foreground text-xs">
																				-
																			</span>
																		)}
																	</TableCell>
																	<TableCell className="pr-6">
																		{(entry.status ===
																			"pending" ||
																			entry.status ===
																				"queued") && (
																			<Button
																				variant="outline"
																				size="sm"
																				onClick={(
																					e
																				) => {
																					e.stopPropagation()
																					handleCancelCall(
																						entry.id
																					)
																				}}
																				className="h-8 w-8 p-0"
																			>
																				<Trash2Icon className="h-4 w-4" />
																			</Button>
																		)}
																	</TableCell>
																</TableRow>
															)
														)}
													</TableBody>
												</Table>
											</div>
										</div>
									</div>

									{selectedEntry && !isMobile && (
										<div className="w-1/3 border-l border-border pl-4 h-full flex flex-col overflow-hidden">
											<div className="flex items-center justify-between mb-2 py-1 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
												<h3 className="font-medium text-lg">
													Queue Entry Details
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
											<QueueEntryDetails
												entry={selectedEntry}
											/>
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
