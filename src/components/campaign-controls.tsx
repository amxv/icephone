"use client"

import {
	startCampaign,
	pauseCampaign,
	resumeCampaign,
	stopCampaign,
	getCampaignExecutionStatus,
	scheduleCampaign,
	triggerCampaignProcessing,
	updateCampaign
} from "@/actions/campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { useCallback, useEffect, useState } from "react"
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
	campaignSettings?: Record<string, unknown> | null
}

type CampaignSettings = NonNullable<
	Parameters<typeof updateCampaign>[1]["campaignSettings"]
>

export function CampaignControls({
	campaignId,
	onStatusChange
}: CampaignControlsProps) {
	const [campaign, setCampaign] = useState<CampaignInfo | null>(null)
	const [loading, setLoading] = useState(true)
	const [actionLoading, setActionLoading] = useState(false)
	const [scheduleLoading, setScheduleLoading] = useState(false)
	const [processLoading, setProcessLoading] = useState(false)
	const [settingsLoading, setSettingsLoading] = useState(false)
	const [scheduledStart, setScheduledStart] = useState("")
	const [maxCallsPerDay, setMaxCallsPerDay] = useState("")
	const [callInterval, setCallInterval] = useState("")
	const [maxAttempts, setMaxAttempts] = useState("")
	const [targetLeads, setTargetLeads] = useState("")

	const toDateTimeLocalValue = useCallback((value: Date | string | null) => {
		if (!value) return ""
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return ""
		const localDate = new Date(
			date.getTime() - date.getTimezoneOffset() * 60 * 1000
		)
		return localDate.toISOString().slice(0, 16)
	}, [])

	const loadAdvancedSettings = useCallback((campaignInfo: CampaignInfo) => {
		const settings = (campaignInfo.campaignSettings || {}) as {
			callTiming?: { maxCallsPerDay?: number; callInterval?: number }
			retryLogic?: { maxAttempts?: number }
			goals?: { targetLeads?: number }
		}

		setMaxCallsPerDay(
			typeof settings.callTiming?.maxCallsPerDay === "number"
				? String(settings.callTiming.maxCallsPerDay)
				: ""
		)
		setCallInterval(
			typeof settings.callTiming?.callInterval === "number"
				? String(settings.callTiming.callInterval)
				: ""
		)
		setMaxAttempts(
			typeof settings.retryLogic?.maxAttempts === "number"
				? String(settings.retryLogic.maxAttempts)
				: ""
		)
		setTargetLeads(
			typeof settings.goals?.targetLeads === "number"
				? String(settings.goals.targetLeads)
				: ""
		)
	}, [])

	useEffect(() => {
		const fetchCampaignInfo = async () => {
			try {
				const result = await getCampaignExecutionStatus(
					parseInt(campaignId)
				)
				if (result.success && result.data) {
					setCampaign(result.data.campaign)
					setScheduledStart(
						toDateTimeLocalValue(result.data.campaign.startDate)
					)
					loadAdvancedSettings(result.data.campaign)
				}
			} catch (error) {
				console.error("Error fetching campaign info:", error)
			} finally {
				setLoading(false)
			}
		}

		fetchCampaignInfo()
	}, [campaignId, loadAdvancedSettings, toDateTimeLocalValue])

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
					setScheduledStart(
						toDateTimeLocalValue(
							refreshResult.data.campaign.startDate
						)
					)
					loadAdvancedSettings(refreshResult.data.campaign)
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

	const handleScheduleCampaign = async () => {
		if (!campaign) return
		if (!scheduledStart) {
			toast.error("Pick a schedule time first")
			return
		}

		const startTime = new Date(scheduledStart)
		if (Number.isNaN(startTime.getTime())) {
			toast.error("Invalid schedule time")
			return
		}

		setScheduleLoading(true)
		try {
			const result = await scheduleCampaign(campaign.id, startTime)
			if (!result.success) {
				toast.error(result.error || "Failed to schedule campaign")
				return
			}

			toast.success("Campaign scheduled")
			const refreshResult = await getCampaignExecutionStatus(
				parseInt(campaignId)
			)
			if (refreshResult.success && refreshResult.data) {
				setCampaign(refreshResult.data.campaign)
				setScheduledStart(
					toDateTimeLocalValue(refreshResult.data.campaign.startDate)
				)
				loadAdvancedSettings(refreshResult.data.campaign)
			}
			onStatusChange?.()
		} catch (error) {
			console.error("Error scheduling campaign:", error)
			toast.error("Failed to schedule campaign")
		} finally {
			setScheduleLoading(false)
		}
	}

	const handleProcessNow = async () => {
		if (!campaign) return
		setProcessLoading(true)
		try {
			const result = await triggerCampaignProcessing(campaign.id)
			if (!result.success) {
				toast.error(result.error || "Failed to process campaign queue")
				return
			}
			toast.success("Campaign queue processing triggered")
			onStatusChange?.()
		} catch (error) {
			console.error("Error triggering campaign processing:", error)
			toast.error("Failed to trigger campaign processing")
		} finally {
			setProcessLoading(false)
		}
	}

	const handleSaveAdvancedSettings = async () => {
		if (!campaign) return
		setSettingsLoading(true)
		try {
			const currentSettings = (campaign.campaignSettings ||
				{}) as Partial<CampaignSettings>
			const callTiming = currentSettings.callTiming || {}
			const retryLogic = currentSettings.retryLogic
			const goals = currentSettings.goals || {}

			const parsedMaxAttempts =
				maxAttempts.trim().length > 0 ? Number(maxAttempts) : undefined
			const nextRetryLogic: CampaignSettings["retryLogic"] =
				parsedMaxAttempts !== undefined || retryLogic
					? {
							maxAttempts:
								parsedMaxAttempts ??
								(typeof retryLogic?.maxAttempts === "number"
									? retryLogic.maxAttempts
									: 1),
							retryIntervals: Array.isArray(
								retryLogic?.retryIntervals
							)
								? retryLogic.retryIntervals.filter(
										(value): value is number =>
											typeof value === "number" &&
											Number.isFinite(value)
									)
								: [],
							retryConditions: Array.isArray(
								retryLogic?.retryConditions
							)
								? retryLogic.retryConditions.filter(
										(value): value is string =>
											typeof value === "string"
									)
								: []
						}
					: undefined

			const nextSettings: CampaignSettings = {
				...currentSettings,
				callTiming: {
					...callTiming,
					maxCallsPerDay:
						maxCallsPerDay.trim().length > 0
							? Number(maxCallsPerDay)
							: undefined,
					callInterval:
						callInterval.trim().length > 0
							? Number(callInterval)
							: undefined
				},
				retryLogic: nextRetryLogic,
				goals: {
					...goals,
					targetLeads:
						targetLeads.trim().length > 0
							? Number(targetLeads)
							: undefined
				}
			}

			const result = await updateCampaign(campaign.id, {
				campaignSettings: nextSettings
			})
			if (!result.success) {
				toast.error(result.error || "Failed to save campaign settings")
				return
			}

			toast.success("Campaign settings saved")
			const refreshResult = await getCampaignExecutionStatus(
				parseInt(campaignId)
			)
			if (refreshResult.success && refreshResult.data) {
				setCampaign(refreshResult.data.campaign)
				loadAdvancedSettings(refreshResult.data.campaign)
			}
		} catch (error) {
			console.error("Error saving campaign settings:", error)
			toast.error("Failed to save campaign settings")
		} finally {
			setSettingsLoading(false)
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
	const canSchedule =
		campaign?.status !== "completed" &&
		campaign?.status !== "cancelled" &&
		campaign?.status !== "archived"
	const canProcessNow =
		campaign?.status === "running" ||
		campaign?.status === "paused" ||
		campaign?.status === "scheduled"

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
				<div className="flex items-center justify-between gap-3">
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

				<div className="mt-4 pt-4 border-t border-border/50 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
					<div className="space-y-1 w-full lg:max-w-sm">
						<label
							htmlFor="campaign-schedule-start"
							className="text-xs font-medium text-muted-foreground"
						>
							Schedule Start
						</label>
						<Input
							id="campaign-schedule-start"
							type="datetime-local"
							value={scheduledStart}
							onChange={(event) =>
								setScheduledStart(event.target.value)
							}
							disabled={!canSchedule || scheduleLoading}
						/>
					</div>
					<div className="flex gap-2 w-full lg:w-auto">
						<Button
							variant="outline"
							onClick={handleScheduleCampaign}
							disabled={!canSchedule || scheduleLoading}
							className="w-full lg:w-auto"
						>
							{scheduleLoading ? "Scheduling..." : "Schedule"}
						</Button>
						<Button
							variant="outline"
							onClick={handleProcessNow}
							disabled={!canProcessNow || processLoading}
							className="w-full lg:w-auto"
						>
							{processLoading ? "Processing..." : "Process Now"}
						</Button>
					</div>
				</div>

				<div className="mt-4 pt-4 border-t border-border/50 space-y-3">
					<p className="text-xs font-medium text-muted-foreground">
						Advanced Campaign Settings
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
						<div className="space-y-1">
							<label
								htmlFor="campaign-max-calls-per-day"
								className="text-xs text-muted-foreground"
							>
								Max Calls / Day
							</label>
							<Input
								id="campaign-max-calls-per-day"
								type="number"
								min={1}
								value={maxCallsPerDay}
								onChange={(event) =>
									setMaxCallsPerDay(event.target.value)
								}
							/>
						</div>
						<div className="space-y-1">
							<label
								htmlFor="campaign-call-interval"
								className="text-xs text-muted-foreground"
							>
								Call Interval (min)
							</label>
							<Input
								id="campaign-call-interval"
								type="number"
								min={1}
								value={callInterval}
								onChange={(event) =>
									setCallInterval(event.target.value)
								}
							/>
						</div>
						<div className="space-y-1">
							<label
								htmlFor="campaign-max-retry-attempts"
								className="text-xs text-muted-foreground"
							>
								Max Retry Attempts
							</label>
							<Input
								id="campaign-max-retry-attempts"
								type="number"
								min={1}
								value={maxAttempts}
								onChange={(event) =>
									setMaxAttempts(event.target.value)
								}
							/>
						</div>
						<div className="space-y-1">
							<label
								htmlFor="campaign-target-leads"
								className="text-xs text-muted-foreground"
							>
								Target Leads
							</label>
							<Input
								id="campaign-target-leads"
								type="number"
								min={1}
								value={targetLeads}
								onChange={(event) =>
									setTargetLeads(event.target.value)
								}
							/>
						</div>
					</div>
					<div className="flex justify-end">
						<Button
							variant="outline"
							onClick={handleSaveAdvancedSettings}
							disabled={settingsLoading}
						>
							{settingsLoading ? "Saving..." : "Save Settings"}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
