"use client"

import {
	createEnhancedCampaign,
	getCampaignTemplates,
	createCampaignFromTemplate,
	type EnhancedCampaignData,
	type CampaignStatus
} from "@/actions/campaigns"
import { getVoiceAgents } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { VoiceAgent } from "@/types"
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	BotIcon,
	CheckIcon,
	ClockIcon,
	CopyIcon,
	FileTextIcon,
	PhoneIcon,
	PlusIcon,
	SettingsIcon,
	TargetIcon,
	BookTemplateIcon,
	ZapIcon
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

// Form data interface
interface CampaignFormData {
	// Basic Information
	name: string
	description: string
	voiceAgentId: number | null

	// Call Timing
	callTimingEnabled: boolean
	timezone: string
	businessHoursEnabled: boolean
	maxCallsPerDay: number
	callInterval: number

	// Week schedule
	mondayEnabled: boolean
	mondayStart: string
	mondayEnd: string
	tuesdayEnabled: boolean
	tuesdayStart: string
	tuesdayEnd: string
	wednesdayEnabled: boolean
	wednesdayStart: string
	wednesdayEnd: string
	thursdayEnabled: boolean
	thursdayStart: string
	thursdayEnd: string
	fridayEnabled: boolean
	fridayStart: string
	fridayEnd: string
	saturdayEnabled: boolean
	saturdayStart: string
	saturdayEnd: string
	sundayEnabled: boolean
	sundayStart: string
	sundayEnd: string

	// Retry Logic
	maxAttempts: number
	retryInterval1: number
	retryInterval2: number
	retryInterval3: number

	// Goals
	targetLeads: number | null
	targetConversions: number | null
	targetCallsPerDay: number | null

	// Automation
	autoProgressLeads: boolean
	autoScheduleFollowups: boolean
	autoUpdateScores: boolean

	// Schedule
	startDate: string
	endDate: string
}

interface CampaignCreationDialogProps {
	trigger?: React.ReactNode
	onCampaignCreated?: () => void
}

const STEP_LABELS = {
	template: "Choose Template",
	basic: "Basic Information",
	agent: "Voice Agent",
	timing: "Call Timing",
	retry: "Retry Logic",
	goals: "Goals & Success",
	review: "Review & Create"
}

const DAYS_OF_WEEK = [
	{ key: "monday", label: "Monday" },
	{ key: "tuesday", label: "Tuesday" },
	{ key: "wednesday", label: "Wednesday" },
	{ key: "thursday", label: "Thursday" },
	{ key: "friday", label: "Friday" },
	{ key: "saturday", label: "Saturday" },
	{ key: "sunday", label: "Sunday" }
] as const

const TIMEZONES = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Phoenix",
	"Europe/London",
	"Europe/Paris",
	"Asia/Tokyo",
	"Australia/Sydney"
]

