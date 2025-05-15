import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Calls | IcePhone",
	description: "View and manage voice agent call records"
}

import { CallsPageClient } from "@/components/calls-page-client"

export default function CallsPage() {
	return (
		<div className="h-full flex flex-col overflow-hidden pb-4 p-10">
			<CallsPageClient />
		</div>
	)
}
