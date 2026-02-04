"use client"

import { CalendarBody } from "@/lib/calendar/components/calendar-body"
import { CalendarHeader } from "@/lib/calendar/components/header/calendar-header"
import { CalendarProvider } from "@/lib/calendar/contexts/calendar-context"
import React, { useEffect, useState } from "react"

import { EventUpdateHandler } from "@/lib/calendar/components/event-update-handler"
import { DragDropProvider } from "@/lib/calendar/contexts/drag-drop-context"
import type { IEvent, IUser } from "@/lib/calendar/interfaces"
import { getEvents } from "@/lib/calendar/requests"
import type { TCalendarView } from "@/lib/calendar/types"
import { useAuthUser } from "@/lib/auth/use-auth-user"

// Server component that fetches data
// export async function CalendarData() { // This seems unused now, data is fetched client-side
// 	// Simulate loading delay
// 	await new Promise((resolve) => setTimeout(resolve, 5000))
//
// 	const events = await getEvents()
// 	// const users = await getUsers() // getUsers is commented out
//
// 	return { events /*, users*/ }
// }

// Client component that handles view state
export function Calendar() {
	const [data, setData] = useState<{
		events: IEvent[]
		users: IUser[]
	} | null>(null)
	const { user, isLoading } = useAuthUser()

	// Get saved view from localStorage or default to "agenda"
	const [savedView, setSavedView] = useState<TCalendarView>("agenda")

	useEffect(() => {
		// Fetch the data
		const fetchData = async () => {
			const events = await getEvents()
			// Construct users array from current auth user
			const usersArray: IUser[] = []
			if (!isLoading && user) {
				usersArray.push({
					id: user.id,
					name:
						user.name ||
						user.email ||
						"Current User",
					picturePath: user.image || null
				})
			}
			setData({ events, users: usersArray })
		}

		// Get saved view from localStorage
		try {
			const savedSettings = localStorage.getItem("calendar-settings")
			if (savedSettings) {
				const settings = JSON.parse(savedSettings)
				if (settings.view) {
					setSavedView(settings.view)
				}
			}
		} catch (error) {
			console.error("Error reading from localStorage:", error)
		}

		if (!isLoading) {
			// Only fetch data once auth user is loaded
			fetchData()
		}
	}, [user, isLoading])

	// Show loading state if data is not loaded yet or auth user is loading
	if (!data || isLoading) {
		return (
			<div className="w-full h-full flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
			</div>
		)
	}

	return (
		<DragDropProvider>
			<CalendarProvider
				events={data.events}
				users={data.users}
				view={savedView}
			>
				<div className="w-full">
					<EventUpdateHandler />
					<CalendarHeader />
					<CalendarBody />
				</div>
			</CalendarProvider>
		</DragDropProvider>
	)
}
