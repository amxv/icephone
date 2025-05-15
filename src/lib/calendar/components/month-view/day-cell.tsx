"use client"

import { isToday, startOfDay } from "date-fns"
import { motion } from "framer-motion"
import { useMemo } from "react"

import { EventBullet } from "@/lib/calendar/components/month-view/event-bullet"
import { MonthEventBadge } from "@/lib/calendar/components/month-view/month-event-badge"

import { staggerContainer, transition } from "@/lib/calendar/animations"
import { getMonthCellEvents } from "@/lib/calendar/helpers"

import { EventListDialog } from "@/lib/calendar/components/dialogs/events-list-dialog"
import { DroppableArea } from "@/lib/calendar/components/dnd/droppable-area"
import type { ICalendarCell, IEvent } from "@/lib/calendar/interfaces"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"

interface IProps {
	cell: ICalendarCell
	events: IEvent[]
	eventPositions: Record<string, number>
}

const MAX_VISIBLE_EVENTS = 3

export const dayCellVariants = cva("text-white", {
	variants: {
		color: {
			blue: "bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 ",
			green: "bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-400",
			red: "bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-400",
			yellow: "bg-yellow-600 dark:bg-yellow-500 hover:bg-yellow-700 dark:hover:bg-yellow-400",
			purple: "bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-400",
			orange: "bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-400",
			gray: "bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-400"
		}
	},
	defaultVariants: {
		color: "blue"
	}
})

export function DayCell({ cell, events, eventPositions }: IProps) {
	const { day, currentMonth, date } = cell

	const cellEvents = useMemo(
		() => getMonthCellEvents(date, events, eventPositions),
		[date, events, eventPositions]
	)
	const isSunday = date.getDay() === 0

	return (
		<motion.div
			className={cn(
				"flex flex-col gap-1 border-l border-t py-1.5",
				isSunday && "border-l-0"
			)}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={transition}
		>
			<DroppableArea date={date}>
				<motion.span
					className={cn(
						"h-6 w-6 px-1 flex translate-x-1 items-center justify-center rounded-full text-xs font-semibold lg:px-2 mb-1", // mb-0.5 here, always applied
						!currentMonth && "text-muted-foreground",
						isToday(date) && " bg-primary text-primary-foreground"
					)}
					whileHover={{ scale: 1.1 }}
					transition={transition}
				>
					{day}
				</motion.span>

				<motion.div
					className={cn(
						"flex h-6 gap-1 px-2 lg:min-h-[94px] lg:flex-col lg:gap-2 lg:px-0",
						!currentMonth && "opacity-50"
					)}
					variants={staggerContainer}
				>
					{[0, 1, 2].map((position) => {
						const event = cellEvents.find(
							(e) => e.position === position
						)
						const eventKey = event
							? `event-${event.id}-${position}`
							: `empty-${position}`

						return (
							<motion.div
								key={eventKey}
								className={cn(
									"lg:h-[26px] mb-1",
									event ? "" : "lg:min-h-[26px]"
								)}
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{
									delay: position * 0.1,
									...transition
								}}
							>
								{event && (
									<>
										<EventBullet
											className="lg:hidden"
											color={event.color}
										/>
										<MonthEventBadge
											className="hidden lg:flex w-full"
											event={event}
											cellDate={startOfDay(date)}
										/>
									</>
								)}
							</motion.div>
						)
					})}
				</motion.div>

				{cellEvents.length > MAX_VISIBLE_EVENTS && (
					<motion.div
						className={cn(
							"h-4.5 px-1.5 my-2 text-end text-xs font-semibold text-muted-foreground",
							!currentMonth && "opacity-50"
						)}
						initial={{ opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3, ...transition }}
					>
						<EventListDialog date={date} events={cellEvents} />
					</motion.div>
				)}
			</DroppableArea>
		</motion.div>
	)
}
