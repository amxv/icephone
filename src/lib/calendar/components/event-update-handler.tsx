"use client"

import { useCalendar } from "@/lib/calendar/contexts/calendar-context"
import { useDragDrop } from "@/lib/calendar/contexts/drag-drop-context"
import type { IEvent } from "@/lib/calendar/interfaces"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"

export function EventUpdateHandler() {
	const { setOnEventDropped } = useDragDrop()
	const { updateEvent } = useCalendar()

	const handleEventUpdate = useCallback(
		(event: IEvent, newStartDate: Date, newEndDate: Date) => {
			try {
				const updatedEvent = {
					...event,
					startDate: newStartDate.toISOString(),
					endDate: newEndDate.toISOString()
				}

				updateEvent(updatedEvent)
				toast.success("Event updated successfully")
			} catch {
				toast.error("Failed to update event")
			}
		},
		[updateEvent]
	)

	useEffect(() => {
		setOnEventDropped(handleEventUpdate)
	}, [setOnEventDropped, handleEventUpdate])

	return null
}
