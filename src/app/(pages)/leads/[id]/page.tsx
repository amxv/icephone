"use client"

import { getLead, updateLead } from "@/actions/leads"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { CallDialog } from "@/components/communication/call-dialog"
import { TextMessageDialog } from "@/components/communication/text-message-dialog"
import { AppointmentDialog } from "@/components/communication/appointment-dialog"
import { EditLeadDialog } from "@/components/communication/edit-lead-dialog"
import { CommunicationTimeline } from "@/components/communication/communication-timeline"
import { QuickActionsFAB } from "@/components/communication/quick-actions-fab"
import { FollowUpSuggestions } from "@/components/communication/follow-up-suggestions"
import { KeyboardShortcutsHelper } from "@/components/communication/keyboard-shortcuts-helper"
import type {
	Appointment,
	Call,
	LeadDetailData,
	TextMessage
} from "@/types"
import { format, isAfter, isBefore } from "date-fns"
import {
	ArrowLeftIcon,
	CalendarIcon,
	ClockIcon,
	EditIcon,
	Expand,
	MailIcon,
	MessageSquareIcon,
	PhoneCallIcon,
	PlusIcon,
	SaveIcon,
	UserIcon
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
	useKeyboardShortcuts,
	createCommunicationShortcuts
} from "@/hooks/use-keyboard-shortcuts"

