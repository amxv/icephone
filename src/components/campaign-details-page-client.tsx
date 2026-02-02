"use client"

import { getCalls } from "@/actions/calls"
import { AddLeadsModal } from "@/components/add-leads-modal"
import { type CallItem, CallsTable } from "@/components/calls-table"
import { CampaignStatsDashboard } from "@/components/campaign-stats-dashboard"
import { CampaignLeadsDashboard } from "@/components/campaign-leads-dashboard"
import { CampaignControls } from "@/components/campaign-controls"
import { CampaignVoiceConfigurationComponent } from "@/components/campaign-voice-configuration"
import { CampaignAnalyticsDashboard } from "@/components/campaign-analytics-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
	BarChart3,
	Bot,
	ClockIcon,
	FileTextIcon,
	MessageSquareIcon,
	PhoneCallIcon,
	PhoneIncomingIcon,
	PhoneOutgoingIcon,
	PlusCircleIcon,
	XIcon
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// Define the type for the raw call data from getCalls - updated to match actual API response
type RawCallFromGetCalls = {
	id: string // Changed from number to string to match prefixed IDs like 'call_123' or 'voice_456'
	leadId: number | null
	leadName: string | null
	type: "incoming" | "outgoing"
	duration: number | null
	startTime: Date
	summary: string | null
	transcript: string | null
	recordingUrl: string | null
	status: string | null
	createdAt: Date
	updatedAt: Date
	source: string // Change to string since SQL returns literals as string type
	campaignId: number | null
	agentId: number | null
	agentName: string | null
	sessionId: string | null
	cost: string | null
	sentiment: string | null
}

// --- Re-scoped Helper Components ---

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

function CampaignPageHeader({
	campaignId,
	onAddLeadsClick
}: { campaignId: string; onAddLeadsClick: () => void }) {
	return (
		<div className="flex items-center justify-between mb-6">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Campaign Calls
				</h1>
			</div>
			<Button
				onClick={onAddLeadsClick}
				variant="outline"
				className="rounded-xl"
			>
				<PlusCircleIcon className="h-4 w-4 mr-2" />
				Add Leads
			</Button>
		</div>
	)
}

function CampaignCallsTableSkeleton() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardContent className="px-6 py-4">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
						<Skeleton className="h-10 w-64" />
						<Skeleton className="h-10 w-32" />
					</div>
					<div className="overflow-x-auto rounded-2xl border">
						<Skeleton className="h-[300px] w-full" />
					</div>
					<div className="flex flex-row items-center justify-end space-x-2 py-2">
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-20" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function CampaignCallDetailsPanel({ call }: { call: CallItem }) {
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
								{call.leadId && (
									<Link
										href={`/leads/${call.leadId}`}
										className="ml-2 text-sm text-blue-500 hover:underline"
									>
										(View Lead)
									</Link>
								)}
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
								<track
									kind="captions"
									srcLang="en"
									label="English"
								/>
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
									No summary available.
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
								<div className="bg-background/60 p-3 rounded-xl shadow-sm max-h-64 overflow-y-auto text-sm">
									<pre className="whitespace-pre-wrap font-normal">
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
// --- End Helper Components ---

interface CampaignDetailsPageClientProps {
	campaignId: string
}

