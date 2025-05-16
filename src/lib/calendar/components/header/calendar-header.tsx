"use client"

import { motion } from "framer-motion"
import {
	CalendarRange,
	Columns,
	Grid2X2,
	Grid3X3,
	LayoutList,
	List,
	Plus
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
	buttonHover,
	slideFromLeft,
	slideFromRight,
	transition
} from "@/lib/calendar/animations"

import { AddEditEventDialog } from "@/lib/calendar/components/dialogs/add-edit-event-dialog"
import { DateNavigator } from "@/lib/calendar/components/header/date-navigator"
import FilterEvents from "@/lib/calendar/components/header/filter"
import { TodayButton } from "@/lib/calendar/components/header/today-button"
import { UserSelect } from "@/lib/calendar/components/header/user-select"

import { ButtonGroup } from "@/components/ui/button-group"
import { Toggle } from "@/components/ui/toggle"
import { Settings } from "@/lib/calendar/components/settings/settings"
import { useCalendar } from "@/lib/calendar/contexts/calendar-context"
import { useFilteredEvents } from "@/lib/calendar/hooks"

export const MotionButton = motion.create(Button)

export function CalendarHeader() {
	const { view, setView } = useCalendar()

	const events = useFilteredEvents()

	return (
		<div className="flex flex-col gap-4 border-b p-6 lg:flex-row lg:items-center lg:justify-between">
			<motion.div
				className="flex items-center gap-3"
				variants={slideFromLeft}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<TodayButton />
				<DateNavigator view={view} events={events} />
			</motion.div>

			<motion.div
				className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5"
				variants={slideFromRight}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<div className="options flex-wrap flex items-center gap-4 md:gap-2">
					<FilterEvents />
					<ButtonGroup className="flex">
						<MotionButton
							variant={view === "agenda" ? "default" : "outline"}
							aria-label="View as agenda"
							onClick={() => setView("agenda")}
							variants={buttonHover}
							whileHover="hover"
							whileTap="tap"
						>
							<LayoutList className="h-4 w-4" />
						</MotionButton>
						<MotionButton
							variant={view === "day" ? "default" : "outline"}
							aria-label="View by day"
							onClick={() => {
								setView("day")
							}}
							variants={buttonHover}
							whileHover="hover"
							whileTap="tap"
						>
							<List className="h-4 w-4" />
						</MotionButton>

						<MotionButton
							variant={view === "week" ? "default" : "outline"}
							aria-label="View by week"
							onClick={() => setView("week")}
							variants={buttonHover}
							whileHover="hover"
							whileTap="tap"
						>
							<Columns className="h-4 w-4" />
						</MotionButton>

						<MotionButton
							variant={view === "month" ? "default" : "outline"}
							aria-label="View by month"
							onClick={() => setView("month")}
							variants={buttonHover}
							whileHover="hover"
							whileTap="tap"
						>
							<Grid3X3 className="h-4 w-4" />
						</MotionButton>
						<MotionButton
							variant={view === "year" ? "default" : "outline"}
							aria-label="View by year"
							onClick={() => setView("year")}
							variants={buttonHover}
							whileHover="hover"
							whileTap="tap"
						>
							<Grid2X2 className="h-4 w-4" />
						</MotionButton>
					</ButtonGroup>
				</div>

				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5">
					<UserSelect />

					<AddEditEventDialog>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							Add Event
						</Button>
					</AddEditEventDialog>
				</div>
				<Settings />
			</motion.div>
		</div>
	)
}
