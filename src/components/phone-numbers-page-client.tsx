"use client"

import {
	createPhoneNumber,
	setDefaultOutboundPhoneNumber,
	updatePhoneNumber,
	updatePhoneNumberStatus
} from "@/actions/phone-numbers"
import type { VoiceAgent } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { PhoneCall } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

type PhoneNumberRecord = {
	id: number
	provider: "mock" | "twilio" | "telnyx" | "vonage"
	phoneNumber: string
	label: string | null
	status: "provisioning" | "active" | "inactive" | "released"
	capabilities: {
		voice?: boolean
		sms?: boolean
		mms?: boolean
	} | null
	isDefaultOutbound: boolean
	assignedAgentId: number | null
	assignedAgentName: string | null
	updatedAt: Date
}

type CreateFormState = {
	provider: "twilio" | "telnyx" | "vonage" | "mock"
	phoneNumber: string
	label: string
	status: "active" | "provisioning"
	voice: boolean
	sms: boolean
	mms: boolean
	isDefaultOutbound: boolean
	assignedAgentId: string
}

const INITIAL_FORM: CreateFormState = {
	provider: "twilio",
	phoneNumber: "",
	label: "",
	status: "active",
	voice: true,
	sms: false,
	mms: false,
	isDefaultOutbound: false,
	assignedAgentId: "none"
}

