import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Campaigns | IcePhone",
	description: "Manage and run cold call campaigns"
}

import { CampaignsPageClient } from "@/components/campaigns-page-client"

export default function CampaignsPage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<CampaignsPageClient />
			</div>
		</div>
	)
}
