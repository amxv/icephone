"use client"

import { format, parseISO } from "date-fns"
import { Calendar, Clock, MapPin, Text, User } from "lucide-react"

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

import { Button } from "@/components/ui/button"
import { AddEditEventDialog } from "@/lib/calendar/components/dialogs/add-edit-event-dialog"
import type { IEvent } from "@/lib/calendar/interfaces"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { useCalendar } from "../../contexts/calendar-context"
import { formatTime } from "../../helpers"

interface IProps {
	event: IEvent
	children: ReactNode
}

export function EventDetailsDialog({ event, children }: IProps) {
	const startDate = parseISO(event.startDate)
	const endDate = parseISO(event.endDate)
	const { use24HourFormat, removeEvent } = useCalendar()

	const deleteEvent = async (eventId: number) => {
		try {
			await removeEvent(eventId)
		} catch {
			toast.error("Error processing delete request.")
		}
	}

	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{event.title}</DialogTitle>
				</DialogHeader>

				<ScrollArea className="max-h-[80vh]">
					<div className="space-y-4 p-4">
						<div className="flex items-start gap-2">
							<User className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">
									Responsible
								</p>
								<p className="text-sm text-muted-foreground">
									{event.user.name}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-2">
							<Calendar className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">
									Start Date
								</p>
								<p className="text-sm text-muted-foreground">
									{format(startDate, "EEEE dd MMMM")}
									<span className="mx-1">at</span>
									{formatTime(
										parseISO(event.startDate),
										use24HourFormat
									)}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-2">
							<Clock className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">End Date</p>
								<p className="text-sm text-muted-foreground">
									{format(endDate, "EEEE dd MMMM")}
									<span className="mx-1">at</span>
									{formatTime(
										parseISO(event.endDate),
										use24HourFormat
									)}
								</p>
							</div>
						</div>

						{event.location && (
							<div className="flex items-start gap-2">
								<MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-sm font-medium">Where</p>
									<p className="text-sm text-muted-foreground">
										{event.location}
									</p>
								</div>
							</div>
						)}

						<div className="flex items-start gap-2">
							<Text className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">
									Description
								</p>
								<p className="text-sm text-muted-foreground">
									{event.description}
								</p>
							</div>
						</div>
					</div>
				</ScrollArea>
				<div className="flex justify-end gap-2">
					<AddEditEventDialog event={event}>
						<Button variant="outline">Edit</Button>
					</AddEditEventDialog>
					<DialogClose asChild>
						<Button
							variant="destructive"
							onClick={() => {
								deleteEvent(event.id)
							}}
						>
							Delete
						</Button>
					</DialogClose>
				</div>
			</DialogContent>
		</Dialog>
	)
}
