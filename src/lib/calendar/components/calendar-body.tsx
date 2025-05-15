"use client"

import { fadeIn, transition } from "@/lib/calendar/animations"
import { AgendaEvents } from "@/lib/calendar/components/agenda-view/agenda-events"
import { CalendarMonthView } from "@/lib/calendar/components/month-view/calendar-month-view"
import { CalendarDayView } from "@/lib/calendar/components/week-and-day-view/calendar-day-view"
import { CalendarWeekView } from "@/lib/calendar/components/week-and-day-view/calendar-week-view"
import { CalendarYearView } from "@/lib/calendar/components/year-view/calendar-year-view"
import { useCalendar } from "@/lib/calendar/contexts/calendar-context"
import { useFilteredEvents } from "@/lib/calendar/hooks"
import { isSameDay, parseISO } from "date-fns"
import { motion } from "framer-motion"
import React from "react"

export function CalendarBody() {
	const { view } = useCalendar()

	const singleDayEvents = useFilteredEvents().filter((event) => {
		const startDate = parseISO(event.startDate)
		const endDate = parseISO(event.endDate)
		return isSameDay(startDate, endDate)
	})

	const multiDayEvents = useFilteredEvents().filter((event) => {
		const startDate = parseISO(event.startDate)
		const endDate = parseISO(event.endDate)
		return !isSameDay(startDate, endDate)
	})

	return (
		<div className="h-full w-full overflow-auto relative">
			<motion.div
				key={view}
				initial="initial"
				animate="animate"
				exit="exit"
				variants={fadeIn}
				transition={transition}
			>
				{view === "month" && (
					<CalendarMonthView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "week" && (
					<CalendarWeekView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "day" && (
					<CalendarDayView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "year" && (
					<CalendarYearView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "agenda" && (
					<motion.div
						key="agenda"
						initial="initial"
						animate="animate"
						exit="exit"
						variants={fadeIn}
						transition={transition}
					>
						<AgendaEvents />
					</motion.div>
				)}
			</motion.div>
		</div>
	)
}
