"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	PhoneCallIcon,
	MessageSquareIcon,
	CalendarIcon,
	PlusIcon,
	XIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickActionsFABProps {
	onCallClick: () => void
	onTextClick: () => void
	onAppointmentClick: () => void
	hasPhone: boolean
	className?: string
}

export function QuickActionsFAB({
	onCallClick,
	onTextClick,
	onAppointmentClick,
	hasPhone,
	className
}: QuickActionsFABProps) {
	const [isExpanded, setIsExpanded] = useState(false)

	const actions = [
		{
			icon: PhoneCallIcon,
			label: "Quick Call",
			onClick: onCallClick,
			disabled: !hasPhone,
			className: "text-emerald-600 hover:text-emerald-700"
		},
		{
			icon: MessageSquareIcon,
			label: "Quick Text",
			onClick: onTextClick,
			disabled: !hasPhone,
			className: "text-violet-600 hover:text-violet-700"
		},
		{
			icon: CalendarIcon,
			label: "Quick Appointment",
			onClick: onAppointmentClick,
			disabled: false,
			className: "text-blue-600 hover:text-blue-700"
		}
	]

	return (
		<div className={cn("fixed bottom-6 right-6 z-50", className)}>
			{/* Action Buttons */}
			{isExpanded && (
				<div className="flex flex-col gap-2 mb-3">
					{actions.map((action, index) => (
						<Button
							key={action.label}
							variant="outline"
							size="sm"
							onClick={() => {
								if (!action.disabled) {
									action.onClick()
									setIsExpanded(false)
								}
							}}
							disabled={action.disabled}
							className={cn(
								"w-12 h-12 rounded-full border-2 bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-200 animate-in slide-in-from-bottom-2",
								action.className,
								action.disabled &&
									"opacity-50 cursor-not-allowed"
							)}
							style={{
								animationDelay: `${(actions.length - index - 1) * 50}ms`
							}}
							title={
								action.disabled
									? `${action.label} (No phone)`
									: action.label
							}
						>
							<action.icon className="h-5 w-5" />
							<span className="sr-only">{action.label}</span>
						</Button>
					))}
				</div>
			)}

			{/* Main FAB Button */}
			<Button
				variant="outline"
				size="lg"
				onClick={() => setIsExpanded(!isExpanded)}
				className={cn(
					"w-14 h-14 rounded-full border-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200",
					isExpanded && "bg-primary/90"
				)}
				aria-label={
					isExpanded ? "Close quick actions" : "Open quick actions"
				}
			>
				{isExpanded ? (
					<XIcon className="h-6 w-6 transition-transform duration-200" />
				) : (
					<PlusIcon className="h-6 w-6 transition-transform duration-200" />
				)}
			</Button>

			{/* Overlay for mobile */}
			{isExpanded && (
				<div
					className="fixed inset-0 bg-black/10 -z-10 md:hidden"
					onClick={() => setIsExpanded(false)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setIsExpanded(false)
						}
					}}
					role="button"
					tabIndex={0}
					aria-label="Close quick actions overlay"
				/>
			)}
		</div>
	)
}
