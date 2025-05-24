"use client"

import { getAgentRoles } from "@/actions/agent-roles"
import type { AgentRole } from "@/actions/agent-roles"
import { getPhoneNumbers } from "@/actions/phone-numbers"
import type { PhoneNumber } from "@/actions/phone-numbers"
import {
	createVoiceAgent,
	createVoiceAgentWithRole
} from "@/actions/voice-agents"
import { getVoicePresets } from "@/actions/voice-presets"
import type { VoicePreset } from "@/actions/voice-presets"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { VoicePreviewGrid } from "@/components/voice-preview"
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckIcon,
	HeadphonesIcon,
	MessageSquareIcon,
	PhoneIcon,
	PlusIcon,
	SettingsIcon,
	UserIcon
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface SimpleAgentCreatorProps {
	onAgentCreated?: () => void
	trigger?: React.ReactNode
}

interface AgentConfig {
	// Step 1: Role Selection
	roleId?: number

	// Step 2: Voice & Language
	language: string
	voicePresetId?: number

	// Step 3: Basic Setup
	name: string
	phoneNumberId?: number
	status: "active" | "inactive"
	industryContext?: string
}

const LANGUAGE_OPTIONS = [
	{ value: "en", label: "English", flag: "🇺🇸" },
	{ value: "es", label: "Spanish", flag: "🇪🇸" },
	{ value: "fr", label: "French", flag: "🇫🇷" },
	{ value: "de", label: "German", flag: "🇩🇪" },
	{ value: "it", label: "Italian", flag: "🇮🇹" },
	{ value: "pt", label: "Portuguese", flag: "🇵🇹" },
	{ value: "zh", label: "Chinese", flag: "🇨🇳" },
	{ value: "hi", label: "Hindi", flag: "🇮🇳" },
	{ value: "ar", label: "Arabic", flag: "🇸🇦" },
	{ value: "ja", label: "Japanese", flag: "🇯🇵" }
]