export function PhoneNumbersPageClient({
	initialPhoneNumbers,
	voiceAgents
}: {
	initialPhoneNumbers: PhoneNumberRecord[]
	voiceAgents: Array<Pick<VoiceAgent, "id" | "name" | "status">>
}) {
	const [phoneNumbers, setPhoneNumbers] =
		useState<PhoneNumberRecord[]>(initialPhoneNumbers)
	const [form, setForm] = useState<CreateFormState>(INITIAL_FORM)
	const [isPending, startTransition] = useTransition()

	const activeAgentOptions = useMemo(
		() => voiceAgents.filter((agent) => agent.status === "active"),
		[voiceAgents]
	)

	const stats = useMemo(() => {
		const total = phoneNumbers.length
		const active = phoneNumbers.filter(
			(number) => number.status === "active"
		).length
		const assigned = phoneNumbers.filter(
			(number) => number.assignedAgentId !== null
		).length
		const defaultOutbound = phoneNumbers.find(
			(number) => number.isDefaultOutbound
		)
		return {
			total,
			active,
			assigned,
			defaultOutboundNumber: defaultOutbound?.phoneNumber || null
		}
	}, [phoneNumbers])

	const upsertPhoneNumberInState = (updated: PhoneNumberRecord) => {
		setPhoneNumbers((current) => {
			const next = current.map((number) =>
				number.id === updated.id ? updated : number
			)
			if (!current.some((number) => number.id === updated.id)) {
				next.unshift(updated)
			}
			return next
		})
	}

	const handleCreate = () => {
		startTransition(async () => {
			const result = await createPhoneNumber({
				provider: form.provider,
				phoneNumber: form.phoneNumber,
				label: form.label || null,
				status: form.status,
				isDefaultOutbound: form.isDefaultOutbound,
				capabilities: {
					voice: form.voice,
					sms: form.sms,
					mms: form.mms
				},
				assignedAgentId:
					form.assignedAgentId === "none"
						? null
						: Number(form.assignedAgentId)
			})

			if (!result.success || !result.data) {
				toast.error(result.error || "Failed to add phone number")
				return
			}

			upsertPhoneNumberInState({
				...result.data,
				assignedAgentName:
					activeAgentOptions.find(
						(agent) => agent.id === result.data?.assignedAgentId
					)?.name || null
			})
			setForm(INITIAL_FORM)
			toast.success("Phone number added")
		})
	}

	const handleSetDefault = (id: number) => {
		startTransition(async () => {
			const result = await setDefaultOutboundPhoneNumber({ id })
			if (!result.success || !result.data) {
				toast.error(result.error || "Failed to set default number")
				return
			}

			setPhoneNumbers((current) =>
				current.map((number) => ({
					...number,
					isDefaultOutbound: number.id === id
				}))
			)
			toast.success("Default outbound number updated")
		})
	}

	const handleStatusChange = (
		id: number,
		status: "provisioning" | "active" | "inactive" | "released"
	) => {
		startTransition(async () => {
			const result = await updatePhoneNumberStatus({ id, status })
			if (!result.success || !result.data) {
				toast.error(result.error || "Failed to update status")
				return
			}

			setPhoneNumbers((current) =>
				current.map((number) =>
					number.id === id
						? {
								...number,
								status: result.data.status,
								isDefaultOutbound: result.data.isDefaultOutbound
							}
						: number
				)
			)
			toast.success("Phone number status updated")
		})
	}

	const handleAssignAgent = (id: number, assignedAgentId: string) => {
		startTransition(async () => {
			const result = await updatePhoneNumber({
				id,
				assignedAgentId:
					assignedAgentId === "none" ? null : Number(assignedAgentId)
			})
			if (!result.success || !result.data) {
				toast.error(result.error || "Failed to assign agent")
				return
			}

			const assignedName =
				assignedAgentId === "none"
					? null
					: activeAgentOptions.find(
							(agent) => agent.id === Number(assignedAgentId)
						)?.name || null

			setPhoneNumbers((current) =>
				current.map((number) =>
					number.id === id
						? {
								...number,
								assignedAgentId:
									result.data.assignedAgentId || null,
								assignedAgentName: assignedName
							}
						: number
				)
			)
			toast.success("Agent assignment updated")
		})
	}

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-8 p-2 md:px-8 md:py-4 h-full">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						Phone Numbers
					</h1>
					<p className="text-sm text-muted-foreground">
						Manage provider numbers for outbound campaigns, inbound
						support routing, and future PSTN telephony rollout.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="pt-6">
							<p className="text-xs text-muted-foreground">
								Total
							</p>
							<p className="text-2xl font-semibold">
								{stats.total}
							</p>
						</CardContent>
					</Card>
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="pt-6">
							<p className="text-xs text-muted-foreground">
								Active
							</p>
							<p className="text-2xl font-semibold">
								{stats.active}
							</p>
						</CardContent>
					</Card>
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="pt-6">
							<p className="text-xs text-muted-foreground">
								Assigned To Agents
							</p>
							<p className="text-2xl font-semibold">
								{stats.assigned}
							</p>
						</CardContent>
					</Card>
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="pt-6">
							<p className="text-xs text-muted-foreground">
								Default Outbound
							</p>
							<p className="text-sm font-semibold mt-2 truncate">
								{stats.defaultOutboundNumber || "Not set"}
							</p>
						</CardContent>
					</Card>
				</div>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="text-base">
							Add Phone Number
						</CardTitle>
						<CardDescription>
							Add existing numbers from Twilio, Telnyx, Vonage, or
							mock provider for local testing.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
							<div className="space-y-2">
								<Label htmlFor="pn-provider">Provider</Label>
								<Select
									value={form.provider}
									onValueChange={(value) =>
										setForm((current) => ({
											...current,
											provider:
												value as CreateFormState["provider"]
										}))
									}
								>
									<SelectTrigger id="pn-provider">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="twilio">
											Twilio
										</SelectItem>
										<SelectItem value="telnyx">
											Telnyx
										</SelectItem>
										<SelectItem value="vonage">
											Vonage
										</SelectItem>
										<SelectItem value="mock">
											Mock
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="pn-number">Phone Number</Label>
								<Input
									id="pn-number"
									value={form.phoneNumber}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											phoneNumber: event.target.value
										}))
									}
									placeholder="+15551234567"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="pn-label">Label</Label>
								<Input
									id="pn-label"
									value={form.label}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											label: event.target.value
										}))
									}
									placeholder="Support line"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="pn-assigned-agent">
									Assign Agent
								</Label>
								<Select
									value={form.assignedAgentId}
									onValueChange={(value) =>
										setForm((current) => ({
											...current,
											assignedAgentId: value
										}))
									}
								>
									<SelectTrigger id="pn-assigned-agent">
										<SelectValue placeholder="Unassigned" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											Unassigned
										</SelectItem>
										{activeAgentOptions.map((agent) => (
											<SelectItem
												key={agent.id}
												value={agent.id.toString()}
											>
												{agent.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-6">
							<div className="flex items-center gap-2">
								<Checkbox
									id="pn-cap-voice"
									checked={form.voice}
									onCheckedChange={(checked) =>
										setForm((current) => ({
											...current,
											voice: checked === true
										}))
									}
								/>
								<Label htmlFor="pn-cap-voice">Voice</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="pn-cap-sms"
									checked={form.sms}
									onCheckedChange={(checked) =>
										setForm((current) => ({
											...current,
											sms: checked === true
										}))
									}
								/>
								<Label htmlFor="pn-cap-sms">SMS</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="pn-cap-mms"
									checked={form.mms}
									onCheckedChange={(checked) =>
										setForm((current) => ({
											...current,
											mms: checked === true
										}))
									}
								/>
								<Label htmlFor="pn-cap-mms">MMS</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="pn-default"
									checked={form.isDefaultOutbound}
									onCheckedChange={(checked) =>
										setForm((current) => ({
											...current,
											isDefaultOutbound: checked === true
										}))
									}
								/>
								<Label htmlFor="pn-default">
									Set as default outbound
								</Label>
							</div>

							<Button
								onClick={handleCreate}
								disabled={isPending || !form.phoneNumber.trim()}
								className="rounded-2xl"
							>
								Add Number
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardHeader>
						<CardTitle className="text-base">
							Numbers Directory
						</CardTitle>
						<CardDescription>
							Configure status, default outbound routing, and
							agent assignment.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{phoneNumbers.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No phone numbers yet. Add your first provider
								number above.
							</p>
						) : (
							phoneNumbers.map((number) => (
								<div
									key={number.id}
									className="rounded-2xl border border-border/60 p-4"
								>
									<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
										<div>
											<div className="flex items-center gap-2">
												<PhoneCall className="h-4 w-4 text-muted-foreground" />
												<p className="font-medium">
													{number.phoneNumber}
												</p>
												{number.label && (
													<Badge variant="outline">
														{number.label}
													</Badge>
												)}
												{number.isDefaultOutbound && (
													<Badge className="bg-primary/90">
														Default Outbound
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground mt-1 uppercase">
												{number.provider}
											</p>
											<div className="mt-2 flex items-center gap-2">
												{number.capabilities?.voice && (
													<Badge variant="secondary">
														Voice
													</Badge>
												)}
												{number.capabilities?.sms && (
													<Badge variant="secondary">
														SMS
													</Badge>
												)}
												{number.capabilities?.mms && (
													<Badge variant="secondary">
														MMS
													</Badge>
												)}
											</div>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:w-[640px]">
											<Select
												value={number.status}
												onValueChange={(value) =>
													handleStatusChange(
														number.id,
														value as PhoneNumberRecord["status"]
													)
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="active">
														Active
													</SelectItem>
													<SelectItem value="inactive">
														Inactive
													</SelectItem>
													<SelectItem value="provisioning">
														Provisioning
													</SelectItem>
													<SelectItem value="released">
														Released
													</SelectItem>
												</SelectContent>
											</Select>

											<Select
												value={
													number.assignedAgentId
														? number.assignedAgentId.toString()
														: "none"
												}
												onValueChange={(value) =>
													handleAssignAgent(
														number.id,
														value
													)
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Unassigned" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="none">
														Unassigned
													</SelectItem>
													{activeAgentOptions.map(
														(agent) => (
															<SelectItem
																key={agent.id}
																value={agent.id.toString()}
															>
																{agent.name}
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>

											<Button
												variant="outline"
												onClick={() =>
													handleSetDefault(number.id)
												}
												disabled={
													isPending ||
													number.isDefaultOutbound ||
													number.status !== "active"
												}
											>
												Set Default
											</Button>
										</div>
									</div>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
