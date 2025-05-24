"use client"

import { updateVoiceAgent } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
	PhoneNumber,
	VoiceAgentUpdateRequest,
	VoiceAgentWithPhoneNumber,
	VoiceProvider
} from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

// Voice agent update schema
const updateVoiceAgentSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be less than 100 characters"),
	description: z
		.string()
		.max(500, "Description must be less than 500 characters")
		.optional(),
	prompt: z
		.string()
		.min(10, "Prompt must be at least 10 characters")
		.max(5000, "Prompt must be less than 5000 characters"),
	voiceProvider: z.enum(["elevenlabs", "playht", "cartesia"] as const),
	voiceId: z.string().min(1, "Voice ID is required"),
	language: z.string().optional(),
	phoneNumberId: z.number().optional(),
	firstMessage: z
		.string()
		.max(500, "First message must be less than 500 characters")
		.optional(),
	status: z
		.enum(["active", "inactive", "training", "error"] as const)
		.optional()
})

type UpdateVoiceAgentForm = z.infer<typeof updateVoiceAgentSchema>

// Common voice configurations
const VOICE_PROVIDERS = [
	{
		value: "elevenlabs" as VoiceProvider,
		label: "ElevenLabs",
		description: "High-quality AI voices with emotional range"
	},
	{
		value: "playht" as VoiceProvider,
		label: "PlayHT",
		description: "Fast and natural sounding voices"
	},
	{
		value: "cartesia" as VoiceProvider,
		label: "Cartesia",
		description: "Ultra-low latency streaming voices"
	}
] as const

const VOICE_OPTIONS = {
	elevenlabs: [
		{ value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel - Professional" },
		{ value: "AZnzlk1XvdvUeBnXmlld", label: "Domi - Warm" },
		{ value: "EXAVITQu4vr4xnSDxMaL", label: "Bella - Friendly" },
		{ value: "ErXwobaYiN019PkySvjV", label: "Antoni - Calm" },
		{ value: "MF3mGyEYCl7XYWbV9V6O", label: "Elli - Energetic" },
		{ value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh - Corporate" },
		{ value: "VR6AewLTigWG4xSOukaG", label: "Arnold - Deep" },
		{ value: "pNInz6obpgDQGcFmaJgB", label: "Adam - Clear" }
	],
	playht: [
		{
			value: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
			label: "Jennifer - Customer Service"
		},
		{
			value: "s3://voice-cloning-zero-shot/775ae416-49bb-4fb6-bd45-740f205d20a1/male-cs/manifest.json",
			label: "David - Professional"
		},
		{
			value: "s3://voice-cloning-zero-shot/8832a0be-9d0c-4b8e-9b0a-4b9b4b0b4b0b/female-warm/manifest.json",
			label: "Sarah - Warm"
		},
		{
			value: "s3://voice-cloning-zero-shot/1234567-89ab-cdef-0123-456789abcdef/male-deep/manifest.json",
			label: "Michael - Deep"
		}
	],
	cartesia: [
		{
			value: "a0e99841-438c-4a64-b679-ae501e7d6091",
			label: "Barbershop Man - Conversational"
		},
		{
			value: "87748186-23bb-4158-a1eb-332911b0b708",
			label: "Conversational Lady - Friendly"
		},
		{
			value: "156fb8d2-335b-4950-9cb3-a2d33befec77",
			label: "Customer Support Lady - Professional"
		},
		{
			value: "79a125e8-cd45-4c13-8a67-188112f4dd22",
			label: "Wise Guy - Authoritative"
		}
	]
} as const

const LANGUAGES = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "pt", label: "Portuguese" },
	{ value: "nl", label: "Dutch" },
	{ value: "pl", label: "Polish" },
	{ value: "zh", label: "Chinese" },
	{ value: "ja", label: "Japanese" },
	{ value: "ko", label: "Korean" }
] as const

