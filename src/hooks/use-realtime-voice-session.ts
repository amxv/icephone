"use client"

import { updateCallOutcome } from "@/actions/calls"
import { scheduleAppointment } from "@/actions/lead-communication"
import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

const OPENAI_REALTIME_WEBRTC_URL = "https://api.openai.com/v1/realtime/calls"

export interface TranscriptItem {
	role: "user" | "assistant"
	text: string
	timestamp: Date
}

export interface RealtimeVoiceSessionState {
	isConnected: boolean
	isConnecting: boolean
	isListening: boolean
	isSpeaking: boolean
	isMuted: boolean
	error: Error | null
	transcriptHistory: TranscriptItem[]
	assistantTranscript: string
	userTranscript: string
}

export interface RealtimeVoiceSessionControls {
	start: () => Promise<void>
	stop: () => void
	mute: () => void
	unmute: () => void
	clearTranscript: () => void
}

export type UseRealtimeVoiceSessionReturn = RealtimeVoiceSessionState &
	RealtimeVoiceSessionControls

export function useRealtimeVoiceSession(
	agentId: number
): UseRealtimeVoiceSessionReturn {
	const [isConnected, setIsConnected] = useState(false)
	const [isConnecting, setIsConnecting] = useState(false)
	const [isListening, setIsListening] = useState(false)
	const [isSpeaking, setIsSpeaking] = useState(false)
	const [isMuted, setIsMuted] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [transcriptHistory, setTranscriptHistory] = useState<
		TranscriptItem[]
	>([])
	const [assistantTranscript, setAssistantTranscript] = useState("")
	const [userTranscript, setUserTranscript] = useState("")

	const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
	const dataChannelRef = useRef<RTCDataChannel | null>(null)
	const mediaStreamRef = useRef<MediaStream | null>(null)
	const audioElementRef = useRef<HTMLAudioElement | null>(null)
	const sessionStartTimeRef = useRef<number | null>(null)
	const callIdRef = useRef<number | null>(null)
	const isResponseInProgressRef = useRef(false)

	const resetState = useCallback(() => {
		setIsConnected(false)
		setIsConnecting(false)
		setIsListening(false)
		setIsSpeaking(false)
		setIsMuted(false)
		setAssistantTranscript("")
		setUserTranscript("")
	}, [])

	const clearTranscript = useCallback(() => {
		setTranscriptHistory([])
		setAssistantTranscript("")
		setUserTranscript("")
	}, [])

	const executeToolCall = useCallback(
		async (toolName: string, args: Record<string, unknown>) => {
			switch (toolName) {
				case "scheduleAppointment": {
					const inputSchema = z.object({
						leadId: z.coerce.number().int().positive(),
						title: z.string().trim().min(1),
						description: z.string().optional(),
						startTime: z.string().min(1),
						endTime: z.string().min(1),
						location: z.string().optional()
					})

					try {
						const parsed = inputSchema.parse(args)
						const start = new Date(parsed.startTime)
						const end = new Date(parsed.endTime)

						if (
							Number.isNaN(start.getTime()) ||
							Number.isNaN(end.getTime())
						) {
							return {
								success: false,
								error: "Invalid appointment time"
							}
						}

						return await scheduleAppointment({
							leadId: parsed.leadId,
							title: parsed.title,
							description: parsed.description,
							startTime: start,
							endTime: end,
							location: parsed.location
						})
					} catch (error) {
						const message =
							error instanceof Error
								? error.message
								: "Invalid tool input"
						return { success: false, error: message }
					}
				}
				default:
					return {
						success: false,
						error: `Unknown tool: ${toolName}`
					}
			}
		},
		[]
	)

	const handleDataChannelMessage = useCallback(
		async (event: MessageEvent) => {
			try {
				const msg = JSON.parse(event.data)

				switch (msg.type) {
					case "session.created":
						setIsConnected(true)
						setIsConnecting(false)
						break
					case "input_audio_buffer.speech_started":
						setIsListening(true)
						setIsSpeaking(false)
						break
					case "input_audio_buffer.speech_stopped":
						setIsListening(false)
						break
					case "conversation.item.input_audio_transcription.completed":
						if (msg.transcript) {
							setTranscriptHistory((prev) => [
								...prev,
								{
									role: "user",
									text: msg.transcript,
									timestamp: new Date()
								}
							])
							setUserTranscript("")
						}
						break
					case "response.audio_transcript.delta":
						setAssistantTranscript(
							(prev) => prev + (msg.delta || "")
						)
						break
					case "response.audio_transcript.done":
						if (msg.transcript) {
							setTranscriptHistory((prev) => [
								...prev,
								{
									role: "assistant",
									text: msg.transcript,
									timestamp: new Date()
								}
							])
						}
						setAssistantTranscript("")
						break
					case "response.created":
						isResponseInProgressRef.current = true
						break
					case "response.done":
						isResponseInProgressRef.current = false
						break
					case "response.function_call_arguments.done":
						if (msg.name && msg.arguments) {
							let parsedArgs: Record<string, unknown> = {}
							try {
								parsedArgs = JSON.parse(msg.arguments)
							} catch (parseError) {
								console.error(
									"Failed to parse tool args:",
									parseError
								)
							}

							const result = await executeToolCall(
								msg.name,
								parsedArgs
							)

							dataChannelRef.current?.send(
								JSON.stringify({
									type: "conversation.item.create",
									item: {
										type: "function_call_output",
										call_id: msg.call_id,
										output: JSON.stringify(result)
									}
								})
							)

							if (!isResponseInProgressRef.current) {
								dataChannelRef.current?.send(
									JSON.stringify({
										type: "response.create"
									})
								)
							}
						}
						break
					case "error": {
						const message =
							msg.error?.message || "Voice session error"
						if (!message.includes("active response in progress")) {
							setError(new Error(message))
						}
						break
					}
					default:
						break
				}
			} catch (err) {
				console.error("Error handling data channel message:", err)
			}
		},
		[executeToolCall]
	)

	const start = useCallback(async () => {
		if (isConnected || isConnecting) return

		setError(null)
		setIsConnecting(true)

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true
			})
			mediaStreamRef.current = stream

			const sessionResponse = await fetch("/api/voice/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ agentId })
			})

			if (!sessionResponse.ok) {
				const errorData = await sessionResponse.json().catch(() => null)
				throw new Error(
					errorData?.error || "Failed to create voice session"
				)
			}

			const sessionData = await sessionResponse.json()
			const ephemeralKey = sessionData.clientSecret as string | undefined

			if (!ephemeralKey) {
				throw new Error("Failed to get client secret")
			}

			callIdRef.current = sessionData.callId

			const pc = new RTCPeerConnection()
			peerConnectionRef.current = pc

			const audioEl = new Audio()
			audioEl.autoplay = true
			audioEl.onplaying = () => setIsSpeaking(true)
			audioEl.onpause = () => setIsSpeaking(false)
			audioEl.onended = () => setIsSpeaking(false)
			audioElementRef.current = audioEl

			pc.ontrack = (event) => {
				audioEl.srcObject = event.streams[0]
			}

			const dc = pc.createDataChannel("oai-events")
			dataChannelRef.current = dc

			dc.onmessage = handleDataChannelMessage
			dc.onerror = (event) => {
				console.error("Data channel error:", event)
			}

			for (const track of stream.getTracks()) {
				pc.addTrack(track, stream)
			}

			const offer = await pc.createOffer()
			await pc.setLocalDescription(offer)

			const sdpResponse = await fetch(OPENAI_REALTIME_WEBRTC_URL, {
				method: "POST",
				body: offer.sdp,
				headers: {
					Authorization: `Bearer ${ephemeralKey}`,
					"Content-Type": "application/sdp"
				}
			})

			if (!sdpResponse.ok) {
				throw new Error("Failed to establish WebRTC connection")
			}

			const answerSdp = await sdpResponse.text()
			await pc.setRemoteDescription({
				type: "answer",
				sdp: answerSdp
			})

			sessionStartTimeRef.current = Date.now()
			setIsConnected(true)
			setIsConnecting(false)
		} catch (err) {
			console.error("Failed to start voice session:", err)
			if (callIdRef.current) {
				try {
					await updateCallOutcome(callIdRef.current, {
						status: "failed",
						endTime: new Date()
					})
				} catch (updateError) {
					console.error("Failed to mark call as failed:", updateError)
				}
			}
			setError(err instanceof Error ? err : new Error("Failed to start"))
			setIsConnecting(false)
			setIsConnected(false)
		}
	}, [agentId, handleDataChannelMessage, isConnected, isConnecting])

	const stop = useCallback(async () => {
		try {
			const callId = callIdRef.current
			if (callId && sessionStartTimeRef.current) {
				const duration = Math.floor(
					(Date.now() - sessionStartTimeRef.current) / 1000
				)
				const transcriptLines = transcriptHistory.map(
					(item) =>
						`${item.role === "user" ? "User" : "Assistant"}: ${item.text}`
				)
				const transcript = transcriptLines.join("\n")

				await updateCallOutcome(callId, {
					status: "completed",
					endTime: new Date(),
					duration,
					transcript: transcript || null
				})
			}
		} catch (err) {
			console.error("Failed to finalize call:", err)
		}

		dataChannelRef.current?.close()
		peerConnectionRef.current?.close()
		const tracks = mediaStreamRef.current?.getTracks() || []
		for (const track of tracks) {
			track.stop()
		}

		dataChannelRef.current = null
		peerConnectionRef.current = null
		mediaStreamRef.current = null
		audioElementRef.current = null
		sessionStartTimeRef.current = null
		callIdRef.current = null

		resetState()
	}, [resetState, transcriptHistory])

	const mute = useCallback(() => {
		const tracks = mediaStreamRef.current?.getAudioTracks() || []
		for (const track of tracks) {
			track.enabled = false
		}
		setIsMuted(true)
	}, [])

	const unmute = useCallback(() => {
		const tracks = mediaStreamRef.current?.getAudioTracks() || []
		for (const track of tracks) {
			track.enabled = true
		}
		setIsMuted(false)
	}, [])

	useEffect(() => {
		return () => {
			stop()
		}
	}, [stop])

	return {
		isConnected,
		isConnecting,
		isListening,
		isSpeaking,
		isMuted,
		error,
		transcriptHistory,
		assistantTranscript,
		userTranscript,
		start,
		stop,
		mute,
		unmute,
		clearTranscript
	}
}
