"use client"

import { getLeadById } from "@/actions/leads"
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
import type {
	Appointment,
	Call,
	Email,
	LeadDetailData,
	TextMessage
} from "@/types"
import { format, isAfter, isBefore } from "date-fns"
import {
	ArrowLeftIcon,
	CalendarIcon,
	ClockIcon,
	EditIcon,
	MailIcon,
	MessageSquareIcon,
	PhoneCallIcon,
	PlusIcon,
	UserIcon
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

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

// Email component
const EmailCard = ({ email }: { email: Email }) => {
	return (
		<Card className="border-border bg-card/40 backdrop-blur-sm overflow-hidden h-full">
			<div className="flex flex-col h-full">
				<div
					className={`h-1 ${email.type === "incoming" ? "bg-green-500" : "bg-blue-500"}`}
				/>
				<div className="flex-1 p-4">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-2">
							<MailIcon
								className={`h-3 w-3 ${email.type === "incoming" ? "text-green-500" : "text-blue-500"}`}
							/>
							<h3 className="text-sm font-medium line-clamp-1">
								{email.subject}
							</h3>
						</div>
						<div className="text-xs text-muted-foreground">
							{format(new Date(email.sentAt), "MMM d, h:mm a")}
						</div>
					</div>

					<div className="mt-2 p-2 rounded-lg bg-card/30 text-xs line-clamp-3">
						{email.content}
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
		<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
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
	gradient = "from-primary to-primary/60"
}: {
	icon: React.ElementType
	title: string
	buttonText: string
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
		<Button size="sm" variant="outline" className="rounded-full">
			<PlusIcon className="mr-1 h-3 w-3" />
			{buttonText}
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

			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardHeader>
					<Skeleton className="h-6 w-32" />
				</CardHeader>
				<CardContent className="p-6 pt-0">
					<div className="flex flex-col md:flex-row gap-6">
						<div className="flex-1">
							<Skeleton className="h-5 w-32 mb-2" />
							<Skeleton className="h-5 w-48 mb-2" />
							<Skeleton className="h-5 w-36 mb-2" />
							<Skeleton className="h-5 w-40" />
						</div>
						<div className="flex-1">
							<Skeleton className="h-6 w-32 mb-4" />
							<Skeleton className="h-24 w-full" />
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Skeleton className="h-64 w-full rounded-2xl" />
				<Skeleton className="h-64 w-full rounded-2xl" />
				<Skeleton className="h-64 w-full rounded-2xl" />
				<Skeleton className="h-64 w-full rounded-2xl" />
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

				const result = await getLeadById(leadId)

				if (result.success && result.data) {
					setLeadData(result.data as unknown as LeadDetailData)
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

	// Show loading skeleton
	if (loading) {
		return (
			<div className="container py-6">
				<LeadDetailSkeleton />
			</div>
		)
	}

	// Show error
	if (error || !leadData) {
		return (
			<div className="container py-6">
				<Button
					variant="ghost"
					className="mb-6"
					onClick={() => router.back()}
				>
					<ArrowLeftIcon className="mr-2 h-4 w-4" />
					Back to Leads
				</Button>

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
								onClick={() => router.back()}
							>
								Back to Leads
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	const { lead, appointments, calls, textMessages, emails } = leadData

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
		<div className="container max-w-7xl mx-auto py-6">
			{/* Back button and edit button */}
			<div className="flex justify-between items-center mb-6">
				<Button
					variant="ghost"
					onClick={() => router.push("/leads")}
					className="gap-2"
				>
					<ArrowLeftIcon className="h-4 w-4" />
					Back to Leads
				</Button>

				<Button variant="outline" className="gap-2 rounded-full">
					<EditIcon className="h-4 w-4" />
					Edit Lead
				</Button>
			</div>

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

								<div className="flex flex-col gap-2">
									<h3 className="text-sm font-semibold">
										Quick Actions
									</h3>
									<div className="grid grid-cols-2 gap-2">
										<Button
											size="sm"
											className="w-full"
											variant="default"
										>
											<PhoneCallIcon className="h-4 w-4 mr-2" />
											Call
										</Button>
										<Button
											size="sm"
											className="w-full"
											variant="outline"
										>
											<MessageSquareIcon className="h-4 w-4 mr-2" />
											Text
										</Button>
										<Button
											size="sm"
											className="w-full"
											variant="outline"
										>
											<MailIcon className="h-4 w-4 mr-2" />
											Email
										</Button>
										<Button
											size="sm"
											className="w-full"
											variant="outline"
										>
											<CalendarIcon className="h-4 w-4 mr-2" />
											Schedule
										</Button>
									</div>
								</div>

								<Separator className="my-4" />

								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h3 className="text-sm font-semibold">
											Notes
										</h3>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
										>
											<EditIcon className="h-4 w-4" />
										</Button>
									</div>
									<div className="bg-card/30 backdrop-blur-sm p-3 rounded-xl min-h-[120px] text-sm">
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
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Right column - Communication sections */}
				<div className="lg:col-span-8 space-y-6">
					{/* Appointments section */}
					<div>
						<SectionHeader
							icon={CalendarIcon}
							title="Appointments"
							buttonText="Schedule"
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
							buttonText="Log Call"
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

					{/* Messages section */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Text Messages */}
						<div>
							<SectionHeader
								icon={MessageSquareIcon}
								title="Text Messages"
								buttonText="Send Text"
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
								<div className="space-y-3">
									{textMessages.slice(0, 3).map((text) => (
										<TextMessageCard
											key={text.id}
											text={text}
										/>
									))}
								</div>
							)}
						</div>

						{/* Emails */}
						<div>
							<SectionHeader
								icon={MailIcon}
								title="Emails"
								buttonText="Send Email"
								gradient="from-amber-500 to-amber-500/60"
							/>

							{emails.length === 0 ? (
								<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
									<CardContent>
										<EmptyState
											icon={MailIcon}
											title="No Emails"
											description="No email history with this lead yet."
											buttonText="Send Email"
										/>
									</CardContent>
								</Card>
							) : (
								<div className="space-y-3">
									{emails.slice(0, 3).map((email) => (
										<EmailCard
											key={email.id}
											email={email}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
