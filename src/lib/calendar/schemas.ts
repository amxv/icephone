import { z } from "zod"

export const eventSchema = z
	.object({
		title: z.string().min(1, "Title is required"),
		description: z.string().optional(),
		location: z.string().optional(),
		startDate: z.date({
			required_error: "Start date is required"
		}),
		endDate: z.date({
			required_error: "End date is required"
		}),
		color: z.enum(["blue", "green", "red", "yellow", "purple", "orange"], {
			required_error: "Variant is required"
		})
	})
	.refine((data) => data.endDate > data.startDate, {
		message: "End date must be after start date",
		path: ["endDate"]
	})

export type TEventFormData = z.infer<typeof eventSchema>
