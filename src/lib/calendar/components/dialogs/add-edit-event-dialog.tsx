import { zodResolver } from "@hookform/resolvers/zod"
import { addMinutes, format, set } from "date-fns"
import type { ReactNode } from "react"
import React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { COLORS } from "@/lib/calendar/constants"
import { useCalendar } from "@/lib/calendar/contexts/calendar-context"
import { useDisclosure } from "@/lib/calendar/hooks"
import type { IEvent } from "@/lib/calendar/interfaces"
import { type TEventFormData, eventSchema } from "@/lib/calendar/schemas"

import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface IProps {
	children: ReactNode
	startDate?: Date
	startTime?: { hour: number; minute: number }
	event?: IEvent
}

export function AddEditEventDialog({
	children,
	startDate,
	startTime,
	event
}: IProps) {
	const { isOpen, onClose, onToggle } = useDisclosure()
	const { addEvent, updateEvent } = useCalendar()
	const isEditing = !!event
	const [isInitialStartTimeSet, setIsInitialStartTimeSet] =
		React.useState(false)

	const getInitialDates = () => {
		const now = new Date()
		const minutes = now.getMinutes()
		let startDate: Date

		if (minutes < 30) {
			startDate = set(now, { minutes: 30, seconds: 0, milliseconds: 0 })
		} else {
			startDate = set(now, {
				hours: now.getHours() + 1,
				minutes: 0,
				seconds: 0,
				milliseconds: 0
			})
		}

		if (startTime) {
			// if a specific start time is provided (e.g. by clicking on calendar)
			startDate = set(new Date(startDate), {
				// ensure it uses the provided date, but applies the rounding logic for time
				hours: startTime.hour,
				minutes: startTime.minute,
				seconds: 0,
				milliseconds: 0
			})
			// Recalculate based on provided startTime
			const currentStartTimeMinutes = startDate.getMinutes()
			if (currentStartTimeMinutes < 30 && currentStartTimeMinutes !== 0) {
				startDate = set(startDate, {
					minutes: 30,
					seconds: 0,
					milliseconds: 0
				})
			} else if (currentStartTimeMinutes > 30) {
				startDate = set(startDate, {
					hours: startDate.getHours() + 1,
					minutes: 0,
					seconds: 0,
					milliseconds: 0
				})
			}
			// if startTime.minute is already 0 or 30, it will remain as is, which is correct.
		}

		// If a specific startDate is passed (e.g. clicking on a day in month view)
		// We should use that date, but round the time to the next half hour from current time if no specific startTime is given
		if (startDate && !startTime) {
			const dateToUse = new Date(startDate) // Use the passed startDate
			const nowForTime = new Date() // But use current time for rounding logic
			const currentMinutes = nowForTime.getMinutes()
			let roundedHours = nowForTime.getHours()
			let roundedMinutes = 0

			if (currentMinutes < 30) {
				roundedMinutes = 30
			} else {
				roundedMinutes = 0
				roundedHours += 1
			}
			// If roundedHours becomes 24, set to 0 (next day handled by date-fns)
			if (roundedHours === 24) {
				roundedHours = 0
				// date-fns set function handles date increment if hour goes past 23
			}

			startDate = set(dateToUse, {
				hours: roundedHours,
				minutes: roundedMinutes,
				seconds: 0,
				milliseconds: 0
			})
		}

		const endDate = addMinutes(startDate, 30)
		return { startDate: startDate, endDate: endDate }
	}

	const initialDates = getInitialDates()

	const parseEventDates = () => {
		if (!event) return null

		return {
			startDate: new Date(event.startDate),
			endDate: new Date(event.endDate)
		}
	}

	const eventDates = parseEventDates()

	const form = useForm<TEventFormData>({
		resolver: zodResolver(eventSchema),
		defaultValues: isEditing
			? {
					title: event.title,
					description: event.description,
					location: event.location,
					startDate: eventDates?.startDate,
					endDate: eventDates?.endDate,
					color: event.color
				}
			: {
					title: "",
					description: "",
					location: "",
					startDate: initialDates.startDate,
					endDate: initialDates.endDate,
					color: "blue" as const
				}
	})

	const watchedStartDate = form.watch("startDate")
	const watchedEndDate = form.watch("endDate")
	const isEndDateInvalid =
		watchedStartDate && watchedEndDate && watchedEndDate <= watchedStartDate

	const handleStartTimeChange = (newStartDate: Date) => {
		if (!isEditing && !isInitialStartTimeSet) {
			form.setValue("endDate", addMinutes(newStartDate, 30))
			setIsInitialStartTimeSet(true)
		}
	}

	const onSubmit = async (values: TEventFormData) => {
		try {
			const eventPayloadForServer = {
				title: values.title,
				startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
				endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
				description: values.description,
				location: values.location
			}

			if (isEditing && event) {
				const eventDataForContextUpdate: IEvent = {
					id: event.id,
					user: event.user,
					color: values.color,
					title: eventPayloadForServer.title,
					startDate: eventPayloadForServer.startDate,
					endDate: eventPayloadForServer.endDate,
					description: eventPayloadForServer.description,
					location: eventPayloadForServer.location
				}
				await updateEvent(eventDataForContextUpdate)
			} else {
				await addEvent(eventPayloadForServer)
			}

			onClose()
			form.reset()
			setIsInitialStartTimeSet(false)
		} catch (error) {
			console.error(
				`Error ${isEditing ? "editing" : "adding"} event:`,
				error
			)
			toast.error(`Failed to ${isEditing ? "edit" : "add"} event`)
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={onToggle} modal={true}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Event" : "Add New Event"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Modify your existing event."
							: "Create a new event for your calendar."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						id="event-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid gap-4 py-4"
					>
						<FormField
							control={form.control}
							name="title"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel
										htmlFor="title"
										className="required"
									>
										Title
									</FormLabel>
									<FormControl>
										<Input
											id="title"
											placeholder="Enter a title"
											{...field}
											className={
												fieldState.invalid
													? "border-red-500"
													: ""
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="startDate"
							render={({ field }) => (
								<DateTimePicker
									form={form}
									field={field}
									isEditing={isEditing}
									isInitialStartTimeSet={
										isInitialStartTimeSet
									}
									onStartTimeChange={handleStartTimeChange}
								/>
							)}
						/>
						<FormField
							control={form.control}
							name="endDate"
							render={({ field }) => (
								<DateTimePicker
									form={form}
									field={field}
									isInvalid={isEndDateInvalid}
								/>
							)}
						/>
						<FormField
							control={form.control}
							name="color"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel className="required">
										Variant
									</FormLabel>
									<FormControl>
										<Select
											value={field.value}
											onValueChange={field.onChange}
										>
											<SelectTrigger
												className={`w-full ${fieldState.invalid ? "border-red-500" : ""}`}
											>
												<SelectValue placeholder="Select a variant" />
											</SelectTrigger>
											<SelectContent>
												{COLORS.map((color) => (
													<SelectItem
														value={color}
														key={color}
													>
														<div className="flex items-center gap-2">
															<div
																className={`size-3.5 rounded-full bg-${color}-600 dark:bg-${color}-700`}
															/>
															{color}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="location"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel htmlFor="location">
										Where
									</FormLabel>
									<FormControl>
										<Input
											id="location"
											placeholder="Enter a location or video meeting link"
											{...field}
											className={
												fieldState.invalid
													? "border-red-500"
													: ""
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="description"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											{...field}
											placeholder="Enter a description"
											className={
												fieldState.invalid
													? "border-red-500"
													: ""
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button
						form="event-form"
						type="submit"
						disabled={isEndDateInvalid || !form.formState.isValid}
					>
						{isEditing ? "Save Changes" : "Create Event"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
