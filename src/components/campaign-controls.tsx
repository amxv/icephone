"use client"

import {
	startCampaign,
	pauseCampaign,
	resumeCampaign,
	stopCampaign,
	getCampaignExecutionStatus
} from "@/actions/campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import {
	PlayIcon,
	PauseIcon,
	Square as StopIcon,
	ClockIcon,
	CheckCircleIcon,
	XCircleIcon,
	AlertCircleIcon
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface CampaignControlsProps {
	campaignId: string
	onStatusChange?: () => void
}

type CampaignStatus =
	| "draft"
	| "scheduled"
	| "running"
	| "paused"
	| "completed"
	| "cancelled"
	| "archived"

interface CampaignInfo {
	id: number
	name: string
	status: CampaignStatus | null
	startDate: Date | null
	endDate: Date | null
}

export function CampaignControls({
	campaignId,
	onStatusChange
}: CampaignControlsProps) {
	const [campaign, setCampaign] = useState<CampaignInfo | null>(null)
	const [loading, setLoading] = useState(true)
	const [actionLoading, setActionLoading] = useState(false)

	useEffect(() => {
		const fetchCampaignInfo = async () => {
			try {
				const result = await getCampaignExecutionStatus(
					parseInt(campaignId)
				)
				if (result.success && result.data) {
					setCampaign(result.data.campaign)
				}
			} catch (error) {
				console.error("Error fetching campaign info:", error)
			} finally {
				setLoading(false)
			}
		}

		fetchCampaignInfo()
	}, [campaignId])

	const handleCampaignAction = async (
		action: "start" | "pause" | "resume" | "stop"
	) => {
		if (!campaign) return

		setActionLoading(true)
		try {
			let result: {
				success: boolean
				error?: string | null
				data?: unknown
			}
			let actionText = ""

			switch (action) {
				case "start":
					result = await startCampaign(campaign.id)
					actionText = "start"
					break
				case "pause":
					result = await pauseCampaign(campaign.id)
					actionText = "pause"
					break
				case "resume":
					result = await resumeCampaign(campaign.id)
					actionText = "resume"
					break
				case "stop":
					result = await stopCampaign(campaign.id)
					actionText = "stop"
					break
			}

			if (result.success) {
				toast.success(`Campaign ${actionText}ed successfully`)
				// Refresh campaign info
				const refreshResult = await getCampaignExecutionStatus(
					parseInt(campaignId)
				)
				if (refreshResult.success && refreshResult.data) {
					setCampaign(refreshResult.data.campaign)
				}
				onStatusChange?.()
			} else {
				toast.error(result.error || `Failed to ${actionText} campaign`)
			}
		} catch (error) {
			console.error(`Error ${action}ing campaign:`, error)
			toast.error(`Failed to ${action} campaign`)
		} finally {
			setActionLoading(false)
		}
	}

	const getStatusConfig = (status: CampaignStatus | null) => {
		switch (status) {
			case "draft":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-gray-100 text-gray-800"
						>
							Draft
						</Badge>
					),
					icon: <ClockIcon className="h-4 w-4 text-gray-500" />
				}
			case "scheduled":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-blue-100 text-blue-800"
						>
							Scheduled
						</Badge>
					),
					icon: <ClockIcon className="h-4 w-4 text-blue-500" />
				}
			case "running":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-green-100 text-green-800"
						>
							Running
						</Badge>
					),
					icon: <PlayIcon className="h-4 w-4 text-green-500" />
				}
			case "paused":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-yellow-100 text-yellow-800"
						>
							Paused
						</Badge>
					),
					icon: <PauseIcon className="h-4 w-4 text-yellow-500" />
				}
			case "completed":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-emerald-100 text-emerald-800"
						>
							Completed
						</Badge>
					),
					icon: (
						<CheckCircleIcon className="h-4 w-4 text-emerald-500" />
					)
				}
			case "cancelled":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-red-100 text-red-800"
						>
							Cancelled
						</Badge>
					),
					icon: <XCircleIcon className="h-4 w-4 text-red-500" />
				}
			case "archived":
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-slate-100 text-slate-800"
						>
							Archived
						</Badge>
					),
					icon: <AlertCircleIcon className="h-4 w-4 text-slate-500" />
				}
			default:
				return {
					badge: (
						<Badge
							variant="outline"
							className="bg-gray-100 text-gray-800"
						>
							Unknown
						</Badge>
					),
					icon: <AlertCircleIcon className="h-4 w-4 text-gray-500" />
				}
		}
	}

	const canStart =
		campaign?.status === "draft" || campaign?.status === "scheduled"
	const canPause = campaign?.status === "running"
	const canResume = campaign?.status === "paused"
	const canStop =
		campaign?.status === "running" || campaign?.status === "paused"

	if (loading) {
		return (
			<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="h-4 w-4 bg-gray-300 animate-pulse rounded" />
							<div className="h-6 w-20 bg-gray-300 animate-pulse rounded" />
						</div>
						<div className="flex gap-2">
							<div className="h-8 w-16 bg-gray-300 animate-pulse rounded" />
							<div className="h-8 w-16 bg-gray-300 animate-pulse rounded" />
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!campaign) {
		return (
			<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-4">
					<div className="text-center text-muted-foreground">
						Campaign not found
					</div>
				</CardContent>
			</Card>
		)
	}

	const statusConfig = getStatusConfig(campaign.status)

	return (
		<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardContent className="p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{statusConfig.icon}
						{statusConfig.badge}
						<span className="text-sm text-muted-foreground">
							{campaign.name}
						</span>
					</div>

					<div className="flex gap-2">
						{canStart && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleCampaignAction("start")}
								disabled={actionLoading}
								className="gap-1 text-green-700 hover:text-green-800 hover:bg-green-50"
							>
								<PlayIcon className="h-3 w-3" />
								Start
							</Button>
						)}

						{canPause && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleCampaignAction("pause")}
								disabled={actionLoading}
								className="gap-1 text-yellow-700 hover:text-yellow-800 hover:bg-yellow-50"
							>
								<PauseIcon className="h-3 w-3" />
								Pause
							</Button>
						)}

						{canResume && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleCampaignAction("resume")}
								disabled={actionLoading}
								className="gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
							>
								<PlayIcon className="h-3 w-3" />
								Resume
							</Button>
						)}

						{canStop && (
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										disabled={actionLoading}
										className="gap-1 text-red-700 hover:text-red-800 hover:bg-red-50"
									>
										<StopIcon className="h-3 w-3" />
										Stop
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent className="rounded-2xl">
									<AlertDialogHeader>
										<AlertDialogTitle>
											Stop Campaign
										</AlertDialogTitle>
										<AlertDialogDescription>
											Are you sure you want to stop this
											campaign? This will cancel all
											queued calls and mark the campaign
											as completed.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											Cancel
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() =>
												handleCampaignAction("stop")
											}
											className="bg-red-500 hover:bg-red-600"
										>
											Stop Campaign
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
