import { SidebarNav } from "@/components/sidebar-nav"

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-screen w-full flex-col overflow-hidden md:flex-row">
			<SidebarNav />
			<div className="flex-1 min-h-0 w-full overflow-y-auto bg-white/75 dark:bg-neutral-900 md:px-4 md:pb-10 md:rounded-4xl md:mt-3 md:mr-3 md:border md:border-primary/40 md:dark:border-neutral-700 md:h-[calc(100%-1.5rem)] md:shadow-lg md:shadow-primary/60 flex flex-col gap-2">
				{children}
				<div className="h-8 md:h-12" />
			</div>
		</div>
	)
}
