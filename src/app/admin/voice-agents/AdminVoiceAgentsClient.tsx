"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter
} from "@/components/ui/dialog"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
	Bot,
	Search,
	MoreHorizontal,
	Plus,
	User,
	Settings,
	Trash2,
	Edit,
	PlayCircle,
	PauseCircle,
	Activity,
	Calendar,
	MessageSquare,
	Mic,
	Save,
	X
} from "lucide-react"
import {
	searchVoiceAgents,
	updateVoiceAgentStatus,
	deleteVoiceAgent,
	updateVoiceAgentPrompt,
	createVoiceAgentForUser
} from "@/actions/admin-voice-agents"
import { AgentCustomizationDialog } from "@/components/admin/AgentCustomizationDialog"
import type { VoiceAgentStatus } from "@/types"

// Types for the component props
interface AdminVoiceAgentWithDetails {
	id: number
	name: string
	description: string | null
	prompt: string | null
	voice: Record<string, unknown> | null
	language: string | null
	status: VoiceAgentStatus | null
	configuration: Record<string, unknown> | null
	firstMessage: string | null
	createdAt: Date
	updatedAt: Date
	userId: string
	user: {
		id: string
		email: string | null
		firstName: string | null
		lastName: string | null
	} | null
	agentRole: {
		id: number
		displayName: string
		systemPrompt: string
	} | null
	voicePreset: {
		id: number
		displayName: string
		vapiProvider: string
		vapiVoiceId: string
	} | null
	sessionsCount: number
	lastSessionDate: Date | null
}

interface VoiceAgentStats {
	totalAgents: number
	activeAgents: number
	totalSessions: number
	recentAgents: number
	statusDistribution: Record<string, number>
	languageDistribution: Record<string, number>
}

interface VoiceAgentCreationOptions {
	users: Array<{
		id: string
		email: string | null
		name: string | null
	}>
	roles: Array<{
		id: number
		displayName: string
	}>
	voicePresets: Array<{
		id: number
		displayName: string
	}>
}

interface AdminVoiceAgentsClientProps {
	initialVoiceAgents: AdminVoiceAgentWithDetails[]
	initialStats: VoiceAgentStats
	creationOptions: VoiceAgentCreationOptions
}

// Status color mappings
const statusColors: Record<string, string> = {
	active: "bg-green-100 text-green-800 hover:bg-green-100",
	inactive: "bg-gray-100 text-gray-800 hover:bg-gray-100",
	training: "bg-blue-100 text-blue-800 hover:bg-blue-100",
	error: "bg-red-100 text-red-800 hover:bg-red-100"
}

