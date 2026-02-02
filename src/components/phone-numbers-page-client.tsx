"use client"

import { AddPhoneNumberDialog } from "@/components/add-phone-number-dialog"
import { AssignAgentDialog } from "@/components/assign-agent-dialog"
import { PhoneNumberConfigDialog } from "@/components/phone-number-config-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import type { PhoneNumber, VoiceAgent } from "@/types"
import {
	ClockIcon,
	InfoIcon,
	PhoneIcon,
	PhoneIncomingIcon,
	PhoneOutgoingIcon,
	BotIcon,
	RefreshCwIcon,
	WifiIcon,
	AlertCircleIcon,
	CheckCircleIcon,
	FilterIcon
} from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import {
	syncVapiPhoneStatus,
	testVapiPhoneConnectivity
} from "@/actions/phone-numbers"

// Page header component with gradient title
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Phone Numbers
				</h1>
			</div>
			<AddPhoneNumberDialog variant="outline" />
		</div>
	)
}

// VAPI status indicator component
function VapiStatusIndicator({ phoneNumber }: { phoneNumber: PhoneNumber }) {
	const isVapiNumber = phoneNumber.provider === "vapi"
	const hasProviderSid = Boolean(phoneNumber.providerSid)

	if (!isVapiNumber) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							className="gap-1 bg-gray-100 text-gray-600 border-gray-200"
						>
							<WifiIcon className="h-3 w-3" />
							Manual
						</Badge>
					</TooltipTrigger>
					<TooltipContent>
						<p>Manually configured number</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		)
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant="outline"
						className={`gap-1 ${
							hasProviderSid
								? "bg-green-100 text-green-700 border-green-200"
								: "bg-yellow-100 text-yellow-700 border-yellow-200"
						}`}
					>
						{hasProviderSid ? (
							<CheckCircleIcon className="h-3 w-3" />
						) : (
							<AlertCircleIcon className="h-3 w-3" />
						)}
						VAPI
					</Badge>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{hasProviderSid
							? "Connected to VAPI"
							: "VAPI integration pending"}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

// VAPI actions component
function VapiActions({ phoneNumber }: { phoneNumber: PhoneNumber }) {
	const [isSyncing, setIsSyncing] = useState(false)
	const [isTesting, setIsTesting] = useState(false)

	const handleSyncWithVapi = async () => {
		if (!phoneNumber.providerSid) return

		setIsSyncing(true)
		try {
			const result = await syncVapiPhoneStatus(phoneNumber.id)
			if (result.success) {
				console.log(
					"Successfully synced with VAPI for number:",
					phoneNumber.id
				)
				// Refresh the page to show updated data
				window.location.reload()
			}
		} catch (error) {
			console.error("Failed to sync with VAPI:", error)
			alert("Failed to sync with VAPI. Please try again.")
		} finally {
			setIsSyncing(false)
		}
	}

	const handleTestConnectivity = async () => {
		if (!phoneNumber.providerSid) return

		setIsTesting(true)
		try {
			const result = await testVapiPhoneConnectivity(phoneNumber.id)
			if (result.success && result.connectivity) {
				console.log("VAPI connectivity test successful:", result)
				alert(
					`VAPI connectivity test successful!\nPhone: ${result.connectivity.phoneNumber}\nStatus: ${result.connectivity.status}\nProvider: ${result.connectivity.provider}`
				)
			} else {
				alert(
					`VAPI connectivity test failed: ${result.error || "Unknown error"}`
				)
			}
		} catch (error) {
			console.error("Failed to test VAPI connectivity:", error)
			alert("Failed to test VAPI connectivity. Please try again.")
		} finally {
			setIsTesting(false)
		}
	}

	if (phoneNumber.provider !== "vapi" || !phoneNumber.providerSid) {
		return null
	}

	return (
		<div className="flex gap-1">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleSyncWithVapi}
							disabled={isSyncing}
							className="h-8 w-8 p-0"
						>
							<RefreshCwIcon
								className={`h-3 w-3 ${
									isSyncing ? "animate-spin" : ""
								}`}
							/>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Sync with VAPI</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleTestConnectivity}
							disabled={isTesting}
							className="h-8 w-8 p-0"
						>
							<WifiIcon
								className={`h-3 w-3 ${
									isTesting ? "animate-pulse" : ""
								}`}
							/>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Test VAPI connectivity</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	)
}

