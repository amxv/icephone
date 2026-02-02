"use client"

import { useState, useEffect } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MailIcon, FileTextIcon, EyeIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"
import { sendEmail, getEmailTemplates } from "@/actions/lead-communication"

interface EmailDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	leadId: number
	leadName: string
	leadEmail?: string
}

interface EmailTemplate {
	id: number
	name: string
	subject: string
	content: string
	description: string | null
	category: string | null
}

export function EmailDialog({
	open,
	onOpenChange,
	leadId,
	leadName,
	leadEmail
}: EmailDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [subject, setSubject] = useState("")
	const [content, setContent] = useState("")
	const [selectedTemplate, setSelectedTemplate] = useState<string>("")
	const [templates, setTemplates] = useState<EmailTemplate[]>([])
	const [activeTab, setActiveTab] = useState("compose")

	// Fetch email templates when dialog opens
	useEffect(() => {
		if (open) {
			const fetchTemplates = async () => {
				const result = await getEmailTemplates()
				if (result.success) {
					setTemplates(result.data)
				}
			}
			fetchTemplates()
		}
	}, [open])

	// Apply template when selected
	useEffect(() => {
		if (selectedTemplate) {
			const template = templates.find(
				(t) => t.id.toString() === selectedTemplate
			)
			if (template) {
				setSubject(template.subject.replace("{leadName}", leadName))
				setContent(template.content.replace("{leadName}", leadName))
			}
		}
	}, [selectedTemplate, templates, leadName])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)

		try {
			const emailData = {
				leadId,
				subject: subject.trim(),
				content: content.trim(),
				templateId: selectedTemplate
					? Number(selectedTemplate)
					: undefined
			}

			const result = await sendEmail(emailData)

			if (result.success) {
				toast.success(result.message)
				onOpenChange(false)
				// Reset form
				setSubject("")
				setContent("")
				setSelectedTemplate("")
				setActiveTab("compose")
			} else {
				toast.error(result.error)
			}
		} catch (error) {
			console.error("Error sending email:", error)
			toast.error("Failed to send email")
		} finally {
			setIsLoading(false)
		}
	}

	const previewContent = content.replace(/\n/g, "<br>")

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl p-6 border border-border bg-white shadow-lg rounded-3xl max-h-[80vh] overflow-y-auto">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Send Email
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Compose and send an email to {leadName} at {leadEmail}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="pt-2">
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 mb-6 h-auto">
							<TabsTrigger
								value="compose"
								className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
							>
								<FileTextIcon className="h-4 w-4 mr-2" />
								Compose
							</TabsTrigger>
							<TabsTrigger
								value="templates"
								className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
							>
								<MailIcon className="h-4 w-4 mr-2" />
								Templates
							</TabsTrigger>
							<TabsTrigger
								value="preview"
								className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:bg-slate-200/70 data-[state=active]:hover:bg-white transition-all h-10"
							>
								<EyeIcon className="h-4 w-4 mr-2" />
								Preview
							</TabsTrigger>
						</TabsList>

						<TabsContent value="compose" className="space-y-4">
							{/* Template Selection */}
							{templates.length > 0 && (
								<div>
									<Label htmlFor="template-select">
										Email Template (Optional)
									</Label>
									<Select
										value={selectedTemplate}
										onValueChange={setSelectedTemplate}
									>
										<SelectTrigger className="rounded-lg mt-1.5">
											<SelectValue placeholder="Choose a template or write from scratch" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="">
												No template - write from scratch
											</SelectItem>
											{templates.map((template) => (
												<SelectItem
													key={template.id}
													value={template.id.toString()}
												>
													<div className="flex flex-col items-start">
														<span className="font-medium">
															{template.name}
														</span>
														{template.description && (
															<span className="text-xs text-muted-foreground">
																{
																	template.description
																}
															</span>
														)}
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							{/* Subject Line */}
							<div>
								<Label htmlFor="email-subject">Subject</Label>
								<Input
									id="email-subject"
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									className="rounded-lg mt-1.5"
									placeholder="Enter email subject"
									required
								/>
							</div>

							{/* Email Content */}
							<div>
								<Label htmlFor="email-content">Message</Label>
								<Textarea
									id="email-content"
									value={content}
									onChange={(e) => setContent(e.target.value)}
									className="rounded-lg resize-none min-h-[200px] mt-1.5"
									placeholder="Write your email message here..."
									required
								/>
								<p className="text-xs text-muted-foreground mt-1">
									Use {leadName} for personalization
								</p>
							</div>
						</TabsContent>

						<TabsContent value="templates" className="space-y-4">
							{templates.length === 0 ? (
								<div className="text-center py-8">
									<div className="rounded-full bg-slate-100 p-3 mx-auto w-fit mb-4">
										<MailIcon className="h-6 w-6 text-muted-foreground" />
									</div>
									<h3 className="text-sm font-medium">
										No templates found
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Create email templates to speed up your
										workflow
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{templates.map((template) => (
										<div
											key={template.id}
											className={`border rounded-lg p-4 cursor-pointer transition-colors ${
												selectedTemplate ===
												template.id.toString()
													? "border-primary bg-primary/5"
													: "border-border hover:border-primary/50"
											}`}
											onClick={() => {
												setSelectedTemplate(
													template.id.toString()
												)
												setActiveTab("compose")
											}}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" ||
													e.key === " "
												) {
													e.preventDefault()
													setSelectedTemplate(
														template.id.toString()
													)
													setActiveTab("compose")
												}
											}}
											tabIndex={0}
											role="button"
											aria-label={`Select template: ${template.name}`}
										>
											<div className="flex justify-between items-start mb-2">
												<h4 className="font-medium text-sm">
													{template.name}
												</h4>
												{template.category && (
													<span className="text-xs px-2 py-1 bg-slate-100 rounded-md">
														{template.category}
													</span>
												)}
											</div>
											<p className="text-xs text-muted-foreground mb-2">
												{template.description}
											</p>
											<p className="text-sm font-medium">
												Subject: {template.subject}
											</p>
											<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
												{template.content.substring(
													0,
													120
												)}
												...
											</p>
										</div>
									))}
								</div>
							)}
						</TabsContent>

						<TabsContent value="preview" className="space-y-4">
							<div className="border rounded-lg p-4 bg-slate-50">
								<div className="mb-4 pb-3 border-b">
									<div className="text-sm text-muted-foreground mb-1">
										To: {leadEmail}
									</div>
									<div className="text-sm text-muted-foreground mb-2">
										From: Your Business
									</div>
									<h3 className="font-medium text-lg">
										{subject || "No subject"}
									</h3>
								</div>

								<div className="prose prose-sm max-w-none whitespace-pre-wrap">
									{content || "No content to preview"}
								</div>
							</div>
						</TabsContent>
					</Tabs>

					<DialogFooter className="mt-6">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							className="rounded-lg"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="bg-primary hover:bg-primary/90 rounded-lg"
							disabled={
								isLoading ||
								!subject.trim() ||
								!content.trim() ||
								!leadEmail
							}
						>
							{isLoading ? (
								<>
									<div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-r-transparent rounded-full" />
									Sending...
								</>
							) : (
								<>
									<SendIcon className="h-4 w-4 mr-2" />
									Send Email
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
