"use client"

import { assignPhoneNumberToAgent } from "@/actions/voice-agents"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import type { PhoneNumber, VoiceAgent } from "@/types"
import { BotIcon, PhoneIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface AssignAgentDialogProps {
	phoneNumber: PhoneNumber
	voiceAgents: VoiceAgent[]
	onSuccess?: () => void
	trigger?: React.ReactNode
}

export function AssignAgentDialog({
	phoneNumber,
	voiceAgents,
	onSuccess,
	trigger
}: AssignAgentDialogProps) {
	const [open, setOpen] = useState(false)
	const [selectedAgentId, setSelectedAgentId] = useState<string>("")
	const [isAssigning, setIsAssigning] = useState(false)

	// Find currently assigned agent
	const currentAgent = voiceAgents.find(
		(agent) => agent.phoneNumberId === phoneNumber.id
	)

	// Filter available agents (not assigned to other numbers or the current one)
	const availableAgents = voiceAgents.filter(
		(agent) =>
			agent.phoneNumberId === null ||
			agent.phoneNumberId === phoneNumber.id
	)

	const handleAssign = async () => {
		if (!selectedAgentId) return

		setIsAssigning(true)
		try {
			const agentId = parseInt(selectedAgentId)
			const result = await assignPhoneNumberToAgent(
				agentId,
				phoneNumber.id
			)

			if (result.success) {
				toast.success(`Phone number assigned to agent successfully`)
				setOpen(false)
				setSelectedAgentId("")
				onSuccess?.()
			} else {
				toast.error(result.error || "Failed to assign phone number")
			}
		} catch (error) {
			console.error("Error assigning agent:", error)
			toast.error("Failed to assign phone number")
		} finally {
			setIsAssigning(false)
		}
	}

	const handleUnassign = async () => {
		if (!currentAgent) return

		setIsAssigning(true)
		try {
			const result = await assignPhoneNumberToAgent(currentAgent.id, null)

			if (result.success) {
				toast.success("Phone number unassigned successfully")
				setOpen(false)
				onSuccess?.()
			} else {
				toast.error(result.error || "Failed to unassign phone number")
			}
		} catch (error) {
			console.error("Error unassigning agent:", error)
			toast.error("Failed to unassign phone number")
		} finally {
			setIsAssigning(false)
		}
	}

	const defaultTrigger = (
		<Button variant="outline" size="sm" className="rounded-2xl">
			<BotIcon className="h-4 w-4 mr-2" />
			{currentAgent ? "Change Agent" : "Assign Agent"}
		</Button>
	)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						{currentAgent
							? "Change Voice Agent"
							: "Assign Voice Agent"}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{currentAgent
							? `Currently assigned to ${currentAgent.name}. Select a different agent or unassign.`
							: `Assign a voice agent to handle calls for ${phoneNumber.friendlyName}`}
					</DialogDescription>
				</DialogHeader>

				<div className="pt-2">
					{/* Phone Number Info */}
					<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 mb-4">
						<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
							<PhoneIcon className="h-4 w-4 text-primary" />
						</div>
						<div>
							<div className="font-medium">
								{phoneNumber.number}
							</div>
							<div className="text-sm text-muted-foreground">
								{phoneNumber.friendlyName}
							</div>
						</div>
					</div>

					{/* Current Assignment */}
					{currentAgent && (
						<div className="mb-4">
							<Label className="text-sm font-medium">
								Currently Assigned
							</Label>
							<div className="flex items-center gap-3 p-3 rounded-lg border mt-1.5">
								<BotIcon className="h-4 w-4 text-muted-foreground" />
								<span className="font-medium">
									{currentAgent.name}
								</span>
								<span className="text-sm text-muted-foreground">
									({currentAgent.status})
								</span>
							</div>
						</div>
					)}

					{/* Agent Selection */}
					<div className="space-y-2">
						<Label className="text-sm font-medium">
							{currentAgent ? "Change to" : "Select Agent"}
						</Label>
						<Select
							value={selectedAgentId}
							onValueChange={setSelectedAgentId}
						>
							<SelectTrigger className="rounded-lg">
								<SelectValue placeholder="Select a voice agent" />
							</SelectTrigger>
							<SelectContent>
								{availableAgents.length === 0 ? (
									<div className="p-2 text-sm text-muted-foreground text-center">
										No available agents
									</div>
								) : (
									availableAgents.map((agent) => (
										<SelectItem
											key={agent.id}
											value={agent.id.toString()}
											disabled={
												agent.id === currentAgent?.id
											}
										>
											<div className="flex items-center gap-2">
												<BotIcon className="h-4 w-4" />
												<span>{agent.name}</span>
												<span className="text-xs text-muted-foreground ml-auto">
													{agent.status}
												</span>
											</div>
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter className="mt-6">
					{currentAgent && (
						<Button
							variant="outline"
							onClick={handleUnassign}
							disabled={isAssigning}
							className="rounded-lg"
						>
							Unassign
						</Button>
					)}
					<Button
						onClick={handleAssign}
						disabled={!selectedAgentId || isAssigning}
						className="bg-primary hover:bg-primary/90 rounded-lg"
					>
						{isAssigning ? "Assigning..." : "Assign Agent"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
