"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import type { PhoneNumber, VoiceAgent } from "@/types"
import {
	PhoneIcon,
	BotIcon,
	RefreshCwIcon,
	CheckCircleIcon,
	ClockIcon,
	AlertCircleIcon
} from "lucide-react"
import { useState, useTransition } from "react"

/**
 * Customer-friendly status indicator that hides provider details
 */
export function CustomerStatusIndicator({
	phoneNumber
}: { phoneNumber: PhoneNumber }) {
	let statusConfig = {
		icon: CheckCircleIcon,
		label: "Connected",
		description: "Ready to receive calls",
		color: "bg-green-100 text-green-800 hover:bg-green-100"
	}

	// Simplified status mapping for customers
	if (phoneNumber.status === "pending") {
		statusConfig = {
			icon: ClockIcon,
			label: "Setting Up",
			description: "Phone number is being configured",
			color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
		}
	} else if (
		phoneNumber.status === "suspended" ||
		phoneNumber.status === "inactive"
	) {
		statusConfig = {
			icon: AlertCircleIcon,
			label: "Issue",
			description: "Please contact support for assistance",
			color: "bg-red-100 text-red-800 hover:bg-red-100"
		}
	}

	const IconComponent = statusConfig.icon

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant="outline"
						className={`gap-1 px-3 py-1 ${statusConfig.color}`}
					>
						<IconComponent className="h-3 w-3" />
						{statusConfig.label}
					</Badge>
				</TooltipTrigger>
				<TooltipContent>
					<p>{statusConfig.description}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

/**
 * Customer-friendly actions for phone numbers
 */
export function CustomerPhoneActions({
	phoneNumber
}: { phoneNumber: PhoneNumber }) {
	const [isPending, startTransition] = useTransition()
	const [isRefreshing, setIsRefreshing] = useState(false)

	const handleRefresh = () => {
		setIsRefreshing(true)
		startTransition(() => {
			// Simple refresh action for customers
			setTimeout(() => {
				setIsRefreshing(false)
				window.location.reload()
			}, 1000)
		})
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isPending || isRefreshing}
						className="gap-1 px-3 py-1.5 h-8 text-xs"
					>
						<RefreshCwIcon
							className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Refresh phone number status</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

/**
 * Customer-friendly agent assignment display
 */
export function CustomerAgentAssignment({
	phoneNumber,
	voiceAgents
}: {
	phoneNumber: PhoneNumber
	voiceAgents: VoiceAgent[]
}) {
	const assignedAgent = voiceAgents.find(
		(agent) => agent.phoneNumberId === phoneNumber.id
	)

	return (
		<div className="flex items-center gap-2">
			<BotIcon className="h-4 w-4 text-muted-foreground" />
			<span className="text-sm font-medium">Agent:</span>
			<div className="text-sm">
				{assignedAgent ? (
					<Badge
						variant="outline"
						className="gap-1 px-3 py-1 bg-green-50 text-green-700 border-green-200"
					>
						<BotIcon className="h-3 w-3" />
						{assignedAgent.name}
					</Badge>
				) : (
					<span className="text-muted-foreground">Unassigned</span>
				)}
			</div>
		</div>
	)
}

/**
 * Customer-friendly phone number display card
 */
export function CustomerPhoneNumberDisplay({
	phoneNumber,
	voiceAgents,
	onUpdate
}: {
	phoneNumber: PhoneNumber
	voiceAgents?: VoiceAgent[]
	onUpdate?: () => void
}) {
	const { number, friendlyName, isDefault } = phoneNumber

	return (
		<div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border/50 rounded-2xl bg-card/30 mb-3">
			<div className="flex items-center gap-3 mb-2 md:mb-0">
				<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
					<PhoneIcon className="h-5 w-5 text-primary" />
				</div>
				<div>
					<div className="font-medium">{number}</div>
					<div className="text-sm text-muted-foreground">
						{friendlyName}
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex gap-2">
						<CustomerStatusIndicator phoneNumber={phoneNumber} />
						{isDefault && (
							<Badge
								variant="outline"
								className="bg-blue-100 text-blue-800 border-blue-200"
							>
								Default
							</Badge>
						)}
					</div>
				</div>
			</div>

			{/* Voice Agent Assignment */}
			<div className="flex items-center gap-3 mb-2 md:mb-0">
				<CustomerAgentAssignment
					phoneNumber={phoneNumber}
					voiceAgents={voiceAgents || []}
				/>
			</div>

			<div className="flex gap-2 w-full md:w-auto items-center">
				<CustomerPhoneActions phoneNumber={phoneNumber} />
			</div>
		</div>
	)
}
