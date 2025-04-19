"use client"

// import { Logo, LogoIcon } from "@/components/app-sidebar"
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"
import { SignedIn, UserButton } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { LayoutDashboard, LogOut, Settings, UserCog } from "lucide-react"
import { useState } from "react"
import { Logo as ZueLogo } from "./logo"

export function SidebarNav() {
	const [open, setOpen] = useState(false)

	const links = [
		{
			label: "Dashboard",
			href: "/",
			icon: (
				<LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		},
		{
			label: "Profile",
			href: "/profile",
			icon: (
				<UserCog className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
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
				<div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
					{/* {open ? <Logo /> : <LogoIcon />} */}
					<div className="mt-8 flex flex-col gap-2">
						{links.map((link, idx) => (
							<SidebarLink
								key={`${link.label}-${idx}`}
								link={link}
							/>
						))}
					</div>
				</div>
				<div className="flex items-center">
					<SignedIn>
						<div className="flex items-center justify-center gap-22">
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
									<UserButton
										appearance={{
											elements: {
												userButtonAvatarBox: "h-7 w-7"
											}
										}}
									/>
								</motion.div>
							)}
						</div>
					</SignedIn>
				</div>
			</SidebarBody>
		</Sidebar>
	)
}
