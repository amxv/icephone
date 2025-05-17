"use client"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import type { EmailThread } from "@/types"
import { format } from "date-fns"
import { Mail, XIcon } from "lucide-react"
import Link from "next/link"

export function EmailThreadModal({
	thread,
	onClose
}: {
	thread: EmailThread
	onClose: () => void
}) {
	return (
		<Dialog open={!!thread} onOpenChange={() => onClose()}>
			<DialogContent className="sm:max-w-[70%] sm:max-h-[90vh] flex flex-col rounded-3xl">
				<DialogHeader>
					<DialogTitle className="text-xl font-semibold tracking-tight">
						Email Thread
						{thread.name && ` with ${thread.name}`}
					</DialogTitle>

					<Button
						variant="outline"
						size="icon"
						onClick={onClose}
						className="absolute right-4 top-4 rounded-sm h-8 w-8"
						aria-label="Close"
					>
						<XIcon className="h-4 w-4" />
					</Button>
				</DialogHeader>
				<div className="flex-1 mt-4 space-y-4 overflow-y-auto w-full px-1 pb-1">
					{thread.messages.map((message, index) => (
						<div
							key={index}
							className={`rounded-xl p-3 shadow-sm ${
								message.role === "assistant"
									? "bg-muted" // AI messages
									: "bg-primary/10 dark:bg-primary/20" // User/Lead messages
							}`}
						>
							<div className="flex justify-between items-center mb-1.5">
								<span className="font-semibold text-sm">
									{message.role === "assistant"
										? "AI Receptionist"
										: thread.name ||
											thread.email ||
											"Contact"}
								</span>
								<span className="text-xs text-foreground/60">
									{format(
										new Date(message.timestamp),
										"MMM d, yyyy, h:mm a"
									)}
								</span>
							</div>
							<div className="text-sm whitespace-pre-wrap text-foreground/90">
								{message.content}
							</div>
						</div>
					))}
				</div>
				<DialogFooter className="flex flex-row items-center w-full mt-6 pt-4 border-t">
					<p className="text-xs text-foreground/70">
						{thread.thread_id}
					</p>
					<div className="ml-auto">
						{thread.email && (
							<Link href={`mailto:${thread.email}`}>
								<Button variant="outline" size="sm">
									{thread.email}
									<Mail className="w-3 h-3 ml-1" />
								</Button>
							</Link>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
