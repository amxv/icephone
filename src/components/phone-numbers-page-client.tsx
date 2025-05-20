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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import {
	ClockIcon,
	InfoIcon,
	PhoneIcon,
	PhoneIncomingIcon,
	PhoneOutgoingIcon,
	PlusIcon,
	SettingsIcon
} from "lucide-react"
import { useState } from "react"

// Page header component with gradient title
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Phone Numbers
				</h1>
			</div>
			<Button variant="outline" className="rounded-full">
				<PlusIcon className="h-4 w-4 mr-2" />
				Add Number
			</Button>
		</div>
	)
}

// Phone number display with status badge
function PhoneNumberDisplay({
	number,
	name,
	status,
	isDefault = false
}: {
	number: string
	name: string
	status: "active" | "inactive" | "pending"
	isDefault?: boolean
}) {
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
		}
	}

	const config = statusConfig[status]

	return (
		<div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border/50 rounded-2xl bg-card/30 mb-3">
			<div className="flex items-center gap-3 mb-2 md:mb-0">
				<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
					<PhoneIcon className="h-5 w-5 text-primary" />
				</div>
				<div>
					<div className="font-medium">{number}</div>
					<div className="text-sm text-muted-foreground">{name}</div>
				</div>
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
				</div>
			</div>
			<div className="flex gap-2 w-full md:w-auto">
				<Button
					variant="outline"
					size="sm"
					className="rounded-full w-full md:w-auto"
				>
					<SettingsIcon className="h-4 w-4 mr-2" />
					Configure
				</Button>
			</div>
		</div>
	)
}

// Inbound numbers section
function InboundNumbersSection() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<PhoneIncomingIcon className="h-5 w-5 text-green-600" />
						<CardTitle>Inbound Numbers</CardTitle>
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
					<PhoneNumberDisplay
						number="+1 (415) 555-1234"
						name="Sales Department"
						status="active"
						isDefault={true}
					/>
					<PhoneNumberDisplay
						number="+1 (415) 555-5678"
						name="Support Line"
						status="active"
					/>
				</div>
			</CardContent>
		</Card>
	)
}

// Outbound numbers section with settings
function OutboundNumbersSection() {
	const [callerId, setCallerId] = useState("default")
	const [scheduleEnabled, setScheduleEnabled] = useState(true)

	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<PhoneOutgoingIcon className="h-5 w-5 text-blue-600" />
						<CardTitle>Outbound Numbers</CardTitle>
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
					<PhoneNumberDisplay
						number="+1 (415) 555-9012"
						name="Sales Outreach"
						status="active"
						isDefault={true}
					/>

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
export function PhoneNumbersPageClient() {
	return (
		<>
			<PageHeader />

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
					<InboundNumbersSection />
					<OutboundNumbersSection />
				</TabsContent>

				<TabsContent value="inbound" className="mt-6">
					<InboundNumbersSection />
				</TabsContent>

				<TabsContent value="outbound" className="mt-6">
					<OutboundNumbersSection />
				</TabsContent>
			</Tabs>
		</>
	)
}