const STATUS_OPTIONS = [
	{
		value: "active",
		label: "Active",
		description: "Agent is ready to handle calls"
	},
	{ value: "inactive", label: "Inactive", description: "Agent is disabled" },
	{
		value: "training",
		label: "Training",
		description: "Agent is being configured"
	},
	{
		value: "error",
		label: "Error",
		description: "Agent has configuration issues"
	}
] as const

const DEFAULT_PROMPTS = {
	customer_service: `You are a helpful customer service representative. You are friendly, professional, and patient. Your goal is to assist customers with their inquiries and resolve any issues they may have.

Key guidelines:
- Listen carefully to the customer's needs
- Provide clear and accurate information
- Be empathetic and understanding
- If you cannot help with something, offer to transfer to a human agent
- Always maintain a positive and helpful tone`,

	sales: `You are a professional sales representative. Your goal is to understand the customer's needs and explain how our products or services can help them.

Key guidelines:
- Ask qualifying questions to understand their needs
- Listen more than you speak
- Focus on benefits, not just features
- Handle objections professionally
- Never be pushy or aggressive
- If they're interested, offer to schedule a follow-up call`,

	appointment_setting: `You are an appointment setting specialist. Your goal is to schedule meetings between potential customers and our sales team.

Key guidelines:
- Quickly identify if the caller is a good fit
- Ask qualifying questions about their business needs
- If qualified, offer available time slots
- Confirm appointment details clearly
- Send calendar invites when possible
- Be respectful of their time`
} as const

interface EditVoiceAgentDialogProps {
	agent: VoiceAgentWithPhoneNumber
	phoneNumbers: PhoneNumber[]
	onAgentUpdated?: () => void
	trigger?: React.ReactNode
}

