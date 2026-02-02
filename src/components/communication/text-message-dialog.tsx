"use client"

import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquareIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"
import { sendTextMessage } from "@/actions/lead-communication"

interface TextMessageDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	leadId: number
	leadName: string
	leadPhone?: string
}

export function TextMessageDialog({
	open,
	onOpenChange,
	leadId,
	leadName,
	leadPhone
}: TextMessageDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [content, setContent] = useState("")

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)

		try {
			const messageData = {
				leadId,
				content: content.trim()
			}

			const result = await sendTextMessage(messageData)

			if (result.success) {
				toast.success(result.message)
				onOpenChange(false)
				// Reset form
				setContent("")
			} else {
				toast.error(result.error)
			}
		} catch (error) {
			console.error("Error sending text message:", error)
			toast.error("Failed to send text message")
		} finally {
			setIsLoading(false)
		}
	}

	const maxLength = 160
	const remainingChars = maxLength - content.length

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-2xl font-medium tracking-tight">
						Send Text Message
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Send a text message to {leadName} at {leadPhone}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="pt-2">
					<div className="space-y-4">
						{/* Message Content */}
						<div>
							<Label htmlFor="message-content">Message</Label>
							<Textarea
								id="message-content"
								value={content}
								onChange={(e) => setContent(e.target.value)}
								className="rounded-lg resize-none min-h-[120px] mt-1.5"
								placeholder="Write your text message here..."
								maxLength={maxLength}
								required
							/>
							<div className="flex justify-between items-center mt-1">
								<p className="text-xs text-muted-foreground">
									Keep messages concise and clear
								</p>
								<p
									className={`text-xs ${remainingChars < 20 ? "text-orange-500" : "text-muted-foreground"}`}
								>
									{remainingChars} characters remaining
								</p>
							</div>
						</div>

						{/* Preview */}
						{content.trim() && (
							<div className="border rounded-lg p-3 bg-slate-50">
								<h4 className="text-sm font-medium mb-2">
									Preview:
								</h4>
								<div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-xs text-sm">
									{content}
								</div>
								<p className="text-xs text-muted-foreground mt-2">
									This is how your message will appear
								</p>
							</div>
						)}
					</div>

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
								isLoading || !content.trim() || !leadPhone
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
									Send Message
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
