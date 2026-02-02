import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Call Queue | IcePhone",
	description: "View and manage queued voice agent calls"
}

import { CallQueuePageClient } from "@/components/call-queue-page-client"

export default function CallQueuePage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<CallQueuePageClient />
			</div>
		</div>
	)
}
