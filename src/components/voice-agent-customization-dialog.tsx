"use client"

import { getKnowledgeBaseSources } from "@/actions/knowledge-base"
import { updateVoiceAgent } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
	getVoiceAgentCommandCenterTemplate,
	VOICE_AGENT_COMMAND_CENTER_TEMPLATES
} from "@/lib/voice-agent-command-center"
import type { VoiceAgent } from "@/types"
import { SparklesIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const OPENAI_VOICES = OPENAI_REALTIME_VOICES.map((voice) => ({
	value: voice,
	label: `${voice.charAt(0).toUpperCase()}${voice.slice(1)}`
}))

const CUSTOM_TEMPLATE_VALUE = "__custom__"

interface VoiceAgentCustomizationDialogProps {
	agent: VoiceAgent
	onUpdated?: () => void
	trigger?: React.ReactNode
}

type KnowledgeSourceOption = {
	id: number
	name: string
	type: string
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
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
		CUSTOM_TEMPLATE_VALUE
	)
	const [instructions, setInstructions] = useState("")
	const [personality, setPersonality] = useState("")
	const [scriptDirection, setScriptDirection] = useState("")
	const [firstMessage, setFirstMessage] = useState("")
	const [knowledgeSources, setKnowledgeSources] = useState<
		KnowledgeSourceOption[]
	>([])
	const [selectedKnowledgeSourceIds, setSelectedKnowledgeSourceIds] =
		useState<number[]>([])
	const [isLoadingKnowledgeSources, setIsLoadingKnowledgeSources] =
		useState(false)
	const [isSaving, setIsSaving] = useState(false)

	useEffect(() => {
		if (!open) return
		const agentVoice =
			agent.voice?.provider === "openai"
				? agent.voice.voice_id
				: undefined
		const commandCenter = agent.configuration?.command_center
		const template = getVoiceAgentCommandCenterTemplate(
			commandCenter?.templateId
		)
		setSelectedVoice(normalizeOpenAIVoiceId(agentVoice))
		setSelectedTemplateId(template?.id || CUSTOM_TEMPLATE_VALUE)
		setInstructions(agent.prompt || template?.instructionsDefault || "")
		setPersonality(
			commandCenter?.personality || template?.personalityDefault || ""
		)
		setScriptDirection(
			commandCenter?.scriptDirection ||
				template?.scriptDirectionDefault ||
				""
		)
		const configuredSourceIds = Array.isArray(
			agent.configuration?.knowledge_base?.sourceIds
		)
			? agent.configuration.knowledge_base.sourceIds
					.filter(
						(value): value is number =>
							Number.isInteger(value) && value > 0
					)
					.map((value) => Number(value))
			: []
		setFirstMessage(
			agent.firstMessage || template?.firstMessageDefault || ""
		)
		setSelectedKnowledgeSourceIds(Array.from(new Set(configuredSourceIds)))
	}, [
		open,
		agent.prompt,
		agent.voice,
		agent.configuration,
		agent.firstMessage
	])

	useEffect(() => {
		if (!open) return

		let isMounted = true
		setIsLoadingKnowledgeSources(true)
		void getKnowledgeBaseSources()
			.then((result) => {
				if (!isMounted) return
				if (!result.success || !result.data) {
					setKnowledgeSources([])
					return
				}

				const normalizedSources = result.data.map((source) => ({
					id: source.id,
					name: source.name,
					type: source.type
				}))
				setKnowledgeSources(normalizedSources)
			})
			.catch((error) => {
				console.error("Failed to load knowledge sources:", error)
				if (isMounted) {
					setKnowledgeSources([])
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsLoadingKnowledgeSources(false)
				}
			})

		return () => {
			isMounted = false
		}
	}, [open])

	const applyTemplateDefaults = (templateId: string) => {
		const template = getVoiceAgentCommandCenterTemplate(templateId)
		if (!template) {
			return
		}

		setInstructions(template.instructionsDefault)
		setPersonality(template.personalityDefault)
		setScriptDirection(template.scriptDirectionDefault)
		setFirstMessage(template.firstMessageDefault)
	}

	const toggleKnowledgeSource = (sourceId: number, checked: boolean) => {
		setSelectedKnowledgeSourceIds((prev) => {
			if (checked) {
				return Array.from(new Set([...prev, sourceId]))
			}
			return prev.filter((id) => id !== sourceId)
		})
	}

	const handleSave = async () => {
		setIsSaving(true)
		try {
			const selectedTemplate =
				selectedTemplateId === CUSTOM_TEMPLATE_VALUE
					? null
					: getVoiceAgentCommandCenterTemplate(selectedTemplateId)
			const trimmedInstructions = instructions.trim()
			const trimmedPersonality = personality.trim()
			const trimmedScriptDirection = scriptDirection.trim()
			const mergedPromptSections = [trimmedInstructions]

			if (trimmedPersonality) {
				mergedPromptSections.push(
					`Personality guidance: ${trimmedPersonality}`
				)
			}

			if (trimmedScriptDirection) {
				mergedPromptSections.push(
					`Script direction: ${trimmedScriptDirection}`
				)
			}

			const existingConfiguration = agent.configuration || {}
			const normalizedKnowledgeSourceIds = Array.from(
				new Set(
					selectedKnowledgeSourceIds
						.filter((id) => Number.isInteger(id) && id > 0)
						.map((id) => Number(id))
				)
			).sort((a, b) => a - b)
			const commandCenterMode =
				selectedTemplate?.mode ||
				existingConfiguration.command_center?.mode ||
				"support"

			const result = await updateVoiceAgent(agent.id, {
				prompt: mergedPromptSections.filter(Boolean).join("\n\n"),
				firstMessage: firstMessage.trim() || null,
				voice: {
					provider: "openai",
					voice_id: selectedVoice,
					model: OPENAI_REALTIME_MODEL
				},
				configuration: {
					...existingConfiguration,
					knowledge_base: {
						...(existingConfiguration.knowledge_base || {}),
						sourceIds:
							normalizedKnowledgeSourceIds.length > 0
								? normalizedKnowledgeSourceIds
								: undefined
					},
					command_center: {
						mode: commandCenterMode,
						templateId: selectedTemplate?.id,
						personality: trimmedPersonality || undefined,
						scriptDirection: trimmedScriptDirection || undefined,
						updatedAt: new Date().toISOString()
					}
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
						<Label htmlFor="command-center-template">
							Command Center Template
						</Label>
						<Select
							value={selectedTemplateId}
							onValueChange={(value) => {
								setSelectedTemplateId(value)
								if (value !== CUSTOM_TEMPLATE_VALUE) {
									applyTemplateDefaults(value)
								}
							}}
						>
							<SelectTrigger id="command-center-template">
								<SelectValue placeholder="Select a template" />
							</SelectTrigger>
							<SelectContent>
								{VOICE_AGENT_COMMAND_CENTER_TEMPLATES.map(
									(template) => (
										<SelectItem
											key={template.id}
											value={template.id}
										>
											{template.label}
										</SelectItem>
									)
								)}
								<SelectItem value={CUSTOM_TEMPLATE_VALUE}>
									Custom (No Template Override)
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Includes required modes (`support`, `outbound
							cold-calling`, `loan repayment collections`) plus
							quick-start templates.
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="agent-personality">Personality</Label>
						<Textarea
							id="agent-personality"
							value={personality}
							onChange={(event) =>
								setPersonality(event.target.value)
							}
							placeholder="Describe tone and behavior (e.g., calm, concise, assertive)..."
							className="min-h-[90px]"
						/>
					</div>

					<div className="space-y-3">
						<div className="space-y-1">
							<Label>Knowledge Base Scope</Label>
							<p className="text-xs text-muted-foreground">
								Choose which sources this agent can use during
								realtime tool calls. Leave empty to allow all
								team sources.
							</p>
						</div>

						<div className="rounded-xl border border-border/70 p-3 space-y-3">
							<div className="flex items-center gap-2 text-sm">
								<Checkbox
									id="customization-kb-all"
									checked={
										selectedKnowledgeSourceIds.length === 0
									}
									onCheckedChange={(checked) => {
										if (checked) {
											setSelectedKnowledgeSourceIds([])
										}
									}}
								/>
								<Label htmlFor="customization-kb-all">
									Use all available knowledge sources
								</Label>
							</div>

							{isLoadingKnowledgeSources ? (
								<p className="text-xs text-muted-foreground">
									Loading sources...
								</p>
							) : knowledgeSources.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									No knowledge sources found. Add sources in
									the Knowledge Base screen.
								</p>
							) : (
								<div className="max-h-40 overflow-y-auto space-y-2 pr-1">
									{knowledgeSources.map((source) => {
										const checked =
											selectedKnowledgeSourceIds.includes(
												source.id
											)

										return (
											<div
												key={source.id}
												className="flex items-start gap-2 text-sm"
											>
												<Checkbox
													id={`customization-kb-source-${source.id}`}
													checked={checked}
													onCheckedChange={(value) =>
														toggleKnowledgeSource(
															source.id,
															value === true
														)
													}
												/>
												<Label
													htmlFor={`customization-kb-source-${source.id}`}
												>
													{source.name}
													<span className="block text-xs text-muted-foreground">
														#{source.id} •{" "}
														{source.type}
													</span>
												</Label>
											</div>
										)
									})}
								</div>
							)}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="agent-script-direction">
							Script Direction
						</Label>
						<Textarea
							id="agent-script-direction"
							value={scriptDirection}
							onChange={(event) =>
								setScriptDirection(event.target.value)
							}
							placeholder="Add call flow guidance, mandatory points, and escalation behavior..."
							className="min-h-[110px]"
						/>
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

					<div className="space-y-2">
						<Label htmlFor="agent-first-message">
							First Message
						</Label>
						<Textarea
							id="agent-first-message"
							value={firstMessage}
							onChange={(event) =>
								setFirstMessage(event.target.value)
							}
							placeholder="What should the agent say first when the call starts?"
							className="min-h-[90px]"
						/>
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
