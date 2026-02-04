"use client"

import { updateVoiceAgent } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
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
import { Textarea } from "@/components/ui/textarea"
import {
	OPENAI_REALTIME_MODEL,
	OPENAI_REALTIME_VOICES,
	normalizeOpenAIVoiceId
} from "@/lib/openai/realtime-voice"
import type { VoiceAgent } from "@/types"
import { SparklesIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const OPENAI_VOICES = OPENAI_REALTIME_VOICES.map((voice) => ({
	value: voice,
	label: `${voice.charAt(0).toUpperCase()}${voice.slice(1)}`
}))

interface VoiceAgentCustomizationDialogProps {
	agent: VoiceAgent
	onUpdated?: () => void
	trigger?: React.ReactNode
}

export function VoiceAgentCustomizationDialog({
	agent,
	onUpdated,
	trigger
}: VoiceAgentCustomizationDialogProps) {
	const [open, setOpen] = useState(false)
	const [selectedVoice, setSelectedVoice] = useState(
		normalizeOpenAIVoiceId(undefined)
	)
	const [instructions, setInstructions] = useState("")
	const [isSaving, setIsSaving] = useState(false)

	useEffect(() => {
		if (!open) return
		const agentVoice =
			agent.voice?.provider === "openai"
				? agent.voice.voice_id
				: undefined
		setSelectedVoice(normalizeOpenAIVoiceId(agentVoice))
		setInstructions(agent.prompt || "")
	}, [open, agent.prompt, agent.voice])

	const handleSave = async () => {
		setIsSaving(true)
		try {
			const result = await updateVoiceAgent(agent.id, {
				prompt: instructions.trim(),
				voice: {
					provider: "openai",
					voice_id: selectedVoice,
					model: OPENAI_REALTIME_MODEL
				}
			})

			if (result.success) {
				toast.success("Voice agent updated")
				setOpen(false)
				onUpdated?.()
			} else {
				toast.error(result.error || "Failed to update voice agent")
			}
		} catch (error) {
			console.error("Failed to update voice agent:", error)
			toast.error("Failed to update voice agent")
		} finally {
			setIsSaving(false)
		}
	}

	const DefaultTrigger = (
		<Button variant="outline" size="sm" className="flex-1 rounded-2xl">
			<SparklesIcon className="h-4 w-4 mr-2" />
			Customize
		</Button>
	)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger || DefaultTrigger}</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Voice & Instructions</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="voice-select">Voice</Label>
						<Select
							value={selectedVoice}
							onValueChange={(value) =>
								setSelectedVoice(normalizeOpenAIVoiceId(value))
							}
						>
							<SelectTrigger id="voice-select">
								<SelectValue placeholder="Select a voice" />
							</SelectTrigger>
							<SelectContent>
								{OPENAI_VOICES.map((voice) => (
									<SelectItem
										key={voice.value}
										value={voice.value}
									>
										{voice.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Applies to the OpenAI Realtime voice agent.
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="agent-instructions">
							Custom Instructions
						</Label>
						<Textarea
							id="agent-instructions"
							value={instructions}
							onChange={(event) =>
								setInstructions(event.target.value)
							}
							placeholder="Add personality, script guidance, and behavioral instructions for this agent..."
							className="min-h-[160px]"
						/>
						<p className="text-xs text-muted-foreground">
							These instructions are used in the Realtime session
							prompt.
						</p>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
