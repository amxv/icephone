"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import {
	Bot,
	Settings,
	MessageSquare,
	Target,
	Brain,
	Save,
	Play,
	TestTube,
	Users,
	MessageCircle,
	Clock,
	Volume2
} from "lucide-react"
import type { CampaignVoiceConfiguration } from "@/actions/campaigns/voice-integration"
import {
	configureCampaignVoiceAgent,
	getCampaignVoiceConfiguration
} from "@/actions/campaigns/voice-integration"
import { getPhoneNumbers } from "@/actions/phone-numbers"
import { toast } from "sonner"

interface CampaignVoiceConfigurationComponentProps {
	campaignId: number
	campaignName: string
	voiceAgentId?: number
	onConfigurationSaved?: () => void
}

interface TeamPhoneNumberOption {
	id: number
	phoneNumber: string
	provider: "mock" | "twilio" | "telnyx" | "vonage"
	label: string | null
	isDefaultOutbound: boolean
	status: "provisioning" | "active" | "inactive" | "released"
}

export function CampaignVoiceConfigurationComponent({
	campaignId,
	campaignName,
	voiceAgentId,
	onConfigurationSaved
}: CampaignVoiceConfigurationComponentProps) {
	const [resolvedVoiceAgentId, setResolvedVoiceAgentId] = useState<
		number | null
	>(voiceAgentId ?? null)
	const [configuration, setConfiguration] =
		useState<CampaignVoiceConfiguration>({
			campaignSpecificPrompt: "",
			outboundPhoneNumberId: null,
			leadPersonalizationRules: {
				includeLeadName: true,
				includeLeadScore: true,
				includePreviousInteractions: true,
				includeSource: false,
				includeNotes: false
			},
			callFlowCustomization: {
				openingScript: "",
				objectionHandling: [],
				closingScript: "",
				appointmentScheduling: false,
				followupInstructions: ""
			},
			contextVariables: {
				campaignGoal: "",
				targetAudience: "",
				valueProposition: "",
				urgencyLevel: "medium",
				callToAction: ""
			},
			behaviorSettings: {
				aggressivenessLevel: 5,
				professionalismLevel: 8,
				persistenceLevel: 6,
				empathyLevel: 7
			}
		})

	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [objectionInput, setObjectionInput] = useState("")
	const [teamPhoneNumbers, setTeamPhoneNumbers] = useState<
		TeamPhoneNumberOption[]
	>([])

	// Load existing configuration
	useEffect(() => {
		const loadConfiguration = async () => {
			setIsLoading(true)
			try {
				const [configResult, phoneNumbersResult] = await Promise.all([
					getCampaignVoiceConfiguration(campaignId),
					getPhoneNumbers()
				])
				if (
					configResult.success &&
					configResult.data?.voiceConfiguration
				) {
					setConfiguration((prevConfig) => ({
						...prevConfig,
						...configResult.data.voiceConfiguration
					}))
				}
				setResolvedVoiceAgentId(configResult.data?.voiceAgentId ?? null)
				if (phoneNumbersResult.success && phoneNumbersResult.data) {
					setTeamPhoneNumbers(
						phoneNumbersResult.data.filter(
							(number) => number.status === "active"
						)
					)
				}
			} catch (error) {
				console.error("Error loading voice configuration:", error)
				toast.error("Failed to load voice configuration")
			} finally {
				setIsLoading(false)
			}
		}

		loadConfiguration()
	}, [campaignId])

	const handleSaveConfiguration = async () => {
		if (!resolvedVoiceAgentId) {
			toast.error("Please assign a voice agent to this campaign first")
			return
		}

		setIsSaving(true)
		try {
			const result = await configureCampaignVoiceAgent(
				campaignId,
				configuration
			)
			if (result.success) {
				toast.success("Voice agent configuration saved successfully")
				onConfigurationSaved?.()
			} else {
				toast.error(result.error || "Failed to save configuration")
			}
		} catch (error) {
			console.error("Error saving voice configuration:", error)
			toast.error("Failed to save voice configuration")
		} finally {
			setIsSaving(false)
		}
	}

	const addObjectionHandling = () => {
		if (!objectionInput.trim()) return

		setConfiguration((prev) => ({
			...prev,
			callFlowCustomization: {
				...prev.callFlowCustomization,
				objectionHandling: [
					...(prev.callFlowCustomization?.objectionHandling || []),
					objectionInput.trim()
				]
			}
		}))
		setObjectionInput("")
	}

	const removeObjectionHandling = (index: number) => {
		setConfiguration((prev) => ({
			...prev,
			callFlowCustomization: {
				...prev.callFlowCustomization,
				objectionHandling:
					prev.callFlowCustomization?.objectionHandling?.filter(
						(_, i) => i !== index
					) || []
			}
		}))
	}

	const updateBehaviorSetting = (
		key: keyof NonNullable<CampaignVoiceConfiguration["behaviorSettings"]>,
		value: number
	) => {
		setConfiguration((prev) => ({
			...prev,
			behaviorSettings: {
				...prev.behaviorSettings,
				[key]: value
			}
		}))
	}

	if (isLoading) {
		return (
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-6">
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="h-8 w-1 bg-gradient-to-b from-violet-500 to-violet-500/60 rounded-full" />
					<div className="flex items-center gap-2">
						<Bot className="h-5 w-5 text-muted-foreground" />
						<h2 className="text-lg font-medium">
							Voice Agent Configuration
						</h2>
					</div>
				</div>
				<Button
					onClick={handleSaveConfiguration}
					disabled={isSaving || !resolvedVoiceAgentId}
					className="gap-2 rounded-2xl"
				>
					<Save className="h-4 w-4" />
					{isSaving ? "Saving..." : "Save Configuration"}
				</Button>
			</div>

			{!resolvedVoiceAgentId && (
				<Card className="rounded-2xl border-amber-200 bg-amber-50/40 backdrop-blur-sm">
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Bot className="h-4 w-4 text-amber-600" />
							<p className="text-sm text-amber-800">
								Please assign a voice agent to this campaign
								before configuring voice settings.
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			<Tabs defaultValue="prompt" className="space-y-4">
				<TabsList className="grid w-full grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 h-auto">
					<TabsTrigger
						value="prompt"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<MessageSquare className="h-4 w-4 mr-2" />
						Prompt
					</TabsTrigger>
					<TabsTrigger
						value="personalization"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<Users className="h-4 w-4 mr-2" />
						Personalization
					</TabsTrigger>
					<TabsTrigger
						value="callflow"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<MessageCircle className="h-4 w-4 mr-2" />
						Call Flow
					</TabsTrigger>
					<TabsTrigger
						value="context"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<Target className="h-4 w-4 mr-2" />
						Context
					</TabsTrigger>
					<TabsTrigger
						value="behavior"
						className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
					>
						<Brain className="h-4 w-4 mr-2" />
						Behavior
					</TabsTrigger>
				</TabsList>

				{/* Campaign Prompt Tab */}
				<TabsContent value="prompt" className="space-y-4">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Campaign-Specific Instructions
							</CardTitle>
							<CardDescription>
								Add special instructions that will be combined
								with your voice agent's base prompt for this
								campaign.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-2">
							<div className="space-y-4">
								<div>
									<Label htmlFor="campaign-prompt">
										Campaign Instructions
									</Label>
									<Textarea
										id="campaign-prompt"
										className="rounded-lg resize-none min-h-[120px] mt-1.5"
										placeholder="Add specific instructions for this campaign... For example: 'This is a follow-up campaign for leads who attended our webinar. Reference their interest in the topic and focus on scheduling a demo.'"
										value={
											configuration.campaignSpecificPrompt ||
											""
										}
										onChange={(e) =>
											setConfiguration((prev) => ({
												...prev,
												campaignSpecificPrompt:
													e.target.value
											}))
										}
									/>
								</div>
								<div className="text-xs text-muted-foreground">
									💡 These instructions will be added to your
									voice agent's base prompt specifically for
									calls in this campaign.
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Lead Personalization Tab */}
				<TabsContent value="personalization" className="space-y-4">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Lead Personalization Rules
							</CardTitle>
							<CardDescription>
								Configure what lead information to include in
								each call to personalize the conversation.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-2">
							<div className="space-y-6">
								{[
									{
										key: "includeLeadName",
										label: "Lead Name",
										desc: "Include the lead's name in the call context"
									},
									{
										key: "includeLeadScore",
										label: "Lead Score",
										desc: "Include the lead's score (0-100) to adjust approach"
									},
									{
										key: "includeSource",
										label: "Lead Source",
										desc: "Include where the lead came from (website, referral, etc.)"
									},
									{
										key: "includeNotes",
										label: "Lead Notes",
										desc: "Include any existing notes about the lead"
									},
									{
										key: "includePreviousInteractions",
										label: "Previous Interactions",
										desc: "Include history of previous calls and outcomes"
									}
								].map((rule) => (
									<div
										key={rule.key}
										className="flex items-center justify-between py-2"
									>
										<div className="space-y-1">
											<Label className="text-sm font-medium">
												{rule.label}
											</Label>
											<p className="text-xs text-muted-foreground">
												{rule.desc}
											</p>
										</div>
										<Switch
											checked={
												configuration
													.leadPersonalizationRules?.[
													rule.key as keyof NonNullable<
														CampaignVoiceConfiguration["leadPersonalizationRules"]
													>
												] || false
											}
											onCheckedChange={(checked) =>
												setConfiguration((prev) => ({
													...prev,
													leadPersonalizationRules: {
														includeLeadName: true,
														includeLeadScore: true,
														includePreviousInteractions: true,
														includeSource: false,
														includeNotes: false,
														...prev.leadPersonalizationRules,
														[rule.key]: checked
													}
												}))
											}
										/>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Call Flow Tab */}
				<TabsContent value="callflow" className="space-y-4">
					<div className="grid gap-4">
						{/* Opening Script */}
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader className="pb-4">
								<CardTitle className="text-lg">
									Call Flow Scripts
								</CardTitle>
								<CardDescription>
									Customize how your voice agent opens,
									handles objections, and closes calls.
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 space-y-4">
								<div>
									<Label htmlFor="opening-script">
										Opening Script
									</Label>
									<Textarea
										id="opening-script"
										className="rounded-lg resize-none min-h-[80px] mt-1.5"
										placeholder="How should the agent start the call? e.g., 'Hi [Lead Name], this is [Agent Name] from [Company]. I'm calling about your interest in...'"
										value={
											configuration.callFlowCustomization
												?.openingScript || ""
										}
										onChange={(e) =>
											setConfiguration((prev) => ({
												...prev,
												callFlowCustomization: {
													...prev.callFlowCustomization,
													openingScript:
														e.target.value
												}
											}))
										}
									/>
								</div>

								<div>
									<Label htmlFor="closing-script">
										Closing Script
									</Label>
									<Textarea
										id="closing-script"
										className="rounded-lg resize-none min-h-[80px] mt-1.5"
										placeholder="How should the agent end the call? e.g., 'Thank you for your time. I'll send you the information we discussed...'"
										value={
											configuration.callFlowCustomization
												?.closingScript || ""
										}
										onChange={(e) =>
											setConfiguration((prev) => ({
												...prev,
												callFlowCustomization: {
													...prev.callFlowCustomization,
													closingScript:
														e.target.value
												}
											}))
										}
									/>
								</div>

								<div>
									<Label htmlFor="followup-instructions">
										Follow-up Instructions
									</Label>
									<Textarea
										id="followup-instructions"
										className="rounded-lg resize-none min-h-[60px] mt-1.5"
										placeholder="What should the agent do after the call? e.g., 'Send a follow-up email within 2 hours with the demo link...'"
										value={
											configuration.callFlowCustomization
												?.followupInstructions || ""
										}
										onChange={(e) =>
											setConfiguration((prev) => ({
												...prev,
												callFlowCustomization: {
													...prev.callFlowCustomization,
													followupInstructions:
														e.target.value
												}
											}))
										}
									/>
								</div>

								<div className="flex items-center justify-between py-2">
									<div className="space-y-1">
										<Label className="text-sm font-medium">
											Appointment Scheduling
										</Label>
										<p className="text-xs text-muted-foreground">
											Enable the agent to offer
											appointment scheduling during calls
										</p>
									</div>
									<Switch
										checked={
											configuration.callFlowCustomization
												?.appointmentScheduling || false
										}
										onCheckedChange={(checked) =>
											setConfiguration((prev) => ({
												...prev,
												callFlowCustomization: {
													...prev.callFlowCustomization,
													appointmentScheduling:
														checked
												}
											}))
										}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Objection Handling */}
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
							<CardHeader className="pb-4">
								<CardTitle className="text-lg">
									Objection Handling
								</CardTitle>
								<CardDescription>
									Prepare your agent with responses to common
									objections.
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 space-y-4">
								<div className="flex gap-2">
									<Input
										className="rounded-lg flex-1"
										placeholder="Add an objection handling response..."
										value={objectionInput}
										onChange={(e) =>
											setObjectionInput(e.target.value)
										}
										onKeyPress={(e) =>
											e.key === "Enter" &&
											addObjectionHandling()
										}
									/>
									<Button
										onClick={addObjectionHandling}
										disabled={!objectionInput.trim()}
										size="sm"
										className="rounded-lg"
									>
										Add
									</Button>
								</div>

								{configuration.callFlowCustomization
									?.objectionHandling &&
									configuration.callFlowCustomization
										.objectionHandling.length > 0 && (
										<div className="space-y-2">
											{configuration.callFlowCustomization.objectionHandling.map(
												(objection, index) => (
													<div
														key={index}
														className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"
													>
														<p className="text-sm flex-1">
															{objection}
														</p>
														<Button
															onClick={() =>
																removeObjectionHandling(
																	index
																)
															}
															variant="ghost"
															size="sm"
															className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
														>
															×
														</Button>
													</div>
												)
											)}
										</div>
									)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Campaign Context Tab */}
				<TabsContent value="context" className="space-y-4">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Campaign Context
							</CardTitle>
							<CardDescription>
								Define the campaign's goals, target audience,
								and key messaging for better call
								personalization.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-2 space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<Label htmlFor="campaign-goal">
										Campaign Goal
									</Label>
									<Input
										id="campaign-goal"
										className="rounded-lg mt-1.5"
										placeholder="e.g., Generate qualified demo requests"
										value={
											configuration.contextVariables
												?.campaignGoal || ""
										}
										onChange={(e) =>
											setConfiguration((prev) => ({
												...prev,
												contextVariables: {
													...prev.contextVariables,
													campaignGoal: e.target.value
												}
											}))
										}
									/>
								</div>

								<div>
									<Label htmlFor="target-audience">
										Target Audience
									</Label>
									<Input
										id="target-audience"
										className="rounded-lg mt-1.5"
										placeholder="e.g., SaaS founders with 10-50 employees"
										value={
											configuration.contextVariables
												?.targetAudience || ""
										}
										onChange={(e) =>
											setConfiguration((prev) => ({
												...prev,
												contextVariables: {
													...prev.contextVariables,
													targetAudience:
														e.target.value
												}
											}))
										}
									/>
								</div>
							</div>

							<div>
								<Label htmlFor="value-proposition">
									Value Proposition
								</Label>
								<Textarea
									id="value-proposition"
									className="rounded-lg resize-none min-h-[80px] mt-1.5"
									placeholder="What's the key value you offer? e.g., 'We help SaaS companies reduce churn by 40% through predictive analytics...'"
									value={
										configuration.contextVariables
											?.valueProposition || ""
									}
									onChange={(e) =>
										setConfiguration((prev) => ({
											...prev,
											contextVariables: {
												...prev.contextVariables,
												valueProposition: e.target.value
											}
										}))
									}
								/>
							</div>

							<div>
								<Label htmlFor="call-to-action">
									Call to Action
								</Label>
								<Input
									id="call-to-action"
									className="rounded-lg mt-1.5"
									placeholder="e.g., Schedule a 15-minute demo, Book a strategy call"
									value={
										configuration.contextVariables
											?.callToAction || ""
									}
									onChange={(e) =>
										setConfiguration((prev) => ({
											...prev,
											contextVariables: {
												...prev.contextVariables,
												callToAction: e.target.value
											}
										}))
									}
								/>
							</div>

							<div>
								<Label className="text-sm font-medium">
									Urgency Level
								</Label>
								<div className="grid grid-cols-3 gap-2 mt-1.5">
									{["low", "medium", "high"].map((level) => (
										<Button
											key={level}
											variant={
												configuration.contextVariables
													?.urgencyLevel === level
													? "default"
													: "outline"
											}
											size="sm"
											className="rounded-lg capitalize"
											onClick={() =>
												setConfiguration((prev) => ({
													...prev,
													contextVariables: {
														...prev.contextVariables,
														urgencyLevel: level as
															| "low"
															| "medium"
															| "high"
													}
												}))
											}
										>
											{level}
										</Button>
									))}
								</div>
							</div>

							<Separator />

							<div className="space-y-2">
								<Label htmlFor="campaign-outbound-number">
									Outbound Caller ID
								</Label>
								<Select
									value={
										configuration.outboundPhoneNumberId
											? configuration.outboundPhoneNumberId.toString()
											: "auto"
									}
									onValueChange={(value) =>
										setConfiguration((prev) => ({
											...prev,
											outboundPhoneNumberId:
												value === "auto"
													? null
													: Number(value)
										}))
									}
								>
									<SelectTrigger
										id="campaign-outbound-number"
										className="rounded-lg mt-1.5"
									>
										<SelectValue placeholder="Auto-select from team routing" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="auto">
											Auto-select from team routing
										</SelectItem>
										{teamPhoneNumbers.map((number) => (
											<SelectItem
												key={number.id}
												value={number.id.toString()}
											>
												{number.phoneNumber}
												{number.label
													? ` • ${number.label}`
													: ""}
												{number.isDefaultOutbound
													? " • Default"
													: ""}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Applies to queued campaign calls. Keep Auto
									to use provider + agent-aware routing.
								</p>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Behavior Settings Tab */}
				<TabsContent value="behavior" className="space-y-4">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg">
								Agent Behavior Settings
							</CardTitle>
							<CardDescription>
								Fine-tune your voice agent's personality and
								approach for this campaign.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-2 space-y-6">
							{[
								{
									key: "aggressivenessLevel",
									label: "Aggressiveness",
									desc: "How assertive should the agent be?",
									lowLabel: "Gentle",
									highLabel: "Assertive"
								},
								{
									key: "professionalismLevel",
									label: "Professionalism",
									desc: "How formal should the agent sound?",
									lowLabel: "Casual",
									highLabel: "Formal"
								},
								{
									key: "persistenceLevel",
									label: "Persistence",
									desc: "How persistent should the agent be?",
									lowLabel: "Relaxed",
									highLabel: "Persistent"
								},
								{
									key: "empathyLevel",
									label: "Empathy",
									desc: "How empathetic should the agent be?",
									lowLabel: "Direct",
									highLabel: "Empathetic"
								}
							].map((setting) => (
								<div key={setting.key} className="space-y-3">
									<div>
										<div className="flex items-center justify-between">
											<Label className="text-sm font-medium">
												{setting.label}
											</Label>
											<Badge
												variant="outline"
												className="text-xs"
											>
												{configuration
													.behaviorSettings?.[
													setting.key as keyof NonNullable<
														CampaignVoiceConfiguration["behaviorSettings"]
													>
												] || 5}
												/10
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											{setting.desc}
										</p>
									</div>
									<div className="space-y-2">
										<Slider
											value={[
												configuration
													.behaviorSettings?.[
													setting.key as keyof NonNullable<
														CampaignVoiceConfiguration["behaviorSettings"]
													>
												] || 5
											]}
											onValueChange={([value]) =>
												updateBehaviorSetting(
													setting.key as keyof NonNullable<
														CampaignVoiceConfiguration["behaviorSettings"]
													>,
													value
												)
											}
											max={10}
											min={1}
											step={1}
											className="w-full"
										/>
										<div className="flex justify-between text-xs text-muted-foreground">
											<span>{setting.lowLabel}</span>
											<span>{setting.highLabel}</span>
										</div>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}
