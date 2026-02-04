import { CampaignDetailsPageClient } from "@/components/campaign-details-page-client"
import { db_ws } from "@/db"
import { campaigns } from "@/db/schema"
import { requireTeam } from "@/lib/auth/session"
import { teamScope } from "@/lib/team-scope"
import { and, eq } from "drizzle-orm"
import type { Metadata } from "next"

export async function generateMetadata({
	params: paramsPromise
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const params = await paramsPromise
	const campaignId = params.id

	let campaignName = `Campaign ${campaignId}`
	const numericCampaignId = Number.parseInt(campaignId, 10)

	if (Number.isFinite(numericCampaignId)) {
		try {
			const { teamId } = await requireTeam()
			const [campaign] = await db_ws
				.select({ name: campaigns.name })
				.from(campaigns)
				.where(
					and(
						eq(campaigns.id, numericCampaignId),
						teamScope(campaigns, teamId)
					)
				)
				.limit(1)

			if (campaign?.name) {
				campaignName = campaign.name
			}
		} catch (error) {
			console.error("Failed to resolve campaign metadata title:", error)
		}
	}

	return {
		title: `${campaignName} | IcePhone`,
		description: `Details for ${campaignName}`
	}
}

export default async function CampaignDetailsPage({
	params: paramsPromise
}: { params: Promise<{ id: string }> }) {
	const params = await paramsPromise
	const campaignId = params.id
	return (
		<div className="container">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4">
				<CampaignDetailsPageClient campaignId={campaignId} />
			</div>
		</div>
	)
}
