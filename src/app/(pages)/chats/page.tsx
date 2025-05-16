import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Chats | IcePhone",
	description: "View and manage chat conversations"
}

import { ChatsPageClient } from "@/components/chats-page-client"

export default function ChatsPage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<ChatsPageClient />
			</div>
		</div>
	)
}
