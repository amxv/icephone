"use client"

import { useState, useEffect } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { CalendarIcon, PhoneIcon, ClockIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"
import {
	scheduleCall,
	getAvailableVoiceAgents
} from "@/actions/lead-communication"
import { getPhoneNumbers } from "@/actions/phone-numbers"

interface CallDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	leadId: number
	leadName: string
	leadPhone?: string
}

interface VoiceAgent {
	id: number
	name: string
	description: string | null
	status: string | null
}

interface TeamPhoneNumber {
	id: number
	phoneNumber: string
	provider: "mock" | "twilio" | "telnyx" | "vonage"
	label: string | null
	status: "provisioning" | "active" | "inactive" | "released"
	isDefaultOutbound: boolean
}

// Helper function to format date for datetime-local input
const formatDateTimeLocal = (date: Date) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	const hours = String(date.getHours()).padStart(2, "0")
	const minutes = String(date.getMinutes()).padStart(2, "0")
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function CallDialog({
	open,
	onOpenChange,
	leadId,
	leadName,
	leadPhone
}: CallDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [instructions, setInstructions] = useState("")
	const [selectedAgent, setSelectedAgent] = useState<string>("")
	const [priority, setPriority] = useState("0")
	const [scheduledTime, setScheduledTime] = useState("")
	const [phoneNumber, setPhoneNumber] = useState(leadPhone || "")
	const [voiceAgents, setVoiceAgents] = useState<VoiceAgent[]>([])
	const [teamPhoneNumbers, setTeamPhoneNumbers] = useState<TeamPhoneNumber[]>(
		[]
	)
	const [selectedOutboundPhoneNumberId, setSelectedOutboundPhoneNumberId] =
		useState<string>("auto")
	const [isImmediate, setIsImmediate] = useState(true)

	// Fetch available voice agents when dialog opens
	useEffect(() => {
		if (open) {
			const fetchAgents = async () => {
				const [agentsResult, numbersResult] = await Promise.all([
					getAvailableVoiceAgents(),
					getPhoneNumbers()
				])
				if (agentsResult.success) {
					setVoiceAgents(agentsResult.data)
					// Auto-select first agent if available
					if (agentsResult.data.length > 0) {
						setSelectedAgent(agentsResult.data[0].id.toString())
					}
				}

				if (numbersResult.success && numbersResult.data) {
					const activeNumbers = numbersResult.data.filter(
						(number) => number.status === "active"
					)
					setTeamPhoneNumbers(activeNumbers)
					const defaultNumber =
						activeNumbers.find(
							(number) => number.isDefaultOutbound
						) || null
					setSelectedOutboundPhoneNumberId(
						defaultNumber ? defaultNumber.id.toString() : "auto"
					)
				}
			}
			fetchAgents()
		}
	}, [open])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)

		try {
			const callData = {
				leadId,
				instructions: instructions.trim() || undefined,
				voiceAgentId: selectedAgent ? Number(selectedAgent) : undefined,
				priority: Number(priority),
				phoneNumber:
					phoneNumber !== leadPhone ? phoneNumber : undefined,
				outboundPhoneNumberId:
					selectedOutboundPhoneNumberId !== "auto"
						? Number(selectedOutboundPhoneNumberId)
						: undefined,
				scheduledTime:
					!isImmediate && scheduledTime
						? new Date(scheduledTime)
						: undefined
			}

			const result = await scheduleCall(callData)

			if (result.success) {
				toast.success(result.message)
				onOpenChange(false)
				// Reset form
				setInstructions("")
				setSelectedAgent("")
				setPriority("0")
				setScheduledTime("")
				setPhoneNumber(leadPhone || "")
				setSelectedOutboundPhoneNumberId("auto")
				setIsImmediate(true)
			} else {
				toast.error(result.error)
			}
		} catch (error) {
			console.error("Error scheduling call:", error)
			toast.error("Failed to schedule call")
		} finally {
			setIsLoading(false)
		}
	}

	// Set default scheduled time to 1 hour from now
	useEffect(() => {
		if (!isImmediate && !scheduledTime) {
			const defaultTime = new Date()
			defaultTime.setHours(defaultTime.getHours() + 1)
			setScheduledTime(formatDateTimeLocal(defaultTime))
		}
	}, [isImmediate, scheduledTime])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Schedule Call
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Schedule a voice agent call with {leadName}. Provide
						specific instructions for the conversation.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="pt-2">
					<div className="space-y-4">
						{/* Call Timing */}
						<div>
							<Label className="text-sm font-medium">
								Call Timing
							</Label>
							<div className="grid grid-cols-2 gap-2 mt-1.5">
								<Button
									type="button"
									variant={
										isImmediate ? "default" : "outline"
									}
									className="justify-start h-10"
									onClick={() => setIsImmediate(true)}
								>
									<PlayIcon className="h-4 w-4 mr-2" />
									Immediate
								</Button>
								<Button
									type="button"
									variant={
										!isImmediate ? "default" : "outline"
									}
									className="justify-start h-10"
									onClick={() => setIsImmediate(false)}
								>
									<ClockIcon className="h-4 w-4 mr-2" />
									Schedule Later
								</Button>
							</div>
						</div>

						{/* Scheduled Time */}
						{!isImmediate && (
							<div>
								<Label htmlFor="scheduled-time">
									Scheduled Time
								</Label>
								<Input
									id="scheduled-time"
									type="datetime-local"
									value={scheduledTime}
									onChange={(e) =>
										setScheduledTime(e.target.value)
									}
									className="rounded-lg mt-1.5"
									min={formatDateTimeLocal(new Date())}
									required={!isImmediate}
								/>
							</div>
						)}

						{/* Voice Agent Selection */}
						<div>
							<Label htmlFor="voice-agent">Voice Agent</Label>
							<Select
								value={selectedAgent}
								onValueChange={setSelectedAgent}
							>
								<SelectTrigger className="rounded-lg mt-1.5">
									<SelectValue placeholder="Select a voice agent" />
								</SelectTrigger>
								<SelectContent>
									{voiceAgents.map((agent) => (
										<SelectItem
											key={agent.id}
											value={agent.id.toString()}
										>
											<div className="flex flex-col items-start">
												<span className="font-medium">
													{agent.name}
												</span>
												{agent.description && (
													<span className="text-xs text-muted-foreground">
														{agent.description}
													</span>
												)}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{voiceAgents.length === 0 && (
								<p className="text-xs text-muted-foreground mt-1">
									No active voice agents found
								</p>
							)}
						</div>

						{/* Phone Number Override */}
						<div>
							<Label htmlFor="phone-number">Phone Number</Label>
							<Input
								id="phone-number"
								type="tel"
								value={phoneNumber}
								onChange={(e) => setPhoneNumber(e.target.value)}
								className="rounded-lg mt-1.5"
								placeholder="Override lead's phone number"
							/>
							{leadPhone && phoneNumber === leadPhone && (
								<p className="text-xs text-muted-foreground mt-1">
									Using lead's default phone number
								</p>
							)}
						</div>

						{/* Outbound Caller ID */}
						<div>
							<Label htmlFor="outbound-phone-number">
								Outbound Caller ID
							</Label>
							<Select
								value={selectedOutboundPhoneNumberId}
								onValueChange={setSelectedOutboundPhoneNumberId}
							>
								<SelectTrigger
									id="outbound-phone-number"
									className="rounded-lg mt-1.5"
								>
									<SelectValue placeholder="Auto-select from team defaults" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="auto">
										Auto-select from team routing
									</SelectItem>
									{teamPhoneNumbers.map((number) => (
										<SelectItem
											key={number.id}
											value={number.id.toString()}
										>
											{number.phoneNumber}
											{number.label
												? ` • ${number.label}`
												: ""}
											{number.isDefaultOutbound
												? " • Default"
												: ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground mt-1">
								Use Auto for provider/agent-aware routing or
								pick a specific number.
							</p>
						</div>

						{/* Call Instructions */}
						<div>
							<Label htmlFor="instructions">
								Call Instructions
							</Label>
							<Textarea
								id="instructions"
								value={instructions}
								onChange={(e) =>
									setInstructions(e.target.value)
								}
								className="rounded-lg resize-none min-h-[100px] mt-1.5"
								placeholder="e.g., Follow up about last conversation, discuss pricing, schedule demo..."
							/>
						</div>

						{/* Priority */}
						<div>
							<Label htmlFor="priority">Priority</Label>
							<Select
								value={priority}
								onValueChange={setPriority}
							>
								<SelectTrigger className="rounded-lg mt-1.5">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="0">Normal</SelectItem>
									<SelectItem value="1">High</SelectItem>
									<SelectItem value="2">Urgent</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter className="mt-6">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							className="rounded-lg"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="bg-primary hover:bg-primary/90 rounded-lg"
							disabled={isLoading || !phoneNumber.trim()}
						>
							{isLoading ? (
								<>
									<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
									Scheduling...
								</>
							) : isImmediate ? (
								<>
									<PhoneIcon className="h-4 w-4 mr-2" />
									Queue Call
								</>
							) : (
								<>
									<CalendarIcon className="h-4 w-4 mr-2" />
									Schedule Call
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
