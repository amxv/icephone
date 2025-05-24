"use client"

import { createKnowledgeBaseSource } from "@/actions/knowledge-base"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
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
import type { KnowledgeBaseSourceType } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { Database, Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"

// Define form schema
const formSchema = z.object({
	name: z.string().min(3, "Name must be at least 3 characters"),
	type: z.enum(["website_url", "pdf_upload", "gdoc", "txt_upload"] as const),
	uri: z.string().min(1, "URI is required")
})

type FormData = z.infer<typeof formSchema>

export default function AddKnowledgeBaseSourceForm() {
	const router = useRouter()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// Initialize form
	const form = useForm<FormData>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			type: "website_url",
			uri: ""
		}
	})

	// Handle form submission
	const onSubmit = async (data: FormData) => {
		try {
			setIsSubmitting(true)
			setError(null)
			setSuccess(null)

			const result = await createKnowledgeBaseSource({
				name: data.name,
				type: data.type as KnowledgeBaseSourceType,
				uri: data.uri
			})

			if (result.success) {
				setSuccess("Knowledge base source created successfully")
				form.reset()
				router.refresh()
			} else {
				setError(
					result.error || "Failed to create knowledge base source"
				)
			}
		} catch (err) {
			setError("An unexpected error occurred")
			console.error(err)
		} finally {
			setIsSubmitting(false)
		}
	}

	const sourceTypeOptions = [
		{ value: "website_url", label: "Website URL" },
		{ value: "pdf_upload", label: "PDF Document" },
		{ value: "gdoc", label: "Google Document" },
		{ value: "txt_upload", label: "Text Document" }
	]

	return (
		<Card className="w-full max-w-lg mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center">
					<Database className="mr-2 h-5 w-5" />
					Add Knowledge Source
				</CardTitle>
				<CardDescription>
					Add a new knowledge source to your knowledge base
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-6"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input
											placeholder="Product Manual"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										A descriptive name for this knowledge
										source
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Source Type</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger className="rounded-xl">
												<SelectValue placeholder="Select source type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{sourceTypeOptions.map((option) => (
												<SelectItem
													key={option.value}
													value={option.value}
												>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										The type of knowledge source you're
										adding
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="uri"
							render={({ field }) => (
								<FormItem>
									<FormLabel>URI / Location</FormLabel>
									<FormControl>
										<Input
											placeholder="https://example.com/docs or file.pdf"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										URL or file path to the knowledge source
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{error && (
							<div className="p-3 text-sm text-white bg-destructive rounded-xl">
								{error}
							</div>
						)}

						{success && (
							<div className="p-3 text-sm text-white bg-green-600 rounded-xl">
								{success}
							</div>
						)}

						<Button
							type="submit"
							className="w-full rounded-xl"
							variant="outline"
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating...
								</>
							) : (
								<>
									<Plus className="mr-2 h-4 w-4" />
									Add Source
								</>
							)}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	)
}
