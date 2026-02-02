"use client"

import { updatePhoneNumber } from "@/actions/phone-numbers"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { PhoneNumber, VoiceAgent } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClockIcon, SettingsIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

// Define form schema for phone number configuration
const configSchema = z.object({
	friendlyName: z
		.string()
		.min(2, "Friendly name must be at least 2 characters")
		.max(255, "Friendly name must be less than 255 characters"),
	type: z.enum(["inbound", "outbound", "both"]),
	status: z.enum(["active", "inactive", "pending", "suspended"]),
	isDefault: z.boolean(),
	costPerMinute: z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid cost format"),
	callerIdName: z.string().optional(),
	recordCalls: z.boolean(),
	businessHoursEnabled: z.boolean(),
	timezone: z.string(),
	voicemailEnabled: z.boolean(),
	voicemailGreeting: z.string(),
	fallbackEnabled: z.boolean(),
	fallbackNumber: z.string().optional()
})

type ConfigFormValues = z.infer<typeof configSchema>

interface PhoneNumberConfigDialogProps {
	phoneNumber: PhoneNumber
	trigger?: React.ReactNode
	onSuccess?: () => void
	voiceAgents?: VoiceAgent[]
}

export function PhoneNumberConfigDialog({
	phoneNumber,
	trigger,
	onSuccess,
	voiceAgents
}: PhoneNumberConfigDialogProps) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<ConfigFormValues>({
		resolver: zodResolver(configSchema),
		defaultValues: {
			friendlyName: phoneNumber.friendlyName,
			type: phoneNumber.type,
			status: phoneNumber.status,
			isDefault: phoneNumber.isDefault,
			costPerMinute: phoneNumber.costPerMinute,
			callerIdName: phoneNumber.configuration?.callerIdName || "IcePhone",
			recordCalls: phoneNumber.configuration?.recordCalls || true,
			businessHoursEnabled:
				phoneNumber.configuration?.routingRules?.businessHours
					?.enabled || false,
			timezone:
				phoneNumber.configuration?.routingRules?.businessHours
					?.timezone || "America/New_York",
			voicemailEnabled:
				phoneNumber.configuration?.routingRules?.voicemail?.enabled ||
				true,
			voicemailGreeting:
				phoneNumber.configuration?.routingRules?.voicemail?.greeting ||
				"Hi, you've reached us! Please leave a message and we'll get back to you.",
			fallbackEnabled:
				phoneNumber.configuration?.routingRules?.fallback?.enabled ||
				false,
			fallbackNumber:
				phoneNumber.configuration?.routingRules?.fallback?.forwardTo ||
				""
		}
	})

	const onSubmit = async (values: ConfigFormValues) => {
		setIsSubmitting(true)
		try {
			await updatePhoneNumber(phoneNumber.id, {
				friendlyName: values.friendlyName,
				type: values.type,
				status: values.status,
				isDefault: values.isDefault,
				costPerMinute: values.costPerMinute,
				configuration: {
					callerIdName: values.callerIdName,
					recordCalls: values.recordCalls,
					routingRules: {
						businessHours: {
							enabled: values.businessHoursEnabled,
							timezone: values.timezone,
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
							enabled: values.voicemailEnabled,
							greeting: values.voicemailGreeting
						},
						fallback: {
							enabled: values.fallbackEnabled,
							forwardTo: values.fallbackNumber || ""
						}
					}
				}
			})

			toast.success("Phone number configuration updated successfully")
			setOpen(false)
			router.refresh()
			onSuccess?.()
		} catch (error) {
			console.error("Error updating phone number:", error)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update configuration"
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const defaultTrigger = (
		<Button variant="outline" size="sm" className="rounded-full">
			<SettingsIcon className="h-4 w-4 mr-2" />
			Configure
		</Button>
	)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
			<DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto rounded-3xl p-6 border border-border bg-white backdrop-blur-sm shadow-lg">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Configure {phoneNumber.friendlyName}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Customize how this phone number behaves for inbound and
						outbound calls.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-6"
					>
						<Tabs defaultValue="general" className="w-full">
							<TabsList className="grid w-full grid-cols-3 rounded-xl">
								<TabsTrigger value="general">
									General
								</TabsTrigger>
								<TabsTrigger value="routing">
									Call Routing
								</TabsTrigger>
								<TabsTrigger value="advanced">
									Advanced
								</TabsTrigger>
							</TabsList>

							<TabsContent
								value="general"
								className="space-y-4 mt-6"
							>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
														{...field}
														className="rounded-lg"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="type"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-sm font-medium">
													Number Type
												</FormLabel>
												<Select
													onValueChange={
														field.onChange
													}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger className="rounded-lg">
															<SelectValue />
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
															Both Inbound &
															Outbound
														</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<FormField
										control={form.control}
										name="status"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-sm font-medium">
													Status
												</FormLabel>
												<Select
													onValueChange={
														field.onChange
													}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger className="rounded-lg">
															<SelectValue />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="active">
															Active
														</SelectItem>
														<SelectItem value="inactive">
															Inactive
														</SelectItem>
														<SelectItem value="pending">
															Pending
														</SelectItem>
														<SelectItem value="suspended">
															Suspended
														</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

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
														{...field}
														className="rounded-lg"
													/>
												</FormControl>
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
													Default Outbound Number
												</FormLabel>
												<FormDescription className="text-sm text-muted-foreground">
													Use this number for all
													outbound calls by default
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
							</TabsContent>

							<TabsContent
								value="routing"
								className="space-y-4 mt-6"
							>
								<FormField
									control={form.control}
									name="businessHoursEnabled"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between rounded-lg border p-4">
											<div className="space-y-0.5">
												<div className="flex items-center">
													<ClockIcon className="h-4 w-4 mr-2 text-muted-foreground" />
													<FormLabel className="text-sm font-medium">
														Business Hours
													</FormLabel>
												</div>
												<FormDescription className="text-sm text-muted-foreground">
													Only accept calls during
													business hours
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="timezone"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-sm font-medium">
												Timezone
											</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger className="rounded-lg">
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="America/New_York">
														Eastern Time
													</SelectItem>
													<SelectItem value="America/Chicago">
														Central Time
													</SelectItem>
													<SelectItem value="America/Denver">
														Mountain Time
													</SelectItem>
													<SelectItem value="America/Los_Angeles">
														Pacific Time
													</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="voicemailEnabled"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between rounded-lg border p-4">
											<div className="space-y-0.5">
												<FormLabel className="text-sm font-medium">
													Voicemail
												</FormLabel>
												<FormDescription className="text-sm text-muted-foreground">
													Allow callers to leave
													voicemail when unavailable
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="voicemailGreeting"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-sm font-medium">
												Voicemail Greeting
											</FormLabel>
											<FormControl>
												<Textarea
													{...field}
													placeholder="Hi, you've reached us! Please leave a message and we'll get back to you."
													className="rounded-lg resize-none min-h-[80px]"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="fallbackEnabled"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between rounded-lg border p-4">
											<div className="space-y-0.5">
												<FormLabel className="text-sm font-medium">
													Call Fallback
												</FormLabel>
												<FormDescription className="text-sm text-muted-foreground">
													Forward calls to another
													number when AI agent is
													unavailable
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								{form.watch("fallbackEnabled") && (
									<FormField
										control={form.control}
										name="fallbackNumber"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-sm font-medium">
													Fallback Number
												</FormLabel>
												<FormControl>
													<Input
														{...field}
														placeholder="+1234567890"
														className="rounded-lg"
													/>
												</FormControl>
												<FormDescription className="text-xs text-muted-foreground">
													Number to forward calls to
													when AI agent is unavailable
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
							</TabsContent>

							<TabsContent
								value="advanced"
								className="space-y-4 mt-6"
							>
								<FormField
									control={form.control}
									name="callerIdName"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-sm font-medium">
												Caller ID Name
											</FormLabel>
											<FormControl>
												<Input
													{...field}
													placeholder="IcePhone"
													className="rounded-lg"
												/>
											</FormControl>
											<FormDescription className="text-xs text-muted-foreground">
												Name displayed on outbound calls
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="recordCalls"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between rounded-lg border p-4">
											<div className="space-y-0.5">
												<FormLabel className="text-sm font-medium">
													Record Calls
												</FormLabel>
												<FormDescription className="text-sm text-muted-foreground">
													Automatically record all
													calls for training and
													analytics
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
							</TabsContent>
						</Tabs>

						<DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 pt-4">
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
									? "Saving..."
									: "Save Configuration"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
