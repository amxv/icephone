"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
	BrainIcon,
	ClockIcon,
	PhoneCallIcon,
	MailIcon,
	MessageSquareIcon,
	CalendarIcon,
	TrendingUpIcon,
	AlertCircleIcon
} from "lucide-react"
import { getCommunicationLogs } from "@/actions/lead-communication"

interface FollowUpSuggestion {
	id: string
	type: "call" | "email" | "text" | "appointment"
	priority: "high" | "medium" | "low"
	title: string
	description: string
	reasoning: string
	suggestedTiming: string
	action?: () => void
}

interface FollowUpSuggestionsProps {
	leadId: number
	leadStatus: string
	leadScore?: number
	lastActivity?: Date
	onCallSuggestion: () => void
	onEmailSuggestion: () => void
	onTextSuggestion: () => void
	onAppointmentSuggestion: () => void
}

const getActionIcon = (type: string) => {
	switch (type) {
		case "call":
			return PhoneCallIcon
		case "email":
			return MailIcon
		case "text":
			return MessageSquareIcon
		case "appointment":
			return CalendarIcon
		default:
			return AlertCircleIcon
	}
}

const getPriorityColor = (priority: string) => {
	switch (priority) {
		case "high":
			return "bg-red-100 text-red-800"
		case "medium":
			return "bg-yellow-100 text-yellow-800"
		case "low":
			return "bg-green-100 text-green-800"
		default:
			return "bg-gray-100 text-gray-800"
	}
}

interface CommunicationHistoryItem {
	type: "call" | "email" | "text" | "appointment"
	direction: "incoming" | "outgoing"
	status: string
	timestamp: Date
}

