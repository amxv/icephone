"use client"

import { SimpleAgentCreator } from "@/components/simple-agent-creator"
import { EssentialSettings } from "@/components/essential-settings"
import { VoiceAgentTestCall } from "@/components/voice-agent-test-call"
import { updateVoiceAgentStatus } from "@/actions/voice-agents"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import type {
	VoiceAgent,
	VoiceAgentStatus
} from "@/types"
import {
	BotIcon,
	InfoIcon,
	PlusIcon,
	SettingsIcon,
	VolumeXIcon,
	MessageSquareIcon,
	UserIcon,
	CalendarIcon,
	BarChartIcon,
	EditIcon
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

// Helper function to get role display information
function getRoleInfo(prompt: string) {
	const promptLower = prompt.toLowerCase()

	if (
		promptLower.includes("customer service") ||
		promptLower.includes("support")
	) {
		return {
			role: "Customer Service",
			icon: MessageSquareIcon,
			color: "from-blue-500 to-blue-500/60",
			description: "Handles customer inquiries and support"
		}
	}

	if (promptLower.includes("sales") || promptLower.includes("selling")) {
		return {
			role: "Sales Representative",
			icon: UserIcon,
			color: "from-emerald-500 to-emerald-500/60",
			description: "Qualifies leads and closes deals"
		}
	}

	if (
		promptLower.includes("appointment") ||
		promptLower.includes("schedule")
	) {
		return {
			role: "Appointment Setter",
			icon: CalendarIcon,
			color: "from-violet-500 to-violet-500/60",
			description: "Schedules meetings and appointments"
		}
	}

	// Default fallback
	return {
		role: "Voice Assistant",
		icon: BotIcon,
		color: "from-primary to-primary/60",
		description: "AI-powered voice assistant"
	}
}

// Helper function to get voice display name from technical details
function getVoiceDisplayName(
	voice: { provider?: string; voice_id?: string } | null | undefined
) {
	if (!voice || !voice.voice_id) return "Standard Voice"

	// Map common ElevenLabs voice IDs to business-friendly names
	const voiceMap: Record<string, string> = {
		"21m00Tcm4TlvDq8ikWAM": "Professional",
		AZnzlk1XvdvUeBnXmlld: "Warm",
		EXAVITQu4vr4xnSDxMaL: "Friendly",
		ErXwobaYiN019PkySvjV: "Confident",
		MF3mGyEYCl7XYWbV9V6O: "Energetic",
		TxGEqnHWrfWFTfGW9XjX: "Professional",
		VR6AewLTigWG4xSOukaG: "Authoritative",
		pNInz6obpgDQGcFmaJgB: "Clear"
	}

	return voiceMap[voice.voice_id] || "Professional"
}

// Page header component with gradient title
function PageHeader({ onAgentCreated }: { onAgentCreated: () => void }) {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Voice Agents
				</h1>
			</div>
			<SimpleAgentCreator onAgentCreated={onAgentCreated} />
		</div>
	)
}

