"use client"

import { getCampaignExecutionStatus } from "@/actions/campaigns"
import { CampaignStatsCard } from "@/components/campaign-stats-card"
import {
	CalendarPlusIcon,
	ListChecksIcon,
	PhoneForwardedIcon,
	TargetIcon,
	UsersIcon
} from "lucide-react"
import { useEffect, useState } from "react"

interface CampaignStatsDashboardProps {
	campaignId: string
}

interface CampaignExecutionStats {
	totalLeads: number
	convertedLeads: number
	callsCompleted: number
	queuedCalls: number
	meetingsBooked: number
}

export function CampaignStatsDashboard({
	campaignId
}: CampaignStatsDashboardProps) {
	const [stats, setStats] = useState<CampaignExecutionStats>({
		totalLeads: 0,
		convertedLeads: 0,
		callsCompleted: 0,
		queuedCalls: 0,
		meetingsBooked: 0
	})
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function fetchCampaignStats() {
			try {
				const result = await getCampaignExecutionStatus(
					parseInt(campaignId)
				)
				if (result.success && result.data) {
					const data = result.data
					setStats({
						totalLeads: data.leads.total,
						convertedLeads: data.leads.converted,
						callsCompleted: data.queue.completed,
						queuedCalls: data.queue.queued,
						meetingsBooked: 0 // TODO: Implement meetings tracking
					})
				}
			} catch (error) {
				console.error("Error fetching campaign stats:", error)
			} finally {
				setLoading(false)
			}
		}

		fetchCampaignStats()

		// Refresh stats every 30 seconds for real-time updates
		const interval = setInterval(fetchCampaignStats, 30000)
		return () => clearInterval(interval)
	}, [campaignId])

	const statsConfig = [
		{
			title: "Total Leads",
			value: stats.totalLeads,
			icon: UsersIcon,
			description: "All leads in this campaign",
			className: "bg-blue-50 border-blue-200 shadow-sm"
		},
		{
			title: "Converted Leads",
			value: stats.convertedLeads,
			icon: TargetIcon,
			description: "Leads marked as converted",
			className: "bg-green-50 border-green-200 shadow-sm"
		},
		{
			title: "Calls Completed",
			value: stats.callsCompleted,
			icon: PhoneForwardedIcon,
			description: "Total calls completed",
			className: "bg-purple-50 border-purple-200 shadow-sm"
		},
		{
			title: "Queued Calls",
			value: stats.queuedCalls,
			icon: ListChecksIcon,
			description: "Calls pending execution",
			className: "bg-yellow-50 border-yellow-200 shadow-sm"
		},
		{
			title: "Meetings Booked",
			value: stats.meetingsBooked,
			icon: CalendarPlusIcon,
			description: "Meetings scheduled from calls",
			className: "bg-sky-50 border-sky-200 shadow-sm"
		}
	]

	if (loading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
				{statsConfig.map((stat) => (
					<CampaignStatsCard
						key={stat.title}
						title={stat.title}
						value="..."
						icon={stat.icon}
						description={stat.description}
						className={`${stat.className} rounded-2xl animate-pulse`}
					/>
				))}
			</div>
		)
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
			{statsConfig.map((stat) => (
				<CampaignStatsCard
					key={stat.title}
					title={stat.title}
					value={stat.value}
					icon={stat.icon}
					description={stat.description}
					className={`${stat.className} rounded-2xl`}
				/>
			))}
		</div>
	)
}
