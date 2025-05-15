import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Calls | IcePhone",
	description: "View and manage voice agent call records"
}

import { CallsPageClient } from "@/components/calls-page-client"

export default function CallsPage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<CallsPageClient />
			</div>
		</div>
	)
}
