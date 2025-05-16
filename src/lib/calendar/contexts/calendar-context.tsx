"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

import {
	createAppointment,
	deleteAppointment,
	updateAppointment
} from "@/actions/appointmentActions"
import { useLocalStorage } from "@/lib/calendar/hooks"
import type { IEvent, IUser } from "@/lib/calendar/interfaces"
import type { TCalendarView, TEventColor } from "@/lib/calendar/types"
import { toast } from "sonner"

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
	addEvent: (
		eventData: Omit<IEvent, "id" | "user" | "color">
	) => Promise<void>
	updateEvent: (eventData: IEvent) => Promise<void>
	removeEvent: (eventId: number) => Promise<void>
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
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		setData(events || [])
	}, [events])

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

	const addEvent = async (
		eventData: Omit<IEvent, "id" | "user" | "color">
	) => {
		setIsLoading(true)
		try {
			const payload = {
				title: eventData.title,
				startDate: eventData.startDate,
				endDate: eventData.endDate,
				description: eventData.description,
				location: eventData.location
			}
			const result = await createAppointment(payload)
			if ("error" in result) {
				toast.error(result.error)
			} else {
				toast.success("Event added successfully.")
				if (result && typeof result === "object" && "id" in result) {
					setData((currentData) => [...currentData, result as IEvent])
				} else {
					console.warn(
						"CreateAppointment did not return the new event object. UI might not update correctly without a refresh."
					)
				}
			}
		} catch (error) {
			toast.error("Failed to add event.")
			console.error("addEvent error:", error)
		} finally {
			setIsLoading(false)
		}
	}

	const updateEvent = async (eventData: IEvent) => {
		setIsLoading(true)
		try {
			const payload = {
				title: eventData.title,
				startDate: new Date(eventData.startDate).toISOString(),
				endDate: new Date(eventData.endDate).toISOString(),
				description: eventData.description,
				location: eventData.location
			}
			const result = await updateAppointment(eventData.id, payload)

			if ("error" in result) {
				toast.error(result.error)
			} else {
				toast.success("Event updated successfully.")
				if (result && typeof result === "object" && "id" in result) {
					setData((currentData) =>
						currentData.map((event) =>
							event.id === (result as IEvent).id
								? (result as IEvent)
								: event
						)
					)
				} else {
					setData((currentData) =>
						currentData.map((event) =>
							event.id === eventData.id ? eventData : event
						)
					)
				}
			}
		} catch (error) {
			toast.error("Failed to update event.")
			console.error("updateEvent error:", error)
		} finally {
			setIsLoading(false)
		}
	}

	const removeEvent = async (eventId: number) => {
		setIsLoading(true)
		try {
			const result = await deleteAppointment(eventId)
			if (result.success) {
				toast.success("Event deleted successfully.")
				setData((currentData) =>
					currentData.filter((event) => event.id !== eventId)
				)
			} else {
				toast.error(result.error || "Failed to delete event.")
			}
		} catch (error) {
			toast.error("Failed to delete event.")
			console.error("removeEvent error:", error)
		} finally {
			setIsLoading(false)
		}
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