export function EditVoiceAgentDialog({
	agent,
	phoneNumbers,
	onAgentUpdated,
	trigger
}: EditVoiceAgentDialogProps) {
	const [open, setOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<UpdateVoiceAgentForm>({
		resolver: zodResolver(updateVoiceAgentSchema),
		defaultValues: {
			name: agent.name,
			description: agent.description || "",
			prompt: agent.prompt,
			voiceProvider: agent.voice.provider,
			voiceId: agent.voice.voice_id,
			language: agent.language || "en",
			phoneNumberId: agent.phoneNumberId || undefined,
			firstMessage: agent.firstMessage || "",
			status: agent.status || "inactive"
		}
	})

	// Reset form when agent changes
	useEffect(() => {
		form.reset({
			name: agent.name,
			description: agent.description || "",
			prompt: agent.prompt,
			voiceProvider: agent.voice.provider,
			voiceId: agent.voice.voice_id,
			language: agent.language || "en",
			phoneNumberId: agent.phoneNumberId || undefined,
			firstMessage: agent.firstMessage || "",
			status: agent.status || "inactive"
		})
	}, [agent, form])

	const onSubmit = async (data: UpdateVoiceAgentForm) => {
		setIsSubmitting(true)

		try {
			const updateData: VoiceAgentUpdateRequest = {
				name: data.name,
				description: data.description || undefined,
				prompt: data.prompt,
				voice: {
					provider: data.voiceProvider,
					voice_id: data.voiceId
				},
				language: data.language || undefined,
				phoneNumberId: data.phoneNumberId || undefined,
				firstMessage: data.firstMessage || undefined,
				status: data.status
			}

			const result = await updateVoiceAgent(agent.id, updateData)

			if (result.success) {
				toast.success("Voice agent updated successfully")
				setOpen(false)
				onAgentUpdated?.()
			} else {
				toast.error(result.error || "Failed to update voice agent")
			}
		} catch (error) {
			console.error("Error updating voice agent:", error)
			toast.error("Failed to update voice agent")
		} finally {
			setIsSubmitting(false)
		}
	}

	const setPromptTemplate = (template: keyof typeof DEFAULT_PROMPTS) => {
		form.setValue("prompt", DEFAULT_PROMPTS[template])
	}

	const watchedVoiceProvider = form.watch("voiceProvider")

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button
						variant="outline"
						size="sm"
						className="flex-1 rounded-2xl"
					>
						<SettingsIcon className="h-4 w-4 mr-2" />
						Configure
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Configure Voice Agent</DialogTitle>
					<DialogDescription>
						Edit your voice agent settings and configuration
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-6"
					>
						{/* Basic Information */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Agent Name</FormLabel>
										<FormControl>
											<Input
												placeholder="Customer Service Bot"
												className="bg-card/30"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="status"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Status</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger className="bg-card/30">
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{STATUS_OPTIONS.map(
													(status) => (
														<SelectItem
															key={status.value}
															value={status.value}
														>
															<div>
																<div className="font-medium">
																	{
																		status.label
																	}
																</div>
																<div className="text-xs text-muted-foreground">
																	{
																		status.description
																	}
																</div>
															</div>
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Brief description of what this agent does..."
											className="bg-card/30 resize-none"
											rows={2}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Optional description to help you
										identify this agent
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Phone Number Assignment */}
						<FormField
							control={form.control}
							name="phoneNumberId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										Phone Number Assignment
									</FormLabel>
									<Select
										onValueChange={(value) =>
											field.onChange(
												value && value !== "none"
													? Number(value)
													: undefined
											)
										}
										value={
											field.value?.toString() || "none"
										}
									>
										<FormControl>
											<SelectTrigger className="bg-card/30">
												<SelectValue placeholder="Select a phone number (optional)" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="none">
												No phone number
											</SelectItem>
											{phoneNumbers.map((phoneNumber) => (
												<SelectItem
													key={phoneNumber.id}
													value={phoneNumber.id.toString()}
												>
													{phoneNumber.number} -{" "}
													{phoneNumber.friendlyName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										Assign a phone number to this agent for
										inbound calls
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Voice Configuration */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium">
								Voice Configuration
							</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="voiceProvider"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												Voice Provider
											</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger className="bg-card/30">
														<SelectValue placeholder="Select provider" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{VOICE_PROVIDERS.map(
														(provider) => (
															<SelectItem
																key={
																	provider.value
																}
																value={
																	provider.value
																}
															>
																<div>
																	<div className="font-medium">
																		{
																			provider.label
																		}
																	</div>
																	<div className="text-xs text-muted-foreground">
																		{
																			provider.description
																		}
																	</div>
																</div>
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="voiceId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Voice</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger className="bg-card/30">
														<SelectValue placeholder="Select voice" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{watchedVoiceProvider &&
														VOICE_OPTIONS[
															watchedVoiceProvider
														]?.map((voice) => (
															<SelectItem
																key={
																	voice.value
																}
																value={
																	voice.value
																}
															>
																{voice.label}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="language"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Language</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger className="bg-card/30">
													<SelectValue placeholder="Select language" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{LANGUAGES.map((language) => (
													<SelectItem
														key={language.value}
														value={language.value}
													>
														{language.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* First Message */}
						<FormField
							control={form.control}
							name="firstMessage"
							render={({ field }) => (
								<FormItem>
									<FormLabel>First Message</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Hello! How can I help you today?"
											className="bg-card/30 resize-none"
											rows={2}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										The first message the agent will say
										when answering calls
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Agent Prompt */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<FormLabel>Agent Prompt</FormLabel>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											setPromptTemplate(
												"customer_service"
											)
										}
									>
										Customer Service
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											setPromptTemplate("sales")
										}
									>
										Sales
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											setPromptTemplate(
												"appointment_setting"
											)
										}
									>
										Appointment Setting
									</Button>
								</div>
							</div>
							<FormField
								control={form.control}
								name="prompt"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Textarea
												placeholder="You are a helpful customer service representative..."
												className="bg-card/30 resize-none min-h-[200px]"
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Instructions that define how your
											agent should behave and respond
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Action Buttons */}
						<div className="flex justify-end gap-3 pt-6">
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Update Agent
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
