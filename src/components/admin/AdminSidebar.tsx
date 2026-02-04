"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
	LayoutDashboard,
	Users,
	Bot,
	BarChart3,
	Settings,
	Database,
	PhoneCall,
	Calendar,
	Target,
	Zap,
	Home,
	Shield,
	Bell
} from "lucide-react"

const sidebarItems = [
	{
		title: "Dashboard",
		href: "/admin",
		icon: LayoutDashboard,
		description: "Platform overview and stats"
	},
	{
		title: "Users",
		href: "/admin/users",
		icon: Users,
		description: "Manage all platform users"
	},
	{
		title: "Voice Agents",
		href: "/admin/voice-agents",
		icon: Bot,
		description: "Manage voice agents for all users"
	},
	{
		title: "Database",
		href: "/admin/database",
		icon: Database,
		description: "View all database tables"
	},
	{
		title: "Calls",
		href: "/admin/calls",
		icon: PhoneCall,
		description: "All call records and transcripts"
	},
	{
		title: "Appointments",
		href: "/admin/appointments",
		icon: Calendar,
		description: "Scheduled appointments"
	},
	{
		title: "Campaigns",
		href: "/admin/campaigns",
		icon: Target,
		description: "Marketing campaigns"
	},
	{
		title: "Analytics",
		href: "/admin/analytics",
		icon: BarChart3,
		description: "Platform-wide analytics"
	},
	{
		title: "Settings",
		href: "/admin/settings",
		icon: Settings,
		description: "Admin configuration"
	}
]

interface AdminSidebarProps {
	user: {
		fullName: string | null
		emailAddress: string | undefined
	}
}

export function AdminSidebar({ user }: AdminSidebarProps) {
	const pathname = usePathname()

	return (
		<div className="w-64 bg-card/40 backdrop-blur-sm border-r border-border h-full flex flex-col">
			{/* Admin Logo/Title */}
			<div className="p-6 border-b border-border flex-shrink-0">
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
						<Zap className="h-4 w-4 text-primary-foreground" />
					</div>
					<div>
						<h2 className="font-semibold text-lg">
							IcePhone Admin
						</h2>
						<p className="text-xs text-muted-foreground">
							Platform Management
						</p>
					</div>
				</div>
			</div>

			{/* Navigation - Scrollable */}
			<nav className="flex-1 overflow-y-auto p-4 space-y-2">
				{sidebarItems.map((item) => {
					const isActive = pathname === item.href
					const Icon = item.icon

					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"flex items-center gap-3 px-3 py-2 rounded-2xl text-sm transition-colors group",
								isActive
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50"
							)}
						>
							<Icon
								className={cn(
									"h-4 w-4 transition-colors",
									isActive
										? "text-primary"
										: "text-muted-foreground group-hover:text-foreground"
								)}
							/>
							<div className="flex-1">
								<div className="font-medium">{item.title}</div>
								<div className="text-xs text-muted-foreground">
									{item.description}
								</div>
							</div>
						</Link>
					)
				})}
			</nav>

			{/* Bottom Section - User info and actions */}
			<div className="p-4 border-t border-border flex-shrink-0 space-y-3">
				{/* Back to Main App */}
				<Button
					variant="outline"
					size="sm"
					asChild
					className="w-full gap-2"
				>
					<Link href="/">
						<Home className="h-4 w-4" />
						Back to App
					</Link>
				</Button>

				{/* User Info and Actions */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{/* Notifications */}
						<Button
							variant="ghost"
							size="sm"
							className="relative p-2"
						>
							<Bell className="h-4 w-4" />
							{/* Notification badge */}
							<span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
						</Button>

						{/* User Info */}
						<div className="flex-1">
							<div className="text-sm font-medium">
								{user.fullName || user.emailAddress}
							</div>
							<div className="text-xs text-muted-foreground">
								Admin User
							</div>
						</div>
					</div>

					{/* User Button */}
					<UserButton afterSignOutUrl="/" />
				</div>
			</div>
		</div>
	)
}
