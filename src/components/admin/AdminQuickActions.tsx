"use client"

import { Button } from "@/components/ui/button"
import {
	Plus,
	Download,
	UserPlus,
	Bot,
	Database,
	BarChart3
} from "lucide-react"
import Link from "next/link"

const quickActions = [
	{
		title: "Add User",
		description: "Create new user account",
		icon: UserPlus,
		href: "/admin/users/new",
		color: "bg-blue-500 hover:bg-blue-600"
	},
	{
		title: "Create Voice Agent",
		description: "Setup new voice agent",
		icon: Bot,
		href: "/admin/voice-agents/new",
		color: "bg-purple-500 hover:bg-purple-600"
	},
	{
		title: "Export Data",
		description: "Download platform data",
		icon: Download,
		href: "/admin/export",
		color: "bg-orange-500 hover:bg-orange-600"
	},
	{
		title: "View Database",
		description: "Browse all tables",
		icon: Database,
		href: "/admin/database",
		color: "bg-red-500 hover:bg-red-600"
	},
	{
		title: "Analytics Report",
		description: "Generate analytics",
		icon: BarChart3,
		href: "/admin/analytics",
		color: "bg-teal-500 hover:bg-teal-600"
	}
]

export function AdminQuickActions() {
	return (
		<div className="space-y-3">
			{quickActions.map((action) => {
				const Icon = action.icon

				return (
					<Button
						key={action.title}
						variant="outline"
						className="w-full justify-start gap-3 h-auto p-4 rounded-2xl border border-border hover:bg-accent/50"
						asChild
					>
						<Link href={action.href}>
							<div
								className={`h-8 w-8 rounded-lg ${action.color} flex items-center justify-center flex-shrink-0`}
							>
								<Icon className="h-4 w-4 text-white" />
							</div>
							<div className="text-left flex-1">
								<div className="font-medium text-sm">
									{action.title}
								</div>
								<div className="text-xs text-muted-foreground">
									{action.description}
								</div>
							</div>
						</Link>
					</Button>
				)
			})}
		</div>
	)
}
