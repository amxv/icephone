import { SidebarNav } from "@/components/sidebar-nav"
import { redirect } from "next/navigation"

export default function ExamplePageLayout({
	children
}: { children: React.ReactNode }) {
	// Prevent rendering in production
	if (process.env.NODE_ENV === "production") {
		redirect("/dashboard")
	}

	return (
		<div className="flex h-screen w-full overflow-hidden">
			<SidebarNav />
			<div className="p-2 md:p-10 rounded-4xl mt-2 mr-2 border border-primary/40 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-[calc(100%-1rem)] overflow-y-auto shadow-xl shadow-primary/80">
				{children}
				<div className="h-8 md:h-12" />
			</div>
		</div>
	)
}
