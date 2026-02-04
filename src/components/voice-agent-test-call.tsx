"use client"

import { useRealtimeVoiceSession } from "@/hooks/use-realtime-voice-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MicIcon, MicOffIcon, PhoneOffIcon, PhoneIcon } from "lucide-react"
import { useEffect, useState } from "react"

interface VoiceAgentTestCallProps {
	agentId: number
	agentName: string
}

function StatusBadge({
	label,
	active
}: {
	label: string
	active: boolean
}) {
	return (
		<Badge
			variant={active ? "default" : "outline"}
			className={active ? "bg-emerald-100 text-emerald-800" : undefined}
		>
			{label}
		</Badge>
	)
}

export function VoiceAgentTestCall({
	agentId,
	agentName
}: VoiceAgentTestCallProps) {
	const [open, setOpen] = useState(false)
	const {
		isConnected,
		isConnecting,
		isListening,
		isSpeaking,
		isMuted,
		error,
		transcriptHistory,
		assistantTranscript,
		start,
		stop,
		mute,
		unmute,
		clearTranscript
	} = useRealtimeVoiceSession(agentId)

	useEffect(() => {
		if (!open) {
			stop()
			clearTranscript()
		}
	}, [open, stop, clearTranscript])

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="flex-1">
					<PhoneIcon className="h-4 w-4 mr-2" />
					Test Web Call
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Test Call: {agentName}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Start a real-time web call to verify this agent's voice
						workflow.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-wrap gap-2">
					<StatusBadge label="Connected" active={isConnected} />
					<StatusBadge label="Connecting" active={isConnecting} />
					<StatusBadge label="Listening" active={isListening} />
					<StatusBadge label="Speaking" active={isSpeaking} />
				</div>

				{error && (
					<div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
						{error.message}
					</div>
				)}

				<ScrollArea className="h-72 rounded-2xl border border-border bg-muted/10 p-4">
					<div className="space-y-3 text-sm">
						{transcriptHistory.length === 0 && !assistantTranscript && (
							<p className="text-muted-foreground">
								Transcripts will appear here during the call.
							</p>
						)}
						{transcriptHistory.map((item, index) => (
							<div
								key={`${item.role}-${index}`}
								className={
									item.role === "user"
										? "text-slate-600"
										: "text-slate-900 font-medium"
								}
							>
								<span className="uppercase text-xs tracking-wide text-muted-foreground mr-2">
									{item.role}
								</span>
								{item.text}
							</div>
						))}
						{assistantTranscript && (
							<div className="text-slate-900 font-medium">
								<span className="uppercase text-xs tracking-wide text-muted-foreground mr-2">
									assistant
								</span>
								{assistantTranscript}
							</div>
						)}
					</div>
				</ScrollArea>

				<div className="flex flex-wrap gap-2 justify-between">
					<Button
						variant={isMuted ? "destructive" : "outline"}
						onClick={isMuted ? unmute : mute}
						disabled={!isConnected}
						className="gap-2"
					>
						{isMuted ? (
							<MicOffIcon className="h-4 w-4" />
						) : (
							<MicIcon className="h-4 w-4" />
						)}
						{isMuted ? "Unmute" : "Mute"}
					</Button>

					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={start}
							disabled={isConnected || isConnecting}
						>
							Start Call
						</Button>
						<Button
							variant="destructive"
							onClick={stop}
							disabled={!isConnected && !isConnecting}
							className="gap-2"
						>
							<PhoneOffIcon className="h-4 w-4" />
							End Call
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
