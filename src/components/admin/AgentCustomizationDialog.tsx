"use client"

import { useState, useEffect } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
	Settings,
	Brain,
	MessageSquare,
	Globe,
	Plus,
	Save,
	RotateCcw,
	Trash2,
	Copy
} from "lucide-react"
import { toast } from "sonner"
import {
	getBaseSystemPrompt,
	updateBaseSystemPrompt,
	getIndustryPrompts,
	updateIndustryPrompts,
	getAvailableModels,
	updateAvailableModels,
	getPromptTemplates,
	updatePromptTemplates
} from "@/actions/admin-voice-agents"

interface Model {
	id: string
	name: string
	provider: string
	description: string
	costPerToken?: number
	maxTokens?: number
}

interface PromptTemplate {
	id: string
	name: string
	category: string
	template: string
	variables: string[]
}

interface AgentCustomizationDialogProps {
	trigger?: React.ReactNode
}

export function AgentCustomizationDialog({
	trigger
}: AgentCustomizationDialogProps) {
	const [open, setOpen] = useState(false)
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState<string | null>(null)

	// Data states
	const [basePrompt, setBasePrompt] = useState("")
	const [industryPrompts, setIndustryPrompts] = useState<
		Record<string, string>
	>({})
	const [availableModels, setAvailableModels] = useState<Model[]>([])
	const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])

	// Form states
	const [newIndustry, setNewIndustry] = useState("")
	const [newIndustryPrompt, setNewIndustryPrompt] = useState("")
	const [newModel, setNewModel] = useState<Partial<Model>>({})
	const [newTemplate, setNewTemplate] = useState<Partial<PromptTemplate>>({})

	// Load data when dialog opens
	useEffect(() => {
		if (open) {
			loadData()
		}
	}, [open])

	const loadData = async () => {
		setLoading(true)
		try {
			const [prompt, industries, models, templates] = await Promise.all([
				getBaseSystemPrompt(),
				getIndustryPrompts(),
				getAvailableModels(),
				getPromptTemplates()
			])

			setBasePrompt(prompt)
			setIndustryPrompts(industries)
			setAvailableModels(models)
			setPromptTemplates(templates)
		} catch (error) {
			console.error("Error loading customization data:", error)
			toast.error("Failed to load customization settings")
		} finally {
			setLoading(false)
		}
	}

	const handleSaveBasePrompt = async () => {
		setSaving("basePrompt")
		try {
			await updateBaseSystemPrompt(basePrompt)
			toast.success("Base system prompt updated successfully")
		} catch (error) {
			console.error("Error updating base prompt:", error)
			toast.error("Failed to update base prompt")
		} finally {
			setSaving(null)
		}
	}

	const handleSaveIndustryPrompts = async () => {
		setSaving("industryPrompts")
		try {
			await updateIndustryPrompts(industryPrompts)
			toast.success("Industry prompts updated successfully")
		} catch (error) {
			console.error("Error updating industry prompts:", error)
			toast.error("Failed to update industry prompts")
		} finally {
			setSaving(null)
		}
	}

	const handleAddIndustryPrompt = () => {
		if (newIndustry && newIndustryPrompt) {
			setIndustryPrompts((prev) => ({
				...prev,
				[newIndustry]: newIndustryPrompt
			}))
			setNewIndustry("")
			setNewIndustryPrompt("")
		}
	}

	const handleRemoveIndustryPrompt = (industry: string) => {
		setIndustryPrompts((prev) => {
			const updated = { ...prev }
			delete updated[industry]
			return updated
		})
	}

	const handleSaveModels = async () => {
		setSaving("models")
		try {
			await updateAvailableModels(availableModels)
			toast.success("Available models updated successfully")
		} catch (error) {
			console.error("Error updating models:", error)
			toast.error("Failed to update models")
		} finally {
			setSaving(null)
		}
	}

	const handleAddModel = () => {
		if (newModel.id && newModel.name && newModel.provider) {
			setAvailableModels((prev) => [...prev, newModel as Model])
			setNewModel({})
		}
	}

	const handleRemoveModel = (modelId: string) => {
		setAvailableModels((prev) => prev.filter((m) => m.id !== modelId))
	}

	const handleSaveTemplates = async () => {
		setSaving("templates")
		try {
			await updatePromptTemplates(promptTemplates)
			toast.success("Prompt templates updated successfully")
		} catch (error) {
			console.error("Error updating templates:", error)
			toast.error("Failed to update templates")
		} finally {
			setSaving(null)
		}
	}

	const handleAddTemplate = () => {
		if (
			newTemplate.id &&
			newTemplate.name &&
			newTemplate.category &&
			newTemplate.template
		) {
			const template = {
				...newTemplate,
				variables: extractVariables(newTemplate.template || "")
			} as PromptTemplate

			setPromptTemplates((prev) => [...prev, template])
			setNewTemplate({})
		}
	}

	const extractVariables = (template: string): string[] => {
		const matches = template.match(/\{\{(\w+)\}\}/g)
		return matches ? matches.map((match) => match.slice(2, -2)) : []
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" className="gap-2">
						<Settings className="h-4 w-4" />
						Agent Customization
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-4xl max-h-[90vh]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Agent Customization Settings
					</DialogTitle>
					<DialogDescription>
						Configure global settings for voice agents, including
						prompts, models, and templates.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="prompts" className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="prompts" className="gap-2">
							<MessageSquare className="h-4 w-4" />
							Prompts
						</TabsTrigger>
						<TabsTrigger value="models" className="gap-2">
							<Brain className="h-4 w-4" />
							Models
						</TabsTrigger>
						<TabsTrigger value="templates" className="gap-2">
							<Copy className="h-4 w-4" />
							Templates
						</TabsTrigger>
					</TabsList>

					<ScrollArea className="h-[600px] w-full">
						<div className="p-1">
							{/* Base System Prompt Tab */}
							<TabsContent value="prompts" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<MessageSquare className="h-5 w-5" />
											Base System Prompt
										</CardTitle>
										<CardDescription>
											This prompt is applied to all new
											voice agents on creation.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="basePrompt">
												System Prompt
											</Label>
											<Textarea
												id="basePrompt"
												value={basePrompt}
												onChange={(e) =>
													setBasePrompt(
														e.target.value
													)
												}
												placeholder="Enter the base system prompt that will be applied to all new agents..."
												className="min-h-[120px] resize-none"
											/>
										</div>
										<Button
											onClick={handleSaveBasePrompt}
											disabled={saving === "basePrompt"}
											className="gap-2"
										>
											{saving === "basePrompt" ? (
												<div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
											) : (
												<Save className="h-4 w-4" />
											)}
											Save Base Prompt
										</Button>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Globe className="h-5 w-5" />
											Industry-Specific Prompts
										</CardTitle>
										<CardDescription>
											Create specialized prompts for
											different industries.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{/* Existing Industry Prompts */}
										<div className="space-y-3">
											{Object.entries(
												industryPrompts
											).map(([industry, prompt]) => (
												<Card
													key={industry}
													className="border-border/50"
												>
													<CardContent className="p-4">
														<div className="flex items-start justify-between gap-4">
															<div className="flex-1 space-y-2">
																<div className="flex items-center gap-2">
																	<Badge variant="secondary">
																		{
																			industry
																		}
																	</Badge>
																</div>
																<Textarea
																	value={
																		prompt
																	}
																	onChange={(
																		e
																	) =>
																		setIndustryPrompts(
																			(
																				prev
																			) => ({
																				...prev,
																				[industry]:
																					e
																						.target
																						.value
																			})
																		)
																	}
																	className="min-h-[80px] resize-none"
																/>
															</div>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleRemoveIndustryPrompt(
																		industry
																	)
																}
																className="text-red-500 hover:text-red-700"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</CardContent>
												</Card>
											))}
										</div>

										<Separator />

										{/* Add New Industry Prompt */}
										<div className="space-y-3">
											<Label>
												Add New Industry Prompt
											</Label>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
												<Input
													placeholder="Industry name (e.g., Sales, Support)"
													value={newIndustry}
													onChange={(e) =>
														setNewIndustry(
															e.target.value
														)
													}
												/>
												<div className="md:col-span-2">
													<Textarea
														placeholder="Industry-specific prompt..."
														value={
															newIndustryPrompt
														}
														onChange={(e) =>
															setNewIndustryPrompt(
																e.target.value
															)
														}
														className="resize-none"
													/>
												</div>
											</div>
											<div className="flex gap-2">
												<Button
													onClick={
														handleAddIndustryPrompt
													}
													disabled={
														!newIndustry ||
														!newIndustryPrompt
													}
													variant="outline"
													size="sm"
													className="gap-2"
												>
													<Plus className="h-4 w-4" />
													Add Industry Prompt
												</Button>
											</div>
										</div>

										<Button
											onClick={handleSaveIndustryPrompts}
											disabled={
												saving === "industryPrompts"
											}
											className="gap-2"
										>
											{saving === "industryPrompts" ? (
												<div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
											) : (
												<Save className="h-4 w-4" />
											)}
											Save Industry Prompts
										</Button>
									</CardContent>
								</Card>
							</TabsContent>

							{/* Available Models Tab */}
							<TabsContent value="models" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Brain className="h-5 w-5" />
											Available AI Models
										</CardTitle>
										<CardDescription>
											Configure which AI models are
											available for voice agents.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{/* Existing Models */}
										<div className="space-y-3">
											{availableModels.map((model) => (
												<Card
													key={model.id}
													className="border-border/50"
												>
													<CardContent className="p-4">
														<div className="flex items-center justify-between">
															<div className="space-y-1">
																<div className="flex items-center gap-2">
																	<Badge variant="outline">
																		{
																			model.provider
																		}
																	</Badge>
																	<span className="font-medium">
																		{
																			model.name
																		}
																	</span>
																</div>
																<p className="text-sm text-muted-foreground">
																	{
																		model.description
																	}
																</p>
																{model.costPerToken && (
																	<p className="text-xs text-muted-foreground">
																		Cost: $
																		{
																			model.costPerToken
																		}{" "}
																		per
																		token
																	</p>
																)}
															</div>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleRemoveModel(
																		model.id
																	)
																}
																className="text-red-500 hover:text-red-700"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</CardContent>
												</Card>
											))}
										</div>

										<Separator />

										{/* Add New Model */}
										<div className="space-y-3">
											<Label>Add New Model</Label>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
												<Input
													placeholder="Model ID (e.g., gpt-4)"
													value={newModel.id || ""}
													onChange={(e) =>
														setNewModel((prev) => ({
															...prev,
															id: e.target.value
														}))
													}
												/>
												<Input
													placeholder="Model name"
													value={newModel.name || ""}
													onChange={(e) =>
														setNewModel((prev) => ({
															...prev,
															name: e.target.value
														}))
													}
												/>
												<Input
													placeholder="Provider (e.g., openai)"
													value={
														newModel.provider || ""
													}
													onChange={(e) =>
														setNewModel((prev) => ({
															...prev,
															provider:
																e.target.value
														}))
													}
												/>
												<Input
													placeholder="Cost per token (optional)"
													type="number"
													step="0.000001"
													value={
														newModel.costPerToken ||
														""
													}
													onChange={(e) =>
														setNewModel((prev) => ({
															...prev,
															costPerToken: e
																.target.value
																? Number(
																		e.target
																			.value
																	)
																: undefined
														}))
													}
												/>
												<div className="md:col-span-2">
													<Textarea
														placeholder="Model description..."
														value={
															newModel.description ||
															""
														}
														onChange={(e) =>
															setNewModel(
																(prev) => ({
																	...prev,
																	description:
																		e.target
																			.value
																})
															)
														}
														className="resize-none"
													/>
												</div>
											</div>
											<Button
												onClick={handleAddModel}
												disabled={
													!newModel.id ||
													!newModel.name ||
													!newModel.provider
												}
												variant="outline"
												size="sm"
												className="gap-2"
											>
												<Plus className="h-4 w-4" />
												Add Model
											</Button>
										</div>

										<Button
											onClick={handleSaveModels}
											disabled={saving === "models"}
											className="gap-2"
										>
											{saving === "models" ? (
												<div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
											) : (
												<Save className="h-4 w-4" />
											)}
											Save Models
										</Button>
									</CardContent>
								</Card>
							</TabsContent>

							{/* Prompt Templates Tab */}
							<TabsContent
								value="templates"
								className="space-y-6"
							>
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Copy className="h-5 w-5" />
											Prompt Templates
										</CardTitle>
										<CardDescription>
											Create reusable prompt templates
											with variables.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{/* Existing Templates */}
										<div className="space-y-3">
											{promptTemplates.map((template) => (
												<Card
													key={template.id}
													className="border-border/50"
												>
													<CardContent className="p-4">
														<div className="space-y-3">
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-2">
																	<Badge variant="secondary">
																		{
																			template.category
																		}
																	</Badge>
																	<span className="font-medium">
																		{
																			template.name
																		}
																	</span>
																</div>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() =>
																		setPromptTemplates(
																			(
																				prev
																			) =>
																				prev.filter(
																					(
																						t
																					) =>
																						t.id !==
																						template.id
																				)
																		)
																	}
																	className="text-red-500 hover:text-red-700"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
															<Textarea
																value={
																	template.template
																}
																onChange={(e) =>
																	setPromptTemplates(
																		(
																			prev
																		) =>
																			prev.map(
																				(
																					t
																				) =>
																					t.id ===
																					template.id
																						? {
																								...t,
																								template:
																									e
																										.target
																										.value,
																								variables:
																									extractVariables(
																										e
																											.target
																											.value
																									)
																							}
																						: t
																			)
																	)
																}
																className="min-h-[80px] resize-none font-mono text-sm"
															/>
															{template.variables
																.length > 0 && (
																<div className="flex flex-wrap gap-1">
																	{template.variables.map(
																		(
																			variable
																		) => (
																			<Badge
																				key={
																					variable
																				}
																				variant="outline"
																				className="text-xs"
																			>
																				{`{{${variable}}}`}
																			</Badge>
																		)
																	)}
																</div>
															)}
														</div>
													</CardContent>
												</Card>
											))}
										</div>

										<Separator />

										{/* Add New Template */}
										<div className="space-y-3">
											<Label>Add New Template</Label>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
												<Input
													placeholder="Template ID"
													value={newTemplate.id || ""}
													onChange={(e) =>
														setNewTemplate(
															(prev) => ({
																...prev,
																id: e.target
																	.value
															})
														)
													}
												/>
												<Input
													placeholder="Template name"
													value={
														newTemplate.name || ""
													}
													onChange={(e) =>
														setNewTemplate(
															(prev) => ({
																...prev,
																name: e.target
																	.value
															})
														)
													}
												/>
												<Input
													placeholder="Category"
													value={
														newTemplate.category ||
														""
													}
													onChange={(e) =>
														setNewTemplate(
															(prev) => ({
																...prev,
																category:
																	e.target
																		.value
															})
														)
													}
												/>
												<div className="md:col-span-3">
													<Textarea
														placeholder="Template content (use {{variable}} for dynamic content)..."
														value={
															newTemplate.template ||
															""
														}
														onChange={(e) =>
															setNewTemplate(
																(prev) => ({
																	...prev,
																	template:
																		e.target
																			.value
																})
															)
														}
														className="min-h-[100px] resize-none font-mono text-sm"
													/>
												</div>
											</div>
											<Button
												onClick={handleAddTemplate}
												disabled={
													!newTemplate.id ||
													!newTemplate.name ||
													!newTemplate.category ||
													!newTemplate.template
												}
												variant="outline"
												size="sm"
												className="gap-2"
											>
												<Plus className="h-4 w-4" />
												Add Template
											</Button>
										</div>

										<Button
											onClick={handleSaveTemplates}
											disabled={saving === "templates"}
											className="gap-2"
										>
											{saving === "templates" ? (
												<div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
											) : (
												<Save className="h-4 w-4" />
											)}
											Save Templates
										</Button>
									</CardContent>
								</Card>
							</TabsContent>

						</div>
					</ScrollArea>
				</Tabs>
			</DialogContent>
		</Dialog>
	)
}
