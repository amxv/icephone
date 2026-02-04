"use client"

import { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
	KeyboardIcon,
	PhoneCallIcon,
	MessageSquareIcon,
	CalendarIcon
} from "lucide-react"

interface KeyboardShortcut {
	key: string
	description: string
	icon: React.ElementType
}

const shortcuts: KeyboardShortcut[] = [
	{
		key: "Ctrl + C",
		description: "Schedule a call",
		icon: PhoneCallIcon
	},
	{
		key: "Ctrl + T",
		description: "Send text message",
		icon: MessageSquareIcon
	},
	{
		key: "Ctrl + A",
		description: "Schedule appointment",
		icon: CalendarIcon
	}
]

export function KeyboardShortcutsHelper() {
	const [open, setOpen] = useState(false)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="gap-2 text-muted-foreground hover:text-foreground"
				>
					<KeyboardIcon className="h-4 w-4" />
					Shortcuts
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md p-6 border border-border bg-white shadow-lg rounded-3xl">
				<DialogHeader className="pb-4">
					<DialogTitle className="text-xl font-medium tracking-tight">
						Keyboard Shortcuts
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Speed up your workflow with these keyboard shortcuts
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					{shortcuts.map((shortcut) => {
						const Icon = shortcut.icon
						return (
							<div
								key={shortcut.key}
								className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
										<Icon className="h-4 w-4 text-primary" />
									</div>
									<span className="text-sm font-medium">
										{shortcut.description}
									</span>
								</div>
								<Badge
									variant="outline"
									className="font-mono text-xs bg-white"
								>
									{shortcut.key}
								</Badge>
							</div>
						)
					})}
				</div>

				<div className="mt-6 p-3 bg-blue-50 rounded-lg">
					<p className="text-xs text-blue-700">
						💡 <strong>Tip:</strong> Shortcuts only work when you're
						not typing in a text field
					</p>
				</div>
			</DialogContent>
		</Dialog>
	)
}
