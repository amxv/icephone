import { CalendarBody } from "@/lib/calendar/components/calendar-body"
import { CalendarHeader } from "@/lib/calendar/components/header/calendar-header"
import { CalendarProvider } from "@/lib/calendar/contexts/calendar-context"
import React from "react"

import { EventUpdateHandler } from "@/lib/calendar/components/event-update-handler"
import { DragDropProvider } from "@/lib/calendar/contexts/drag-drop-context"
import { getEvents, getUsers } from "@/lib/calendar/requests"

async function getCalendarData() {
	await new Promise((resolve) => setTimeout(resolve, 5000))

	return {
		events: await getEvents(),
		users: await getUsers()
	}
}

export async function Calendar() {
	const { events, users } = await getCalendarData()

	return (
		<DragDropProvider>
			<CalendarProvider events={events} users={users} view="month">
				<div className="w-full">
					<EventUpdateHandler />
					<CalendarHeader />
					<CalendarBody />
				</div>
			</CalendarProvider>
		</DragDropProvider>
	)
}
