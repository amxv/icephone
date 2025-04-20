"use client"

import { createLead } from "@/actions/leads"
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
import { leadStatusEnum } from "@/db/schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "./ui/select"
import { Textarea } from "./ui/textarea"

// Get enum values from the DB schema
const leadStatusValues = leadStatusEnum.enumValues

// Define form schema for lead creation
const formSchema = z.object({
	name: z.string().min(2, { message: "Name must be at least 2 characters" }),
	email: z
		.string()
		.email({ message: "Invalid email address" })
		.optional()
		.or(z.literal("")),
	phone: z.string().optional().or(z.literal("")),
	score: z.coerce.number().min(0).max(100),
	status: z.enum(leadStatusValues),
	source: z.string().optional().or(z.literal("")),
	notes: z.string().optional().or(z.literal(""))
})

type FormValues = z.infer<typeof formSchema>

interface AddLeadDialogProps {
	buttonText?: string
	variant?:
		| "default"
		| "outline"
		| "secondary"
		| "ghost"
		| "link"
		| "destructive"
}

export function AddLeadDialog({
	buttonText = "Add Lead",
	variant = "default"
}: AddLeadDialogProps) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Define form with explicit type
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			email: "",
			phone: "",
			score: 0,
			status: "new",
			source: "",
			notes: ""
		}
	})

	const onSubmit = async (values: FormValues) => {
		setIsSubmitting(true)
		try {
			const result = await createLead(values)

			if (result.success) {
				toast.success("Lead created successfully")
				setOpen(false)
				form.reset()
				router.refresh()
			} else {
				toast.error(result.error || "Failed to create lead")
			}
		} catch (error) {
			console.error("Error creating lead:", error)
			toast.error("An unexpected error occurred")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={variant} className="flex items-center gap-2">
					<PlusIcon className="h-4 w-4" />
					{buttonText}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[550px] rounded-3xl p-6 border border-border bg-white backdrop-blur-sm shadow-lg">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Add New Lead
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Enter the details of your new lead. Click save when
						you're done.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-5 py-3"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										Name
									</FormLabel>
									<FormControl>
										<Input
											placeholder="John Doe"
											{...field}
											className="rounded-lg"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Email
										</FormLabel>
										<FormControl>
											<Input
												placeholder="john@example.com"
												type="email"
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
								name="phone"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Phone
										</FormLabel>
										<FormControl>
											<Input
												placeholder="+1 (555) 123-4567"
												{...field}
												className="rounded-lg"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="score"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Score (0-100)
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												max={100}
												{...field}
												className="rounded-lg"
											/>
										</FormControl>
										<FormDescription className="text-xs text-muted-foreground">
											Rate your lead's potential
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="status"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Status
										</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="rounded-lg">
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{leadStatusValues.map(
													(status) => (
														<SelectItem
															key={status}
															value={status}
														>
															{status
																.charAt(0)
																.toUpperCase() +
																status.slice(1)}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="source"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										Source
									</FormLabel>
									<FormControl>
										<Input
											placeholder="Website, Referral, etc."
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
							name="notes"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										Notes
									</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Additional information about this lead..."
											className="resize-none min-h-[100px] rounded-lg"
											{...field}
										/>
									</FormControl>
									<FormMessage />
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
								{isSubmitting ? "Saving..." : "Save Lead"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