export function CampaignCreationDialog({
	trigger,
	onCampaignCreated
}: CampaignCreationDialogProps) {
	const [open, setOpen] = useState(false)
	const [currentStep, setCurrentStep] = useState("template")
	const [isLoading, setIsLoading] = useState(false)
	const [voiceAgents, setVoiceAgents] = useState<VoiceAgent[]>([])
	const [agentsLoading, setAgentsLoading] = useState(false)
	// Type for campaign template data (matches database schema)
	type CampaignTemplate = {
		id: number
		name: string
		description: string | null
		startDate: Date | null
		endDate: Date | null
		status: CampaignStatus | null
		voiceAgentId: number | null
		campaignSettings: Record<string, unknown> | null
		createdAt: Date
		updatedAt: Date
		userId: string
	}

	const [templates, setTemplates] = useState<CampaignTemplate[]>([])
	const [templatesLoading, setTemplatesLoading] = useState(false)
	const [selectedTemplate, setSelectedTemplate] =
		useState<CampaignTemplate | null>(null)
	const [creationMode, setCreationMode] = useState<"scratch" | "template">(
		"scratch"
	)

	// Form data state
	const [formData, setFormData] = useState<CampaignFormData>({
		// Basic Information
		name: "",
		description: "",
		voiceAgentId: null,

		// Call Timing
		callTimingEnabled: false,
		timezone: "America/New_York",
		businessHoursEnabled: false,
		maxCallsPerDay: 50,
		callInterval: 5,

		// Week schedule
		mondayEnabled: true,
		mondayStart: "09:00",
		mondayEnd: "17:00",
		tuesdayEnabled: true,
		tuesdayStart: "09:00",
		tuesdayEnd: "17:00",
		wednesdayEnabled: true,
		wednesdayStart: "09:00",
		wednesdayEnd: "17:00",
		thursdayEnabled: true,
		thursdayStart: "09:00",
		thursdayEnd: "17:00",
		fridayEnabled: true,
		fridayStart: "09:00",
		fridayEnd: "17:00",
		saturdayEnabled: false,
		saturdayStart: "09:00",
		saturdayEnd: "17:00",
		sundayEnabled: false,
		sundayStart: "09:00",
		sundayEnd: "17:00",

		// Retry Logic
		maxAttempts: 3,
		retryInterval1: 2,
		retryInterval2: 24,
		retryInterval3: 72,

		// Goals
		targetLeads: null,
		targetConversions: null,
		targetCallsPerDay: null,

		// Automation
		autoProgressLeads: true,
		autoScheduleFollowups: false,
		autoUpdateScores: true,

		// Schedule
		startDate: "",
		endDate: ""
	})

	const [errors, setErrors] = useState<
		Partial<Record<keyof CampaignFormData, string>>
	>({})

	const updateFormData = useCallback((updates: Partial<CampaignFormData>) => {
		setFormData((prev) => ({ ...prev, ...updates }))
	}, [])

	const loadVoiceAgents = useCallback(async () => {
		try {
			setAgentsLoading(true)
			const result = await getVoiceAgents()
			if (result.success && result.data) {
				setVoiceAgents(result.data)
			}
		} catch (error) {
			console.error("Failed to load voice agents:", error)
			toast.error("Failed to load voice agents")
		} finally {
			setAgentsLoading(false)
		}
	}, [])

	const loadTemplates = useCallback(async () => {
		try {
			setTemplatesLoading(true)
			const result = await getCampaignTemplates()
			if (result.success && result.data) {
				setTemplates(result.data)
			}
		} catch (error) {
			console.error("Failed to load templates:", error)
			toast.error("Failed to load templates")
		} finally {
			setTemplatesLoading(false)
		}
	}, [])

	useEffect(() => {
		if (open && currentStep === "agent") {
			loadVoiceAgents()
		}
		if (open && currentStep === "template") {
			loadTemplates()
		}
	}, [open, currentStep, loadVoiceAgents, loadTemplates])

	const resetForm = () => {
		setCurrentStep("template")
		setCreationMode("scratch")
		setSelectedTemplate(null)
		setFormData({
			name: "",
			description: "",
			voiceAgentId: null,
			callTimingEnabled: false,
			timezone: "America/New_York",
			businessHoursEnabled: false,
			maxCallsPerDay: 50,
			callInterval: 5,
			mondayEnabled: true,
			mondayStart: "09:00",
			mondayEnd: "17:00",
			tuesdayEnabled: true,
			tuesdayStart: "09:00",
			tuesdayEnd: "17:00",
			wednesdayEnabled: true,
			wednesdayStart: "09:00",
			wednesdayEnd: "17:00",
			thursdayEnabled: true,
			thursdayStart: "09:00",
			thursdayEnd: "17:00",
			fridayEnabled: true,
			fridayStart: "09:00",
			fridayEnd: "17:00",
			saturdayEnabled: false,
			saturdayStart: "09:00",
			saturdayEnd: "17:00",
			sundayEnabled: false,
			sundayStart: "09:00",
			sundayEnd: "17:00",
			maxAttempts: 3,
			retryInterval1: 2,
			retryInterval2: 24,
			retryInterval3: 72,
			targetLeads: null,
			targetConversions: null,
			targetCallsPerDay: null,
			autoProgressLeads: true,
			autoScheduleFollowups: false,
			autoUpdateScores: true,
			startDate: "",
			endDate: ""
		})
		setErrors({})
	}

	const nextStep = () => {
		const steps = Object.keys(STEP_LABELS)
		const currentIndex = steps.indexOf(currentStep)
		if (currentIndex < steps.length - 1) {
			setCurrentStep(steps[currentIndex + 1])
		}
	}

	const prevStep = () => {
		const steps = Object.keys(STEP_LABELS)
		const currentIndex = steps.indexOf(currentStep)
		if (currentIndex > 0) {
			setCurrentStep(steps[currentIndex - 1])
		}
	}

	const validateStep = (step: string): boolean => {
		const newErrors: Partial<Record<keyof CampaignFormData, string>> = {}

		if (step === "basic") {
			if (!formData.name.trim()) {
				newErrors.name = "Campaign name is required"
			}
		}

		if (step === "agent") {
			if (!formData.voiceAgentId) {
				newErrors.voiceAgentId = "Please select a voice agent"
			}
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const createFromTemplate = async () => {
		if (!selectedTemplate) return

		try {
			setIsLoading(true)

			const result = await createCampaignFromTemplate(
				selectedTemplate.id,
				{
					name: `${selectedTemplate.name} (Copy)`,
					description: selectedTemplate.description || undefined,
					startDate: undefined,
					endDate: undefined
				}
			)

			if (result.success) {
				toast.success("Campaign created from template successfully!")
				setOpen(false)
				resetForm()
				onCampaignCreated?.()
			} else {
				toast.error(
					result.error || "Failed to create campaign from template"
				)
			}
		} catch (error) {
			console.error("Error creating campaign from template:", error)
			toast.error("Failed to create campaign from template")
		} finally {
			setIsLoading(false)
		}
	}

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Handle template step
		if (currentStep === "template") {
			if (creationMode === "template" && selectedTemplate) {
				await createFromTemplate()
				return
			}
			if (creationMode === "scratch" || !selectedTemplate) {
				nextStep()
				return
			}
		}

		if (!validateStep(currentStep)) {
			return
		}

		if (currentStep !== "review") {
			nextStep()
			return
		}

		if (!formData.voiceAgentId) {
			toast.error("Please select a voice agent")
			setCurrentStep("agent")
			return
		}

		try {
			setIsLoading(true)

			// Map flat form data to nested EnhancedCampaignData structure
			const campaignData: EnhancedCampaignData = {
				name: formData.name,
				description: formData.description || "",
				voiceAgentId: formData.voiceAgentId || undefined,
				startDate: formData.startDate
					? new Date(formData.startDate)
					: undefined,
				endDate: formData.endDate
					? new Date(formData.endDate)
					: undefined,
				status: "draft",
				campaignSettings: {
					callTiming: formData.callTimingEnabled
						? {
								businessHours: {
									enabled: formData.businessHoursEnabled,
									timezone: formData.timezone,
									schedule: {
										monday: formData.mondayEnabled
											? {
													start: formData.mondayStart,
													end: formData.mondayEnd
												}
											: null,
										tuesday: formData.tuesdayEnabled
											? {
													start: formData.tuesdayStart,
													end: formData.tuesdayEnd
												}
											: null,
										wednesday: formData.wednesdayEnabled
											? {
													start: formData.wednesdayStart,
													end: formData.wednesdayEnd
												}
											: null,
										thursday: formData.thursdayEnabled
											? {
													start: formData.thursdayStart,
													end: formData.thursdayEnd
												}
											: null,
										friday: formData.fridayEnabled
											? {
													start: formData.fridayStart,
													end: formData.fridayEnd
												}
											: null,
										saturday: formData.saturdayEnabled
											? {
													start: formData.saturdayStart,
													end: formData.saturdayEnd
												}
											: null,
										sunday: formData.sundayEnabled
											? {
													start: formData.sundayStart,
													end: formData.sundayEnd
												}
											: null
									}
								},
								maxCallsPerDay: formData.maxCallsPerDay,
								callInterval: formData.callInterval
							}
						: undefined,
					retryLogic: {
						maxAttempts: formData.maxAttempts,
						retryIntervals: [
							formData.retryInterval1,
							formData.retryInterval2,
							formData.retryInterval3
						],
						retryConditions: ["no_answer", "busy", "failed"] // Default retry conditions
					},
					goals: {
						targetLeads: formData.targetLeads || undefined,
						targetConversions:
							formData.targetConversions || undefined,
						targetCallsPerDay:
							formData.targetCallsPerDay || undefined
					},
					automation: {
						autoProgressLeads: formData.autoProgressLeads,
						autoScheduleFollowups: formData.autoScheduleFollowups,
						autoUpdateScores: formData.autoUpdateScores
					},
					successCriteria: {
						convertedStatuses: ["converted"],
						qualifiedStatuses: ["qualified", "interested"]
					}
				}
			}

			await createEnhancedCampaign(campaignData)
			toast.success("Campaign created successfully!")
			setOpen(false)
			resetForm()
			onCampaignCreated?.()
		} catch (error) {
			console.error("Error creating campaign:", error)
			toast.error("Failed to create campaign")
		} finally {
			setIsLoading(false)
		}
	}

	const renderStep = () => {
		switch (currentStep) {
			case "template":
				return (
					<div className="space-y-6">
						<div className="text-center">
							<p className="text-muted-foreground mb-6">
								Choose how you'd like to create your campaign
							</p>
						</div>

						<Tabs
							value={creationMode}
							onValueChange={(value) =>
								setCreationMode(value as "scratch" | "template")
							}
							className="w-full"
						>
							<TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 mb-6 h-auto overflow-hidden">
								<TabsTrigger
									value="scratch"
									className="min-w-0 inline-flex items-center justify-center rounded-lg px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
								>
									<PlusIcon className="hidden sm:block h-4 w-4 mr-2" />
									<span className="truncate">
										Start from Scratch
									</span>
								</TabsTrigger>
								<TabsTrigger
									value="template"
									className="min-w-0 inline-flex items-center justify-center rounded-lg px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
								>
									<BookTemplateIcon className="hidden sm:block h-4 w-4 mr-2" />
									<span className="truncate">
										Use Template
									</span>
								</TabsTrigger>
							</TabsList>

							<TabsContent value="scratch" className="mt-6">
								<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
									<CardContent className="p-6">
										<div className="text-center">
											<div className="rounded-full p-3 border border-border/40 shadow-sm mx-auto w-fit mb-4">
												<PlusIcon className="h-6 w-6 text-muted-foreground" />
											</div>
											<h3 className="text-lg font-medium mb-2">
												Create New Campaign
											</h3>
											<p className="text-sm text-muted-foreground mb-4">
												Build a campaign from scratch
												with custom settings
											</p>
											<Button
												onClick={() => {
													setSelectedTemplate(null)
													nextStep()
												}}
												className="gap-2"
											>
												<ZapIcon className="h-4 w-4" />
												Start Building
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="template" className="mt-6">
								{templatesLoading ? (
									<div className="space-y-4">
										{[1, 2, 3].map((i) => (
											<Card
												key={i}
												className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm"
											>
												<CardContent className="p-4">
													<div className="animate-pulse">
														<div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
														<div className="h-3 bg-muted rounded w-1/2"></div>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								) : templates.length === 0 ? (
									<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
										<CardContent className="p-6">
											<div className="text-center">
												<div className="rounded-full p-3 border border-border/40 shadow-sm mx-auto w-fit mb-4">
													<FileTextIcon className="h-6 w-6 text-muted-foreground" />
												</div>
												<h3 className="text-lg font-medium mb-2">
													No Templates Available
												</h3>
												<p className="text-sm text-muted-foreground mb-4">
													You haven't created any
													campaign templates yet.
													Create your first campaign
													to save it as a template.
												</p>
												<Button
													variant="outline"
													onClick={() => {
														setCreationMode(
															"scratch"
														)
														setSelectedTemplate(
															null
														)
														nextStep()
													}}
													className="gap-2"
												>
													<PlusIcon className="h-4 w-4" />
													Create First Campaign
												</Button>
											</div>
										</CardContent>
									</Card>
								) : (
									<div className="space-y-4">
										{templates.map((template) => (
											<Card
												key={template.id}
												className={`rounded-2xl border cursor-pointer transition-all ${
													selectedTemplate?.id ===
													template.id
														? "border-primary bg-primary/5 shadow-md"
														: "border-border bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md"
												}`}
												onClick={() =>
													setSelectedTemplate(
														template
													)
												}
											>
												<CardContent className="p-4">
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<div className="flex items-center gap-2 mb-2">
																<BookTemplateIcon className="h-4 w-4 text-muted-foreground" />
																<h3 className="font-medium">
																	{
																		template.name
																	}
																</h3>
															</div>
															{template.description && (
																<p className="text-sm text-muted-foreground mb-2">
																	{
																		template.description
																	}
																</p>
															)}
															<div className="flex items-center gap-4 text-xs text-muted-foreground">
																<span>
																	Created{" "}
																	{new Date(
																		template.createdAt
																	).toLocaleDateString()}
																</span>
																{template.voiceAgentId && (
																	<span className="flex items-center gap-1">
																		<BotIcon className="h-3 w-3" />
																		Voice
																		Agent
																		Configured
																	</span>
																)}
															</div>
														</div>
														{selectedTemplate?.id ===
															template.id && (
															<CheckIcon className="h-5 w-5 text-primary" />
														)}
													</div>
												</CardContent>
											</Card>
										))}

										{selectedTemplate && (
											<div className="pt-4">
												<Button
													onClick={() => nextStep()}
													className="w-full gap-2"
												>
													<CopyIcon className="h-4 w-4" />
													Use "{selectedTemplate.name}
													" Template
												</Button>
											</div>
										)}
									</div>
								)}
							</TabsContent>
						</Tabs>
					</div>
				)

			case "basic":
				return (
					<div className="space-y-4">
						<div>
							<Label htmlFor="name">Campaign Name *</Label>
							<Input
								id="name"
								value={formData.name}
								onChange={(e) =>
									updateFormData({ name: e.target.value })
								}
								placeholder="Enter campaign name"
								className={errors.name ? "border-red-500" : ""}
							/>
							{errors.name && (
								<p className="text-sm text-red-500 mt-1">
									{errors.name}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={formData.description}
								onChange={(e) =>
									updateFormData({
										description: e.target.value
									})
								}
								placeholder="Optional campaign description"
								rows={3}
							/>
						</div>

						<div>
							<Label htmlFor="startDate">Start Date</Label>
							<Input
								id="startDate"
								type="date"
								value={formData.startDate}
								onChange={(e) =>
									updateFormData({
										startDate: e.target.value
									})
								}
							/>
						</div>

						<div>
							<Label htmlFor="endDate">End Date</Label>
							<Input
								id="endDate"
								type="date"
								value={formData.endDate}
								onChange={(e) =>
									updateFormData({ endDate: e.target.value })
								}
							/>
						</div>
					</div>
				)

			case "agent":
				return (
					<div className="space-y-4">
						<div>
							<Label>Voice Agent *</Label>
							<Select
								value={formData.voiceAgentId?.toString() || ""}
								onValueChange={(value) =>
									updateFormData({
										voiceAgentId: parseInt(value)
									})
								}
							>
								<SelectTrigger
									className={
										errors.voiceAgentId
											? "border-red-500"
											: ""
									}
								>
									<SelectValue
										placeholder={
											agentsLoading
												? "Loading..."
												: "Select a voice agent"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{voiceAgents.map((agent) => (
										<SelectItem
											key={agent.id}
											value={agent.id.toString()}
										>
											<div className="flex items-center gap-2">
												<BotIcon className="h-4 w-4" />
												{agent.name}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.voiceAgentId && (
								<p className="text-sm text-red-500 mt-1">
									{errors.voiceAgentId}
								</p>
							)}
						</div>
					</div>
				)

			case "timing":
				return (
					<div className="space-y-6">
						<div className="flex items-center space-x-2">
							<Checkbox
								id="callTimingEnabled"
								checked={formData.callTimingEnabled}
								onCheckedChange={(checked) =>
									updateFormData({
										callTimingEnabled: !!checked
									})
								}
							/>
							<Label htmlFor="callTimingEnabled">
								Enable call timing controls
							</Label>
						</div>

						{formData.callTimingEnabled && (
							<>
								<div>
									<Label>Timezone</Label>
									<Select
										value={formData.timezone}
										onValueChange={(value) =>
											updateFormData({ timezone: value })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{TIMEZONES.map((tz) => (
												<SelectItem key={tz} value={tz}>
													{tz}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div>
									<Label htmlFor="maxCallsPerDay">
										Max Calls Per Day
									</Label>
									<Input
										id="maxCallsPerDay"
										type="number"
										min="1"
										max="1000"
										value={formData.maxCallsPerDay}
										onChange={(e) =>
											updateFormData({
												maxCallsPerDay:
													parseInt(e.target.value) ||
													1
											})
										}
									/>
								</div>

								<div>
									<Label htmlFor="callInterval">
										Call Interval (minutes)
									</Label>
									<Input
										id="callInterval"
										type="number"
										min="1"
										max="1440"
										value={formData.callInterval}
										onChange={(e) =>
											updateFormData({
												callInterval:
													parseInt(e.target.value) ||
													1
											})
										}
									/>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="businessHoursEnabled"
										checked={formData.businessHoursEnabled}
										onCheckedChange={(checked) =>
											updateFormData({
												businessHoursEnabled: !!checked
											})
										}
									/>
									<Label htmlFor="businessHoursEnabled">
										Enable business hours
									</Label>
								</div>

								{formData.businessHoursEnabled && (
									<div className="space-y-4">
										{DAYS_OF_WEEK.map((day) => {
											const enabledKey =
												`${day.key}Enabled` as keyof CampaignFormData
											const startKey =
												`${day.key}Start` as keyof CampaignFormData
											const endKey =
												`${day.key}End` as keyof CampaignFormData

											return (
												<div
													key={day.key}
													className="grid grid-cols-3 gap-4 items-center"
												>
													<div className="flex items-center space-x-2">
														<Checkbox
															id={enabledKey}
															checked={
																formData[
																	enabledKey
																] as boolean
															}
															onCheckedChange={(
																checked
															) =>
																updateFormData({
																	[enabledKey]:
																		!!checked
																})
															}
														/>
														<Label
															htmlFor={enabledKey}
														>
															{day.label}
														</Label>
													</div>
													<Input
														type="time"
														value={
															formData[
																startKey
															] as string
														}
														onChange={(e) =>
															updateFormData({
																[startKey]:
																	e.target
																		.value
															})
														}
														disabled={
															!(formData[
																enabledKey
															] as boolean)
														}
													/>
													<Input
														type="time"
														value={
															formData[
																endKey
															] as string
														}
														onChange={(e) =>
															updateFormData({
																[endKey]:
																	e.target
																		.value
															})
														}
														disabled={
															!(formData[
																enabledKey
															] as boolean)
														}
													/>
												</div>
											)
										})}
									</div>
								)}
							</>
						)}
					</div>
				)

			case "retry":
				return (
					<div className="space-y-4">
						<div>
							<Label htmlFor="maxAttempts">
								Maximum Attempts
							</Label>
							<Input
								id="maxAttempts"
								type="number"
								min="1"
								max="10"
								value={formData.maxAttempts}
								onChange={(e) =>
									updateFormData({
										maxAttempts:
											parseInt(e.target.value) || 1
									})
								}
							/>
						</div>

						<div>
							<Label htmlFor="retryInterval1">
								First Retry (hours)
							</Label>
							<Input
								id="retryInterval1"
								type="number"
								min="1"
								max="168"
								value={formData.retryInterval1}
								onChange={(e) =>
									updateFormData({
										retryInterval1:
											parseInt(e.target.value) || 1
									})
								}
							/>
						</div>

						<div>
							<Label htmlFor="retryInterval2">
								Second Retry (hours)
							</Label>
							<Input
								id="retryInterval2"
								type="number"
								min="1"
								max="168"
								value={formData.retryInterval2}
								onChange={(e) =>
									updateFormData({
										retryInterval2:
											parseInt(e.target.value) || 1
									})
								}
							/>
						</div>

						<div>
							<Label htmlFor="retryInterval3">
								Third Retry (hours)
							</Label>
							<Input
								id="retryInterval3"
								type="number"
								min="1"
								max="168"
								value={formData.retryInterval3}
								onChange={(e) =>
									updateFormData({
										retryInterval3:
											parseInt(e.target.value) || 1
									})
								}
							/>
						</div>
					</div>
				)

			case "goals":
				return (
					<div className="space-y-6">
						<div>
							<Label htmlFor="targetLeads">Target Leads</Label>
							<Input
								id="targetLeads"
								type="number"
								min="1"
								value={formData.targetLeads || ""}
								onChange={(e) =>
									updateFormData({
										targetLeads: e.target.value
											? parseInt(e.target.value)
											: null
									})
								}
								placeholder="Optional"
							/>
						</div>

						<div>
							<Label htmlFor="targetConversions">
								Target Conversions
							</Label>
							<Input
								id="targetConversions"
								type="number"
								min="1"
								value={formData.targetConversions || ""}
								onChange={(e) =>
									updateFormData({
										targetConversions: e.target.value
											? parseInt(e.target.value)
											: null
									})
								}
								placeholder="Optional"
							/>
						</div>

						<div>
							<Label htmlFor="targetCallsPerDay">
								Target Calls Per Day
							</Label>
							<Input
								id="targetCallsPerDay"
								type="number"
								min="1"
								value={formData.targetCallsPerDay || ""}
								onChange={(e) =>
									updateFormData({
										targetCallsPerDay: e.target.value
											? parseInt(e.target.value)
											: null
									})
								}
								placeholder="Optional"
							/>
						</div>

						<div className="space-y-3">
							<Label>Automation Settings</Label>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="autoProgressLeads"
									checked={formData.autoProgressLeads}
									onCheckedChange={(checked) =>
										updateFormData({
											autoProgressLeads: !!checked
										})
									}
								/>
								<Label htmlFor="autoProgressLeads">
									Auto-progress leads based on call outcomes
								</Label>
							</div>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="autoScheduleFollowups"
									checked={formData.autoScheduleFollowups}
									onCheckedChange={(checked) =>
										updateFormData({
											autoScheduleFollowups: !!checked
										})
									}
								/>
								<Label htmlFor="autoScheduleFollowups">
									Auto-schedule follow-up calls
								</Label>
							</div>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="autoUpdateScores"
									checked={formData.autoUpdateScores}
									onCheckedChange={(checked) =>
										updateFormData({
											autoUpdateScores: !!checked
										})
									}
								/>
								<Label htmlFor="autoUpdateScores">
									Auto-update lead scores
								</Label>
							</div>
						</div>
					</div>
				)

			case "review":
				return (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">
									Campaign Summary
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-medium">
										Basic Information
									</h4>
									<p className="text-sm text-muted-foreground">
										Name: {formData.name}
									</p>
									{formData.description && (
										<p className="text-sm text-muted-foreground">
											Description: {formData.description}
										</p>
									)}
								</div>

								<div>
									<h4 className="font-medium">Voice Agent</h4>
									<p className="text-sm text-muted-foreground">
										{voiceAgents.find(
											(a) =>
												a.id === formData.voiceAgentId
										)?.name || "Not selected"}
									</p>
								</div>

								<div>
									<h4 className="font-medium">
										Call Settings
									</h4>
									<p className="text-sm text-muted-foreground">
										Timing:{" "}
										{formData.callTimingEnabled
											? "Enabled"
											: "Disabled"}
									</p>
									{formData.callTimingEnabled && (
										<>
											<p className="text-sm text-muted-foreground">
												Max calls per day:{" "}
												{formData.maxCallsPerDay}
											</p>
											<p className="text-sm text-muted-foreground">
												Call interval:{" "}
												{formData.callInterval} minutes
											</p>
										</>
									)}
								</div>

								<div>
									<h4 className="font-medium">Retry Logic</h4>
									<p className="text-sm text-muted-foreground">
										Max attempts: {formData.maxAttempts}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				)

			default:
				return null
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(newOpen) => {
				setOpen(newOpen)
				if (!newOpen) {
					resetForm()
				}
			}}
		>
			<DialogTrigger asChild>
				{trigger || (
					<Button className="gap-2">
						<PlusIcon className="h-4 w-4" />
						Create Campaign
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<PhoneIcon className="h-5 w-5" />
						Create New Campaign
					</DialogTitle>
					<DialogDescription>
						Set up a new cold call campaign with advanced scheduling
						and retry logic.
					</DialogDescription>
				</DialogHeader>

				{/* Step indicator */}
				<div className="overflow-x-auto py-4">
					<div className="mx-auto flex min-w-max items-center justify-center space-x-2 px-1">
						{Object.entries(STEP_LABELS).map(
							([key, label], index) => {
								const isActive = key === currentStep
								const steps = Object.keys(STEP_LABELS)
								const isCompleted =
									steps.indexOf(currentStep) > index

								return (
									<div
										key={key}
										className="flex items-center"
									>
										<div
											className={`
										w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-medium
										${
											isActive
												? "bg-primary text-primary-foreground"
												: isCompleted
													? "bg-green-500 text-white"
													: "bg-muted text-muted-foreground"
										}
									`}
											aria-label={`Step ${index + 1}: ${label}`}
										>
											{isCompleted ? (
												<CheckIcon className="h-4 w-4" />
											) : (
												index + 1
											)}
										</div>
										{index <
											Object.keys(STEP_LABELS).length -
												1 && (
											<div
												className={`w-5 sm:w-8 h-0.5 mx-1 sm:mx-2 ${isCompleted ? "bg-green-500" : "bg-muted"}`}
											/>
										)}
									</div>
								)
							}
						)}
					</div>
				</div>

				<form onSubmit={onSubmit} className="space-y-6">
					<div className="min-h-[400px]">
						<h3 className="text-lg font-medium mb-4 flex items-center gap-2">
							{currentStep === "template" && (
								<BookTemplateIcon className="h-5 w-5" />
							)}
							{currentStep === "basic" && (
								<SettingsIcon className="h-5 w-5" />
							)}
							{currentStep === "agent" && (
								<BotIcon className="h-5 w-5" />
							)}
							{currentStep === "timing" && (
								<ClockIcon className="h-5 w-5" />
							)}
							{currentStep === "retry" && (
								<ArrowRightIcon className="h-5 w-5" />
							)}
							{currentStep === "goals" && (
								<TargetIcon className="h-5 w-5" />
							)}
							{currentStep === "review" && (
								<CheckIcon className="h-5 w-5" />
							)}
							{
								STEP_LABELS[
									currentStep as keyof typeof STEP_LABELS
								]
							}
						</h3>
						{renderStep()}
					</div>

					<div className="flex justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={prevStep}
							disabled={currentStep === "template"}
							className="gap-2"
						>
							<ArrowLeftIcon className="h-4 w-4" />
							Previous
						</Button>

						<Button
							type="submit"
							disabled={isLoading}
							className="gap-2"
						>
							{isLoading ? (
								<>
									<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
									Creating...
								</>
							) : currentStep === "review" ? (
								<>
									<ZapIcon className="h-4 w-4" />
									Create Campaign
								</>
							) : (
								<>
									Next
									<ArrowRightIcon className="h-4 w-4" />
								</>
							)}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