// Statistics cards component
function VoiceAgentStatsCards({ stats }: { stats: VoiceAgentStats }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="rounded-2xl p-2 bg-blue-100">
							<Bot className="h-4 w-4 text-blue-600" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">
								Total Agents
							</p>
							<p className="text-2xl font-semibold">
								{stats.totalAgents}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="rounded-2xl p-2 bg-green-100">
							<PlayCircle className="h-4 w-4 text-green-600" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">
								Active Agents
							</p>
							<p className="text-2xl font-semibold">
								{stats.activeAgents}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="rounded-2xl p-2 bg-amber-100">
							<MessageSquare className="h-4 w-4 text-amber-600" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">
								Total Sessions
							</p>
							<p className="text-2xl font-semibold">
								{stats.totalSessions}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="rounded-2xl p-2 bg-teal-100">
							<Calendar className="h-4 w-4 text-teal-600" />
						</div>
						<div>
							<p className="text-sm text-muted-foreground">
								Recent
							</p>
							<p className="text-2xl font-semibold">
								{stats.recentAgents}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

// Status badge component
function StatusBadge({ status }: { status: VoiceAgentStatus | null }) {
	const statusColors: Record<string, string> = {
		active: "bg-green-100 text-green-800 hover:bg-green-100",
		inactive: "bg-gray-100 text-gray-800 hover:bg-gray-100",
		training: "bg-blue-100 text-blue-800 hover:bg-blue-100",
		error: "bg-red-100 text-red-800 hover:bg-red-100"
	}

	if (!status) {
		return (
			<Badge className="px-3 py-1 bg-gray-100 text-gray-800 hover:bg-gray-100">
				None
			</Badge>
		)
	}

	return (
		<Badge
			className={`px-3 py-1 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}
		>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</Badge>
	)
}

// Main client component
export function AdminVoiceAgentsClient({
	initialVoiceAgents,
	initialStats,
	creationOptions
}: AdminVoiceAgentsClientProps) {
	const [voiceAgents, setVoiceAgents] = useState(initialVoiceAgents)
	const [searchQuery, setSearchQuery] = useState("")
	const [isSearching, setIsSearching] = useState(false)
	const [isPending, startTransition] = useTransition()
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [editedAgentId, setEditedAgentId] = useState<number | null>(null)
	const [editedPrompt, setEditedPrompt] = useState("")
	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [createForm, setCreateForm] = useState({
		name: "",
		description: "",
		userId: "",
		agentRoleId: "",
		voicePresetId: "",
		language: "en",
		status: "inactive" as VoiceAgentStatus
	})

	// Search function
	const handleSearch = async (query: string) => {
		setSearchQuery(query)
		if (query.trim().length === 0) {
			setVoiceAgents(initialVoiceAgents)
			return
		}

		setIsSearching(true)
		try {
			const results = await searchVoiceAgents(query)
			setVoiceAgents(results)
		} catch (error) {
			console.error("Search error:", error)
			toast.error("Failed to search voice agents")
		} finally {
			setIsSearching(false)
		}
	}

	// Update status function
	const handleStatusUpdate = async (
		agentId: number,
		newStatus: VoiceAgentStatus
	) => {
		startTransition(async () => {
			try {
				await updateVoiceAgentStatus(agentId, newStatus)

				// Update local state
				setVoiceAgents((prev) =>
					prev.map((agent) =>
						agent.id === agentId
							? {
									...agent,
									status: newStatus,
									updatedAt: new Date()
								}
							: agent
					)
				)

				toast.success(`Voice agent status updated to ${newStatus}`)
			} catch (error) {
				console.error("Status update error:", error)
				toast.error("Failed to update voice agent status")
			}
		})
	}

	// Delete function
	const handleDelete = async (agentId: number) => {
		if (
			!confirm(
				"Are you sure you want to delete this voice agent? This action cannot be undone."
			)
		) {
			return
		}

		startTransition(async () => {
			try {
				await deleteVoiceAgent(agentId)

				// Update local state
				setVoiceAgents((prev) =>
					prev.filter((agent) => agent.id !== agentId)
				)

				toast.success("Voice agent deleted successfully")
			} catch (error) {
				console.error("Delete error:", error)
				toast.error("Failed to delete voice agent")
			}
		})
	}

	// Format date helper
	const formatDate = (date: Date | null) => {
		if (!date) return "Never"
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		}).format(new Date(date))
	}

	// Edit dialog functions
	const handleEditPrompt = (agentId: number, prompt: string) => {
		setEditedAgentId(agentId)
		setEditedPrompt(prompt || "")
		setEditDialogOpen(true)
	}

	const handleSavePrompt = async () => {
		if (!editedAgentId) return

		startTransition(async () => {
			try {
				await updateVoiceAgentPrompt(editedAgentId, editedPrompt)

				// Update local state
				setVoiceAgents((prev) =>
					prev.map((agent) =>
						agent.id === editedAgentId
							? {
									...agent,
									prompt: editedPrompt,
									updatedAt: new Date()
								}
							: agent
					)
				)

				toast.success("Voice agent prompt updated successfully")
				setEditDialogOpen(false)
			} catch (error) {
				console.error("Prompt update error:", error)
				toast.error("Failed to update voice agent prompt")
			}
		})
	}

	const handleCancelEdit = () => {
		setEditDialogOpen(false)
	}

	const resetCreateForm = () => {
		setCreateForm({
			name: "",
			description: "",
			userId: "",
			agentRoleId: "",
			voicePresetId: "",
			language: "en",
			status: "inactive"
		})
	}

	const handleCreateAgent = async () => {
		if (
			!createForm.name.trim() ||
			!createForm.userId ||
			!createForm.agentRoleId ||
			!createForm.voicePresetId
		) {
			toast.error("Please complete all required fields")
			return
		}

		setIsCreating(true)
		try {
			await createVoiceAgentForUser({
				name: createForm.name.trim(),
				description: createForm.description.trim() || undefined,
				userId: createForm.userId,
				agentRoleId: Number.parseInt(createForm.agentRoleId, 10),
				voicePresetId: Number.parseInt(createForm.voicePresetId, 10),
				language: createForm.language,
				status: createForm.status
			})

			const refreshedAgents = await searchVoiceAgents(searchQuery)
			setVoiceAgents(refreshedAgents)
			toast.success("Voice agent created successfully")
			resetCreateForm()
			setCreateDialogOpen(false)
		} catch (error) {
			console.error("Create agent error:", error)
			toast.error("Failed to create voice agent")
		} finally {
			setIsCreating(false)
		}
	}

	const handleCreateDialogChange = (open: boolean) => {
		setCreateDialogOpen(open)
		if (!open) {
			resetCreateForm()
		}
	}

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						Voice Agents
					</h1>
				</div>
				<div className="flex items-center gap-3">
					<AgentCustomizationDialog
						trigger={
							<Button
								variant="outline"
								className="gap-2 rounded-2xl"
							>
								<Settings className="h-4 w-4" />
								Customize Agents
							</Button>
						}
					/>
					<Dialog
						open={createDialogOpen}
						onOpenChange={handleCreateDialogChange}
					>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								className="gap-2 rounded-2xl"
							>
								<Plus className="h-4 w-4" />
								Create Agent
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create Voice Agent</DialogTitle>
								<DialogDescription>
									Create a new voice agent for any user
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-2">
								<div className="grid gap-2">
									<Label htmlFor="agent-name">Name</Label>
									<Input
										id="agent-name"
										value={createForm.name}
										onChange={(event) =>
											setCreateForm((prev) => ({
												...prev,
												name: event.target.value
											}))
										}
										placeholder="Inbound Support Agent"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="agent-description">
										Description
									</Label>
									<Textarea
										id="agent-description"
										value={createForm.description}
										onChange={(event) =>
											setCreateForm((prev) => ({
												...prev,
												description: event.target.value
											}))
										}
										placeholder="Optional short description"
									/>
								</div>
								<div className="grid gap-2">
									<Label>User</Label>
									<Select
										value={createForm.userId}
										onValueChange={(value) =>
											setCreateForm((prev) => ({
												...prev,
												userId: value
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a user" />
										</SelectTrigger>
										<SelectContent>
											{creationOptions.users.map(
												(userOption) => (
													<SelectItem
														key={userOption.id}
														value={userOption.id}
													>
														{userOption.email ||
															userOption.name ||
															userOption.id}
													</SelectItem>
												)
											)}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label>Role</Label>
									<Select
										value={createForm.agentRoleId}
										onValueChange={(value) =>
											setCreateForm((prev) => ({
												...prev,
												agentRoleId: value
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select role" />
										</SelectTrigger>
										<SelectContent>
											{creationOptions.roles.map(
												(role) => (
													<SelectItem
														key={role.id}
														value={String(role.id)}
													>
														{role.displayName}
													</SelectItem>
												)
											)}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label>Voice</Label>
									<Select
										value={createForm.voicePresetId}
										onValueChange={(value) =>
											setCreateForm((prev) => ({
												...prev,
												voicePresetId: value
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select OpenAI voice preset" />
										</SelectTrigger>
										<SelectContent>
											{creationOptions.voicePresets.map(
												(preset) => (
													<SelectItem
														key={preset.id}
														value={String(
															preset.id
														)}
													>
														{preset.displayName}
													</SelectItem>
												)
											)}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label>Status</Label>
									<Select
										value={createForm.status}
										onValueChange={(value) =>
											setCreateForm((prev) => ({
												...prev,
												status: value as VoiceAgentStatus
											}))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="inactive">
												Inactive
											</SelectItem>
											<SelectItem value="active">
												Active
											</SelectItem>
											<SelectItem value="training">
												Training
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="agent-language">
										Language
									</Label>
									<Input
										id="agent-language"
										value={createForm.language}
										onChange={(event) =>
											setCreateForm((prev) => ({
												...prev,
												language: event.target.value
											}))
										}
										placeholder="en"
									/>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={() =>
											setCreateDialogOpen(false)
										}
										disabled={isCreating}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreateAgent}
										disabled={isCreating}
									>
										{isCreating
											? "Creating..."
											: "Create Agent"}
									</Button>
								</div>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{/* Statistics Cards */}
			<VoiceAgentStatsCards stats={initialStats} />

			{/* Search and Filters */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search agents or users..."
						value={searchQuery}
						onChange={(e) => handleSearch(e.target.value)}
						className="pl-10 rounded-2xl bg-card/30"
						disabled={isSearching}
					/>
				</div>
				{(isSearching || isPending) && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-r-transparent" />
						{isSearching ? "Searching..." : "Updating..."}
					</div>
				)}
			</div>

			{/* Voice Agents Table */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-1 overflow-hidden">
				<CardContent className="p-0 h-full">
					<div className="overflow-auto h-full">
						<Table>
							<TableHeader>
								<TableRow className="border-border/40">
									<TableHead>Agent</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Role & Voice</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Sessions</TableHead>
									<TableHead>Last Session</TableHead>
									<TableHead className="w-[60px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{voiceAgents.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="text-center py-8"
										>
											<div className="flex flex-col items-center justify-center text-muted-foreground">
												<Bot className="h-8 w-8 mb-2" />
												<p className="text-sm">
													{searchQuery
														? "No voice agents found matching your search"
														: "No voice agents found"}
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									voiceAgents.map((agent) => (
										<TableRow
											key={agent.id}
											className="border-border/40"
										>
											<TableCell>
												<div>
													<div className="font-medium">
														{agent.name}
													</div>
													{agent.description && (
														<div className="text-sm text-muted-foreground">
															{agent.description
																.length > 50
																? `${agent.description.substring(0, 50)}...`
																: agent.description}
														</div>
													)}
													<div className="text-xs text-muted-foreground mt-1">
														ID: {agent.id}
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<div className="rounded-full p-1 bg-muted">
														<User className="h-3 w-3" />
													</div>
													<div>
														<div className="text-sm font-medium">
															{agent.userId}
														</div>
														{agent.user?.email && (
															<div className="text-xs text-muted-foreground">
																{
																	agent.user
																		.email
																}
															</div>
														)}
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div className="space-y-1">
													{agent.agentRole && (
														<div className="flex items-center gap-1">
															<Settings className="h-3 w-3 text-muted-foreground" />
															<span className="text-xs">
																{
																	agent
																		.agentRole
																		.displayName
																}
															</span>
														</div>
													)}
													{agent.voicePreset && (
														<div className="flex items-center gap-1">
															<Mic className="h-3 w-3 text-muted-foreground" />
															<span className="text-xs">
																{
																	agent
																		.voicePreset
																		.displayName
																}
															</span>
														</div>
													)}
													{agent.language && (
														<div className="text-xs text-muted-foreground">
															{agent.language.toUpperCase()}
														</div>
													)}
												</div>
											</TableCell>
											<TableCell>
												<StatusBadge
													status={agent.status}
												/>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-1">
													<Activity className="h-3 w-3 text-muted-foreground" />
													<span className="text-sm">
														{agent.sessionsCount}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<div className="text-sm text-muted-foreground">
													{formatDate(
														agent.lastSessionDate
													)}
												</div>
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger
														asChild
													>
														<Button
															variant="ghost"
															className="h-8 w-8 p-0"
														>
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() =>
																handleStatusUpdate(
																	agent.id,
																	"active"
																)
															}
															disabled={
																agent.status ===
																	"active" ||
																isPending
															}
														>
															<PlayCircle className="mr-2 h-4 w-4" />
															Set Active
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleStatusUpdate(
																	agent.id,
																	"inactive"
																)
															}
															disabled={
																agent.status ===
																	"inactive" ||
																isPending
															}
														>
															<PauseCircle className="mr-2 h-4 w-4" />
															Set Inactive
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleStatusUpdate(
																	agent.id,
																	"training"
																)
															}
															disabled={
																agent.status ===
																	"training" ||
																isPending
															}
														>
															<Settings className="mr-2 h-4 w-4" />
															Set Training
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleEditPrompt(
																	agent.id,
																	agent.prompt ||
																		""
																)
															}
															disabled={isPending}
														>
															<Edit className="mr-2 h-4 w-4" />
															Edit Prompt
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleDelete(
																	agent.id
																)
															}
															className="text-red-600"
															disabled={isPending}
														>
															<Trash2 className="mr-2 h-4 w-4" />
															Delete
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Edit Prompt Dialog */}
			<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Edit Prompt</DialogTitle>
						<DialogDescription>
							Edit the prompt for the selected voice agent
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="prompt" className="text-right">
								Prompt
							</Label>
							<Textarea
								id="prompt"
								value={editedPrompt}
								onChange={(e) =>
									setEditedPrompt(e.target.value)
								}
								className="col-span-3"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="submit"
							disabled={isPending}
							onClick={handleSavePrompt}
						>
							{isPending ? "Saving..." : "Save Changes"}
						</Button>
						<Button
							type="reset"
							disabled={isPending}
							onClick={handleCancelEdit}
						>
							{isPending ? "Cancelling..." : "Cancel"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
