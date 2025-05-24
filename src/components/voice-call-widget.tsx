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
import type { VoiceAgentWithPhoneNumber } from "@/types"
import {
	Activity,
	Circle,
	Clock,
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

// Type for Millis SDK client
type MillisClient = ReturnType<
	typeof import("@millisai/web-sdk").default.createClient
>

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

	const millennisRef = useRef<MillisClient | null>(null)
	const intervalRef = useRef<NodeJS.Timeout | null>(null)
	const startTimeRef = useRef<number | null>(null)

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
					label: "Speaking",
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

	// Initialize Millis AI SDK
	const initializeMillis = async () => {
		try {
			// Get public key from environment variables
			let publicKey: string | undefined =
				process.env.NEXT_PUBLIC_MILLIS_PUBLIC_KEY

			// If not available, try Cloudflare context (for production)
			if (!publicKey) {
				try {
					const { getCloudflareContext } = await import(
						"@opennextjs/cloudflare"
					)
					const { env } = getCloudflareContext()
					publicKey = env.NEXT_PUBLIC_MILLIS_PUBLIC_KEY
				} catch (error) {
					console.log(
						"Cloudflare context not available, running in development mode"
					)
				}
			}

			if (!publicKey) {
				throw new Error(
					"NEXT_PUBLIC_MILLIS_PUBLIC_KEY is not configured. Please check your environment variables."
				)
			}

			// Dynamic import of Millis SDK
			const { default: Millis } = await import("@millisai/web-sdk")

			// Get endpoint from environment variables (optional)
			let endPoint: string | undefined =
				process.env.NEXT_PUBLIC_MILLIS_ENDPOINT

			// If not available, try Cloudflare context (for production)
			if (!endPoint) {
				try {
					const { getCloudflareContext } = await import(
						"@opennextjs/cloudflare"
					)
					const { env } = getCloudflareContext()
					endPoint = env.NEXT_PUBLIC_MILLIS_ENDPOINT
				} catch (error) {
					// No endpoint specified, use default
				}
			}

			// Create client with public key and optional endpoint
			const millisClient = Millis.createClient({
				publicKey,
				...(endPoint && { endPoint })
			})

			console.log("Millis AI client initialized successfully")
			return millisClient
		} catch (error) {
			console.error("Failed to initialize Millis SDK:", error)
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error"

			if (errorMessage.includes("WebSocket")) {
				toast.error(
					"WebSocket connection failed. Please check your network connection."
				)
			} else if (
				errorMessage.includes("publicKey") ||
				errorMessage.includes("configuration")
			) {
				toast.error(
					"Voice service configuration error. Please contact support."
				)
			} else {
				toast.error(
					"Failed to initialize voice service. Please try again."
				)
			}
			throw error
		}
	}

	// Start voice call
	const startCall = async () => {
		try {
			setCallState((prev) => ({ ...prev, status: "connecting" }))

			const millisClient = await initializeMillis()
			millennisRef.current = millisClient

			// Request microphone permission
			await navigator.mediaDevices.getUserMedia({ audio: true })

			// Start the call with dynamic temporary voice agent configuration
			// This creates a temporary agent with custom configurations per the Millis AI docs
			// https://docs.millis.ai/integration/web-sdk#dynamically-creating-a-temporary-voice-agent
			await millisClient.start({
				agent: {
					agent_config: {
						prompt:
							agent.prompt ||
							"You're a helpful AI assistant. Be friendly and conversational in your responses. You can help with general questions and conversation.",
						voice: {
							provider: "elevenlabs",
							voice_id: "EXAVITQu4vr4xnSDxMaL" // Default voice, can be customized
						},
						language: agent.language || "en",
						llm: "gpt-4o-mini",
						tools: [] // Can be extended with custom functions later
					}
				},
				metadata: {
					agent_name: agent.name,
					phone_number: agent.phoneNumber?.number || "unknown",
					agent_id: agent.id.toString(),
					session_type: "test_call",
					created_at: new Date().toISOString()
				},
				include_metadata_in_prompt: true
			})

			// Set up event handlers using .on() method
			millennisRef.current.on("onready", () => {
				setCallState((prev) => ({ ...prev, status: "connected" }))
				startTimeRef.current = Date.now()
				startDurationTimer()
				toast.success("Connected to voice agent")
			})

			millennisRef.current.on(
				"ontranscript",
				(text: string, payload: { is_final?: boolean }) => {
					if (payload.is_final) {
						setCurrentTranscript(text)
						onTranscript?.(text, false)
						setCallState((prev) => ({
							...prev,
							status: "speaking"
						}))
					}
				}
			)

			millennisRef.current.on(
				"onresponsetext",
				(text: string, payload: { is_final?: boolean }) => {
					if (payload.is_final) {
						setAgentResponse(text)
						onTranscript?.(text, true)
						setCallState((prev) => ({
							...prev,
							status: "listening"
						}))
					}
				}
			)

			millennisRef.current.on("onlatency", (latency: number) => {
				setCallState((prev) => ({ ...prev, latency }))

				// Update connection quality based on latency
				if (latency < 200) {
					setConnectionQuality("excellent")
				} else if (latency < 500) {
					setConnectionQuality("good")
				} else {
					setConnectionQuality("poor")
				}
			})

			millennisRef.current.on("onsessionended", () => {
				console.log("Millis AI session ended")
				endCall()
			})

			millennisRef.current.on("onerror", (error: Event) => {
				console.error("Millis AI error:", error)
				setCallState((prev) => ({ ...prev, status: "error" }))
				toast.error("Voice call error occurred")
			})

			// Additional event handlers for testing and debugging
			millennisRef.current.on("onopen", () => {
				console.log("Millis AI WebSocket connection opened")
			})

			millennisRef.current.on("onclose", (event: CloseEvent) => {
				console.log("Millis AI WebSocket connection closed:", event)

				// Check for validation errors in the close reason
				if (event.reason?.includes("validation error")) {
					console.error("Millis AI validation error:", event.reason)
					toast.error(
						"Voice configuration error. Please check agent settings."
					)
				}
			})

			millennisRef.current.on(
				"onfunction",
				(text: string, payload: { name: string; params: object }) => {
					console.log("Millis AI function call:", { text, payload })
				}
			)

			millennisRef.current.on(
				"useraudioready",
				(data: { analyser: AnalyserNode; stream: MediaStream }) => {
					console.log("User audio ready:", data)
				}
			)

			millennisRef.current.on("analyzer", (analyzer: AnalyserNode) => {
				// Set up volume monitoring
				const dataArray = new Uint8Array(analyzer.frequencyBinCount)
				const updateVolume = () => {
					analyzer.getByteFrequencyData(dataArray)
					const volume =
						dataArray.reduce((sum, value) => sum + value, 0) /
						dataArray.length
					setCallState((prev) => ({
						...prev,
						volume: Math.round(volume)
					}))

					if (
						callState.status === "connected" ||
						callState.status === "speaking" ||
						callState.status === "listening"
					) {
						requestAnimationFrame(updateVolume)
					}
				}
				updateVolume()
			})
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
			} else if (
				errorMessage.includes("publicKey") ||
				errorMessage.includes("MILLIS")
			) {
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
		if (millennisRef.current) {
			millennisRef.current.stop()
			millennisRef.current = null
		}

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

	// Toggle mute
	const toggleMute = () => {
		if (millennisRef.current) {
			const newMutedState = !callState.isMuted
			setCallState((prev) => ({ ...prev, isMuted: newMutedState }))

			// TODO: Implement actual mute functionality with Millis SDK
			toast.info(
				newMutedState ? "Microphone muted" : "Microphone unmuted"
			)
		}
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
			if (millennisRef.current) {
				millennisRef.current.stop()
			}
			stopDurationTimer()
		}
	}, [stopDurationTimer])

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
									disabled={
										callState.status === "connecting" ||
										callState.status === "ended"
									}
								>
									{callState.isMuted ? (
										<MicOff className="h-4 w-4" />
									) : (
										<Mic className="h-4 w-4" />
									)}
								</Button>
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
