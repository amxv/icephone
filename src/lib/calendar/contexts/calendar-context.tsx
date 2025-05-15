"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"

import { useLocalStorage } from "@/lib/calendar/hooks"
import type { IEvent, IUser } from "@/lib/calendar/interfaces"
import type { TCalendarView, TEventColor } from "@/lib/calendar/types"

interface ICalendarContext {
	selectedDate: Date
	view: TCalendarView
	setView: (view: TCalendarView) => void
	agendaModeGroupBy: "date" | "color"
	setAgendaModeGroupBy: (groupBy: "date" | "color") => void
	use24HourFormat: boolean
	toggleTimeFormat: () => void
	setSelectedDate: (date: Date | undefined) => void
	selectedUserId: IUser["id"] | "all"
	setSelectedUserId: (userId: IUser["id"] | "all") => void
	badgeVariant: "dot" | "colored"
	setBadgeVariant: (variant: "dot" | "colored") => void
	selectedColors: TEventColor[]
	filterEventsBySelectedColors: (colors: TEventColor) => void
	filterEventsBySelectedUser: (userId: IUser["id"] | "all") => void
	users: IUser[]
	events: IEvent[]
	addEvent: (event: IEvent) => void
	updateEvent: (event: IEvent) => void
	removeEvent: (eventId: number) => void
	clearFilter: () => void
}

interface CalendarSettings {
	badgeVariant: "dot" | "colored"
	view: TCalendarView
	use24HourFormat: boolean
	agendaModeGroupBy: "date" | "color"
}

const DEFAULT_SETTINGS: CalendarSettings = {
	badgeVariant: "colored",
	view: "day",
	use24HourFormat: true,
	agendaModeGroupBy: "date"
}

const CalendarContext = createContext({} as ICalendarContext)

export function CalendarProvider({
	children,
	users,
	events,
	badge = "colored",
	view = "day"
}: {
	children: React.ReactNode
	users: IUser[]
	events: IEvent[]
	view?: TCalendarView
	badge?: "dot" | "colored"
}) {
	const [settings, setSettings] = useLocalStorage<CalendarSettings>(
		"calendar-settings",
		{
			...DEFAULT_SETTINGS,
			badgeVariant: badge,
			view: view
		}
	)

	const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
		settings.badgeVariant
	)
	const [currentView, setCurrentViewState] = useState<TCalendarView>(
		settings.view
	)
	const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
		settings.use24HourFormat
	)
	const [agendaModeGroupBy, setAgendaModeGroupByState] = useState<
		"date" | "color"
	>(settings.agendaModeGroupBy)

	const [selectedDate, setSelectedDate] = useState(new Date())
	const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">(
		"all"
	)
	const [selectedColors, setSelectedColors] = useState<TEventColor[]>([])
	const [data, setData] = useState(events || [])

	const updateSettings = (newPartialSettings: Partial<CalendarSettings>) => {
		setSettings({
			...settings,
			...newPartialSettings
		})
	}

	const setBadgeVariant = (variant: "dot" | "colored") => {
		setBadgeVariantState(variant)
		updateSettings({ badgeVariant: variant })
	}

	const setView = (newView: TCalendarView) => {
		setCurrentViewState(newView)
		updateSettings({ view: newView })
	}

	const toggleTimeFormat = () => {
		const newValue = !use24HourFormat
		setUse24HourFormatState(newValue)
		updateSettings({ use24HourFormat: newValue })
	}

	const setAgendaModeGroupBy = (groupBy: "date" | "color") => {
		setAgendaModeGroupByState(groupBy)
		updateSettings({ agendaModeGroupBy: groupBy })
	}

	const filterEventsBySelectedColors = (color: TEventColor) => {
		const isColorSelected = selectedColors.includes(color)
		const newColors = isColorSelected
			? selectedColors.filter((c) => c !== color)
			: [...selectedColors, color]

		if (newColors.length > 0) {
			const filteredEvents = events.filter((event) => {
				const eventColor = event.color || "blue"
				return newColors.includes(eventColor)
			})
			setData(filteredEvents)
		} else setData(events)

		setSelectedColors(newColors)
	}

	const filterEventsBySelectedUser = (userId: IUser["id"] | "all") => {
		setSelectedUserId(userId)
		if (userId === "all") {
			setData(events)
		} else {
			const filteredEvents = events.filter(
				(event) => event.user.id === userId
			)
			setData(filteredEvents)
		}
	}

	const handleSelectDate = (date: Date | undefined) => {
		if (!date) return
		setSelectedDate(date)
	}

	const addEvent = (event: IEvent) => {
		setData((prevEvents) => [...prevEvents, event])
	}

	const updateEvent = (event: IEvent) => {
		const newEvent: IEvent = {
			...event,
			startDate: new Date(event.startDate).toISOString(),
			endDate: new Date(event.endDate).toISOString()
		}

		setData((prevEvents) => {
			const index = prevEvents.findIndex((e) => e.id === event.id)
			if (index !== -1) {
				const updatedEvents = [...prevEvents]
				updatedEvents[index] = newEvent
				return updatedEvents
			}
			return prevEvents
		})
	}

	const removeEvent = (eventId: number) => {
		setData((prevEvents) =>
			prevEvents.filter((event) => event.id !== eventId)
		)
	}

	const clearFilter = () => {
		setData(events)
		setSelectedColors([])
	}

	const value = {
		selectedDate,
		setSelectedDate: handleSelectDate,
		selectedUserId,
		setSelectedUserId,
		badgeVariant,
		setBadgeVariant,
		users,
		selectedColors,
		filterEventsBySelectedColors,
		filterEventsBySelectedUser,
		events: data,
		view: currentView,
		use24HourFormat,
		toggleTimeFormat,
		setView,
		agendaModeGroupBy,
		setAgendaModeGroupBy,
		addEvent,
		updateEvent,
		removeEvent,
		clearFilter
	}

	return (
		<CalendarContext.Provider value={value}>
			{children}
		</CalendarContext.Provider>
	)
}

export function useCalendar(): ICalendarContext {
	const context = useContext(CalendarContext)
	if (!context)
		throw new Error("useCalendar must be used within a CalendarProvider.")
	return context
}
