"use client"

import { updateVoiceAgent } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { VoiceAgent, VoiceAgentConfiguration } from "@/types"
import {
	Bot,
	Brain,
	Clock,
	MessageSquare,
	Phone,
	Settings2,
	Shield,
	Volume2
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface VoiceAgentSettingsProps {
	agent: VoiceAgent
	onAgentUpdated?: () => void
	trigger?: React.ReactNode
}

export function VoiceAgentSettings({
	agent,
	onAgentUpdated,
	trigger
}: VoiceAgentSettingsProps) {
	const [open, setOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [config, setConfig] = useState<VoiceAgentConfiguration>(
		agent.configuration || {}
	)

	const updateConfig = (path: string, value: unknown) => {
		setConfig((prev) => {
			const keys = path.split(".")
			const newConfig = { ...prev }
			let current: Record<string, unknown> = newConfig

			for (let i = 0; i < keys.length - 1; i++) {
				const key = keys[i]
				if (!current[key] || typeof current[key] !== "object") {
					current[key] = {}
				}
				current = current[key] as Record<string, unknown>
			}

			current[keys[keys.length - 1]] = value
			return newConfig
		})
	}

	const getConfigValue = (path: string, defaultValue: unknown = "") => {
		const keys = path.split(".")
		let current: unknown = config

		for (const key of keys) {
			if (current == null || typeof current !== "object")
				return defaultValue
			current = (current as Record<string, unknown>)[key]
		}

		return current !== undefined ? current : defaultValue
	}

	const handleSave = async () => {
		setIsSubmitting(true)

		try {
			const result = await updateVoiceAgent(agent.id, {
				configuration: config
			})

			if (result.success) {
				toast.success("Voice agent settings updated successfully")
				setOpen(false)
				onAgentUpdated?.()
			} else {
				toast.error(
					result.error || "Failed to update voice agent settings"
				)
			}
		} catch (error) {
			console.error("Error updating voice agent settings:", error)
			toast.error("Failed to update voice agent settings")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button
						variant="outline"
						size="sm"
						className="gap-2 rounded-2xl"
					>
						<Settings2 className="h-4 w-4" />
						Advanced Settings
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Bot className="h-5 w-5" />
						Advanced Settings: {agent.name}
					</DialogTitle>
					<DialogDescription>
						Configure advanced voice agent behavior, flow control,
						and integrations
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="flow" className="space-y-6">
					<TabsList className="grid grid-cols-6 w-full">
						<TabsTrigger
							value="flow"
							className="flex items-center gap-1"
						>
							<MessageSquare className="h-3 w-3" />
							Flow
						</TabsTrigger>
						<TabsTrigger
							value="llm"
							className="flex items-center gap-1"
						>
							<Brain className="h-3 w-3" />
							AI Model
						</TabsTrigger>
						<TabsTrigger
							value="voice"
							className="flex items-center gap-1"
						>
							<Volume2 className="h-3 w-3" />
							Voice
						</TabsTrigger>
						<TabsTrigger
							value="phone"
							className="flex items-center gap-1"
						>
							<Phone className="h-3 w-3" />
							Phone
						</TabsTrigger>
						<TabsTrigger
							value="session"
							className="flex items-center gap-1"
						>
							<Clock className="h-3 w-3" />
							Session
						</TabsTrigger>
						<TabsTrigger
							value="privacy"
							className="flex items-center gap-1"
						>
							<Shield className="h-3 w-3" />
							Privacy
						</TabsTrigger>
					</TabsList>

					{/* Flow Control Settings */}
					<TabsContent value="flow" className="space-y-4">
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Conversation Flow</CardTitle>
								<CardDescription>
									Control how conversations start and flow
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>User Speaks First</Label>
										<p className="text-sm text-muted-foreground">
											Wait for user to start the
											conversation
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"flow.user_start_first",
												false
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"flow.user_start_first",
												checked
											)
										}
									/>
								</div>

								<div className="space-y-3">
									<Label>Response Delay (ms)</Label>
									<Input
										type="number"
										placeholder="500"
										value={
											getConfigValue(
												"flow.response_delay",
												""
											) as string
										}
										onChange={(e) =>
											updateConfig(
												"flow.response_delay",
												Number.parseInt(
													e.target.value
												) || 0
											)
										}
										className="rounded-2xl bg-card/30"
									/>
									<p className="text-sm text-muted-foreground">
										Delay before agent responds to user
										speech
									</p>
								</div>

								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<div className="space-y-1">
											<Label>Allow Interruptions</Label>
											<p className="text-sm text-muted-foreground">
												Let users interrupt the agent
											</p>
										</div>
										<Switch
											checked={
												getConfigValue(
													"flow.interruption.allowed",
													true
												) as boolean
											}
											onCheckedChange={(checked) =>
												updateConfig(
													"flow.interruption.allowed",
													checked
												)
											}
										/>
									</div>

									{Boolean(
										getConfigValue(
											"flow.interruption.allowed",
											true
										)
									) && (
										<div className="space-y-2 pl-4 border-l-2 border-border">
											<div className="flex items-center justify-between">
												<Label className="text-sm">
													Keep interruption message
												</Label>
												<Switch
													checked={
														getConfigValue(
															"flow.interruption.keep_interruption_message",
															false
														) as boolean
													}
													onCheckedChange={(
														checked
													) =>
														updateConfig(
															"flow.interruption.keep_interruption_message",
															checked
														)
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<Label className="text-sm">
													Allow first message
													interruption
												</Label>
												<Switch
													checked={
														getConfigValue(
															"flow.interruption.first_message",
															true
														) as boolean
													}
													onCheckedChange={(
														checked
													) =>
														updateConfig(
															"flow.interruption.first_message",
															checked
														)
													}
												/>
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Call Termination</CardTitle>
								<CardDescription>
									Configure how the agent can end calls
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>
											Enable Agent Call Termination
										</Label>
										<p className="text-sm text-muted-foreground">
											Allow agent to end calls when
											appropriate
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"flow.agent_terminate_call.enabled",
												false
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"flow.agent_terminate_call.enabled",
												checked
											)
										}
									/>
								</div>

								{Boolean(
									getConfigValue(
										"flow.agent_terminate_call.enabled",
										false
									)
								) && (
									<div className="space-y-3 pl-4 border-l-2 border-border">
										<div className="space-y-2">
											<Label>
												Termination Instruction
											</Label>
											<Textarea
												placeholder="End the call politely when the conversation is complete..."
												value={
													getConfigValue(
														"flow.agent_terminate_call.instruction",
														""
													) as string
												}
												onChange={(e) =>
													updateConfig(
														"flow.agent_terminate_call.instruction",
														e.target.value
													)
												}
												className="rounded-2xl bg-card/30"
												rows={3}
											/>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Inactivity Handling</CardTitle>
								<CardDescription>
									Handle periods of silence during calls
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<Label>Idle Time (seconds)</Label>
									<Input
										type="number"
										placeholder="10"
										value={
											getConfigValue(
												"flow.inactivity_handling.idle_time",
												""
											) as string
										}
										onChange={(e) =>
											updateConfig(
												"flow.inactivity_handling.idle_time",
												Number.parseInt(
													e.target.value
												) || 0
											)
										}
										className="rounded-2xl bg-card/30"
									/>
								</div>

								<div className="space-y-3">
									<Label>Inactivity Message</Label>
									<Input
										placeholder="Are you still there?"
										value={
											getConfigValue(
												"flow.inactivity_handling.message",
												""
											) as string
										}
										onChange={(e) =>
											updateConfig(
												"flow.inactivity_handling.message",
												e.target.value
											)
										}
										className="rounded-2xl bg-card/30"
									/>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* LLM Settings */}
					<TabsContent value="llm" className="space-y-4">
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>AI Model Configuration</CardTitle>
								<CardDescription>
									Configure the underlying AI model behavior
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-3">
									<Label>Model</Label>
									<Select
										value={
											getConfigValue(
												"llm.model",
												"gpt-4o"
											) as string
										}
										onValueChange={(value) =>
											updateConfig("llm.model", value)
										}
									>
										<SelectTrigger className="rounded-2xl bg-card/30">
											<SelectValue placeholder="Select model" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="gpt-4o">
												GPT-4 Omni
											</SelectItem>
											<SelectItem value="gpt-4o-mini">
												GPT-4 Omni Mini
											</SelectItem>
											<SelectItem value="claude-3-7-sonnet">
												Claude 3.7 Sonnet
											</SelectItem>
											<SelectItem value="claude-3-5-haiku">
												Claude 3.5 Haiku
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-3">
									<Label>Temperature (0.0 - 2.0)</Label>
									<Input
										type="number"
										min="0"
										max="2"
										step="0.1"
										placeholder="0.7"
										value={
											getConfigValue(
												"llm.temperature",
												""
											) as string
										}
										onChange={(e) =>
											updateConfig(
												"llm.temperature",
												Number.parseFloat(
													e.target.value
												) || 0
											)
										}
										className="rounded-2xl bg-card/30"
									/>
									<p className="text-sm text-muted-foreground">
										Higher values make responses more
										creative, lower values more focused
									</p>
								</div>

								<div className="space-y-4">
									<h4 className="font-medium">
										History Settings
									</h4>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Message History Limit</Label>
											<Input
												type="number"
												placeholder="20"
												value={
													getConfigValue(
														"llm.history_settings.history_message_limit",
														""
													) as string
												}
												onChange={(e) =>
													updateConfig(
														"llm.history_settings.history_message_limit",
														Number.parseInt(
															e.target.value
														) || 0
													)
												}
												className="rounded-2xl bg-card/30"
											/>
										</div>
										<div className="space-y-2">
											<Label>Tool Result Limit</Label>
											<Input
												type="number"
												placeholder="5"
												value={
													getConfigValue(
														"llm.history_settings.history_tool_result_limit",
														""
													) as string
												}
												onChange={(e) =>
													updateConfig(
														"llm.history_settings.history_tool_result_limit",
														Number.parseInt(
															e.target.value
														) || 0
													)
												}
												className="rounded-2xl bg-card/30"
											/>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Voice Settings */}
					<TabsContent value="voice" className="space-y-4">
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Speech-to-Text</CardTitle>
								<CardDescription>
									Configure speech recognition settings
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-3">
									<Label>Provider</Label>
									<Select
										value={
											getConfigValue(
												"speech_to_text.provider",
												"deepgram"
											) as string
										}
										onValueChange={(value) =>
											updateConfig(
												"speech_to_text.provider",
												value
											)
										}
									>
										<SelectTrigger className="rounded-2xl bg-card/30">
											<SelectValue placeholder="Select provider" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="deepgram">
												Deepgram
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-3">
									<Label>Model</Label>
									<Select
										value={
											getConfigValue(
												"speech_to_text.model",
												"nova-2"
											) as string
										}
										onValueChange={(value) =>
											updateConfig(
												"speech_to_text.model",
												value
											)
										}
									>
										<SelectTrigger className="rounded-2xl bg-card/30">
											<SelectValue placeholder="Select model" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="nova-2">
												Nova-2 (Latest)
											</SelectItem>
											<SelectItem value="nova">
												Nova
											</SelectItem>
											<SelectItem value="enhanced">
												Enhanced
											</SelectItem>
											<SelectItem value="base">
												Base
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>Multilingual Support</Label>
										<p className="text-sm text-muted-foreground">
											Enable automatic language detection
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"speech_to_text.multilingual",
												false
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"speech_to_text.multilingual",
												checked
											)
										}
									/>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Phone Settings */}
					<TabsContent value="phone" className="space-y-4">
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Call Settings</CardTitle>
								<CardDescription>
									Configure phone and recording settings
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>Enable Call Recording</Label>
										<p className="text-sm text-muted-foreground">
											Record all calls for quality and
											training
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"call_settings.enable_recording",
												true
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"call_settings.enable_recording",
												checked
											)
										}
									/>
								</div>

								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>DTMF Dial Support</Label>
										<p className="text-sm text-muted-foreground">
											Allow touch-tone dialing during
											calls
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"flow.dtmf_dial.enabled",
												false
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"flow.dtmf_dial.enabled",
												checked
											)
										}
									/>
								</div>

								{Boolean(
									getConfigValue(
										"flow.dtmf_dial.enabled",
										false
									)
								) && (
									<div className="space-y-3 pl-4 border-l-2 border-border">
										<Label>DTMF Instruction</Label>
										<Textarea
											placeholder="Press 1 for sales, 2 for support..."
											value={
												getConfigValue(
													"flow.dtmf_dial.instruction",
													""
												) as string
											}
											onChange={(e) =>
												updateConfig(
													"flow.dtmf_dial.instruction",
													e.target.value
												)
											}
											className="rounded-2xl bg-card/30"
											rows={3}
										/>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Voicemail Handling</CardTitle>
								<CardDescription>
									Configure behavior when reaching voicemail
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<Label>Action</Label>
									<Select
										value={
											getConfigValue(
												"flow.voicemail.action",
												"hangup"
											) as string
										}
										onValueChange={(value) =>
											updateConfig(
												"flow.voicemail.action",
												value
											)
										}
									>
										<SelectTrigger className="rounded-2xl bg-card/30">
											<SelectValue placeholder="Select action" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="hangup">
												Hang Up
											</SelectItem>
											<SelectItem value="continue">
												Continue & Leave Message
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{getConfigValue(
									"flow.voicemail.action",
									"hangup"
								) === "continue" && (
									<div className="space-y-3 pl-4 border-l-2 border-border">
										<Label>Voicemail Message</Label>
										<Textarea
											placeholder="Hi, this is an automated message from..."
											value={
												getConfigValue(
													"flow.voicemail.message",
													""
												) as string
											}
											onChange={(e) =>
												updateConfig(
													"flow.voicemail.message",
													e.target.value
												)
											}
											className="rounded-2xl bg-card/30"
											rows={3}
										/>

										<div className="flex items-center justify-between">
											<Label className="text-sm">
												Continue on voice activity
											</Label>
											<Switch
												checked={
													getConfigValue(
														"flow.voicemail.continue_on_voice_activity",
														false
													) as boolean
												}
												onCheckedChange={(checked) =>
													updateConfig(
														"flow.voicemail.continue_on_voice_activity",
														checked
													)
												}
											/>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* Session Settings */}
					<TabsContent value="session" className="space-y-4">
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Session Timeouts</CardTitle>
								<CardDescription>
									Configure call duration and idle timeouts
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-3">
										<Label>Max Duration (minutes)</Label>
										<Input
											type="number"
											placeholder="30"
											value={
												getConfigValue(
													"session_timeout.max_duration",
													""
												) as string
											}
											onChange={(e) =>
												updateConfig(
													"session_timeout.max_duration",
													Number.parseInt(
														e.target.value
													) || 0
												)
											}
											className="rounded-2xl bg-card/30"
										/>
									</div>

									<div className="space-y-3">
										<Label>Max Idle (minutes)</Label>
										<Input
											type="number"
											placeholder="5"
											value={
												getConfigValue(
													"session_timeout.max_idle",
													""
												) as string
											}
											onChange={(e) =>
												updateConfig(
													"session_timeout.max_idle",
													Number.parseInt(
														e.target.value
													) || 0
												)
											}
											className="rounded-2xl bg-card/30"
										/>
									</div>
								</div>

								<div className="space-y-3">
									<Label>Timeout Message</Label>
									<Input
										placeholder="This call is taking longer than expected. Goodbye!"
										value={
											getConfigValue(
												"session_timeout.message",
												""
											) as string
										}
										onChange={(e) =>
											updateConfig(
												"session_timeout.message",
												e.target.value
											)
										}
										className="rounded-2xl bg-card/30"
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Memory & Context</CardTitle>
								<CardDescription>
									Configure conversation memory settings
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<Label>User Identifier Key</Label>
									<Input
										placeholder="phone_number"
										value={
											getConfigValue(
												"memory.user_identifier_key",
												""
											) as string
										}
										onChange={(e) =>
											updateConfig(
												"memory.user_identifier_key",
												e.target.value
											)
										}
										className="rounded-2xl bg-card/30"
									/>
									<p className="text-sm text-muted-foreground">
										Key to use for identifying repeat
										callers
									</p>
								</div>

								<div className="space-y-3">
									<Label>Timezone</Label>
									<Select
										value={
											getConfigValue(
												"timezone",
												"UTC"
											) as string
										}
										onValueChange={(value) =>
											updateConfig("timezone", value)
										}
									>
										<SelectTrigger className="rounded-2xl bg-card/30">
											<SelectValue placeholder="Select timezone" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="UTC">
												UTC
											</SelectItem>
											<SelectItem value="America/New_York">
												Eastern Time
											</SelectItem>
											<SelectItem value="America/Chicago">
												Central Time
											</SelectItem>
											<SelectItem value="America/Denver">
												Mountain Time
											</SelectItem>
											<SelectItem value="America/Los_Angeles">
												Pacific Time
											</SelectItem>
											<SelectItem value="Europe/London">
												London
											</SelectItem>
											<SelectItem value="Europe/Paris">
												Paris
											</SelectItem>
											<SelectItem value="Asia/Tokyo">
												Tokyo
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Privacy Settings */}
					<TabsContent value="privacy" className="space-y-4">
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Privacy & Compliance</CardTitle>
								<CardDescription>
									Configure privacy and compliance settings
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>Opt-out Data Collection</Label>
										<p className="text-sm text-muted-foreground">
											Disable data collection for privacy
											compliance
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"privacy_settings.opt_out_data_collection",
												false
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"privacy_settings.opt_out_data_collection",
												checked
											)
										}
									/>
								</div>

								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label>Do Not Call Detection</Label>
										<p className="text-sm text-muted-foreground">
											Automatically detect and respect DNC
											requests
										</p>
									</div>
									<Switch
										checked={
											getConfigValue(
												"privacy_settings.do_not_call_detection",
												true
											) as boolean
										}
										onCheckedChange={(checked) =>
											updateConfig(
												"privacy_settings.do_not_call_detection",
												checked
											)
										}
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader>
								<CardTitle>Knowledge Base</CardTitle>
								<CardDescription>
									Connect to knowledge base for enhanced
									responses
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<Label>Knowledge Base Files</Label>
									<Textarea
										placeholder="file1.pdf, file2.txt (coming soon)"
										value={(
											getConfigValue(
												"knowledge_base.files",
												[]
											) as string[]
										).join(", ")}
										onChange={(e) =>
											updateConfig(
												"knowledge_base.files",
												e.target.value
													.split(",")
													.map((f: string) =>
														f.trim()
													)
													.filter(Boolean)
											)
										}
										className="rounded-2xl bg-card/30"
										rows={2}
										disabled
									/>
									<p className="text-sm text-muted-foreground">
										Knowledge base integration coming soon
									</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				<div className="flex justify-end gap-3 pt-4 border-t">
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={isSubmitting}
						className="rounded-2xl"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={isSubmitting}
						className="rounded-2xl"
					>
						{isSubmitting && (
							<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
						)}
						Save Settings
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
