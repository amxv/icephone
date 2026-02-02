"use client"

import { useState } from "react"
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
import { CalendarIcon, ClockIcon } from "lucide-react"
import { toast } from "sonner"
import { scheduleAppointment } from "@/actions/lead-communication"

interface AppointmentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	leadId: number
	leadName: string
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

export function AppointmentDialog({
	open,
	onOpenChange,
	leadId,
	leadName
}: AppointmentDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [title, setTitle] = useState("")
	const [description, setDescription] = useState("")
	const [startTime, setStartTime] = useState("")
	const [duration, setDuration] = useState("60") // minutes
	const [location, setLocation] = useState("")

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)

		try {
			const startDate = new Date(startTime)
			const endDate = new Date(
				startDate.getTime() + Number(duration) * 60 * 1000
			)

			const appointmentData = {
				leadId,
				title: title.trim(),
				description: description.trim() || undefined,
				startTime: startDate,
				endTime: endDate,
				location: location.trim() || undefined
			}

			const result = await scheduleAppointment(appointmentData)

			if (result.success) {
				toast.success(result.message)
				onOpenChange(false)
				// Reset form
				setTitle("")
				setDescription("")
				setStartTime("")
				setDuration("60")
				setLocation("")
			} else {
				toast.error(result.error)
			}
		} catch (error) {
			console.error("Error scheduling appointment:", error)
			toast.error("Failed to schedule appointment")
		} finally {
			setIsLoading(false)
		}
	}

	// Set default start time to next hour
	const getDefaultStartTime = () => {
		const now = new Date()
		now.setHours(now.getHours() + 1, 0, 0, 0) // Next hour, rounded down to exact hour
		return formatDateTimeLocal(now)
	}

	// Calculate end time for display
	const getEndTime = () => {
		if (startTime) {
			const start = new Date(startTime)
			const end = new Date(start.getTime() + Number(duration) * 60 * 1000)
			return end.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit"
			})
		}
		return ""
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Schedule Appointment
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Schedule a meeting or appointment with {leadName}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="pt-2">
					<div className="space-y-4">
						{/* Appointment Title */}
						<div>
							<Label htmlFor="appointment-title">
								Meeting Title
							</Label>
							<Input
								id="appointment-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="rounded-lg mt-1.5"
								placeholder="e.g., Sales Discovery Call, Product Demo"
								required
							/>
						</div>

						{/* Start Date and Time */}
						<div>
							<Label htmlFor="start-time">
								Start Date & Time
							</Label>
							<Input
								id="start-time"
								type="datetime-local"
								value={startTime || getDefaultStartTime()}
								onChange={(e) => setStartTime(e.target.value)}
								className="rounded-lg mt-1.5"
								min={formatDateTimeLocal(new Date())}
								required
							/>
						</div>

						{/* Duration */}
						<div>
							<Label htmlFor="duration">Duration</Label>
							<Select
								value={duration}
								onValueChange={setDuration}
							>
								<SelectTrigger className="rounded-lg mt-1.5">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="15">
										15 minutes
									</SelectItem>
									<SelectItem value="30">
										30 minutes
									</SelectItem>
									<SelectItem value="45">
										45 minutes
									</SelectItem>
									<SelectItem value="60">1 hour</SelectItem>
									<SelectItem value="90">
										1.5 hours
									</SelectItem>
									<SelectItem value="120">2 hours</SelectItem>
								</SelectContent>
							</Select>
							{startTime && (
								<p className="text-xs text-muted-foreground mt-1">
									Ends at {getEndTime()}
								</p>
							)}
						</div>

						{/* Location */}
						<div>
							<Label htmlFor="location">
								Location (Optional)
							</Label>
							<Input
								id="location"
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								className="rounded-lg mt-1.5"
								placeholder="e.g., Conference Room A, Zoom Meeting, Client Office"
							/>
						</div>

						{/* Description */}
						<div>
							<Label htmlFor="appointment-description">
								Agenda/Notes (Optional)
							</Label>
							<Textarea
								id="appointment-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="rounded-lg resize-none min-h-[100px] mt-1.5"
								placeholder="Meeting agenda, preparation notes, or topics to discuss..."
							/>
						</div>

						{/* Meeting Summary */}
						{title && startTime && (
							<div className="border rounded-lg p-4 bg-slate-50">
								<h4 className="text-sm font-medium mb-2">
									Meeting Summary:
								</h4>
								<div className="space-y-1 text-sm text-muted-foreground">
									<div className="flex items-center gap-2">
										<CalendarIcon className="h-4 w-4" />
										<span>{title}</span>
									</div>
									<div className="flex items-center gap-2">
										<ClockIcon className="h-4 w-4" />
										<span>
											{new Date(
												startTime
											).toLocaleDateString()}{" "}
											at{" "}
											{new Date(
												startTime
											).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit"
											})}{" "}
											({duration} min)
										</span>
									</div>
									{location && (
										<div className="flex items-center gap-2">
											<span className="h-4 w-4 text-center">
												📍
											</span>
											<span>{location}</span>
										</div>
									)}
								</div>
							</div>
						)}
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
							disabled={isLoading || !title.trim() || !startTime}
						>
							{isLoading ? (
								<>
									<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
									Scheduling...
								</>
							) : (
								<>
									<CalendarIcon className="h-4 w-4 mr-2" />
									Schedule Appointment
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