export function SimpleAgentCreator({
	onAgentCreated,
	trigger
}: SimpleAgentCreatorProps) {
	const [open, setOpen] = useState(false)
	const [currentStep, setCurrentStep] = useState(1)
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Data loading states
	const [agentRoles, setAgentRoles] = useState<AgentRole[]>([])
	const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([])
	const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
	const [isLoadingData, setIsLoadingData] = useState(false)

	// Form state
	const [config, setConfig] = useState<AgentConfig>({
		language: "en",
		name: "",
		status: "inactive"
	})

	const loadVoicePresets = useCallback(
		async (language: string) => {
			try {
				const result = await getVoicePresets(language)

				// Server action returns array directly
				setVoicePresets(result)

				// Auto-select default voice if available
				const defaultVoice = result.find(
					(voice: VoicePreset) => voice.isDefault
				)
				if (defaultVoice && !config.voicePresetId) {
					setConfig((prev) => ({
						...prev,
						voicePresetId: defaultVoice.id
					}))
				}
			} catch (error) {
				console.error("Failed to load voice presets:", error)
				toast.error("Failed to load voice options")
			}
		},
		[config.voicePresetId]
	)

	const loadInitialData = useCallback(async () => {
		setIsLoadingData(true)
		try {
			const [rolesResult, phonesResult] = await Promise.all([
				getAgentRoles(),
				getPhoneNumbers()
			])

			// Server actions return arrays directly, not wrapped in success/data
			setAgentRoles(rolesResult)
			setPhoneNumbers(phonesResult)

			// Load initial voice presets for English
			await loadVoicePresets("en")
		} catch (error) {
			console.error("Failed to load initial data:", error)
			toast.error("Failed to load agent setup data")
		} finally {
			setIsLoadingData(false)
		}
	}, [loadVoicePresets])

	// Load initial data when dialog opens
	useEffect(() => {
		if (open) {
			loadInitialData()
		}
	}, [open, loadInitialData])

	// Load voice presets when language changes
	useEffect(() => {
		if (config.language) {
			loadVoicePresets(config.language)
		}
	}, [config.language, loadVoicePresets])

	const updateConfig = (updates: Partial<AgentConfig>) => {
		setConfig((prev) => ({ ...prev, ...updates }))
	}

	const nextStep = () => {
		if (currentStep < 3) {
			setCurrentStep((prev) => prev + 1)
		}
	}

	const prevStep = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1)
		}
	}

	const canProceedFromStep = (step: number): boolean => {
		switch (step) {
			case 1:
				return !!config.roleId
			case 2:
				return !!config.language && !!config.voicePresetId
			case 3:
				return !!config.name.trim()
			default:
				return false
		}
	}

	const handleSubmit = async () => {
		if (!canProceedFromStep(3)) {
			toast.error("Please complete all required fields")
			return
		}

		setIsSubmitting(true)
		try {
			const selectedRole = agentRoles.find(
				(role) => role.id === config.roleId
			)
			const selectedVoice = voicePresets.find(
				(voice) => voice.id === config.voicePresetId
			)

			if (
				!selectedRole ||
				!selectedVoice ||
				!config.roleId ||
				!config.voicePresetId
			) {
				toast.error("Invalid role or voice selection")
				return
			}

			// Use the enhanced createVoiceAgentWithRole function for automatic VAPI assistant creation
			const agentData = {
				name: config.name,
				description: `${selectedRole.displayName} agent with ${selectedVoice.displayName} voice`,
				agentRoleId: config.roleId,
				voicePresetId: config.voicePresetId,
				language: config.language,
				phoneNumberId: config.phoneNumberId,
				status: config.status,
				industryContext: config.industryContext
			}

			const result = await createVoiceAgentWithRole(agentData)

			if (result.success) {
				toast.success(
					"Voice agent created successfully with VAPI assistant!"
				)
				setOpen(false)
				setCurrentStep(1)
				setConfig({
					language: "en",
					name: "",
					status: "inactive"
				})
				onAgentCreated?.()
			} else {
				toast.error(result.error || "Failed to create voice agent")
			}
		} catch (error) {
			console.error("Error creating voice agent:", error)
			toast.error("An unexpected error occurred")
		} finally {
			setIsSubmitting(false)
		}
	}

	const selectedRole = agentRoles.find((role) => role.id === config.roleId)
	const selectedVoice = voicePresets.find(
		(voice) => voice.id === config.voicePresetId
	)
	const selectedLanguage = LANGUAGE_OPTIONS.find(
		(lang) => lang.value === config.language
	)

	const DefaultTrigger = (
		<Button variant="outline" className="gap-2 rounded-2xl">
			<PlusIcon className="h-4 w-4" />
			Create Voice Agent
		</Button>
	)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger || DefaultTrigger}</DialogTrigger>

			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl font-medium">
						Create Voice Agent
					</DialogTitle>
				</DialogHeader>

				{/* Progress Indicator */}
				<div className="flex items-center gap-2 mb-6">
					{[1, 2, 3].map((step) => (
						<div key={step} className="flex items-center gap-2">
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
									step < currentStep
										? "bg-primary text-primary-foreground"
										: step === currentStep
											? "bg-primary/20 text-primary border-2 border-primary"
											: "bg-muted text-muted-foreground"
								}`}
							>
								{step < currentStep ? (
									<CheckIcon className="h-4 w-4" />
								) : (
									step
								)}
							</div>
							{step < 3 && (
								<div
									className={`h-0.5 w-16 transition-colors ${
										step < currentStep
											? "bg-primary"
											: "bg-muted"
									}`}
								/>
							)}
						</div>
					))}
				</div>

				{/* Step Content */}
				<div className="min-h-[400px]">
					{/* Step 1: Role Selection */}
					{currentStep === 1 && (
						<div className="space-y-6">
							<div className="text-center mb-6">
								<UserIcon className="h-12 w-12 mx-auto text-primary mb-3" />
								<h3 className="text-xl font-medium mb-2">
									Choose Your Agent's Role
								</h3>
								<p className="text-muted-foreground">
									Select what your voice agent will specialize
									in. Each role comes with optimized
									conversation patterns.
								</p>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{agentRoles.map((role) => {
									const IconComponent =
										role.icon === "MessageSquareIcon"
											? MessageSquareIcon
											: role.icon === "PhoneIcon"
												? PhoneIcon
												: role.icon === "SettingsIcon"
													? SettingsIcon
													: UserIcon

									return (
										<Card
											key={role.id}
											className={`cursor-pointer transition-all hover:shadow-md border-2 rounded-3xl ${
												config.roleId === role.id
													? "border-primary bg-primary/5 shadow-sm"
													: "border-border hover:border-primary/50"
											}`}
											onClick={() =>
												updateConfig({
													roleId: role.id
												})
											}
										>
											<CardHeader className="text-center pb-2">
												<div className="mx-auto mb-3 p-3 rounded-2xl bg-primary/10 w-fit">
													<IconComponent className="h-6 w-6 text-primary" />
												</div>
												<CardTitle className="text-lg">
													{role.displayName}
												</CardTitle>
											</CardHeader>
											<CardContent className="pt-0">
												<p className="text-sm text-muted-foreground text-center mb-4">
													{role.description}
												</p>
												<div className="space-y-2">
													<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
														Conversation Style
													</div>
													<div className="text-sm">
														{role.conversationStyle}
													</div>

													{role.industryFocus && (
														<>
															<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3">
																Industry Focus
															</div>
															<div className="text-sm">
																{
																	role.industryFocus
																}
															</div>
														</>
													)}
												</div>
											</CardContent>
										</Card>
									)
								})}
							</div>
						</div>
					)}

					{/* Step 2: Voice & Language */}
					{currentStep === 2 && (
						<div className="space-y-6">
							<div className="text-center mb-6">
								<HeadphonesIcon className="h-12 w-12 mx-auto text-primary mb-3" />
								<h3 className="text-xl font-medium mb-2">
									Select Voice & Language
								</h3>
								<p className="text-muted-foreground">
									Choose the language and voice personality
									that best represents your business.
								</p>
							</div>

							{/* Language Selection */}
							<div className="space-y-3">
								<Label className="text-base font-medium">
									Language
								</Label>
								<Select
									value={config.language}
									onValueChange={(language) =>
										updateConfig({
											language,
											voicePresetId: undefined
										})
									}
								>
									<SelectTrigger className="w-full rounded-2xl">
										<SelectValue placeholder="Select language" />
									</SelectTrigger>
									<SelectContent>
										{LANGUAGE_OPTIONS.map((lang) => (
											<SelectItem
												key={lang.value}
												value={lang.value}
											>
												<div className="flex items-center gap-2">
													<span>{lang.flag}</span>
													<span>{lang.label}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Voice Selection */}
							<div className="space-y-3">
								<Label className="text-base font-medium">
									Voice Personality
								</Label>
								<VoicePreviewGrid
									voicePresets={voicePresets}
									selectedVoice={selectedVoice || null}
									onVoiceSelect={(preset) =>
										updateConfig({
											voicePresetId: preset.id
										})
									}
									isLoading={isLoadingData}
									columns={2}
								/>
							</div>
						</div>
					)}

					{/* Step 3: Basic Setup */}
					{currentStep === 3 && (
						<div className="space-y-6">
							<div className="text-center mb-6">
								<SettingsIcon className="h-12 w-12 mx-auto text-primary mb-3" />
								<h3 className="text-xl font-medium mb-2">
									Complete Setup
								</h3>
								<p className="text-muted-foreground">
									Give your agent a name and configure basic
									settings to get started.
								</p>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{/* Left Column */}
								<div className="space-y-4">
									{/* Agent Name */}
									<div className="space-y-2">
										<Label
											htmlFor="agent-name"
											className="text-base font-medium"
										>
											Agent Name *
										</Label>
										<Input
											id="agent-name"
											placeholder="e.g., Customer Support Assistant"
											value={config.name}
											onChange={(e) =>
												updateConfig({
													name: e.target.value
												})
											}
											className="rounded-2xl"
										/>
									</div>

									{/* Phone Number Assignment */}
									<div className="space-y-2">
										<Label className="text-base font-medium">
											Phone Number (Optional)
										</Label>
										<Select
											value={
												config.phoneNumberId?.toString() ||
												"none"
											}
											onValueChange={(value) =>
												updateConfig({
													phoneNumberId:
														value === "none"
															? undefined
															: Number.parseInt(
																	value,
																	10
																)
												})
											}
										>
											<SelectTrigger className="w-full rounded-2xl">
												<SelectValue placeholder="Assign to phone number" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">
													No phone number assigned
												</SelectItem>
												{phoneNumbers.map((phone) => (
													<SelectItem
														key={phone.id}
														value={phone.id.toString()}
													>
														{phone.number}{" "}
														{phone.friendlyName &&
															`(${phone.friendlyName})`}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* Agent Status */}
									<div className="space-y-2">
										<Label className="text-base font-medium">
											Status
										</Label>
										<div className="flex items-center space-x-2">
											<Switch
												checked={
													config.status === "active"
												}
												onCheckedChange={(checked) =>
													updateConfig({
														status: checked
															? "active"
															: "inactive"
													})
												}
											/>
											<span className="text-sm">
												{config.status === "active"
													? "Active (Ready to take calls)"
													: "Inactive (Setup mode)"}
											</span>
										</div>
									</div>
								</div>

								{/* Right Column */}
								<div className="space-y-4">
									{/* Industry Context */}
									<div className="space-y-2">
										<Label
											htmlFor="industry-context"
											className="text-base font-medium"
										>
											Business Context (Optional)
										</Label>
										<Textarea
											id="industry-context"
											placeholder="Describe your business or industry to help the agent provide better responses..."
											value={config.industryContext || ""}
											onChange={(e) =>
												updateConfig({
													industryContext:
														e.target.value
												})
											}
											className="rounded-2xl min-h-[100px]"
										/>
									</div>

									{/* Configuration Summary */}
									<Card className="bg-muted/40 border-dashed">
										<CardHeader className="pb-3">
											<CardTitle className="text-base">
												Configuration Summary
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Role:
												</span>
												<span className="font-medium">
													{selectedRole?.displayName}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Language:
												</span>
												<span className="font-medium">
													{selectedLanguage?.label}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Voice:
												</span>
												<span className="font-medium">
													{selectedVoice?.displayName}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Status:
												</span>
												<span
													className={`font-medium ${config.status === "active" ? "text-green-600" : "text-amber-600"}`}
												>
													{config.status === "active"
														? "Active"
														: "Inactive"}
												</span>
											</div>
										</CardContent>
									</Card>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Navigation Buttons */}
				<div className="flex items-center justify-between pt-6 border-t">
					<Button
						variant="outline"
						onClick={prevStep}
						disabled={currentStep === 1}
						className="gap-2 rounded-2xl"
					>
						<ArrowLeftIcon className="h-4 w-4" />
						Previous
					</Button>

					<div className="flex items-center gap-2">
						{currentStep < 3 ? (
							<Button
								onClick={nextStep}
								disabled={!canProceedFromStep(currentStep)}
								className="gap-2 rounded-2xl"
							>
								Next
								<ArrowRightIcon className="h-4 w-4" />
							</Button>
						) : (
							<Button
								onClick={handleSubmit}
								disabled={
									!canProceedFromStep(3) || isSubmitting
								}
								className="gap-2 rounded-2xl"
							>
								{isSubmitting ? (
									<>
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />
										Creating...
									</>
								) : (
									<>
										<CheckIcon className="h-4 w-4" />
										Create Agent
									</>
								)}
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
