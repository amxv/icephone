import { CampaignDetailsPageClient } from "@/components/campaign-details-page-client" // We will create this component next
import type { Metadata } from "next"

export async function generateMetadata({
	params: paramsPromise
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const params = await paramsPromise // Await the promise
	const campaignId = params.id
	// TODO: Fetch campaign name and use it in the title
	return {
		title: `Campaign ${campaignId} | IcePhone`,
		description: `Details for campaign ${campaignId}`
	}
}

export default async function CampaignDetailsPage({
	params: paramsPromise
}: { params: Promise<{ id: string }> }) {
	const params = await paramsPromise // Await the promise
	const campaignId = params.id
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<CampaignDetailsPageClient campaignId={campaignId} />
			</div>
		</div>
	)
}
