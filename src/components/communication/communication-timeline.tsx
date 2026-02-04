"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
	PhoneCallIcon,
	MessageSquareIcon,
	CalendarIcon,
	SearchIcon,
	FilterIcon,
	ClockIcon,
	UserIcon,
	MapPinIcon,
	PhoneIcon
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { getCommunicationLogs } from "@/actions/lead-communication"

interface CommunicationHistoryItem {
	id: string
	type: "call" | "text" | "appointment"
	direction: "incoming" | "outgoing"
	status: string
	timestamp: Date
	content?: string
	subject?: string
	duration?: number
	relatedData?: {
		voiceAgentName?: string
		templateName?: string
		location?: string
		phoneNumber?: string
	}
	details?: Record<string, unknown>
}

interface CommunicationTimelineProps {
	leadId: number
	refreshTrigger?: number
}

const getTypeIcon = (type: string) => {
	switch (type) {
		case "call":
			return PhoneCallIcon
		case "text":
			return MessageSquareIcon
		case "appointment":
			return CalendarIcon
		default:
			return UserIcon
	}
}

const getTypeColor = (type: string, direction: string) => {
	const isIncoming = direction === "incoming"

	switch (type) {
		case "call":
			return isIncoming ? "text-emerald-500" : "text-blue-500"
		case "text":
			return isIncoming ? "text-violet-600" : "text-violet-500"
		case "appointment":
			return "text-indigo-500"
		default:
			return "text-gray-500"
	}
}

const getStatusBadge = (status: string, type: string) => {
	const statusColors: Record<string, string> = {
		pending: "bg-yellow-100 text-yellow-800",
		sent: "bg-blue-100 text-blue-800",
		delivered: "bg-green-100 text-green-800",
		failed: "bg-red-100 text-red-800",
		cancelled: "bg-gray-100 text-gray-800",
		completed: "bg-green-100 text-green-800",
		scheduled: "bg-indigo-100 text-indigo-800"
	}

	return (
		<Badge
			className={`px-2 py-1 text-xs ${statusColors[status] || "bg-gray-100 text-gray-800"}`}
		>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</Badge>
	)
}