const generateSuggestions = (
	communicationHistory: CommunicationHistoryItem[],
	leadStatus: string,
	leadScore?: number,
	lastActivity?: Date
): FollowUpSuggestion[] => {
	const suggestions: FollowUpSuggestion[] = []
	const daysSinceLastActivity = lastActivity
		? Math.floor(
				(Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
			)
		: 0

	// Check for recent communications
	const recentCalls = communicationHistory.filter(
		(item) => item.type === "call" && item.direction === "outgoing"
	)
	const recentEmails = communicationHistory.filter(
		(item) => item.type === "email" && item.direction === "outgoing"
	)

	// High priority suggestions based on lead status and activity
	if (leadStatus === "qualified" && daysSinceLastActivity > 3) {
		suggestions.push({
			id: "qualified-follow-up",
			type: "call",
			priority: "high",
			title: "Qualified Lead Follow-up Call",
			description:
				"Schedule a follow-up call to move this qualified lead forward",
			reasoning: "Lead is qualified but hasn't been contacted in 3+ days",
			suggestedTiming: "Within 24 hours"
		})
	}

	if (leadStatus === "new" && communicationHistory.length === 0) {
		suggestions.push({
			id: "initial-contact",
			type: "call",
			priority: "high",
			title: "Initial Contact Call",
			description: "Make first contact with this new lead",
			reasoning: "New lead with no communication history",
			suggestedTiming: "Within 2 hours"
		})
	}

	// Medium priority suggestions based on communication patterns
	if (recentCalls.length > 0 && recentEmails.length === 0) {
		suggestions.push({
			id: "email-follow-up",
			type: "email",
			priority: "medium",
			title: "Email Follow-up",
			description:
				"Send follow-up email with call summary and next steps",
			reasoning: "Recent calls but no email follow-up",
			suggestedTiming: "Within 6 hours of last call"
		})
	}

	if (leadScore && leadScore > 70 && daysSinceLastActivity > 7) {
		suggestions.push({
			id: "high-score-reengagement",
			type: "appointment",
			priority: "medium",
			title: "Schedule Demo/Meeting",
			description:
				"High-scoring lead - schedule a product demo or meeting",
			reasoning: "High lead score but no recent activity",
			suggestedTiming: "This week"
		})
	}

	// Low priority suggestions for nurturing
	if (leadStatus === "contacted" && daysSinceLastActivity > 14) {
		suggestions.push({
			id: "nurture-sequence",
			type: "email",
			priority: "low",
			title: "Nurture Email",
			description: "Send valuable content to stay top-of-mind",
			reasoning: "Lead contacted but needs nurturing",
			suggestedTiming: "This week"
		})
	}

	// Text message suggestions for urgent follow-ups
	if (
		recentCalls.length > 2 &&
		!recentCalls.some((c) => c.status === "completed")
	) {
		suggestions.push({
			id: "text-alternative",
			type: "text",
			priority: "medium",
			title: "Text Message Follow-up",
			description: "Try text message since calls haven't connected",
			reasoning: "Multiple unanswered calls",
			suggestedTiming: "Today"
		})
	}

	return suggestions.slice(0, 3) // Limit to top 3 suggestions
}

export function FollowUpSuggestions({
	leadId,
	leadStatus,
	leadScore,
	lastActivity,
	onCallSuggestion,
	onEmailSuggestion,
	onTextSuggestion,
	onAppointmentSuggestion
}: FollowUpSuggestionsProps) {
	const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const fetchSuggestions = async () => {
			try {
				setLoading(true)
				const result = await getCommunicationLogs(leadId)
				if (result.success) {
					const generatedSuggestions = generateSuggestions(
						result.data,
						leadStatus,
						leadScore,
						lastActivity
					)

					// Add action handlers
					const suggestionsWithActions = generatedSuggestions.map(
						(suggestion) => ({
							...suggestion,
							action: () => {
								switch (suggestion.type) {
									case "call":
										onCallSuggestion()
										break
									case "email":
										onEmailSuggestion()
										break
									case "text":
										onTextSuggestion()
										break
									case "appointment":
										onAppointmentSuggestion()
										break
								}
							}
						})
					)

					setSuggestions(suggestionsWithActions)
				}
			} catch (error) {
				console.error("Error generating suggestions:", error)
				setSuggestions([])
			} finally {
				setLoading(false)
			}
		}

		fetchSuggestions()
	}, [
		leadId,
		leadStatus,
		leadScore,
		lastActivity,
		onCallSuggestion,
		onEmailSuggestion,
		onTextSuggestion,
		onAppointmentSuggestion
	])

	if (loading) {
		return (
			<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="text-lg font-medium flex items-center gap-2">
						<BrainIcon className="h-5 w-5" />
						Follow-up Suggestions
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</CardContent>
			</Card>
		)
	}

	if (suggestions.length === 0) {
		return (
			<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="text-lg font-medium flex items-center gap-2">
						<BrainIcon className="h-5 w-5" />
						Follow-up Suggestions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4">
						<div className="rounded-full p-3 border border-border/40 shadow-sm bg-card/30 w-fit mx-auto mb-3">
							<TrendingUpIcon className="h-6 w-6 text-muted-foreground" />
						</div>
						<h3 className="text-sm font-medium">All caught up!</h3>
						<p className="text-xs text-muted-foreground mt-1">
							No immediate follow-up actions needed for this lead.
						</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-3">
				<CardTitle className="text-lg font-medium flex items-center gap-2">
					<BrainIcon className="h-5 w-5" />
					AI Follow-up Suggestions
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{suggestions.map((suggestion) => {
					const Icon = getActionIcon(suggestion.type)
					return (
						<div
							key={suggestion.id}
							className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
						>
							<div className="flex items-start justify-between mb-2">
								<div className="flex items-center gap-2">
									<Icon className="h-4 w-4 text-muted-foreground" />
									<h4 className="font-medium text-sm">
										{suggestion.title}
									</h4>
								</div>
								<Badge
									className={`px-2 py-1 text-xs ${getPriorityColor(suggestion.priority)}`}
								>
									{suggestion.priority.toUpperCase()}
								</Badge>
							</div>

							<p className="text-sm text-muted-foreground mb-2">
								{suggestion.description}
							</p>

							<div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
								<ClockIcon className="h-3 w-3" />
								<span>{suggestion.suggestedTiming}</span>
							</div>

							<div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/20 rounded">
								<strong>Why:</strong> {suggestion.reasoning}
							</div>

							<Button
								size="sm"
								variant="outline"
								onClick={suggestion.action}
								className="w-full text-xs rounded-lg"
							>
								Take Action
							</Button>
						</div>
					)
				})}
			</CardContent>
		</Card>
	)
}
