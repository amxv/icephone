import { SidebarNav } from "@/components/sidebar-nav"

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-screen w-full overflow-hidden">
			<SidebarNav />
			<div className="p-2 md:p-10 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full overflow-y-auto">
				{children}
			</div>
		</div>
	)
}
