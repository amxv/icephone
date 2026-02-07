"use client"

// import { Logo, LogoIcon } from "@/components/app-sidebar"
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/auth/user-menu"
import { useAuthUser } from "@/lib/auth/use-auth-user"
import { motion } from "framer-motion"
import {
	BarChart,
	Book,
	Bot,
	Calendar,
	Funnel,
	Headset,
	LayoutDashboard,
	Megaphone,
	PhoneCall,
	Settings,
	Users
} from "lucide-react"
import { useState } from "react"
import { Logo as ZueLogo } from "./logo"

export function SidebarNav() {
	const [open, setOpen] = useState(false)
	const { user } = useAuthUser()

	const links = [
		{
			label: "Dashboard",
			href: "/dashboard",
			icon: (
				<LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Leads",
			href: "/leads",
			icon: (
				<Users className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Pipelines",
			href: "/pipelines",
			icon: (
				<Funnel className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Appointments",
			href: "/appointments",
			icon: (
				<Calendar className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Calls",
			href: "/calls",
			icon: (
				<Headset className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Phone Numbers",
			href: "/phone-numbers",
			icon: (
				<PhoneCall className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},

		{
			label: "Voice Agents",
			href: "/voice-agents",
			icon: (
				<Bot className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Campaigns",
			href: "/campaigns",
			icon: (
				<Megaphone className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Knowledge",
			href: "/knowledge",
			icon: (
				<Book className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Analytics",
			href: "/analytics",
			icon: (
				<BarChart className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Settings",
			href: "/settings",
			icon: (
				<Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		}
	]

	return (
		<Sidebar open={open} setOpen={setOpen}>
			<SidebarBody className="justify-between gap-10">
				<div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
					{/* {open ? <Logo /> : <LogoIcon />} */}
					<div className="mt-6 flex flex-col gap-2">
						{links.map((link, idx) => (
							<SidebarLink
								key={`${link.label}-${idx}`}
								link={link}
							/>
						))}
					</div>
				</div>
				<div className="flex items-center mb-2">
					{user && (
						<div className="flex items-center justify-center gap-28">
							<ZueLogo lightMode={true} width={45} height={37} />
							{open && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{
										duration: 0.3,
										delay: 0.1,
										ease: "easeInOut"
									}}
								>
									<UserMenu />
								</motion.div>
							)}
						</div>
					)}
				</div>
			</SidebarBody>
		</Sidebar>
	)
}
