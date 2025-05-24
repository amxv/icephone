"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import { CALL_STATUS, useVapi } from "@/hooks/useVapi"
import {
	type Message,
	MessageTypeEnum,
	type TranscriptMessage,
	TranscriptMessageTypeEnum
} from "@/lib/types/conversation"
import { createVapiAssistant } from "@/lib/vapi-assistant"
import type { VoiceAgentWithPhoneNumber } from "@/types"
import {
	Activity,
	Circle,
	Clock,
	ExternalLink,
	Mic,
	MicOff,
	Phone,
	PhoneOff,
	Users,
	Volume2,
	VolumeX
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface VoiceCallState {
	status:
		| "idle"
		| "connecting"
		| "connected"
		| "speaking"
		| "listening"
		| "ended"
		| "error"
	duration: number
	isRecording: boolean
	isMuted: boolean
	volume: number
	latency?: number
}

interface VoiceCallWidgetProps {
	agent: VoiceAgentWithPhoneNumber
	onCallEnd?: (duration: number) => void
	onTranscript?: (text: string, isAgent: boolean) => void
	className?: string
}

export function VoiceCallWidget({
	agent,
	onCallEnd,
	onTranscript,
	className = ""
}: VoiceCallWidgetProps) {
	const [callState, setCallState] = useState<VoiceCallState>({
		status: "idle",
		duration: 0,
		isRecording: false,
		isMuted: false,
		volume: 0
	})

	const [currentTranscript, setCurrentTranscript] = useState("")
	const [agentResponse, setAgentResponse] = useState("")
	const [connectionQuality, setConnectionQuality] = useState<
		"excellent" | "good" | "poor"
	>("excellent")

	const intervalRef = useRef<NodeJS.Timeout | null>(null)
	const startTimeRef = useRef<number | null>(null)

	// Use Vapi hook
	const {
		callStatus,
		isSpeechActive,
		audioLevel,
		messages,
		activeTranscript,
		webCallUrl,
		start,
		stop,
		sendMessage,
		joinCall
	} = useVapi()

	// Convert Vapi status to our internal status
	useEffect(() => {
		switch (callStatus) {
			case CALL_STATUS.INACTIVE:
				if (
					callState.status !== "idle" &&
					callState.status !== "ended"
				) {
					setCallState((prev) => ({ ...prev, status: "ended" }))
				}
				break
			case CALL_STATUS.LOADING:
				setCallState((prev) => ({ ...prev, status: "connecting" }))
				break
			case CALL_STATUS.ACTIVE:
				if (callState.status === "connecting") {
					setCallState((prev) => ({ ...prev, status: "connected" }))
					startTimeRef.current = Date.now()
					startDurationTimer()
					toast.success("Connected to voice agent")
				}
				break
		}
	}, [callStatus, callState.status])

	// Handle speech activity
	useEffect(() => {
		if (callStatus === CALL_STATUS.ACTIVE) {
			if (isSpeechActive) {
				setCallState((prev) => ({ ...prev, status: "listening" }))
			} else {
				setCallState((prev) => ({ ...prev, status: "speaking" }))
			}
		}
	}, [isSpeechActive, callStatus])

	// Handle audio level for volume indicator
	useEffect(() => {
		const volumePercentage = Math.round(audioLevel * 100)
		setCallState((prev) => ({ ...prev, volume: volumePercentage }))
	}, [audioLevel])

	// Handle messages and transcripts
	useEffect(() => {
		// Handle active transcript (partial)
		if (activeTranscript?.transcript) {
			setCurrentTranscript(activeTranscript.transcript)
		}

		// Handle completed messages
		const latestMessage = messages[messages.length - 1]
		if (latestMessage) {
			if (latestMessage.type === MessageTypeEnum.TRANSCRIPT) {
				const transcriptMsg = latestMessage as TranscriptMessage
				if (
					transcriptMsg.transcriptType ===
					TranscriptMessageTypeEnum.FINAL
				) {
					if (transcriptMsg.role === "user") {
						setCurrentTranscript(transcriptMsg.transcript)
						onTranscript?.(transcriptMsg.transcript, false)
					} else if (transcriptMsg.role === "assistant") {
						setAgentResponse(transcriptMsg.transcript)
						onTranscript?.(transcriptMsg.transcript, true)
					}
				}
			}
		}
	}, [activeTranscript, messages, onTranscript])

	// Format call duration
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}:${secs.toString().padStart(2, "0")}`
	}

	// Get status configuration
	const getStatusConfig = () => {
		switch (callState.status) {
			case "idle":
				return {
					color: "bg-gray-100 text-gray-700",
					icon: Phone,
					label: "Ready to Call",
					description: "Click to start conversation"
				}
			case "connecting":
				return {
					color: "bg-yellow-100 text-yellow-700",
					icon: Circle,
					label: "Connecting...",
					description: "Establishing connection"
				}
			case "connected":
				return {
					color: "bg-green-100 text-green-700",
					icon: Phone,
					label: "Connected",
					description: "Call is active"
				}
			case "speaking":
				return {
					color: "bg-blue-100 text-blue-700",
					icon: Mic,
					label: "User Speaking",
					description: "You are talking"
				}
			case "listening":
				return {
					color: "bg-purple-100 text-purple-700",
					icon: Users,
					label: "Agent Speaking",
					description: "AI agent is responding"
				}
			case "ended":
				return {
					color: "bg-gray-100 text-gray-700",
					icon: PhoneOff,
					label: "Call Ended",
					description: "Conversation completed"
				}
			case "error":
				return {
					color: "bg-red-100 text-red-700",
					icon: PhoneOff,
					label: "Error",
					description: "Connection failed"
				}
		}
	}

	// Start voice call
	const startCall = async () => {
		try {
			setCallState((prev) => ({ ...prev, status: "connecting" }))

			// Request microphone permission
			await navigator.mediaDevices.getUserMedia({ audio: true })

			// Create Vapi assistant configuration from our agent data
			const vapiAssistant = createVapiAssistant(agent)

			// Start the call with Vapi
			await start(vapiAssistant)
		} catch (error) {
			console.error("Failed to start call:", error)
			setCallState((prev) => ({ ...prev, status: "error" }))

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error"

			if (
				errorMessage.includes("getUserMedia") ||
				errorMessage.includes("microphone")
			) {
				toast.error(
					"Microphone access denied. Please allow microphone permissions and try again."
				)
			} else if (
				errorMessage.includes("WebSocket") ||
				errorMessage.includes("connection")
			) {
				toast.error(
					"Failed to connect to voice service. Please check your internet connection."
				)
			} else if (errorMessage.includes("VAPI")) {
				toast.error(
					"Voice service configuration error. Please contact support."
				)
			} else {
				toast.error(`Voice call failed: ${errorMessage}`)
			}
		}
	}

	// End voice call
	const endCall = () => {
		stop()
		stopDurationTimer()

		const finalDuration = callState.duration
		setCallState((prev) => ({
			...prev,
			status: "ended",
			isRecording: false
		}))

		onCallEnd?.(finalDuration)
		toast.success(`Call ended. Duration: ${formatDuration(finalDuration)}`)
	}

	// Toggle mute (placeholder - Vapi doesn't expose mute functionality directly)
	const toggleMute = () => {
		const newMutedState = !callState.isMuted
		setCallState((prev) => ({ ...prev, isMuted: newMutedState }))

		// Note: Vapi doesn't currently support mute functionality
		// This is a UI state change only
		toast.info(
			newMutedState
				? "Microphone muted (UI only - feature coming soon)"
				: "Microphone unmuted"
		)
	}

	// Start duration timer
	const startDurationTimer = () => {
		intervalRef.current = setInterval(() => {
			if (startTimeRef.current) {
				const elapsed = Math.floor(
					(Date.now() - startTimeRef.current) / 1000
				)
				setCallState((prev) => ({ ...prev, duration: elapsed }))
			}
		}, 1000)
	}

	// Stop duration timer
	const stopDurationTimer = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current)
			intervalRef.current = null
		}
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (callStatus === CALL_STATUS.ACTIVE) {
				stop()
			}
			stopDurationTimer()
		}
	}, [callStatus, stop, stopDurationTimer])

	const statusConfig = getStatusConfig()
	const StatusIcon = statusConfig.icon

	return (
		<Card
			className={`rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm ${className}`}
		>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
							<StatusIcon className="h-6 w-6 text-primary" />
						</div>
						<div>
							<CardTitle className="text-lg">
								{agent.name}
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Voice Agent Call
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className={`px-3 py-1 ${statusConfig.color}`}
						>
							{statusConfig.label}
						</Badge>
						{connectionQuality &&
							callState.status !== "idle" &&
							callState.status !== "ended" && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												className={`h-2 w-2 rounded-full ${
													connectionQuality ===
													"excellent"
														? "bg-green-500"
														: connectionQuality ===
																"good"
															? "bg-yellow-500"
															: "bg-red-500"
												}`}
											/>
										</TooltipTrigger>
										<TooltipContent>
											<p>
												Connection: {connectionQuality}
											</p>
											{callState.latency && (
												<p>
													Latency: {callState.latency}
													ms
												</p>
											)}
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* Call Status and Duration */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">
								Duration
							</span>
						</div>
						<div className="text-sm font-mono">
							{formatDuration(callState.duration)}
						</div>
					</div>

					{/* Volume Indicator */}
					{(callState.status === "speaking" ||
						callState.status === "listening") && (
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Activity className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">
									Audio Level
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
									<div
										className="h-full bg-primary transition-all duration-150"
										style={{
											width: `${Math.min(callState.volume * 2, 100)}%`
										}}
									/>
								</div>
								<span className="text-xs text-muted-foreground w-8">
									{callState.volume}%
								</span>
							</div>
						</div>
					)}

					{/* Transcript Display */}
					{(currentTranscript || agentResponse) && (
						<div className="space-y-2">
							{currentTranscript && (
								<div className="p-3 rounded-2xl bg-blue-50 text-sm">
									<div className="text-xs text-blue-600 font-medium mb-1">
										You said:
									</div>
									<div className="text-blue-900">
										{currentTranscript}
									</div>
								</div>
							)}
							{agentResponse && (
								<div className="p-3 rounded-2xl bg-green-50 text-sm">
									<div className="text-xs text-green-600 font-medium mb-1">
										Agent:
									</div>
									<div className="text-green-900">
										{agentResponse}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Call Controls */}
					<div className="flex gap-2 pt-2">
						{callState.status === "idle" ? (
							<Button
								onClick={startCall}
								className="flex-1 rounded-2xl bg-green-600 hover:bg-green-700 text-white"
								size="lg"
							>
								<Phone className="h-4 w-4 mr-2" />
								Start Call
							</Button>
						) : callState.status === "connecting" ? (
							<Button
								disabled
								className="flex-1 rounded-2xl bg-muted hover:bg-muted"
								size="lg"
								variant="outline"
							>
								<div className="animate-spin mr-2 h-4 w-4 border-2 border-muted-foreground border-r-transparent rounded-full" />
								Connecting...
							</Button>
						) : (
							<>
								<Button
									onClick={toggleMute}
									variant={
										callState.isMuted
											? "destructive"
											: "outline"
									}
									size="lg"
									className="rounded-2xl"
									disabled={callState.status === "ended"}
								>
									{callState.isMuted ? (
										<MicOff className="h-4 w-4" />
									) : (
										<Mic className="h-4 w-4" />
									)}
								</Button>
								{webCallUrl &&
									callState.status === "connected" && (
										<Button
											onClick={joinCall}
											variant="outline"
											size="lg"
											className="rounded-2xl"
											title="Open call in new window"
										>
											<ExternalLink className="h-4 w-4" />
										</Button>
									)}
								<Button
									onClick={endCall}
									variant="destructive"
									size="lg"
									className="flex-1 rounded-2xl"
									disabled={callState.status === "ended"}
								>
									<PhoneOff className="h-4 w-4 mr-2" />
									End Call
								</Button>
							</>
						)}
					</div>

					{/* Status Description */}
					<div className="text-center">
						<p className="text-xs text-muted-foreground">
							{statusConfig.description}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