export function CampaignDetailsPageClient({
	campaignId
}: CampaignDetailsPageClientProps) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const [calls, setCalls] = useState<CallItem[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedCall, setSelectedCall] = useState<CallItem | null>(null)
	const [isMobile, setIsMobile] = useState(false)
	const [isAddLeadsModalOpen, setIsAddLeadsModalOpen] = useState(false)
	const [activeTab, setActiveTab] = useState("calls")

	// Simplified state for CallsTable interaction
	const [currentSearchQuery, setCurrentSearchQuery] = useState<string>(
		searchParams.get("search") || ""
	)
	const [currentColumnFilters, setCurrentColumnFilters] =
		useState<ColumnFiltersState>(() => {
			const filtersFromParams = searchParams.get("filters")
			if (filtersFromParams) {
				try {
					return JSON.parse(filtersFromParams)
				} catch {
					return []
				}
			}
			return []
		})

	const createQueryString = useCallback(
		(paramsToUpdate: Record<string, string | number | null>) => {
			const params = new URLSearchParams(searchParams.toString())
			for (const [key, value] of Object.entries(paramsToUpdate)) {
				if (value === null) params.delete(key)
				else params.set(key, String(value))
			}
			return params.toString()
		},
		[searchParams]
	)

	// Effect to update URL from local state changes (search, filters, selectedCall)
	useEffect(() => {
		const newQueryString = createQueryString({
			search: currentSearchQuery || null,
			filters:
				currentColumnFilters.length > 0
					? JSON.stringify(currentColumnFilters)
					: null,
			callId: selectedCall?.id || null
		})
		router.replace(`${pathname}?${newQueryString}`, { scroll: false })
	}, [
		currentSearchQuery,
		currentColumnFilters,
		selectedCall,
		pathname,
		router,
		createQueryString
	])

	const fetchData = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const result = await getCalls({
				campaignId: Number(campaignId),
				search: currentSearchQuery || undefined
				// Note: column filters would need to be mapped to the filter format
			})

			// Handle successful response with real data
			if (result.success && result.data) {
				const rawCallsData = Array.isArray(result.data)
					? result.data
					: []
				const formattedCalls: CallItem[] = rawCallsData.map(
					(call: RawCallFromGetCalls) => ({
						id: call.id, // Keep as string - no need to convert to number
						leadId:
							call.leadId !== null ? Number(call.leadId) : null,
						leadName: call.leadName || null,
						type: call.type as "incoming" | "outgoing",
						duration:
							call.duration !== null &&
							typeof call.duration === "number"
								? Number(call.duration)
								: null,
						startTime: new Date(call.startTime).toISOString(),
						summary: call.summary || null,
						transcript: call.transcript || null,
						recordingUrl: call.recordingUrl || null,
						status: call.status || null,
						createdAt: new Date(call.createdAt).toISOString(),
						updatedAt: new Date(call.updatedAt).toISOString(),
						// Include additional fields from enhanced API
						source: call.source || "calls",
						campaignId: call.campaignId || null,
						agentId: call.agentId || null,
						agentName: call.agentName || null,
						sessionId: call.sessionId || null,
						cost: call.cost || null,
						sentiment: call.sentiment || null
					})
				)
				setCalls(formattedCalls)
			} else {
				// Handle API errors properly without fallback to mock data
				if (result.error) {
					console.error(`API error from getCalls: "${result.error}"`)
					setError(result.error)
				} else {
					// No error but no data - this is a valid state (empty campaign)
					setCalls([])
				}
			}
		} catch (e) {
			console.error("Exception during fetchData:", e)
			setError("Failed to load campaign calls. Please try again.")
			setCalls([]) // Set empty array instead of mock data
		} finally {
			setIsLoading(false)
		}
	}, [campaignId, currentSearchQuery]) // Add currentSearchQuery as dependency

	useEffect(() => {
		fetchData()
	}, [fetchData])

	// Effect to handle initial call selection from URL - updated for string IDs
	useEffect(() => {
		const callIdParam = searchParams.get("callId")
		if (callIdParam && calls.length > 0) {
			const callToSelect = calls.find(
				(c) => c.id === callIdParam // Direct string comparison instead of parseInt
			)
			if (callToSelect) setSelectedCall(callToSelect)
			else setSelectedCall(null)
		} else if (!callIdParam) {
			setSelectedCall(null)
		}
	}, [searchParams, calls])

	// Handle window resize to determine mobile view
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768) // md breakpoint
		}
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	const handleRowClick = (call: CallItem) => setSelectedCall(call)
	const handleClosePanel = () => setSelectedCall(null)

	if (isLoading && calls.length === 0) {
		return (
			<>
				<CampaignPageHeader
					campaignId={campaignId}
					onAddLeadsClick={() => setIsAddLeadsModalOpen(true)}
				/>
				<CampaignCallsTableSkeleton />
				<AddLeadsModal
					open={isAddLeadsModalOpen}
					onOpenChange={setIsAddLeadsModalOpen}
					campaignId={campaignId}
				/>
			</>
		)
	}

	return (
		<>
			<CampaignPageHeader
				campaignId={campaignId}
				onAddLeadsClick={() => setIsAddLeadsModalOpen(true)}
			/>
			<CampaignStatsDashboard campaignId={campaignId} />
			<CampaignControls
				campaignId={campaignId}
				onStatusChange={() => {
					// Refresh data when campaign status changes
					fetchData()
				}}
			/>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 mb-6 h-auto">
					<TabsTrigger
						value="calls"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<PhoneCallIcon className="h-4 w-4 mr-2" />
						Calls
					</TabsTrigger>
					<TabsTrigger
						value="leads"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<FileTextIcon className="h-4 w-4 mr-2" />
						Leads
					</TabsTrigger>
					<TabsTrigger
						value="voice"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<Bot className="h-4 w-4 mr-2" />
						Voice Config
					</TabsTrigger>
					<TabsTrigger
						value="analytics"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<BarChart3 className="h-4 w-4 mr-2" />
						Analytics
					</TabsTrigger>
				</TabsList>

				<TabsContent value="calls" className="mt-0">
					{error ? (
						<Card className="rounded-3xl border-destructive bg-destructive/10 p-6 text-center">
							<h3 className="text-lg font-semibold text-destructive">
								Error loading calls
							</h3>
							<p className="text-destructive/80">{error}</p>
							<Button
								variant="outline"
								className="mt-4"
								onClick={fetchData}
							>
								Try Again
							</Button>
						</Card>
					) : calls.length === 0 ? (
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardContent className="py-12">
								<div className="flex flex-col items-center justify-center text-center">
									<div className="rounded-full p-3 border border-border/40 shadow-sm">
										<PhoneCallIcon className="h-8 w-8 text-muted-foreground" />
									</div>
									<h3 className="mt-4 text-lg font-medium">
										No Calls For This Campaign Yet
									</h3>
									<p className="mt-2 text-sm text-muted-foreground max-w-xs">
										As calls are made for this campaign,
										they will appear here.
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="flex flex-col gap-4 flex-1 overflow-hidden">
							{/* Mobile Dialog for Call Details */}
							<Dialog
								open={!!selectedCall && isMobile}
								onOpenChange={(isOpen) => {
									if (!isOpen) handleClosePanel()
								}}
							>
								<DialogContent className="max-w-3xl h-[80vh] sm:h-[90vh] p-0 flex flex-col bg-background/80 backdrop-blur-xl !rounded-3xl">
									{selectedCall && (
										<>
											<DialogHeader className="p-4 border-b border-border/50">
												<DialogTitle className="flex items-center justify-between">
													Call Details
													<Button
														variant="ghost"
														size="icon"
														onClick={
															handleClosePanel
														}
														className="rounded-full"
													>
														<XIcon className="h-5 w-5" />
													</Button>
												</DialogTitle>
											</DialogHeader>
											<CampaignCallDetailsPanel
												call={selectedCall}
											/>
										</>
									)}
								</DialogContent>
							</Dialog>

							{/* Desktop Layout: Table and Side Panel */}
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
													data={calls}
													onRowClick={handleRowClick}
													selectedCallId={
														selectedCall?.id
													}
													searchQuery={
														currentSearchQuery
													}
													onSearchChange={
														setCurrentSearchQuery
													}
													initialColumnFilters={
														currentColumnFilters
													}
													onFilterChange={
														setCurrentColumnFilters
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
														onClick={
															handleClosePanel
														}
														className="h-8 w-8 p-0 rounded-full"
														aria-label="Close panel"
													>
														<XIcon className="h-4 w-4" />
													</Button>
												</div>
												<CampaignCallDetailsPanel
													call={selectedCall}
												/>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</TabsContent>

				<TabsContent value="leads" className="mt-0">
					<CampaignLeadsDashboard
						campaignId={campaignId}
						onLeadsChange={() => {
							// Optional: refresh data if needed
						}}
					/>
				</TabsContent>

				<TabsContent value="voice" className="mt-0">
					<CampaignVoiceConfigurationComponent
						campaignId={Number(campaignId)}
						campaignName={`Campaign ${campaignId}`}
						onConfigurationSaved={() => {
							// Optional: handle configuration saved
						}}
					/>
				</TabsContent>

				<TabsContent value="analytics" className="mt-0">
					<CampaignAnalyticsDashboard
						campaignId={campaignId}
						campaignName={`Campaign ${campaignId}`}
					/>
				</TabsContent>
			</Tabs>

			<AddLeadsModal
				open={isAddLeadsModalOpen}
				onOpenChange={setIsAddLeadsModalOpen}
				campaignId={campaignId}
				onLeadsAdded={() => {
					// Refresh leads if on leads tab
					if (activeTab === "leads") {
						// The dashboard will refresh automatically
					}
				}}
			/>
		</>
	)
}
