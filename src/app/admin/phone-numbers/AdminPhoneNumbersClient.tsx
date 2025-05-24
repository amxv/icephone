"use client"

import { useState, useTransition } from "react"
import {
	Phone,
	Plus,
	Search,
	Download,
	Upload,
	Filter,
	MoreHorizontal
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
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
import { Skeleton } from "@/components/ui/skeleton"

import {
	assignPhoneNumberToUser,
	updatePhoneNumberStatus,
	importPhoneNumberFromVapi,
	createPhoneNumber,
	deletePhoneNumber,
	searchPhoneNumbers,
	getAvailableVapiPhoneNumbers
} from "@/actions/admin-phone-numbers"
import type {
	PhoneNumber,
	PhoneNumberCapabilities,
	PhoneNumberConfiguration
} from "@/types"

// Database version that allows nullable fields from Drizzle
type DatabasePhoneNumber = {
	id: number
	number: string
	friendlyName: string
	type: "inbound" | "outbound" | "both"
	status: "active" | "inactive" | "pending" | "suspended" | null
	isDefault: boolean | null
	provider: string | null
	providerSid: string | null
	userId: string
	capabilities: PhoneNumberCapabilities | null
	configuration: PhoneNumberConfiguration | null
	costPerMinute: string | null
	createdAt: Date
	updatedAt: Date
}

type Stats = {
	total: number
	active: number
	inactive: number
	pending: number
	suspended: number
	inboundOnly: number
	outboundOnly: number
	both: number
}

interface AdminPhoneNumbersClientProps {
	initialPhoneNumbers: DatabasePhoneNumber[]
	initialStats: Stats
}

export function AdminPhoneNumbersClient({
	initialPhoneNumbers,
	initialStats
}: AdminPhoneNumbersClientProps) {
	const [phoneNumbers, setPhoneNumbers] = useState(initialPhoneNumbers)
	const [stats, setStats] = useState(initialStats)
	const [searchQuery, setSearchQuery] = useState("")
	const [isSearching, setIsSearching] = useState(false)
	const [isPending, startTransition] = useTransition()

	// Dialog states
	const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [availableVapiNumbers, setAvailableVapiNumbers] = useState<
		Array<{
			id: string
			name: string
			phoneNumber: string
			provider: string
			createdAt: string
		}>
	>([])
	const [isLoadingVapiNumbers, setIsLoadingVapiNumbers] = useState(false)

	// Form states
	const [importForm, setImportForm] = useState({
		vapiPhoneNumberId: "",
		assignToUserId: ""
	})
	const [createForm, setCreateForm] = useState({
		number: "",
		friendlyName: "",
		userId: "",
		type: "both" as "inbound" | "outbound" | "both",
		status: "active" as "active" | "inactive" | "pending" | "suspended",
		provider: ""
	})

	const handleSearch = async (query: string) => {
		if (!query.trim()) {
			setPhoneNumbers(initialPhoneNumbers)
			setIsSearching(false)
			return
		}

		setIsSearching(true)
		try {
			const results = await searchPhoneNumbers(query)
			setPhoneNumbers(results)
		} catch (error) {
			console.error("Search failed:", error)
		} finally {
			setIsSearching(false)
		}
	}

	const handleStatusUpdate = async (
		phoneNumberId: number,
		newStatus: "active" | "inactive" | "pending" | "suspended"
	) => {
		startTransition(async () => {
			try {
				await updatePhoneNumberStatus(phoneNumberId, newStatus)
				// Update local state
				setPhoneNumbers((prev) =>
					prev.map((pn) =>
						pn.id === phoneNumberId
							? { ...pn, status: newStatus }
							: pn
					)
				)
			} catch (error) {
				console.error("Failed to update status:", error)
			}
		})
	}

	const handleAssignToUser = async (
		phoneNumberId: number,
		userId: string
	) => {
		startTransition(async () => {
			try {
				await assignPhoneNumberToUser(phoneNumberId, userId)
				// Update local state
				setPhoneNumbers((prev) =>
					prev.map((pn) =>
						pn.id === phoneNumberId
							? { ...pn, userId, status: "active" }
							: pn
					)
				)
			} catch (error) {
				console.error("Failed to assign phone number:", error)
			}
		})
	}

	const handleImportFromVapi = async () => {
		if (!importForm.vapiPhoneNumberId || !importForm.assignToUserId) return

		startTransition(async () => {
			try {
				const newNumber = await importPhoneNumberFromVapi(
					importForm.vapiPhoneNumberId,
					importForm.assignToUserId
				)
				setPhoneNumbers((prev) => [newNumber, ...prev])
				setIsImportDialogOpen(false)
				setImportForm({ vapiPhoneNumberId: "", assignToUserId: "" })
			} catch (error) {
				console.error("Failed to import from Vapi:", error)
			}
		})
	}

	const handleCreatePhoneNumber = async () => {
		if (!createForm.number || !createForm.userId) return

		startTransition(async () => {
			try {
				const newNumber = await createPhoneNumber(createForm)
				setPhoneNumbers((prev) => [newNumber, ...prev])
				setIsCreateDialogOpen(false)
				setCreateForm({
					number: "",
					friendlyName: "",
					userId: "",
					type: "both",
					status: "active",
					provider: ""
				})
			} catch (error) {
				console.error("Failed to create phone number:", error)
			}
		})
	}

	const handleDelete = async (phoneNumberId: number) => {
		if (!confirm("Are you sure you want to delete this phone number?"))
			return

		startTransition(async () => {
			try {
				await deletePhoneNumber(phoneNumberId)
				setPhoneNumbers((prev) =>
					prev.filter((pn) => pn.id !== phoneNumberId)
				)
			} catch (error) {
				console.error("Failed to delete phone number:", error)
			}
		})
	}

	const getStatusBadge = (status: string | null) => {
		if (!status) {
			return (
				<Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
					Unknown
				</Badge>
			)
		}

		const statusColors = {
			active: "bg-green-100 text-green-800 hover:bg-green-100",
			inactive: "bg-gray-100 text-gray-800 hover:bg-gray-100",
			pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
			suspended: "bg-red-100 text-red-800 hover:bg-red-100"
		}

		return (
			<Badge
				className={`${statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}`}
			>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</Badge>
		)
	}

	const getTypeBadge = (type: string) => {
		const typeColors = {
			inbound: "bg-blue-100 text-blue-800 hover:bg-blue-100",
			outbound: "bg-purple-100 text-purple-800 hover:bg-purple-100",
			both: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
		}

		return (
			<Badge
				className={`${typeColors[type as keyof typeof typeColors] || "bg-gray-100 text-gray-800"}`}
			>
				{type?.charAt(0).toUpperCase() + type?.slice(1)}
			</Badge>
		)
	}

	// Load available Vapi numbers when dialog opens
	const loadAvailableVapiNumbers = async () => {
		setIsLoadingVapiNumbers(true)
		try {
			const numbers = await getAvailableVapiPhoneNumbers()
			setAvailableVapiNumbers(numbers)
		} catch (error) {
			console.error("Failed to load Vapi phone numbers:", error)
		} finally {
			setIsLoadingVapiNumbers(false)
		}
	}

	return (
		<div className="flex flex-col gap-6 h-full">
			{/* Stats Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold">{stats.total}</div>
						<p className="text-xs text-muted-foreground">
							Total Numbers
						</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-green-600">
							{stats.active}
						</div>
						<p className="text-xs text-muted-foreground">Active</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-gray-600">
							{stats.inactive}
						</div>
						<p className="text-xs text-muted-foreground">
							Inactive
						</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-yellow-600">
							{stats.pending}
						</div>
						<p className="text-xs text-muted-foreground">Pending</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-blue-600">
							{stats.inboundOnly}
						</div>
						<p className="text-xs text-muted-foreground">Inbound</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-purple-600">
							{stats.outboundOnly}
						</div>
						<p className="text-xs text-muted-foreground">
							Outbound
						</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-emerald-600">
							{stats.both}
						</div>
						<p className="text-xs text-muted-foreground">
							Both Ways
						</p>
					</CardContent>
				</Card>
				<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-4">
						<div className="text-2xl font-bold text-red-600">
							{stats.suspended}
						</div>
						<p className="text-xs text-muted-foreground">
							Suspended
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Controls */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-6">
					<div className="flex flex-col md:flex-row gap-4 justify-between">
						<div className="flex flex-col md:flex-row gap-3 flex-1">
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
								<Input
									placeholder="Search phone numbers..."
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value)
										handleSearch(e.target.value)
									}}
									className="pl-10 rounded-2xl bg-card/30"
								/>
							</div>
						</div>
						<div className="flex gap-2">
							{/* Import from Vapi Dialog */}
							<Dialog
								open={isImportDialogOpen}
								onOpenChange={(open) => {
									setIsImportDialogOpen(open)
									if (open) {
										loadAvailableVapiNumbers()
									}
								}}
							>
								<DialogTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="gap-2 rounded-2xl"
									>
										<Upload className="h-4 w-4" />
										Import from Vapi
									</Button>
								</DialogTrigger>
								<DialogContent className="rounded-3xl max-w-2xl">
									<DialogHeader>
										<DialogTitle>
											Import Phone Number from Vapi
										</DialogTitle>
										<DialogDescription>
											Select a phone number from your Vapi
											account and assign it to a user.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4">
										<div>
											<Label htmlFor="vapiNumbers">
												Available Vapi Phone Numbers
											</Label>
											{isLoadingVapiNumbers ? (
												<div className="space-y-2">
													<Skeleton className="h-10 w-full rounded-2xl" />
													<Skeleton className="h-10 w-full rounded-2xl" />
													<Skeleton className="h-10 w-full rounded-2xl" />
												</div>
											) : availableVapiNumbers.length ===
												0 ? (
												<div className="text-center py-8 text-muted-foreground">
													<Phone className="h-8 w-8 mx-auto mb-2" />
													<p>
														No available phone
														numbers found in your
														Vapi account.
													</p>
													<p className="text-sm">
														All numbers may already
														be imported or you might
														need to purchase numbers
														in Vapi first.
													</p>
												</div>
											) : (
												<div className="space-y-2 max-h-64 overflow-y-auto">
													{availableVapiNumbers.map(
														(phone) => (
															<Card
																key={phone.id}
																className={`cursor-pointer transition-colors hover:bg-muted/50 ${
																	importForm.vapiPhoneNumberId ===
																	phone.id
																		? "ring-2 ring-primary bg-primary/5"
																		: ""
																}`}
																onClick={() =>
																	setImportForm(
																		(
																			prev
																		) => ({
																			...prev,
																			vapiPhoneNumberId:
																				phone.id
																		})
																	)
																}
															>
																<CardContent className="p-3">
																	<div className="flex items-center justify-between">
																		<div>
																			<div className="font-medium">
																				{
																					phone.phoneNumber
																				}
																			</div>
																			<div className="text-sm text-muted-foreground">
																				{phone.name ||
																					"Unlabeled"}{" "}
																				•{" "}
																				{phone.provider ||
																					"Unknown"}
																			</div>
																		</div>
																		<Badge variant="outline">
																			{phone.provider ||
																				"Unknown"}
																		</Badge>
																	</div>
																</CardContent>
															</Card>
														)
													)}
												</div>
											)}
										</div>

										{importForm.vapiPhoneNumberId && (
											<div>
												<Label htmlFor="assignUser">
													Assign to User ID
												</Label>
												<Input
													id="assignUser"
													placeholder="Enter user ID to assign to"
													value={
														importForm.assignToUserId
													}
													onChange={(e) =>
														setImportForm(
															(prev) => ({
																...prev,
																assignToUserId:
																	e.target
																		.value
															})
														)
													}
													className="rounded-2xl"
												/>
											</div>
										)}

										<div className="flex gap-2 justify-end">
											<Button
												variant="outline"
												onClick={() =>
													setIsImportDialogOpen(false)
												}
												className="rounded-2xl"
											>
												Cancel
											</Button>
											<Button
												onClick={handleImportFromVapi}
												disabled={
													isPending ||
													!importForm.vapiPhoneNumberId ||
													!importForm.assignToUserId ||
													isLoadingVapiNumbers
												}
												className="rounded-2xl"
											>
												{isPending
													? "Importing..."
													: "Import"}
											</Button>
										</div>
									</div>
								</DialogContent>
							</Dialog>

							{/* Create Phone Number Dialog */}
							<Dialog
								open={isCreateDialogOpen}
								onOpenChange={setIsCreateDialogOpen}
							>
								<DialogTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="gap-2 rounded-2xl"
									>
										<Plus className="h-4 w-4" />
										Create Number
									</Button>
								</DialogTrigger>
								<DialogContent className="rounded-3xl">
									<DialogHeader>
										<DialogTitle>
											Create Phone Number
										</DialogTitle>
										<DialogDescription>
											Manually create a new phone number
											record.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4">
										<div>
											<Label htmlFor="number">
												Phone Number
											</Label>
											<Input
												id="number"
												placeholder="e.g., +12065551234"
												value={createForm.number}
												onChange={(e) =>
													setCreateForm((prev) => ({
														...prev,
														number: e.target.value
													}))
												}
												className="rounded-2xl"
											/>
										</div>
										<div>
											<Label htmlFor="friendlyName">
												Friendly Name
											</Label>
											<Input
												id="friendlyName"
												placeholder="e.g., Main Office Line"
												value={createForm.friendlyName}
												onChange={(e) =>
													setCreateForm((prev) => ({
														...prev,
														friendlyName:
															e.target.value
													}))
												}
												className="rounded-2xl"
											/>
										</div>
										<div>
											<Label htmlFor="userId">
												User ID
											</Label>
											<Input
												id="userId"
												placeholder="Enter user ID to assign to"
												value={createForm.userId}
												onChange={(e) =>
													setCreateForm((prev) => ({
														...prev,
														userId: e.target.value
													}))
												}
												className="rounded-2xl"
											/>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div>
												<Label htmlFor="type">
													Type
												</Label>
												<Select
													value={createForm.type}
													onValueChange={(
														value:
															| "inbound"
															| "outbound"
															| "both"
													) =>
														setCreateForm(
															(prev) => ({
																...prev,
																type: value
															})
														)
													}
												>
													<SelectTrigger className="rounded-2xl">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="inbound">
															Inbound
														</SelectItem>
														<SelectItem value="outbound">
															Outbound
														</SelectItem>
														<SelectItem value="both">
															Both
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div>
												<Label htmlFor="status">
													Status
												</Label>
												<Select
													value={createForm.status}
													onValueChange={(
														value:
															| "active"
															| "inactive"
															| "pending"
															| "suspended"
													) =>
														setCreateForm(
															(prev) => ({
																...prev,
																status: value
															})
														)
													}
												>
													<SelectTrigger className="rounded-2xl">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="active">
															Active
														</SelectItem>
														<SelectItem value="inactive">
															Inactive
														</SelectItem>
														<SelectItem value="pending">
															Pending
														</SelectItem>
														<SelectItem value="suspended">
															Suspended
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
										<div>
											<Label htmlFor="provider">
												Provider (Optional)
											</Label>
											<Input
												id="provider"
												placeholder="e.g., vapi, twilio"
												value={createForm.provider}
												onChange={(e) =>
													setCreateForm((prev) => ({
														...prev,
														provider: e.target.value
													}))
												}
												className="rounded-2xl"
											/>
										</div>
										<div className="flex gap-2 justify-end">
											<Button
												variant="outline"
												onClick={() =>
													setIsCreateDialogOpen(false)
												}
												className="rounded-2xl"
											>
												Cancel
											</Button>
											<Button
												onClick={
													handleCreatePhoneNumber
												}
												disabled={
													isPending ||
													!createForm.number ||
													!createForm.userId
												}
												className="rounded-2xl"
											>
												{isPending
													? "Creating..."
													: "Create"}
											</Button>
										</div>
									</div>
								</DialogContent>
							</Dialog>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Phone Numbers Table */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-1">
				<CardHeader className="px-6 py-4">
					<CardTitle className="text-lg font-medium">
						Phone Numbers
					</CardTitle>
				</CardHeader>
				<CardContent className="px-6 py-0 pb-6">
					<div className="rounded-2xl border overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Number</TableHead>
									<TableHead>Name</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Provider</TableHead>
									<TableHead>User ID</TableHead>
									<TableHead>Capabilities</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="w-[50px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{isSearching ? (
									Array.from({ length: 5 }).map((_, i) => (
										<TableRow key={i}>
											<TableCell>
												<Skeleton className="h-4 w-28" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-24" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-16" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-16" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-16" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-24" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-20" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-20" />
											</TableCell>
											<TableCell>
												<Skeleton className="h-4 w-8" />
											</TableCell>
										</TableRow>
									))
								) : phoneNumbers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={9}
											className="text-center py-8"
										>
											<div className="flex flex-col items-center gap-2">
												<Phone className="h-8 w-8 text-muted-foreground" />
												<p className="text-sm text-muted-foreground">
													No phone numbers found
												</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									phoneNumbers.map((phoneNumber) => (
										<TableRow key={phoneNumber.id}>
											<TableCell className="font-mono text-sm">
												{phoneNumber.number}
											</TableCell>
											<TableCell>
												{phoneNumber.friendlyName}
											</TableCell>
											<TableCell>
												{getTypeBadge(phoneNumber.type)}
											</TableCell>
											<TableCell>
												{getStatusBadge(
													phoneNumber.status
												)}
											</TableCell>
											<TableCell className="text-sm">
												{phoneNumber.provider || "—"}
											</TableCell>
											<TableCell className="font-mono text-xs">
												{phoneNumber.userId.slice(0, 8)}
												...
											</TableCell>
											<TableCell>
												<div className="flex gap-1">
													{phoneNumber.capabilities
														?.voice && (
														<Badge
															variant="outline"
															className="text-xs"
														>
															Voice
														</Badge>
													)}
													{phoneNumber.capabilities
														?.sms && (
														<Badge
															variant="outline"
															className="text-xs"
														>
															SMS
														</Badge>
													)}
													{phoneNumber.capabilities
														?.mms && (
														<Badge
															variant="outline"
															className="text-xs"
														>
															MMS
														</Badge>
													)}
													{phoneNumber.capabilities
														?.fax && (
														<Badge
															variant="outline"
															className="text-xs"
														>
															Fax
														</Badge>
													)}
												</div>
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{new Date(
													phoneNumber.createdAt
												).toLocaleDateString()}
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger
														asChild
													>
														<Button
															variant="ghost"
															size="sm"
														>
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() =>
																handleStatusUpdate(
																	phoneNumber.id,
																	"active"
																)
															}
															disabled={
																phoneNumber.status ===
																"active"
															}
														>
															Set Active
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleStatusUpdate(
																	phoneNumber.id,
																	"inactive"
																)
															}
															disabled={
																phoneNumber.status ===
																"inactive"
															}
														>
															Set Inactive
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleStatusUpdate(
																	phoneNumber.id,
																	"suspended"
																)
															}
															disabled={
																phoneNumber.status ===
																"suspended"
															}
														>
															Suspend
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																handleDelete(
																	phoneNumber.id
																)
															}
															className="text-red-600"
														>
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
		</div>
	)
}