// Enhanced phone number display with VAPI information
function PhoneNumberDisplay({
	phoneNumber,
	voiceAgents,
	onUpdate
}: {
	phoneNumber: PhoneNumber
	voiceAgents?: VoiceAgent[]
	onUpdate?: () => void
}) {
	const { number, friendlyName, status, isDefault, provider, providerSid } =
		phoneNumber
	const statusConfig = {
		active: {
			color: "bg-green-100 text-green-800 border-green-200",
			label: "Active"
		},
		inactive: {
			color: "bg-gray-100 text-gray-800 border-gray-200",
			label: "Inactive"
		},
		pending: {
			color: "bg-yellow-100 text-yellow-800 border-yellow-200",
			label: "Pending"
		},
		suspended: {
			color: "bg-red-100 text-red-800 border-red-200",
			label: "Suspended"
		}
	}

	const config = statusConfig[status] || statusConfig.inactive

	// Find assigned voice agent
	const assignedAgent = voiceAgents?.find(
		(agent) => agent.phoneNumberId === phoneNumber.id
	)

	return (
		<div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border/50 rounded-2xl bg-card/30 mb-3">
			<div className="flex items-center gap-3 mb-2 md:mb-0">
				<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
					<PhoneIcon className="h-5 w-5 text-primary" />
				</div>
				<div>
					<div className="font-medium">{number}</div>
					<div className="text-sm text-muted-foreground">
						{friendlyName}
					</div>
					{/* Provider information */}
					{provider && (
						<div className="text-xs text-muted-foreground mt-1">
							Provider: {provider}
							{providerSid && (
								<span className="ml-1 text-gray-400">
									({providerSid.substring(0, 8)}...)
								</span>
							)}
						</div>
					)}
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex gap-2">
						<Badge variant="outline" className={config.color}>
							{config.label}
						</Badge>
						{isDefault && (
							<Badge
								variant="outline"
								className="bg-blue-100 text-blue-800 border-blue-200"
							>
								Default
							</Badge>
						)}
						<VapiStatusIndicator phoneNumber={phoneNumber} />
					</div>
				</div>
			</div>

			{/* Voice Agent Assignment */}
			<div className="flex items-center gap-3 mb-2 md:mb-0">
				<div className="flex items-center gap-2">
					<BotIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">Agent:</span>
				</div>
				<div className="text-sm">
					{assignedAgent ? (
						<Badge
							variant="outline"
							className="gap-1 px-3 py-1 bg-green-50 text-green-700 border-green-200"
						>
							<BotIcon className="h-3 w-3" />
							{assignedAgent.name}
						</Badge>
					) : (
						<span className="text-muted-foreground">
							Unassigned
						</span>
					)}
				</div>
			</div>

			<div className="flex gap-2 w-full md:w-auto items-center">
				<VapiActions phoneNumber={phoneNumber} />
				<AssignAgentDialog
					phoneNumber={phoneNumber}
					voiceAgents={voiceAgents || []}
					onSuccess={onUpdate}
				/>
				<PhoneNumberConfigDialog
					phoneNumber={phoneNumber}
					voiceAgents={voiceAgents}
					onSuccess={onUpdate}
				/>
			</div>
		</div>
	)
}

// Define filter types
interface PhoneNumberFilters {
	provider?: string
	status?: string
	vapiConnected?: boolean
}