// Business-focused voice agent display card
function VoiceAgentCard({
	agent,
	onAgentUpdated
}: {
	agent: VoiceAgent
	onAgentUpdated?: () => void
}) {
	const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false)
	const [selectedStatus, setSelectedStatus] =
		useState<VoiceAgentStatus>("active")
	const [isUpdating, setIsUpdating] = useState(false)

	const roleInfo = getRoleInfo(agent.prompt || "")
	const voiceDisplayName = getVoiceDisplayName(agent.voice)

	const statusConfig = {
		active: {
			color: "bg-green-100 text-green-800 border-green-200",
			label: "Active",
			icon: BotIcon
		},
		inactive: {
			color: "bg-gray-100 text-gray-800 border-gray-200",
			label: "Inactive",
			icon: VolumeXIcon
		},
		training: {
			color: "bg-yellow-100 text-yellow-800 border-yellow-200",
			label: "Training",
			icon: SettingsIcon
		},
		error: {
			color: "bg-red-100 text-red-800 border-red-200",
			label: "Error",
			icon: VolumeXIcon
		}
	}

	const config =
		statusConfig[agent.status || "inactive"] || statusConfig.inactive
	const StatusIcon = config.icon
	const RoleIcon = roleInfo.icon

	const handleStatusChange = async () => {
		setIsUpdating(true)
		try {
			const result = await updateVoiceAgentStatus(
				agent.id,
				selectedStatus
			)

			if (result.success) {
				toast.success(`Agent status updated to ${selectedStatus}`)
				setIsStatusChangeOpen(false)
				onAgentUpdated?.()
			} else {
				toast.error(result.error || "Failed to update agent status")
			}
		} catch (error) {
			console.error("Error updating agent status:", error)
			toast.error("Failed to update agent status")
		} finally {
			setIsUpdating(false)
		}
	}

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm hover:bg-primary/5 transition">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div
							className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${roleInfo.color} flex items-center justify-center`}
						>
							<RoleIcon className="h-6 w-6 text-white" />
						</div>
						<div>
							<CardTitle className="text-lg">
								{agent.name}
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								{roleInfo.role}
							</p>
							{agent.description && (
								<p className="text-xs text-muted-foreground mt-1">
									{roleInfo.description}
								</p>
							)}
						</div>
					</div>
					<div className="flex gap-2">
						<Dialog
							open={isStatusChangeOpen}
							onOpenChange={setIsStatusChangeOpen}
						>
							<DialogTrigger asChild>
								<Badge
									variant="outline"
									className={`px-3 py-1 cursor-pointer hover:bg-primary/10 ${config.color}`}
									onClick={() => {
										setSelectedStatus(
											agent.status || "inactive"
										)
										setIsStatusChangeOpen(true)
									}}
								>
									{config.label}
									<EditIcon className="h-3 w-3 ml-1" />
								</Badge>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md p-6 border border-border bg-white shadow-lg rounded-3xl">
								<DialogHeader className="pb-4">
									<DialogTitle className="text-2xl font-medium tracking-tight">
										Change Agent Status
									</DialogTitle>
									<DialogDescription className="text-muted-foreground">
										Update the status of {agent.name}
									</DialogDescription>
								</DialogHeader>

								<div className="pt-2">
									<Label className="text-sm font-medium">
										Select Status
									</Label>
									<Select
										value={selectedStatus}
										onValueChange={(value) =>
											setSelectedStatus(
												value as VoiceAgentStatus
											)
										}
									>
										<SelectTrigger className="rounded-lg mt-1.5">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="active">
												<div className="flex items-center gap-2">
													<BotIcon className="h-4 w-4" />
													<span>Active</span>
												</div>
											</SelectItem>
											<SelectItem value="inactive">
												<div className="flex items-center gap-2">
													<VolumeXIcon className="h-4 w-4" />
													<span>Inactive</span>
												</div>
											</SelectItem>
											<SelectItem value="training">
												<div className="flex items-center gap-2">
													<SettingsIcon className="h-4 w-4" />
													<span>Training</span>
												</div>
											</SelectItem>
											<SelectItem value="error">
												<div className="flex items-center gap-2">
													<VolumeXIcon className="h-4 w-4" />
													<span>Error</span>
												</div>
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<DialogFooter className="mt-6">
									<Button
										variant="outline"
										onClick={() =>
											setIsStatusChangeOpen(false)
										}
										className="rounded-lg"
									>
										Cancel
									</Button>
									<Button
										onClick={handleStatusChange}
										disabled={
											isUpdating ||
											selectedStatus === agent.status
										}
										className="bg-primary hover:bg-primary/90 rounded-lg"
									>
										{isUpdating
											? "Updating..."
											: "Update Status"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* Voice Configuration - Business Friendly */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<VolumeXIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">Voice</span>
						</div>
						<div className="text-sm text-muted-foreground">
							{voiceDisplayName} •{" "}
							{agent.language === "en"
								? "English"
								: agent.language?.toUpperCase() || "English"}
						</div>
					</div>

					{/* Performance Metrics (placeholder for future implementation) */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<BarChartIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">
								Performance
							</span>
						</div>
						<div className="text-sm text-muted-foreground">
							0 calls handled
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-2 pt-2">
						<EssentialSettings
							agent={agent}
							onSettingsUpdated={onAgentUpdated}
							trigger={
								<Button
									variant="outline"
									size="sm"
									className="flex-1 rounded-2xl"
								>
									<SettingsIcon className="h-4 w-4 mr-2" />
									Settings
								</Button>
							}
						/>
						<VoiceAgentTestCall
							agentId={agent.id}
							agentName={agent.name}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Voice agents list section
function VoiceAgentsSection({
	agents,
	isLoading = false,
	onAgentUpdated
}: {
	agents: VoiceAgent[]
	isLoading?: boolean
	onAgentUpdated?: () => void
}) {
	if (isLoading) {
		return (
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle>Voice Agents</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="space-y-3">
								<Skeleton className="h-32 w-full rounded-3xl" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between mb-4">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
						</TooltipTrigger>
						<TooltipContent>
							<p className="max-w-xs">
								Voice agents are AI-powered assistants that can
								handle inbound calls and make outbound calls on
								your behalf.
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			{agents.length > 0 ? (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{agents.map((agent) => (
						<VoiceAgentCard
							key={agent.id}
							agent={agent}
							onAgentUpdated={onAgentUpdated}
						/>
					))}
				</div>
			) : (
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent>
						<div className="flex flex-col items-center justify-center py-8 text-center h-40">
							<div className="rounded-full p-3 border border-border/40 shadow-sm">
								<BotIcon className="h-6 w-6 text-muted-foreground" />
							</div>
							<h3 className="mt-3 text-sm font-medium">
								No Voice Agents
							</h3>
							<p className="mt-1 text-xs text-muted-foreground max-w-xs">
								Create your first AI voice agent to start
								handling calls
							</p>
							<SimpleAgentCreator
								onAgentCreated={() => window.location.reload()}
								trigger={
									<Button
										className="mt-3"
										size="sm"
										variant="outline"
									>
										<PlusIcon className="mr-1 h-3 w-3" />
										Create Your First Agent
									</Button>
								}
							/>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

// Main client component
export function VoiceAgentsPageClient({
	initialVoiceAgents
}: {
	initialVoiceAgents: {
		data: VoiceAgent[] | null
		success: boolean
		error: string | null
	}
}) {
	const [isLoading, setIsLoading] = useState(false)
	const [agents, setAgents] = useState(initialVoiceAgents.data || [])

	const handleAgentCreated = () => {
		// Refresh the page to get the updated list
		window.location.reload()
	}

	return (
		<div className="space-y-6">
			<PageHeader
				onAgentCreated={handleAgentCreated}
			/>

			{!initialVoiceAgents.success ? (
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="text-center py-12">
						<p className="text-destructive">
							Failed to load voice agents:{" "}
							{initialVoiceAgents.error}
						</p>
					</CardContent>
				</Card>
			) : (
				<VoiceAgentsSection
					agents={agents}
					isLoading={isLoading}
					onAgentUpdated={handleAgentCreated}
				/>
			)}
		</div>
	)
}
