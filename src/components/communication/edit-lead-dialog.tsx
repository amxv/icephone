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
import { EditIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { updateLead } from "@/actions/leads"
import { leadStatusEnum } from "@/db/schema"

interface EditLeadDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	lead: {
		id: number
		name: string
		email?: string | null
		phone?: string | null
		status: string
		score?: number | null
		source?: string | null
		notes?: string | null
	}
	onLeadUpdated?: () => void
}

export function EditLeadDialog({
	open,
	onOpenChange,
	lead,
	onLeadUpdated
}: EditLeadDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [formData, setFormData] = useState({
		name: lead.name,
		email: lead.email || "",
		phone: lead.phone || "",
		status: lead.status,
		score: lead.score || 0,
		source: lead.source || "",
		notes: lead.notes || ""
	})

	// Reset form data when lead changes or dialog opens
	useEffect(() => {
		if (open) {
			setFormData({
				name: lead.name,
				email: lead.email || "",
				phone: lead.phone || "",
				status: lead.status,
				score: lead.score || 0,
				source: lead.source || "",
				notes: lead.notes || ""
			})
		}
	}, [open, lead])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)

		try {
			const updateData = {
				name: formData.name.trim(),
				email: formData.email.trim() || null,
				phone: formData.phone.trim() || null,
				status: formData.status as
					| "new"
					| "contacted"
					| "qualified"
					| "converted"
					| "lost",
				score: formData.score,
				source: formData.source.trim() || null,
				notes: formData.notes.trim() || null
			}

			const result = await updateLead(lead.id, updateData)

			if (result.success) {
				toast.success("Lead updated successfully")
				onOpenChange(false)
				onLeadUpdated?.()
			} else {
				toast.error(result.error || "Failed to update lead")
			}
		} catch (error) {
			console.error("Error updating lead:", error)
			toast.error("Failed to update lead")
		} finally {
			setIsLoading(false)
		}
	}

	const handleInputChange = (field: string, value: string | number) => {
		setFormData((prev) => ({
			...prev,
			[field]: value
		}))
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Edit Lead Details
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Update the information for {lead.name}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="pt-2">
					<div className="space-y-4">
						<div>
							<Label htmlFor="lead-name">Name</Label>
							<Input
								id="lead-name"
								value={formData.name}
								onChange={(e) =>
									handleInputChange("name", e.target.value)
								}
								placeholder="e.g., John Doe"
								className="rounded-lg mt-1.5"
								disabled={isLoading}
								required
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="lead-phone">Phone Number</Label>
								<Input
									id="lead-phone"
									type="tel"
									value={formData.phone}
									onChange={(e) =>
										handleInputChange(
											"phone",
											e.target.value
										)
									}
									placeholder="e.g., (555) 123-4567"
									className="rounded-lg mt-1.5"
									disabled={isLoading}
								/>
							</div>
							<div>
								<Label htmlFor="lead-email">Email</Label>
								<Input
									id="lead-email"
									type="email"
									value={formData.email}
									onChange={(e) =>
										handleInputChange(
											"email",
											e.target.value
										)
									}
									placeholder="e.g., john@example.com"
									className="rounded-lg mt-1.5"
									disabled={isLoading}
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="lead-status">Status</Label>
								<Select
									value={formData.status}
									onValueChange={(value) =>
										handleInputChange("status", value)
									}
									disabled={isLoading}
								>
									<SelectTrigger className="rounded-lg mt-1.5">
										<SelectValue placeholder="Select status" />
									</SelectTrigger>
									<SelectContent>
										{leadStatusEnum.enumValues.map(
											(status) => (
												<SelectItem
													key={status}
													value={status}
												>
													{status
														.charAt(0)
														.toUpperCase() +
														status.slice(1)}
												</SelectItem>
											)
										)}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="lead-score">
									Score (0-100)
								</Label>
								<Input
									id="lead-score"
									type="number"
									min={0}
									max={100}
									value={formData.score}
									onChange={(e) =>
										handleInputChange(
											"score",
											Number(e.target.value)
										)
									}
									className="rounded-lg mt-1.5"
									disabled={isLoading}
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="lead-source">Source</Label>
							<Input
								id="lead-source"
								value={formData.source}
								onChange={(e) =>
									handleInputChange("source", e.target.value)
								}
								placeholder="e.g., Website, Referral, etc."
								className="rounded-lg mt-1.5"
								disabled={isLoading}
							/>
						</div>

						<div>
							<Label htmlFor="lead-notes">Notes</Label>
							<Textarea
								id="lead-notes"
								value={formData.notes}
								onChange={(e) =>
									handleInputChange("notes", e.target.value)
								}
								placeholder="Additional information about this lead..."
								className="rounded-lg resize-none min-h-[100px] mt-1.5"
								disabled={isLoading}
							/>
						</div>
					</div>

					<DialogFooter className="mt-6">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							className="rounded-lg"
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="bg-primary hover:bg-primary/90 rounded-lg"
							disabled={isLoading || !formData.name.trim()}
						>
							{isLoading ? (
								<>
									<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
									Saving...
								</>
							) : (
								<>
									<SaveIcon className="h-4 w-4 mr-2" />
									Save Changes
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
