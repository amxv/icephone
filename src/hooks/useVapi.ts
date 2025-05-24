"use client"

import {
	type Message,
	MessageTypeEnum,
	type TranscriptMessage,
	TranscriptMessageTypeEnum
} from "@/lib/types/conversation"
import { createVapiClient } from "@/lib/vapi"
import type Vapi from "@vapi-ai/web"
import type { CreateAssistantDTO } from "@vapi-ai/web/dist/api"
import { useCallback, useEffect, useRef, useState } from "react"

export enum CALL_STATUS {
	INACTIVE = "inactive",
	ACTIVE = "active",
	LOADING = "loading"
}

export function useVapi() {
	const [isSpeechActive, setIsSpeechActive] = useState(false)
	const [callStatus, setCallStatus] = useState<CALL_STATUS>(
		CALL_STATUS.INACTIVE
	)
	const [webCallUrl, setWebCallUrl] = useState<string | null>(null)
	const [messages, setMessages] = useState<Message[]>([])
	const [activeTranscript, setActiveTranscript] =
		useState<TranscriptMessage | null>(null)
	const [audioLevel, setAudioLevel] = useState(0)

	// Use ref to store Vapi instance to avoid recreation
	const vapiRef = useRef<Vapi | null>(null)

	// Initialize Vapi instance only once
	useEffect(() => {
		if (!vapiRef.current) {
			try {
				vapiRef.current = createVapiClient()
			} catch (error) {
				console.error("Failed to create Vapi client:", error)
			}
		}
	}, [])

	// Set up event listeners
	useEffect(() => {
		const vapi = vapiRef.current
		if (!vapi) return

		const onSpeechStart = () => {
			console.log("Speech started")
			setIsSpeechActive(true)
		}

		const onSpeechEnd = () => {
			console.log("Speech ended")
			setIsSpeechActive(false)
		}

		const onCallStart = () => {
			console.log("Call started")
			setCallStatus(CALL_STATUS.ACTIVE)
		}

		const onCallEnd = () => {
			console.log("Call ended")
			setCallStatus(CALL_STATUS.INACTIVE)
			setWebCallUrl(null)
			setMessages([])
			setActiveTranscript(null)
			setAudioLevel(0)
		}

		const onVolumeLevel = (volume: number) => {
			setAudioLevel(volume)
		}

		const onMessage = (message: Message) => {
			console.log("Received message:", message)

			if (
				message.type === MessageTypeEnum.TRANSCRIPT &&
				message.transcriptType === TranscriptMessageTypeEnum.PARTIAL
			) {
				setActiveTranscript(message)
			} else {
				setMessages((prev) => [...prev, message])
				if (message.type === MessageTypeEnum.TRANSCRIPT) {
					setActiveTranscript(null)
				}
			}
		}

		const onError = (error: Error | unknown) => {
			console.error("Vapi error:", error)
			setCallStatus(CALL_STATUS.INACTIVE)
			setWebCallUrl(null)
		}

		// Add event listeners
		vapi.on("speech-start", onSpeechStart)
		vapi.on("speech-end", onSpeechEnd)
		vapi.on("call-start", onCallStart)
		vapi.on("call-end", onCallEnd)
		vapi.on("volume-level", onVolumeLevel)
		vapi.on("message", onMessage)
		vapi.on("error", onError)

		// Cleanup function
		return () => {
			vapi.removeListener("speech-start", onSpeechStart)
			vapi.removeListener("speech-end", onSpeechEnd)
			vapi.removeListener("call-start", onCallStart)
			vapi.removeListener("call-end", onCallEnd)
			vapi.removeListener("volume-level", onVolumeLevel)
			vapi.removeListener("message", onMessage)
			vapi.removeListener("error", onError)
		}
	}, [])

	const start = useCallback(
		async (assistant: CreateAssistantDTO) => {
			const vapi = vapiRef.current
			if (!vapi) {
				console.error("Vapi client not initialized")
				return
			}

			if (callStatus === CALL_STATUS.ACTIVE) {
				console.log("Call already active, stopping first")
				await stop()
			}

			setCallStatus(CALL_STATUS.LOADING)
			setMessages([])
			setActiveTranscript(null)

			try {
				console.log("Starting call with assistant:", assistant)
				const result = await vapi.start(assistant)
				console.log("Call started successfully:", result)

				// Extract web call URL if available
				if (
					result &&
					typeof result === "object" &&
					"webCallUrl" in result
				) {
					setWebCallUrl(result.webCallUrl as string)
				}

				return result
			} catch (error) {
				console.error("Failed to start call:", error)
				setCallStatus(CALL_STATUS.INACTIVE)
				throw error
			}
		},
		[callStatus]
	)

	const stop = useCallback(async () => {
		const vapi = vapiRef.current
		if (!vapi) return

		console.log("Stopping call")
		setCallStatus(CALL_STATUS.LOADING)

		try {
			vapi.stop()
		} catch (error) {
			console.error("Error stopping call:", error)
		}

		// Reset state
		setWebCallUrl(null)
		setMessages([])
		setActiveTranscript(null)
		setAudioLevel(0)
	}, [])

	const toggleCall = useCallback(
		(assistant?: CreateAssistantDTO) => {
			if (callStatus === CALL_STATUS.ACTIVE) {
				stop()
			} else if (assistant) {
				start(assistant)
			}
		},
		[callStatus, start, stop]
	)

	const sendMessage = useCallback(
		(
			messageContent: string,
			role: "user" | "assistant" | "system" = "user"
		) => {
			const vapi = vapiRef.current
			if (!vapi) return

			vapi.send({
				type: "add-message",
				message: {
					role,
					content: messageContent
				}
			})
		},
		[]
	)

	const joinCall = useCallback(() => {
		if (webCallUrl) {
			window.open(webCallUrl, "_blank", "width=800,height=600")
		}
	}, [webCallUrl])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (vapiRef.current && callStatus === CALL_STATUS.ACTIVE) {
				vapiRef.current.stop()
			}
		}
	}, [callStatus])

	return {
		isSpeechActive,
		callStatus,
		audioLevel,
		activeTranscript,
		messages,
		webCallUrl,
		start,
		stop,
		toggleCall,
		sendMessage,
		joinCall
	}
}
