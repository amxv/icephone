"use client"

import { updateVoiceAgent } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { VoiceAgent, VoiceAgentConfiguration } from "@/types"
import { SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface EssentialSettingsProps {
	agent: VoiceAgent
	onSettingsUpdated?: () => void
	trigger?: React.ReactNode
}

interface EssentialConfig {
	// Call timing settings
	idleTimeout: number // 5-30 seconds before prompting inactive user
	maxCallDuration: number // 10-60 minutes maximum call length
	inactivityMessage: string // Simple message for inactive users

	// Call handling settings
	enableRecording: boolean // Record calls for quality
	voicemailHandling: "hangup" | "leave_message" // What to do on voicemail
	dncDetection: boolean // Do not call detection

	// Business context
	businessHours: {
		enabled: boolean
		timezone: string
		message: string // After hours message
	}
}

const TIMEZONE_OPTIONS = [
	{ value: "America/New_York", label: "Eastern Time (ET)" },
	{ value: "America/Chicago", label: "Central Time (CT)" },
	{ value: "America/Denver", label: "Mountain Time (MT)" },
	{ value: "America/Los_Angeles", label: "Pacific Time (PT)" },
	{ value: "America/Phoenix", label: "Arizona (MST)" },
	{ value: "America/Anchorage", label: "Alaska Time (AKT)" },
	{ value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
	{ value: "Europe/London", label: "London (GMT)" },
	{ value: "Europe/Paris", label: "Central Europe (CET)" },
	{ value: "Asia/Tokyo", label: "Japan (JST)" },
	{ value: "Australia/Sydney", label: "Sydney (AEDT)" }
]

export function EssentialSettings({
	agent,
	onSettingsUpdated,
	trigger
}: EssentialSettingsProps) {
	const [open, setOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [config, setConfig] = useState<EssentialConfig>({
		idleTimeout: 10,
		maxCallDuration: 30,
		inactivityMessage:
			"I'm sorry, I didn't catch that. Could you please repeat?",
		enableRecording: true,
		voicemailHandling: "hangup",
		dncDetection: true,
		businessHours: {
			enabled: false,
			timezone: "America/New_York",
			message:
				"We're currently closed. Please call back during business hours or leave a message."
		}
	})

	// Load current settings when dialog opens
	useEffect(() => {
		if (open && agent.configuration) {
			try {
				// Extract settings from voice agent configuration (if it exists)
				const agentConfig = agent.configuration

				setConfig({
					idleTimeout:
						agentConfig?.flow?.inactivity_handling?.idle_time || 10,
					maxCallDuration: agentConfig?.session_timeout?.max_duration
						? Math.round(
								agentConfig.session_timeout.max_duration / 60
							)
						: 30,
					inactivityMessage:
						agentConfig?.flow?.inactivity_handling?.message ||
						"I'm sorry, I didn't catch that. Could you please repeat?",
					enableRecording:
						agentConfig?.call_settings?.enable_recording ?? true,
					voicemailHandling:
						(agentConfig?.flow?.voicemail?.action as
							| "hangup"
							| "continue") === "continue"
							? "leave_message"
							: "hangup",
					dncDetection:
						agentConfig?.privacy_settings?.do_not_call_detection ??
						true,
					businessHours: {
						enabled: false, // Will implement in future update
						timezone: agentConfig?.timezone || "America/New_York",
						message:
							"We're currently closed. Please call back during business hours or leave a message."
					}
				})
			} catch (error) {
				console.error("Error loading agent configuration:", error)
			}
		}
	}, [open, agent.configuration])

	const updateConfig = (
		key: keyof EssentialConfig | string,
		value: boolean | number | string | EssentialConfig["businessHours"]
	) => {
		if (key.includes(".")) {
			// Handle nested properties like businessHours.enabled
			const [parent, child] = key.split(".")
			if (parent === "businessHours" && child) {
				setConfig((prev) => ({
					...prev,
					businessHours: {
						...prev.businessHours,
						[child]: value
					}
				}))
			}
		} else {
			setConfig((prev) => ({
				...prev,
				[key]: value
			}))
		}
	}

	const handleSubmit = async () => {
		setIsSubmitting(true)
		try {
			// Convert simplified config back to voice agent configuration format
			const voiceConfig: Partial<VoiceAgentConfiguration> = {
				flow: {
					...agent.configuration?.flow,
					inactivity_handling: {
						idle_time: config.idleTimeout,
						message: config.inactivityMessage
					},
					voicemail: {
						action:
							config.voicemailHandling === "leave_message"
								? "continue"
								: "hangup",
						continue_on_voice_activity:
							config.voicemailHandling === "leave_message"
					}
				},
				session_timeout: {
					...agent.configuration?.session_timeout,
					max_duration: config.maxCallDuration * 60, // Convert minutes to seconds
					max_idle: config.idleTimeout,
					message:
						"Thank you for your time. Please call back if you need further assistance."
				},
				call_settings: {
					enable_recording: config.enableRecording
				},
				privacy_settings: {
					...agent.configuration?.privacy_settings,
					do_not_call_detection: config.dncDetection
				},
				timezone: config.businessHours.timezone
			}

			const result = await updateVoiceAgent(agent.id, {
				configuration: {
					...agent.configuration,
					...voiceConfig
				}
			})

			if (result.success) {
				toast.success("Settings updated successfully!")
				setOpen(false)
				onSettingsUpdated?.()
			} else {
				toast.error(result.error || "Failed to update settings")
			}
		} catch (error) {
			console.error("Error updating settings:", error)
			toast.error("An unexpected error occurred")
		} finally {
			setIsSubmitting(false)
		}
	}

	const DefaultTrigger = (
		<Button variant="outline" size="sm" className="gap-2 rounded-2xl">
			<SettingsIcon className="h-4 w-4" />
			Settings
		</Button>
	)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger || DefaultTrigger}</DialogTrigger>

			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-xl font-medium">
						Agent Settings: {agent.name}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* Call Timing Settings */}
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Call Timing
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Idle Timeout */}
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<Label className="text-base font-medium">
										Response Timeout
									</Label>
									<span className="text-sm text-muted-foreground">
										{config.idleTimeout} seconds
									</span>
								</div>
								<Slider
									value={[config.idleTimeout]}
									onValueChange={([value]) =>
										updateConfig("idleTimeout", value)
									}
									min={5}
									max={30}
									step={1}
									className="w-full"
								/>
								<p className="text-xs text-muted-foreground">
									How long to wait for customer response
									before prompting again
								</p>
							</div>

							{/* Max Call Duration */}
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<Label className="text-base font-medium">
										Maximum Call Duration
									</Label>
									<span className="text-sm text-muted-foreground">
										{config.maxCallDuration} minutes
									</span>
								</div>
								<Slider
									value={[config.maxCallDuration]}
									onValueChange={([value]) =>
										updateConfig("maxCallDuration", value)
									}
									min={10}
									max={60}
									step={5}
									className="w-full"
								/>
								<p className="text-xs text-muted-foreground">
									Automatically end calls after this duration
								</p>
							</div>

							{/* Inactivity Message */}
							<div className="space-y-3">
								<Label className="text-base font-medium">
									Inactivity Message
								</Label>
								<Textarea
									value={config.inactivityMessage}
									onChange={(e) =>
										updateConfig(
											"inactivityMessage",
											e.target.value
										)
									}
									placeholder="What to say when customer doesn't respond..."
									className="rounded-2xl bg-card/30"
									rows={2}
								/>
								<p className="text-xs text-muted-foreground">
									Message played when customer is inactive
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Call Handling Settings */}
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Call Handling
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Call Recording */}
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<Label className="text-base font-medium">
										Call Recording
									</Label>
									<p className="text-sm text-muted-foreground">
										Record calls for quality and training
										purposes
									</p>
								</div>
								<Switch
									checked={config.enableRecording}
									onCheckedChange={(checked) =>
										updateConfig("enableRecording", checked)
									}
								/>
							</div>

							{/* Voicemail Handling */}
							<div className="space-y-3">
								<Label className="text-base font-medium">
									Voicemail Detection
								</Label>
								<Select
									value={config.voicemailHandling}
									onValueChange={(
										value: "hangup" | "leave_message"
									) =>
										updateConfig("voicemailHandling", value)
									}
								>
									<SelectTrigger className="rounded-2xl bg-card/30">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="hangup">
											Hang up when voicemail detected
										</SelectItem>
										<SelectItem value="leave_message">
											Leave a message on voicemail
										</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									What to do when voicemail is detected on
									outbound calls
								</p>
							</div>

							{/* DNC Detection */}
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<Label className="text-base font-medium">
										Do Not Call Detection
									</Label>
									<p className="text-sm text-muted-foreground">
										Automatically detect and respect "do not
										call" requests
									</p>
								</div>
								<Switch
									checked={config.dncDetection}
									onCheckedChange={(checked) =>
										updateConfig("dncDetection", checked)
									}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Business Hours */}
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Business Hours
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Enable Business Hours */}
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<Label className="text-base font-medium">
										Business Hours Handling
									</Label>
									<p className="text-sm text-muted-foreground">
										Handle calls differently outside
										business hours
									</p>
								</div>
								<Switch
									checked={config.businessHours.enabled}
									onCheckedChange={(checked) =>
										updateConfig(
											"businessHours.enabled",
											checked
										)
									}
								/>
							</div>

							{config.businessHours.enabled && (
								<div className="space-y-4 pl-4 border-l-2 border-border">
									{/* Timezone */}
									<div className="space-y-3">
										<Label className="text-base font-medium">
											Timezone
										</Label>
										<Select
											value={
												config.businessHours.timezone
											}
											onValueChange={(value) =>
												updateConfig(
													"businessHours.timezone",
													value
												)
											}
										>
											<SelectTrigger className="rounded-2xl bg-card/30">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{TIMEZONE_OPTIONS.map((tz) => (
													<SelectItem
														key={tz.value}
														value={tz.value}
													>
														{tz.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* After Hours Message */}
									<div className="space-y-3">
										<Label className="text-base font-medium">
											After Hours Message
										</Label>
										<Textarea
											value={config.businessHours.message}
											onChange={(e) =>
												updateConfig(
													"businessHours.message",
													e.target.value
												)
											}
											placeholder="Message for after hours calls..."
											className="rounded-2xl bg-card/30"
											rows={3}
										/>
										<p className="text-xs text-muted-foreground">
											Message played to callers outside
											business hours
										</p>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center justify-end gap-3 pt-6 border-t">
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						className="rounded-2xl"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isSubmitting}
						className="rounded-2xl"
					>
						{isSubmitting ? (
							<>
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent mr-2" />
								Saving...
							</>
						) : (
							"Save Settings"
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
