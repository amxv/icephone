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
import { useUser } from "@clerk/nextjs"

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
	const { user: clerkUser, isLoaded: clerkUserIsLoaded } = useUser()

	// Get saved view from localStorage or default to "agenda"
	const [savedView, setSavedView] = useState<TCalendarView>("agenda")

	useEffect(() => {
		// Fetch the data
		const fetchData = async () => {
			const events = await getEvents()
			// Construct users array from current Clerk user
			const usersArray: IUser[] = []
			if (clerkUserIsLoaded && clerkUser) {
				usersArray.push({
					id: clerkUser.id,
					name:
						clerkUser.firstName && clerkUser.lastName
							? `${clerkUser.firstName} ${clerkUser.lastName}`
							: clerkUser.username || "Current User",
					picturePath: clerkUser.imageUrl
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

		if (clerkUserIsLoaded) {
			// Only fetch data once clerk user is loaded
			fetchData()
		}
	}, [clerkUser, clerkUserIsLoaded])

	// Show loading state if data is not loaded yet or clerk user is loading
	if (!data || !clerkUserIsLoaded) {
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
