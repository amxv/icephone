import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Phone Numbers | IcePhone",
	description: "Manage your inbound and outbound phone numbers for AI voice agents"
}

import { PhoneNumbersPageClient } from "@/components/phone-numbers-page-client"

export default function PhoneNumbersPage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<PhoneNumbersPageClient />
			</div>
		</div>
	)
}
