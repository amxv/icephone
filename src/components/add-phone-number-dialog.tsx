"use client"

import { createPhoneNumber } from "@/actions/phone-numbers"
import { Button } from "@/components/ui/button"
import {
	Dialog,
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
	FormDescription,
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
import { Switch } from "@/components/ui/switch"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

// Define form schema for phone number creation
const formSchema = z.object({
	number: z
		.string()
		.min(1, "Phone number is required")
		.regex(
			/^\+[1-9]\d{1,14}$/,
			"Must be a valid E.164 format phone number (e.g., +1234567890)"
		),
	friendlyName: z
		.string()
		.min(2, "Friendly name must be at least 2 characters")
		.max(255, "Friendly name must be less than 255 characters"),
	type: z.enum(["inbound", "outbound", "both"]),
	provider: z.string().optional(),
	providerSid: z.string().optional(),
	isDefault: z.boolean(),
	costPerMinute: z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid cost format")
})

type FormValues = z.infer<typeof formSchema>

interface AddPhoneNumberDialogProps {
	buttonText?: string
	variant?:
		| "default"
		| "outline"
		| "secondary"
		| "ghost"
		| "link"
		| "destructive"
	onSuccess?: () => void
}

export function AddPhoneNumberDialog({
	buttonText = "Add Number",
	variant = "outline",
	onSuccess
}: AddPhoneNumberDialogProps) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			number: "",
			friendlyName: "",
			type: "inbound",
			provider: "twilio",
			providerSid: "",
			isDefault: false,
			costPerMinute: "0.0130"
		}
	})

	const onSubmit = async (values: FormValues) => {
		setIsSubmitting(true)
		try {
			const result = await createPhoneNumber({
				...values,
				capabilities: {
					voice: true,
					sms: true,
					mms: false,
					fax: false
				},
				configuration: {
					callerIdName: "IcePhone",
					recordCalls: true,
					routingRules: {
						businessHours: {
							enabled: false,
							timezone: "America/New_York",
							schedule: {
								monday: { start: "09:00", end: "17:00" },
								tuesday: { start: "09:00", end: "17:00" },
								wednesday: { start: "09:00", end: "17:00" },
								thursday: { start: "09:00", end: "17:00" },
								friday: { start: "09:00", end: "17:00" },
								saturday: null,
								sunday: null
							}
						},
						voicemail: {
							enabled: true,
							greeting:
								"Hi, you've reached us! Please leave a message and we'll get back to you."
						},
						fallback: {
							enabled: false,
							forwardTo: ""
						}
					}
				}
			})

			toast.success("Phone number added successfully")
			setOpen(false)
			form.reset()
			router.refresh()
			onSuccess?.()
		} catch (error) {
			console.error("Error creating phone number:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to add phone number"
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleNumberBlur = () => {
		const number = form.getValues("number")
		if (number && !form.getValues("friendlyName")) {
			// Auto-generate friendly name from number
			const formatted = number
				.replace(/^\+1/, "")
				.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
			form.setValue("friendlyName", `Phone ${formatted}`)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant={variant}
					className="flex items-center gap-2 rounded-full"
				>
					<PlusIcon className="h-4 w-4" />
					{buttonText}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[550px] rounded-3xl p-6 border border-border bg-white backdrop-blur-sm shadow-lg">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Add Phone Number
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Add a new phone number for your voice agents. Configure
						how it will be used for inbound and outbound calls.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-5 py-3"
					>
						<FormField
							control={form.control}
							name="number"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										Phone Number
									</FormLabel>
									<FormControl>
										<Input
											placeholder="+1234567890"
											{...field}
											onBlur={handleNumberBlur}
											className="rounded-lg"
										/>
									</FormControl>
									<FormDescription className="text-xs text-muted-foreground">
										Enter phone number in E.164 format
										(e.g., +1234567890)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="friendlyName"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										Friendly Name
									</FormLabel>
									<FormControl>
										<Input
											placeholder="Main Business Line"
											{...field}
											className="rounded-lg"
										/>
									</FormControl>
									<FormDescription className="text-xs text-muted-foreground">
										A descriptive name to help identify this
										number
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="type"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Number Type
										</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="rounded-lg">
													<SelectValue placeholder="Select type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="inbound">
													Inbound Only
												</SelectItem>
												<SelectItem value="outbound">
													Outbound Only
												</SelectItem>
												<SelectItem value="both">
													Both Inbound & Outbound
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="provider"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Provider
										</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="rounded-lg">
													<SelectValue placeholder="Select provider" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="twilio">
													Twilio
												</SelectItem>
												<SelectItem value="vonage">
													Vonage
												</SelectItem>
												<SelectItem value="custom">
													Custom Provider
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="costPerMinute"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Cost Per Minute ($)
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												placeholder="0.0130"
												{...field}
												className="rounded-lg"
											/>
										</FormControl>
										<FormDescription className="text-xs text-muted-foreground">
											Billing rate per minute
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="providerSid"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Provider SID (Optional)
										</FormLabel>
										<FormControl>
											<Input
												placeholder="AC1234567890abcdef..."
												{...field}
												className="rounded-lg"
											/>
										</FormControl>
										<FormDescription className="text-xs text-muted-foreground">
											Provider's unique identifier
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="isDefault"
							render={({ field }) => (
								<FormItem className="flex items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel className="text-sm font-medium">
											Set as Default Outbound Number
										</FormLabel>
										<FormDescription className="text-sm text-muted-foreground">
											Use this number for all outbound
											calls by default
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
								className="w-full sm:w-auto rounded-lg"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="w-full sm:w-auto rounded-lg"
								disabled={isSubmitting}
							>
								{isSubmitting
									? "Adding..."
									: "Add Phone Number"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