const formatDuration = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const TimelineItem = ({ item }: { item: CommunicationHistoryItem }) => {
	const Icon = getTypeIcon(item.type)
	const colorClass = getTypeColor(item.type, item.direction)

	return (
		<div className="flex gap-4 p-4 border-l-2 border-border/40 hover:border-primary/30 transition-colors">
			<div
				className={`flex-shrink-0 w-10 h-10 rounded-full bg-card/50 border border-border/40 flex items-center justify-center ${colorClass}`}
			>
				<Icon className="h-4 w-4" />
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between mb-2">
					<div className="flex items-center gap-2 flex-wrap">
						<h4 className="text-sm font-medium">
							{item.type.charAt(0).toUpperCase() +
								item.type.slice(1)}{" "}
							•{" "}
							<span className="text-muted-foreground">
								{item.direction === "incoming"
									? "Received"
									: "Sent"}
							</span>
						</h4>
						{getStatusBadge(item.status, item.type)}
					</div>
					<div className="text-xs text-muted-foreground">
						{formatDistanceToNow(item.timestamp, {
							addSuffix: true
						})}
					</div>
				</div>

				{item.subject && (
					<div className="text-sm font-medium mb-1 line-clamp-1">
						{item.subject}
					</div>
				)}

				{item.content && (
					<div className="text-sm text-muted-foreground mb-2 line-clamp-2">
						{item.content}
					</div>
				)}

				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					<div className="flex items-center gap-1">
						<ClockIcon className="h-3 w-3" />
						{format(item.timestamp, "MMM d, h:mm a")}
					</div>

					{item.duration && (
						<div className="flex items-center gap-1">
							<PhoneIcon className="h-3 w-3" />
							{formatDuration(item.duration)}
						</div>
					)}

					{item.relatedData?.location && (
						<div className="flex items-center gap-1">
							<MapPinIcon className="h-3 w-3" />
							{item.relatedData.location}
						</div>
					)}

					{item.relatedData?.voiceAgentName && (
						<div className="flex items-center gap-1">
							<UserIcon className="h-3 w-3" />
							{item.relatedData.voiceAgentName}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

const EmptyState = () => (
	<div className="flex flex-col items-center justify-center py-8 text-center">
		<div className="rounded-full p-3 border border-border/40 shadow-sm bg-card/30">
			<ClockIcon className="h-6 w-6 text-muted-foreground" />
		</div>
		<h3 className="mt-3 text-sm font-medium">No Communication History</h3>
		<p className="mt-1 text-xs text-muted-foreground max-w-xs">
			All communication attempts with this lead will appear here in
			chronological order.
		</p>
	</div>
)

const TimelineSkeleton = () => (
	<div className="space-y-4">
		{[1, 2, 3].map((i) => (
			<div key={i} className="flex gap-4 p-4">
				<Skeleton className="w-10 h-10 rounded-full" />
				<div className="flex-1 space-y-2">
					<div className="flex justify-between">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-16" />
					</div>
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-2/3" />
				</div>
			</div>
		))}
	</div>
)

export function CommunicationTimeline({
	leadId,
	refreshTrigger
}: CommunicationTimelineProps) {
	const [communications, setCommunications] = useState<
		CommunicationHistoryItem[]
	>([])
	const [loading, setLoading] = useState(true)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
	const [showFilters, setShowFilters] = useState(false)

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshTrigger is intentionally included to refetch data when communication actions are performed
	useEffect(() => {
		const fetchCommunications = async () => {
			try {
				setLoading(true)
				const result = await getCommunicationLogs(leadId)
				if (result.success) {
					setCommunications(result.data)
				}
			} catch (error) {
				console.error("Error fetching communications:", error)
			} finally {
				setLoading(false)
			}
		}

		fetchCommunications()
	}, [leadId, refreshTrigger])

	// Filter communications based on search term and selected types
	const filteredCommunications = communications.filter((item) => {
		const matchesSearch =
			!searchTerm ||
			item.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.type.toLowerCase().includes(searchTerm.toLowerCase())

		const matchesType =
			selectedTypes.size === 0 || selectedTypes.has(item.type)

		return matchesSearch && matchesType
	})

	const toggleTypeFilter = (type: string) => {
		const newTypes = new Set(selectedTypes)
		if (newTypes.has(type)) {
			newTypes.delete(type)
		} else {
			newTypes.add(type)
		}
		setSelectedTypes(newTypes)
	}

	const typeOptions = ["call", "text", "appointment"]

	return (
		<div className="space-y-4">
			{/* Search and Filter Header */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1">
					<SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
					<Input
						placeholder="Search communications..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10 rounded-lg"
					/>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowFilters(!showFilters)}
					className="gap-2 rounded-lg"
				>
					<FilterIcon className="h-4 w-4" />
					Filter
					{selectedTypes.size > 0 && (
						<Badge className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground">
							{selectedTypes.size}
						</Badge>
					)}
				</Button>
			</div>

			{/* Filter Options */}
			{showFilters && (
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm">
					<CardContent className="p-4">
						<div className="flex flex-wrap gap-2">
							{typeOptions.map((type) => (
								<Button
									key={type}
									variant={
										selectedTypes.has(type)
											? "default"
											: "outline"
									}
									size="sm"
									onClick={() => toggleTypeFilter(type)}
									className="h-8 text-xs rounded-lg"
								>
									{type.charAt(0).toUpperCase() +
										type.slice(1)}
								</Button>
							))}
							{selectedTypes.size > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSelectedTypes(new Set())}
									className="h-8 text-xs text-muted-foreground hover:text-foreground"
								>
									Clear All
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Timeline Content */}
			<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-0">
					{loading ? (
						<div className="p-4">
							<TimelineSkeleton />
						</div>
					) : filteredCommunications.length === 0 ? (
						<div className="p-4">
							{communications.length === 0 ? (
								<EmptyState />
							) : (
								<div className="text-center py-8">
									<p className="text-sm text-muted-foreground">
										No communications match your search
										criteria.
									</p>
								</div>
							)}
						</div>
					) : (
						<div className="divide-y divide-border/40">
							{filteredCommunications.map((item) => (
								<TimelineItem key={item.id} item={item} />
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
