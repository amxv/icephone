import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
	FormControl,
	FormItem,
	FormLabel,
	FormMessage
} from "@/components/ui/form"
import {
	Popover,
	PopoverContent,
	PopoverTrigger
} from "@/components/ui/popover"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useCalendar } from "@/lib/calendar/contexts/calendar-context"
import type { TEventFormData } from "@/lib/calendar/schemas"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { ControllerRenderProps, UseFormReturn } from "react-hook-form"

interface DatePickerProps {
	form: UseFormReturn<TEventFormData>
	field: ControllerRenderProps<TEventFormData, "endDate" | "startDate">
	isEditing?: boolean
	isInitialStartTimeSet?: boolean
	onStartTimeChange?: (date: Date) => void
	isInvalid?: boolean
}

export function DateTimePicker({
	form,
	field,
	isEditing,
	isInitialStartTimeSet,
	onStartTimeChange,
	isInvalid
}: DatePickerProps) {
	const { use24HourFormat } = useCalendar()

	function handleDateSelect(date: Date | undefined) {
		if (date) {
			form.setValue(field.name, date)
			if (field.name === "startDate" && onStartTimeChange) {
				onStartTimeChange(date)
			}
		}
	}

	function handleTimeChange(type: "hour" | "minute" | "ampm", value: string) {
		const currentDate = form.getValues(field.name) || new Date()
		const newDate = new Date(currentDate)

		if (type === "hour") {
			newDate.setHours(Number.parseInt(value, 10))
		} else if (type === "minute") {
			newDate.setMinutes(Number.parseInt(value, 10))
		} else if (type === "ampm") {
			const hours = newDate.getHours()
			if (value === "AM" && hours >= 12) {
				newDate.setHours(hours - 12)
			} else if (value === "PM" && hours < 12) {
				newDate.setHours(hours + 12)
			}
		}

		form.setValue(field.name, newDate)
		if (field.name === "startDate" && onStartTimeChange) {
			onStartTimeChange(newDate)
		}
	}

	return (
		<FormItem className="flex flex-col">
			<FormLabel>
				{field.name === "startDate" ? "Start Date" : "End Date"}
			</FormLabel>
			<Popover modal={true}>
				<PopoverTrigger asChild>
					<FormControl>
						<Button
							variant={"outline"}
							className={cn(
								"w-full pl-3 text-left font-normal",
								!field.value && "text-muted-foreground",
								isInvalid &&
									"border-red-500 focus-visible:ring-red-500"
							)}
						>
							{field.value ? (
								format(
									field.value,
									use24HourFormat
										? "MM/dd/yyyy HH:mm"
										: "MM/dd/yyyy hh:mm aa"
								)
							) : (
								<span>MM/DD/YYYY hh:mm aa</span>
							)}
							<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
						</Button>
					</FormControl>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0">
					<div className="sm:flex">
						<div className="flex flex-col">
							<div className="text-sm font-medium text-center pt-2">
								Date
							</div>
							<Calendar
								mode="single"
								selected={field.value}
								onSelect={handleDateSelect}
								initialFocus
							/>
						</div>
						<div className="flex flex-col">
							<div className="text-sm font-medium text-center pt-2">
								Time
							</div>
							<div className="flex flex-col sm:flex-row sm:h-110 divide-y sm:divide-y-0 sm:divide-x">
								<ScrollArea className="h-110 hide-scrollbar">
									<div className="flex sm:flex-col p-2">
										{Array.from(
											{
												length: use24HourFormat
													? 24
													: 12
											},
											(_, i) => i
										).map((hour) => {
											const displayHour = use24HourFormat
												? hour
												: hour === 0
													? 12
													: hour
											const hourText = displayHour
												.toString()
												.padStart(2, "0")
											return (
												<Button
													key={hour}
													size="icon"
													variant={
														field.value &&
														field.value.getHours() %
															(use24HourFormat
																? 24
																: 12) ===
															hour %
																(use24HourFormat
																	? 24
																	: 12)
															? "default"
															: "ghost"
													}
													className="sm:w-full shrink-0 aspect-square"
													onClick={() =>
														handleTimeChange(
															"hour",
															hour.toString()
														)
													}
												>
													{hourText}
												</Button>
											)
										})}
									</div>
								</ScrollArea>
								<ScrollArea className="h-110 hide-scrollbar">
									<div className="flex sm:flex-col p-2">
										{Array.from(
											{ length: 12 },
											(_, i) => i * 5
										).map((minute) => (
											<Button
												key={minute}
												size="icon"
												variant={
													field.value &&
													field.value.getMinutes() ===
														minute
														? "default"
														: "ghost"
												}
												className="sm:w-full shrink-0 aspect-square"
												onClick={() =>
													handleTimeChange(
														"minute",
														minute.toString()
													)
												}
											>
												{minute
													.toString()
													.padStart(2, "0")}
											</Button>
										))}
									</div>
								</ScrollArea>
								{!use24HourFormat && (
									<div className="flex sm:flex-col p-2">
										<Button
											size="icon"
											variant={
												field.value &&
												field.value.getHours() < 12
													? "default"
													: "ghost"
											}
											className="sm:w-full shrink-0 aspect-square"
											onClick={() =>
												handleTimeChange("ampm", "AM")
											}
										>
											AM
										</Button>
										<Button
											size="icon"
											variant={
												field.value &&
												field.value.getHours() >= 12
													? "default"
													: "ghost"
											}
											className="sm:w-full shrink-0 aspect-square"
											onClick={() =>
												handleTimeChange("ampm", "PM")
											}
										>
											PM
										</Button>
									</div>
								)}
							</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>
			<FormMessage />
		</FormItem>
	)
}
