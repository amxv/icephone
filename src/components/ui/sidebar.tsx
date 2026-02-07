"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, X } from "lucide-react"
import Link, { type LinkProps } from "next/link"
import { usePathname } from "next/navigation"
import { type ReactNode, createContext, useContext, useState } from "react"

interface Links {
	label: string
	href: string
	icon: ReactNode
}

interface SidebarContextProps {
	open: boolean
	setOpen: React.Dispatch<React.SetStateAction<boolean>>
	animate: boolean
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined)

export const useSidebar = () => {
	const context = useContext(SidebarContext)
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider")
	}
	return context
}

export const SidebarProvider = ({
	children,
	open: openProp,
	setOpen: setOpenProp,
	animate = true
}: {
	children: React.ReactNode
	open?: boolean
	setOpen?: React.Dispatch<React.SetStateAction<boolean>>
	animate?: boolean
}) => {
	const [openState, setOpenState] = useState(false)

	const open = openProp !== undefined ? openProp : openState
	const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState

	return (
		<SidebarContext.Provider value={{ open, setOpen, animate }}>
			{children}
		</SidebarContext.Provider>
	)
}

export const Sidebar = ({
	children,
	open,
	setOpen,
	animate
}: {
	children: React.ReactNode
	open?: boolean
	setOpen?: React.Dispatch<React.SetStateAction<boolean>>
	animate?: boolean
}) => {
	return (
		<SidebarProvider open={open} setOpen={setOpen} animate={animate}>
			{children}
		</SidebarProvider>
	)
}

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
	return (
		<>
			<DesktopSidebar {...props} />
			<MobileSidebar {...(props as React.ComponentProps<"div">)} />
		</>
	)
}

export const DesktopSidebar = ({
	className,
	children,
	...props
}: React.ComponentProps<typeof motion.div>) => {
	const { open, setOpen, animate } = useSidebar()
	return (
		<motion.div
			className={cn(
				"h-full px-4 py-4 hidden md:flex md:flex-col bg-background dark:bg-neutral-800 w-[220px] flex-shrink-0",
				className
			)}
			animate={{
				width: animate ? (open ? "220px" : "75px") : "220px"
			}}
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			{...props}
		>
			{children}
		</motion.div>
	)
}

export const MobileSidebar = ({
	className,
	children,
	...props
}: React.ComponentProps<"div">) => {
	const { open, setOpen } = useSidebar()
	return (
		<>
			<div
				className={cn(
					"h-10 px-4 py-4 flex flex-row md:hidden items-center bg-background dark:bg-neutral-800 w-full"
				)}
				{...props}
			>
				<div className="flex justify-start z-20 w-full">
					<Menu
						className="text-black dark:text-white cursor-pointer"
						onClick={() => setOpen(!open)}
					/>
				</div>
			</div>
			<AnimatePresence>
				{open && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="fixed inset-0 bg-black/50 z-[99] md:hidden"
							onClick={() => setOpen(false)}
						/>
						<motion.div
							initial={{ x: "-100%", opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							exit={{ x: "-100%", opacity: 0 }}
							transition={{
								duration: 0.3,
								ease: "easeInOut"
							}}
							className={cn(
								"fixed inset-y-0 left-0 w-[280px] bg-background dark:bg-neutral-900 z-[100] flex flex-col justify-between p-6 pt-10 rounded-r-2xl shadow-xl md:hidden",
								className
							)}
						>
							<button
								type="button"
								className="absolute right-4 top-4 z-50 text-black dark:text-white cursor-pointer bg-transparent border-none p-0 m-0"
								onClick={() => setOpen(false)}
							>
								<X />
							</button>
							{children}
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	)
}

export const SidebarLink = ({
	link,
	className,
	...props
}: {
	link: Links
	className?: string
	props?: LinkProps
}) => {
	const { open, setOpen, animate } = useSidebar()
	const pathname = usePathname()

	// Check if current path starts with the link path
	const isActive =
		pathname.startsWith(link.href) &&
		(link.href !== "/" || pathname === "/")

	return (
		<Link
			href={link.href}
			onClick={() => setOpen(false)}
			className={cn(
				"flex items-center justify-start gap-4 group/sidebar py-3 px-2.5 rounded-2xl transition-all duration-200 hover:bg-white hover:border hover:border-primary/60 dark:hover:bg-neutral-700 dark:hover:border-neutral-600 border border-transparent",
				isActive &&
					"bg-white/50 border-primary/60 dark:bg-neutral-700 dark:border-neutral-600",
				className
			)}
			{...props}
		>
			<div
				className={cn(isActive ? "text-primary dark:text-primary" : "")}
			>
				{link.icon}
			</div>
			<motion.span
				animate={{
					display: animate
						? open
							? "inline-block"
							: "none"
						: "inline-block",
					opacity: animate ? (open ? 1 : 0) : 1
				}}
				className={cn(
					"text-sm whitespace-pre inline-block !p-0 !m-0",
					isActive
						? "text-black dark:text-primary font-medium"
						: "text-black dark:text-white"
				)}
			>
				{link.label}
			</motion.span>
		</Link>
	)
}