// Enhanced filtering component
function PhoneNumberFilters({
	onFilterChange
}: {
	onFilterChange: (filters: PhoneNumberFilters) => void
}) {
	const [provider, setProvider] = useState<string>("all")
	const [status, setStatus] = useState<string>("all")
	const [vapiConnected, setVapiConnected] = useState<string>("all")

	const handleFilterChange = useCallback(() => {
		onFilterChange({
			provider: provider === "all" ? undefined : provider,
			status: status === "all" ? undefined : status,
			vapiConnected:
				vapiConnected === "all"
					? undefined
					: vapiConnected === "connected"
		})
	}, [provider, status, vapiConnected, onFilterChange])

	useEffect(() => {
		handleFilterChange()
	}, [handleFilterChange])

	return (
		<Card className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm shadow-sm mb-4">
			<CardContent className="p-4">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<FilterIcon className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm font-medium">Filters:</span>
					</div>

					<Select value={provider} onValueChange={setProvider}>
						<SelectTrigger className="w-[140px] h-8 text-sm">
							<SelectValue placeholder="Provider" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Providers</SelectItem>
							<SelectItem value="vapi">VAPI</SelectItem>
							<SelectItem value="twilio">Twilio</SelectItem>
							<SelectItem value="vonage">Vonage</SelectItem>
							<SelectItem value="manual">Manual</SelectItem>
						</SelectContent>
					</Select>

					<Select value={status} onValueChange={setStatus}>
						<SelectTrigger className="w-[120px] h-8 text-sm">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="suspended">Suspended</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={vapiConnected}
						onValueChange={setVapiConnected}
					>
						<SelectTrigger className="w-[150px] h-8 text-sm">
							<SelectValue placeholder="VAPI Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All VAPI</SelectItem>
							<SelectItem value="connected">
								VAPI Connected
							</SelectItem>
							<SelectItem value="disconnected">
								Not Connected
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</CardContent>
		</Card>
	)
}

