"use client"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import type { PhoneNumber, VoiceAgent } from "@/types"
import {
	PhoneIcon,
	PhoneIncomingIcon,
	PhoneOutgoingIcon,
	InfoIcon,
	FilterIcon,
	ContactIcon
} from "lucide-react"
import { useState, useEffect } from "react"
import { CustomerPhoneNumberDisplay } from "@/components/customer-phone-display"

// Customer page header with business-friendly messaging
function CustomerPageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Your Phone Numbers
				</h1>
				<p className="text-muted-foreground">
					Manage your business phone numbers and AI voice agents
				</p>
			</div>
			<Button variant="outline" className="gap-2 rounded-2xl" disabled>
				<ContactIcon className="h-4 w-4" />
				Contact Support
			</Button>
		</div>
	)
}

// Customer-friendly filters (no provider options)
interface CustomerPhoneNumberFilters {
	status?: string
	agentAssigned?: boolean
}

function CustomerPhoneNumberFilters({
	onFilterChange
}: {
	onFilterChange: (filters: CustomerPhoneNumberFilters) => void
}) {
	const [status, setStatus] = useState<string>("all")
	const [agentAssigned, setAgentAssigned] = useState<string>("all")

	// Apply filters whenever any filter changes
	useEffect(() => {
		onFilterChange({
			status: status === "all" ? undefined : status,
			agentAssigned:
				agentAssigned === "all"
					? undefined
					: agentAssigned === "assigned"
		})
	}, [status, agentAssigned, onFilterChange])

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2">
					<FilterIcon className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-lg">Filters</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<label
							htmlFor="status-filter"
							className="text-sm font-medium"
						>
							Status
						</label>
						<Select value={status} onValueChange={setStatus}>
							<SelectTrigger
								id="status-filter"
								className="rounded-lg"
							>
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									All Statuses
								</SelectItem>
								<SelectItem value="active">
									Connected
								</SelectItem>
								<SelectItem value="pending">
									Setting Up
								</SelectItem>
								<SelectItem value="suspended">
									Has Issues
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="agent-filter"
							className="text-sm font-medium"
						>
							Voice Agent
						</label>
						<Select
							value={agentAssigned}
							onValueChange={setAgentAssigned}
						>
							<SelectTrigger
								id="agent-filter"
								className="rounded-lg"
							>
								<SelectValue placeholder="All numbers" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Numbers</SelectItem>
								<SelectItem value="assigned">
									Has Agent
								</SelectItem>
								<SelectItem value="unassigned">
									Needs Agent
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Customer inbound numbers section
function CustomerInboundNumbersSection({
	phoneNumbers,
	voiceAgents,
	onUpdate,
	filters
}: {
	phoneNumbers: PhoneNumber[]
	voiceAgents?: VoiceAgent[]
	onUpdate?: () => void
	filters: CustomerPhoneNumberFilters
}) {
	const filteredNumbers = phoneNumbers.filter((number) => {
		if (filters.status && number.status !== filters.status) {
			return false
		}
		if (typeof filters.agentAssigned === "boolean") {
			const hasAgent = voiceAgents?.some(
				(agent) => agent.phoneNumberId === number.id
			)
			if (filters.agentAssigned !== hasAgent) {
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
									These are the phone numbers customers call
									to reach your business. Your AI voice agent
									will automatically answer these calls.
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
							<CustomerPhoneNumberDisplay
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

// Customer outbound numbers section
function CustomerOutboundNumbersSection({
	phoneNumbers,
	voiceAgents,
	onUpdate,
	filters
}: {
	phoneNumbers: PhoneNumber[]
	voiceAgents?: VoiceAgent[]
	onUpdate?: () => void
	filters: CustomerPhoneNumberFilters
}) {
	const filteredNumbers = phoneNumbers.filter((number) => {
		if (filters.status && number.status !== filters.status) {
			return false
		}
		if (typeof filters.agentAssigned === "boolean") {
			const hasAgent = voiceAgents?.some(
				(agent) => agent.phoneNumberId === number.id
			)
			if (filters.agentAssigned !== hasAgent) {
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
									These numbers are used when your AI agent
									makes outgoing calls to leads and customers.
									This is what appears on their caller ID.
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
							<CustomerPhoneNumberDisplay
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
				</div>
			</CardContent>
		</Card>
	)
}

// Main Customer Phone Numbers Page Client Component
export function CustomerPhoneNumbersPageClient({
	initialPhoneNumbers = [],
	voiceAgents = []
}: {
	initialPhoneNumbers?: PhoneNumber[]
	voiceAgents?: VoiceAgent[]
}) {
	const [phoneNumbers, setPhoneNumbers] =
		useState<PhoneNumber[]>(initialPhoneNumbers)
	const [filters, setFilters] = useState<CustomerPhoneNumberFilters>({})

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
			<CustomerPageHeader />

			<CustomerPhoneNumberFilters onFilterChange={setFilters} />

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
					<CustomerInboundNumbersSection
						phoneNumbers={inboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
					<CustomerOutboundNumbersSection
						phoneNumbers={outboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
				</TabsContent>

				<TabsContent value="inbound" className="mt-6">
					<CustomerInboundNumbersSection
						phoneNumbers={inboundNumbers}
						voiceAgents={voiceAgents}
						onUpdate={handleUpdate}
						filters={filters}
					/>
				</TabsContent>

				<TabsContent value="outbound" className="mt-6">
					<CustomerOutboundNumbersSection
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
