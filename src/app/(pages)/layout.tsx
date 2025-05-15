import { SidebarNav } from "@/components/sidebar-nav"

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-screen w-full overflow-hidden">
			<SidebarNav />
			<div className="md:px-4 md:pb-10 rounded-4xl mt-3 mr-3 border border-primary/40 dark:border-neutral-700 bg-white/75 dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-[calc(100%-1.5rem)] overflow-y-auto shadow-lg shadow-primary/60">
				{children}
				<div className="h-8 md:h-12" />
			</div>
		</div>
	)
}
