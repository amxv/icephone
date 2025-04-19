"use client"

import { Logo, LogoIcon } from "@/components/app-sidebar"
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"
import { SignedIn, UserButton } from "@clerk/nextjs"
import { LayoutDashboard, LogOut, Settings, UserCog } from "lucide-react"
import { useState } from "react"

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
		},
		{
			label: "Logout",
			href: "/auth/signout",
			icon: (
				<LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
			)
		}
	]

	return (
		<Sidebar open={open} setOpen={setOpen}>
			<SidebarBody className="justify-between gap-10">
				<div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
					{open ? <Logo /> : <LogoIcon />}
					<div className="mt-8 flex flex-col gap-2">
						{links.map((link, idx) => (
							<SidebarLink
								key={`${link.label}-${idx}`}
								link={link}
							/>
						))}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<SignedIn>
						<div className="flex items-center">
							<UserButton
								appearance={{
									elements: {
										userButtonAvatarBox: "h-7 w-7"
									}
								}}
							/>
							{open && (
								<span className="ml-2 text-sm text-neutral-700 dark:text-neutral-200">
									Account
								</span>
							)}
						</div>
					</SignedIn>
				</div>
			</SidebarBody>
		</Sidebar>
	)
}