// Status badges with appropriate colors
const StatusBadge = ({ status }: { status: string }) => {
	const statusColors: Record<string, string> = {
		new: "bg-blue-100 text-blue-800 hover:bg-blue-100",
		contacted: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
		qualified: "bg-orange-100 text-orange-800 hover:bg-orange-100",
		converted: "bg-green-100 text-green-800 hover:bg-green-100",
		lost: "bg-red-100 text-red-800 hover:bg-red-100"
	}

	return (
		<Badge
			className={`px-3 py-1 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}
		>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</Badge>
	)
}

// Score badge with color based on the score value
const ScoreBadge = ({ score }: { score: number }) => {
	let color = "bg-gray-100 text-gray-800"

	if (score >= 80) {
		color = "bg-green-100 text-green-800"
	} else if (score >= 60) {
		color = "bg-blue-100 text-blue-800"
	} else if (score >= 40) {
		color = "bg-yellow-100 text-yellow-800"
	} else if (score >= 20) {
		color = "bg-orange-100 text-orange-800"
	} else {
		color = "bg-red-100 text-red-800"
	}

	return <Badge className={`px-3 py-1 ${color}`}>Score: {score}</Badge>
}

// Appointment card component
const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
	const isPast = isBefore(new Date(appointment.startTime), new Date())

	return (
		<Card className="border-border bg-card/40 backdrop-blur-sm overflow-hidden h-full">
			<div className="flex flex-col h-full">
				<div
					className={`h-1 ${appointment.completed ? "bg-green-500" : isPast ? "bg-red-500" : "bg-blue-500"}`}
				/>
				<div className="flex-1 p-4">
					<div className="flex items-start justify-between">
						<h3 className="text-base font-medium line-clamp-1">
							{appointment.title}
						</h3>
						<div className="flex gap-2">
							{appointment.completed ? (
								<Badge className="bg-green-100 text-green-800">
									Completed
								</Badge>
							) : isPast ? (
								<Badge className="bg-red-100 text-red-800">
									Missed
								</Badge>
							) : (
								<Badge className="bg-blue-100 text-blue-800">
									Upcoming
								</Badge>
							)}
						</div>
					</div>

					<div className="flex items-center gap-2 mt-2 text-muted-foreground text-xs">
						<ClockIcon className="h-3 w-3" />
						<span>
							{format(
								new Date(appointment.startTime),
								"MMM d, yyyy h:mm a"
							)}{" "}
							-{format(new Date(appointment.endTime), "h:mm a")}
						</span>
					</div>

					{appointment.location && (
						<div className="mt-2 text-muted-foreground text-xs">
							📍 {appointment.location}
						</div>
					)}

					{appointment.description && (
						<div className="mt-3 text-xs line-clamp-2">
							{appointment.description}
						</div>
					)}
				</div>
			</div>
		</Card>
	)
}

// Call card component
const CallCard = ({ call }: { call: Call }) => {
	return (
		<Card className="border-border bg-card/40 backdrop-blur-sm overflow-hidden h-full">
			<div className="flex flex-col h-full">
				<div
					className={`h-1 ${call.type === "incoming" ? "bg-green-500" : "bg-blue-500"}`}
				/>
				<div className="flex-1 p-4">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-2">
							<PhoneCallIcon
								className={`h-3 w-3 ${call.type === "incoming" ? "text-green-500" : "text-blue-500"}`}
							/>
							<h3 className="text-sm font-medium">
								{call.type === "incoming"
									? "Incoming Call"
									: "Outgoing Call"}
							</h3>
						</div>
						<Badge
							variant="outline"
							className={`text-xs ${
								call.type === "incoming"
									? "bg-green-100 text-green-800"
									: "bg-blue-100 text-blue-800"
							}`}
						>
							{call.status ||
								(call.type === "incoming"
									? "Received"
									: "Placed")}
						</Badge>
					</div>

					<div className="flex items-center gap-2 mt-2 text-muted-foreground text-xs">
						<ClockIcon className="h-3 w-3" />
						<span>
							{format(
								new Date(call.startTime),
								"MMM d, yyyy h:mm a"
							)}
							{call.duration &&
								` • ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, "0")}`}
						</span>
					</div>

					{call.summary && (
						<div className="mt-2 text-xs line-clamp-2">
							<p className="font-medium">Summary:</p>
							<p className="mt-1">{call.summary}</p>
						</div>
					)}
				</div>
			</div>
		</Card>
	)
}

// Text message component
const TextMessageCard = ({ text }: { text: TextMessage }) => {
	return (
		<Card className="border-border bg-card/40 backdrop-blur-sm overflow-hidden h-full">
			<div className="flex flex-col h-full">
				<div
					className={`h-1 ${text.type === "incoming" ? "bg-green-500" : "bg-blue-500"}`}
				/>
				<div className="flex-1 p-4">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-2">
							<MessageSquareIcon
								className={`h-3 w-3 ${text.type === "incoming" ? "text-green-500" : "text-blue-500"}`}
							/>
							<h3 className="text-sm font-medium">
								{text.type === "incoming" ? "Received" : "Sent"}
							</h3>
						</div>
						<div className="text-xs text-muted-foreground">
							{format(new Date(text.sentAt), "MMM d, h:mm a")}
						</div>
					</div>

					<div className="mt-2 p-2 rounded-lg bg-card/30 text-xs line-clamp-3">
						{text.content}
					</div>
				</div>
			</div>
		</Card>
	)
}

// Empty state components for each section
const EmptyState = ({
	icon: Icon,
	title,
	description,
	buttonText
}: {
	icon: React.ElementType
	title: string
	description: string
	buttonText: string
}) => (
	<div className="flex flex-col items-center justify-center py-8 text-center h-40">
		<div className="rounded-full p-3 border border-border/40 shadow-sm">
			<Icon className="h-6 w-6 text-muted-foreground" />
		</div>
		<h3 className="mt-3 text-sm font-medium">{title}</h3>
		<p className="mt-1 text-xs text-muted-foreground max-w-xs">
			{description}
		</p>
		<Button className="mt-3" size="sm" variant="outline">
			<PlusIcon className="mr-1 h-3 w-3" />
			{buttonText}
		</Button>
	</div>
)

// Section header component
const SectionHeader = ({
	icon: Icon,
	title,
	buttonText,
	buttonLink = "#",
	gradient = "from-primary to-primary/60"
}: {
	icon: React.ElementType
	title: string
	buttonText: string
	buttonLink?: string
	gradient?: string
}) => (
	<div className="flex items-center justify-between mb-4">
		<div className="flex items-center gap-2">
			<div
				className={`h-8 w-1 bg-gradient-to-b ${gradient} rounded-full`}
			/>
			<div className="flex items-center gap-2">
				<Icon className="h-5 w-5 text-muted-foreground" />
				<h2 className="text-lg font-medium">{title}</h2>
			</div>
		</div>
		<Button
			size="sm"
			variant="outline"
			className="text-xs text-muted-foreground hover:text-foreground"
			asChild
		>
			<Link href={buttonLink}>
				View All
				<Expand className="ml-1 h-3 w-3" />
			</Link>
		</Button>
	</div>
)

// Loading skeleton
function LeadDetailSkeleton() {
	return (
		<div className="flex flex-col gap-8">
			<div className="flex items-center gap-2">
				<Skeleton className="h-10 w-10 rounded-full" />
				<Skeleton className="h-10 w-48" />
			</div>

			{/* Lead info skeleton */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Left column */}
				<div className="lg:col-span-4">
					<Skeleton className="h-72 w-full rounded-2xl" />
				</div>

				{/* Right column sections */}
				<div className="lg:col-span-8 space-y-6">
					{/* Appointments skeleton */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-8 w-32" />
						</div>
						<Skeleton className="h-48 w-full rounded-2xl" />
					</div>

					{/* Calls skeleton */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-8 w-32" />
						</div>
						<Skeleton className="h-48 w-full rounded-2xl" />
					</div>

					{/* Texts skeleton */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-8 w-32" />
						</div>
						<Skeleton className="h-48 w-full rounded-2xl" />
					</div>
				</div>
			</div>
		</div>
	)
}

// Main lead detail page
export default function LeadDetailPage() {
	const params = useParams()
	const router = useRouter()
	const [loading, setLoading] = useState(true)
	const [leadData, setLeadData] = useState<LeadDetailData | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [notes, setNotes] = useState<string>("")
	const [isEditingNotes, setIsEditingNotes] = useState(false)
	const [isSavingNotes, setIsSavingNotes] = useState(false)
	const [refreshTrigger, setRefreshTrigger] = useState(0)

	// Communication dialog states
	const [callDialogOpen, setCallDialogOpen] = useState(false)
	const [textDialogOpen, setTextDialogOpen] = useState(false)
	const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false)
	const [editLeadDialogOpen, setEditLeadDialogOpen] = useState(false)

	// Keyboard shortcuts for communication actions
	const communicationShortcuts = createCommunicationShortcuts({
		onCall: () => {
			if (leadData?.lead.phone && !callDialogOpen) {
				setCallDialogOpen(true)
			}
		},
		onText: () => {
			if (leadData?.lead.phone && !textDialogOpen) {
				setTextDialogOpen(true)
			}
		},
		onAppointment: () => {
			if (leadData && !appointmentDialogOpen) {
				setAppointmentDialogOpen(true)
			}
		}
	})

	useKeyboardShortcuts({
		shortcuts: communicationShortcuts,
		enabled: !!leadData && !loading
	})

	// Header component for consistent styling
	const StickyHeader = ({ disabled = false }: { disabled?: boolean }) => (
		<div
			className="sticky top-0 py-4 z-50 border-b backdrop-blur-md rounded-t-3xl"
			style={{
				backgroundColor: "rgba(255, 251, 235, 0.7)"
			}}
		>
			<div className="container max-w-7xl mx-auto">
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						onClick={() => router.push("/leads")}
						className="gap-2"
					>
						<ArrowLeftIcon className="h-4 w-4" />
						Back to Leads
					</Button>

					{!disabled && leadData && (
						<div className="flex gap-2 justify-center">
							<Button
								size="sm"
								className="w-28"
								variant="outline"
								disabled={disabled || !leadData.lead.phone}
								onClick={() => setCallDialogOpen(true)}
							>
								<PhoneCallIcon className="h-4 w-4" />
								Call
							</Button>
							<Button
								size="sm"
								className="w-28"
								variant="outline"
								disabled={disabled || !leadData.lead.phone}
								onClick={() => setTextDialogOpen(true)}
							>
								<MessageSquareIcon className="h-4 w-4" />
								Text
							</Button>
							<Button
								size="sm"
								className="w-28"
								variant="outline"
								disabled={disabled}
								onClick={() => setAppointmentDialogOpen(true)}
							>
								<CalendarIcon className="h-4 w-4" />
								Schedule
							</Button>
						</div>
					)}

					<div className="flex gap-2">
						<KeyboardShortcutsHelper />
						<Button
							variant="outline"
							className="gap-2 rounded-full"
							disabled={disabled}
							onClick={() => setEditLeadDialogOpen(true)}
						>
							<EditIcon className="h-4 w-4" />
							Edit Lead
						</Button>
					</div>
				</div>
			</div>
		</div>
	)

	useEffect(() => {
		async function fetchLeadData() {
			setLoading(true)
			try {
				const leadId = Number(params.id)
				if (Number.isNaN(leadId)) {
					setError("Invalid lead ID")
					setLoading(false)
					return
				}

				const result = await getLead(leadId)

				if (result.success && result.data) {
					setLeadData(result.data as unknown as LeadDetailData)
					setNotes(result.data.lead.notes || "")
				} else {
					setError(result.error || "Failed to fetch lead data")
				}
			} catch (err) {
				console.error("Error fetching lead details:", err)
				setError("An unexpected error occurred")
			} finally {
				setLoading(false)
			}
		}

		fetchLeadData()
	}, [params.id])

	const handleSaveNotes = async () => {
		if (!leadData) return

		setIsSavingNotes(true)
		try {
			const result = await updateLead(leadData.lead.id, {
				notes: notes
			})

			if (result.success && result.data) {
				// Update the lead data with the new notes
				setLeadData({
					...leadData,
					lead: {
						...leadData.lead,
						notes: notes
					}
				})
				setIsEditingNotes(false)
				toast.success("Notes updated successfully")
			} else {
				console.error("Failed to update notes:", result.error)
				toast.error(result.error || "Failed to save notes")
			}
		} catch (err) {
			console.error("Error saving notes:", err)
			toast.error("An unexpected error occurred while saving notes")
		} finally {
			setIsSavingNotes(false)
		}
	}

	// Function to refresh lead data after communication actions
	const refreshLeadData = async () => {
		if (!leadData) return

		try {
			const result = await getLead(leadData.lead.id)
			if (result.success && result.data) {
				setLeadData(result.data as unknown as LeadDetailData)
				// Trigger communication timeline refresh
				setRefreshTrigger((prev) => prev + 1)
			}
		} catch (error) {
			console.error("Error refreshing lead data:", error)
		}
	}

	// Show loading skeleton
	if (loading) {
		return (
			<>
				<StickyHeader disabled />
				<div className="container py-6">
					<LeadDetailSkeleton />
				</div>
			</>
		)
	}

	// Show error
	if (error || !leadData) {
		return (
			<>
				<StickyHeader disabled />
				<div className="container py-6">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-16">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
									<UserIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									Error Loading Lead
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									{error ||
										"Could not load lead details. Please try again."}
								</p>
								<Button
									className="mt-4"
									variant="outline"
									onClick={() => router.back()}
								>
									Back to Leads
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</>
		)
	}

	const { lead, appointments, calls, textMessages } = leadData

	// Split appointments into upcoming and past
	const now = new Date()
	const upcomingAppointments = appointments
		.filter((app) => isAfter(new Date(app.startTime), now))
		.sort(
			(a, b) =>
				new Date(a.startTime).getTime() -
				new Date(b.startTime).getTime()
		)

	const pastAppointments = appointments
		.filter((app) => isBefore(new Date(app.startTime), now))
		.sort(
			(a, b) =>
				new Date(b.startTime).getTime() -
				new Date(a.startTime).getTime()
		)

	return (
		<>
			<StickyHeader />
			<div className="container max-w-7xl mx-auto py-6">
				{/* Lead profile header */}
				<div className="mb-8">
					<div className="flex items-center gap-4 mb-2">
						<Avatar className="h-16 w-16">
							<div className="bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center text-2xl font-semibold">
								{lead.name.charAt(0).toUpperCase()}
							</div>
						</Avatar>

						<div>
							<h1 className="text-3xl font-semibold mb-1 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-500">
								{lead.name}
							</h1>
							<div className="flex flex-wrap gap-2">
								<StatusBadge status={lead.status} />
								<ScoreBadge score={lead.score} />
								{lead.source && (
									<Badge className="bg-purple-100 text-purple-800 px-3 py-1">
										{lead.source}
									</Badge>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Main content grid */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					{/* Left column - Contact info and actions */}
					<div className="lg:col-span-4">
						<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm overflow-hidden h-full">
							<CardContent className="p-5">
								<div className="space-y-4">
									<div className="space-y-2 text-sm">
										{lead.email && (
											<div className="flex items-center gap-2">
												<MailIcon className="h-4 w-4 text-muted-foreground" />
												<a
													href={`mailto:${lead.email}`}
													className="hover:underline"
												>
													{lead.email}
												</a>
											</div>
										)}

										{lead.phone && (
											<div className="flex items-center gap-2">
												<PhoneCallIcon className="h-4 w-4 text-muted-foreground" />
												<a
													href={`tel:${lead.phone}`}
													className="hover:underline"
												>
													{lead.phone}
												</a>
											</div>
										)}

										<div className="flex items-center gap-2">
											<CalendarIcon className="h-4 w-4 text-muted-foreground" />
											<span className="text-muted-foreground">
												Added on{" "}
												{format(
													new Date(lead.createdAt),
													"MMMM d, yyyy"
												)}
											</span>
										</div>
									</div>

									<Separator className="my-4" />

									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-semibold">
												Notes
											</h3>
											{!isEditingNotes ? (
												<Button
													variant="outline"
													size="sm"
													className="h-8 gap-1"
													onClick={() =>
														setIsEditingNotes(true)
													}
												>
													<EditIcon className="h-3 w-3" />
													Edit
												</Button>
											) : (
												<Button
													variant="outline"
													size="sm"
													className="h-8 gap-1"
													onClick={() => {
														setNotes(
															lead.notes || ""
														)
														setIsEditingNotes(false)
													}}
												>
													<ArrowLeftIcon className="h-3 w-3" />
													Cancel
												</Button>
											)}
										</div>
										{!isEditingNotes ? (
											<div className="bg-card/30 backdrop-blur-sm p-3 rounded-xl min-h-[120px] text-sm max-h-[200px] overflow-y-auto">
												{lead.notes ? (
													<div className="whitespace-pre-wrap">
														{lead.notes}
													</div>
												) : (
													<div className="text-muted-foreground text-sm h-full flex items-center justify-center">
														No notes added yet
													</div>
												)}
											</div>
										) : (
											<div className="space-y-2">
												<Textarea
													value={notes}
													onChange={(e) =>
														setNotes(e.target.value)
													}
													placeholder="Add notes about this lead..."
													className="min-h-[150px] max-h-[200px] overflow-y-auto bg-card/30 text-sm"
												/>
												<Button
													onClick={handleSaveNotes}
													className="w-full"
													disabled={isSavingNotes}
													variant="default"
												>
													{isSavingNotes ? (
														<>
															<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
															Saving...
														</>
													) : (
														<>
															<SaveIcon className="h-4 w-4 mr-2" />
															Save Notes
														</>
													)}
												</Button>
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Follow-up Suggestions */}
						<FollowUpSuggestions
							leadId={lead.id}
							leadStatus={lead.status}
							leadScore={lead.score}
							lastActivity={
								lead.updatedAt
									? new Date(lead.updatedAt)
									: undefined
							}
							onCallSuggestion={() => setCallDialogOpen(true)}
							onTextSuggestion={() => setTextDialogOpen(true)}
							onAppointmentSuggestion={() =>
								setAppointmentDialogOpen(true)
							}
						/>
					</div>

					{/* Right column - Communication sections */}
					<div className="lg:col-span-8 space-y-6">
						{/* Communication Timeline section */}
						<div>
							<SectionHeader
								icon={ClockIcon}
								title="Communication Timeline"
								buttonText="View all communications"
								buttonLink="#"
								gradient="from-indigo-500 to-indigo-500/60"
							/>
							<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
								<CardContent className="p-0">
									<CommunicationTimeline
										leadId={lead.id}
										refreshTrigger={refreshTrigger}
									/>
								</CardContent>
							</Card>
						</div>

						{/* Appointments section */}
						<div>
							<SectionHeader
								icon={CalendarIcon}
								title="Appointments"
								buttonText="View all appointments"
								buttonLink="/appointments"
								gradient="from-blue-500 to-blue-500/60"
							/>

							{appointments.length === 0 ? (
								<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
									<CardContent>
										<EmptyState
											icon={CalendarIcon}
											title="No Appointments"
											description="No appointments scheduled with this lead yet."
											buttonText="Schedule Appointment"
										/>
									</CardContent>
								</Card>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									{upcomingAppointments
										.slice(0, 2)
										.map((appointment) => (
											<AppointmentCard
												key={appointment.id}
												appointment={appointment}
											/>
										))}
									{upcomingAppointments.length === 0 &&
										pastAppointments.length > 0 &&
										pastAppointments
											.slice(0, 2)
											.map((appointment) => (
												<AppointmentCard
													key={appointment.id}
													appointment={appointment}
												/>
											))}
								</div>
							)}
						</div>

						{/* Calls section */}
						<div>
							<SectionHeader
								icon={PhoneCallIcon}
								title="Call History"
								buttonText="View all calls"
								buttonLink="/calls"
								gradient="from-emerald-500 to-emerald-500/60"
							/>

							{calls.length === 0 ? (
								<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
									<CardContent>
										<EmptyState
											icon={PhoneCallIcon}
											title="No Calls"
											description="No call history with this lead yet."
											buttonText="Log a Call"
										/>
									</CardContent>
								</Card>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									{calls.slice(0, 4).map((call) => (
										<CallCard key={call.id} call={call} />
									))}
								</div>
							)}
						</div>

						{/* Text Messages section */}
						<div>
							<SectionHeader
								icon={MessageSquareIcon}
								title="Text Messages"
								buttonText="View all messages"
								buttonLink="#"
								gradient="from-violet-500 to-violet-500/60"
							/>

							{textMessages.length === 0 ? (
								<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
									<CardContent>
										<EmptyState
											icon={MessageSquareIcon}
											title="No Messages"
											description="No text messages with this lead yet."
											buttonText="Send Text"
										/>
									</CardContent>
								</Card>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									{textMessages.slice(0, 4).map((text) => (
										<TextMessageCard
											key={text.id}
											text={text}
										/>
									))}
								</div>
							)}
						</div>

					</div>
				</div>
			</div>

			{/* Communication Dialogs */}
			{leadData && (
				<>
					<CallDialog
						open={callDialogOpen}
						onOpenChange={(open) => {
							setCallDialogOpen(open)
							if (!open) refreshLeadData()
						}}
						leadId={leadData.lead.id}
						leadName={leadData.lead.name}
						leadPhone={leadData.lead.phone || undefined}
					/>
					<TextMessageDialog
						open={textDialogOpen}
						onOpenChange={(open) => {
							setTextDialogOpen(open)
							if (!open) refreshLeadData()
						}}
						leadId={leadData.lead.id}
						leadName={leadData.lead.name}
						leadPhone={leadData.lead.phone || undefined}
					/>
					<AppointmentDialog
						open={appointmentDialogOpen}
						onOpenChange={(open) => {
							setAppointmentDialogOpen(open)
							if (!open) refreshLeadData()
						}}
						leadId={leadData.lead.id}
						leadName={leadData.lead.name}
					/>
					<EditLeadDialog
						open={editLeadDialogOpen}
						onOpenChange={(open) => {
							setEditLeadDialogOpen(open)
							if (!open) refreshLeadData()
						}}
						lead={leadData.lead}
						onLeadUpdated={() => refreshLeadData()}
					/>

					{/* Quick Actions FAB */}
					<QuickActionsFAB
						onCallClick={() => setCallDialogOpen(true)}
						onTextClick={() => setTextDialogOpen(true)}
						onAppointmentClick={() =>
							setAppointmentDialogOpen(true)
						}
						hasPhone={!!leadData.lead.phone}
					/>
				</>
			)}
		</>
	)
}