// Inbound numbers section with enhanced filtering
function InboundNumbersSection({
	phoneNumbers,
	voiceAgents,
	onUpdate,
	filters
}: {
	phoneNumbers: PhoneNumber[]
	voiceAgents?: VoiceAgent[]
	onUpdate?: () => void
	filters: PhoneNumberFilters
}) {
	const filteredNumbers = phoneNumbers.filter((number) => {
		if (filters.provider && number.provider !== filters.provider) {
			return false
		}
		if (filters.status && number.status !== filters.status) {
			return false
		}
		if (typeof filters.vapiConnected === "boolean") {
			const hasVapiConnection =
				number.provider === "vapi" && Boolean(number.providerSid)
			if (filters.vapiConnected !== hasVapiConnection) {
				return false
			}
		}
		return true
	})

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<PhoneIncomingIcon className="h-5 w-5 text-green-600" />
						<CardTitle>
							Inbound Numbers ({filteredNumbers.length})
						</CardTitle>
					</div>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent>
								<p className="max-w-xs">
									Inbound numbers are used for customers to
									call your business. Incoming calls will be
									automatically handled by your AI voice
									agent.
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{filteredNumbers.length > 0 ? (
						filteredNumbers.map((phoneNumber) => (
							<PhoneNumberDisplay
								key={phoneNumber.id}
								phoneNumber={phoneNumber}
								voiceAgents={voiceAgents}
								onUpdate={onUpdate}
							/>
						))
					) : (
						<div className="text-center py-8 text-muted-foreground">
							<PhoneIncomingIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No inbound numbers match your filters</p>
							<p className="text-sm">
								Try adjusting your filter settings
							</p>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}

// Outbound numbers section with enhanced filtering
function OutboundNumbersSection({
	phoneNumbers,
	voiceAgents,
	onUpdate,
	filters
}: {
	phoneNumbers: PhoneNumber[]
	voiceAgents?: VoiceAgent[]
	onUpdate?: () => void
	filters: PhoneNumberFilters
}) {
	const [callerId, setCallerId] = useState("default")
	const [scheduleEnabled, setScheduleEnabled] = useState(true)

	const filteredNumbers = phoneNumbers.filter((number) => {
		if (filters.provider && number.provider !== filters.provider) {
			return false
		}
		if (filters.status && number.status !== filters.status) {
			return false
		}
		if (typeof filters.vapiConnected === "boolean") {
			const hasVapiConnection =
				number.provider === "vapi" && Boolean(number.providerSid)
			if (filters.vapiConnected !== hasVapiConnection) {
				return false
			}
		}
		return true
	})

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<PhoneOutgoingIcon className="h-5 w-5 text-blue-600" />
						<CardTitle>
							Outbound Numbers ({filteredNumbers.length})
						</CardTitle>
					</div>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent>
								<p className="max-w-xs">
									Outbound numbers are used for your AI agents
									to make outgoing calls to leads and
									customers. This is what appears on their
									caller ID.
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{filteredNumbers.length > 0 ? (
						filteredNumbers.map((phoneNumber) => (
							<PhoneNumberDisplay
								key={phoneNumber.id}
								phoneNumber={phoneNumber}
								voiceAgents={voiceAgents}
								onUpdate={onUpdate}
							/>
						))
					) : (
						<div className="text-center py-8 text-muted-foreground">
							<PhoneOutgoingIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No outbound numbers match your filters</p>
							<p className="text-sm">
								Try adjusting your filter settings
							</p>
						</div>
					)}

					<div className="p-4 border border-border/50 rounded-2xl bg-card/30">
						<h3 className="text-base font-medium mb-4">
							Outbound Settings
						</h3>

						<div className="grid gap-4">
							<div className="flex flex-col space-y-1.5">
								<div className="flex justify-between items-center">
									<label
										htmlFor="callerId"
										className="text-sm font-medium"
									>
										Caller ID Name
									</label>
								</div>
								<Select
									value={callerId}
									onValueChange={setCallerId}
								>
									<SelectTrigger
										id="callerId"
										className="rounded-lg"
									>
										<SelectValue placeholder="Select a caller ID to display" />
									</SelectTrigger>
									<SelectContent position="popper">
										<SelectItem value="default">
											IcePhone Sales
										</SelectItem>
										<SelectItem value="company">
											Your Company Name
										</SelectItem>
										<SelectItem value="local">
											Local Area Match (Smart)
										</SelectItem>
										<SelectItem value="custom">
											Custom Name
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<div className="flex items-center">
										<ClockIcon className="h-4 w-4 mr-2 text-muted-foreground" />
										<label
											htmlFor="scheduleToggle"
											className="text-sm font-medium"
										>
											Respect Business Hours
										</label>
									</div>
									<p className="text-sm text-muted-foreground">
										Only make outbound calls during business
										hours
									</p>
								</div>
								<Switch
									id="scheduleToggle"
									checked={scheduleEnabled}
									onCheckedChange={setScheduleEnabled}
								/>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Main Phone Numbers Page Client Component
export function PhoneNumbersPageClient({
	initialPhoneNumbers = [],
	voiceAgents = []
}: {
	initialPhoneNumbers?: PhoneNumber[]
	voiceAgents?: VoiceAgent[]
}) {
	const [phoneNumbers, setPhoneNumbers] =
		useState<PhoneNumber[]>(initialPhoneNumbers)
	const [filters, setFilters] = useState<PhoneNumberFilters>({})

	// Filter numbers by type
	const inboundNumbers = phoneNumbers.filter(
		(num) => num.type === "inbound" || num.type === "both"
	)
	const outboundNumbers = phoneNumbers.filter(
		(num) => num.type === "outbound" || num.type === "both"
	)

	const handleUpdate = () => {
		// Refresh the page to get updated data
		window.location.reload()
	}

	return (
		<>
			<PageHeader />

			<PhoneNumberFilters onFilterChange={setFilters} />

			<Tabs defaultValue="all" className="mb-6">
				<TabsList className="rounded-full bg-muted/80 shadow-inner">
					<TabsTrigger
						value="all"
						className="px-6 text-base font-medium rounded-full"
					>
						All Numbers
					</TabsTrigger>
					<TabsTrigger
						value="inbound"
						className="px-6 text-base font-medium rounded-full"
					>
						Inbound
					</TabsTrigger>
					<TabsTrigger
						value="outbound"
						className="px-6 text-base font-medium rounded-full"
					>
						Outbound
					</TabsTrigger>
				</TabsList>

				<TabsContent value="all" className="space-y-6 mt-6">
					<InboundNumbersSection
						phoneNumbers={inboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
					<OutboundNumbersSection
						phoneNumbers={outboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
				</TabsContent>

				<TabsContent value="inbound" className="mt-6">
					<InboundNumbersSection
						phoneNumbers={inboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
				</TabsContent>

				<TabsContent value="outbound" className="mt-6">
					<OutboundNumbersSection
						phoneNumbers={outboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
				</TabsContent>
			</Tabs>
		</>
	)
}
