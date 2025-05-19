import { CampaignStatsCard } from "@/components/campaign-stats-card"
import {
	CalendarPlusIcon,
	ListChecksIcon,
	PhoneForwardedIcon,
	TargetIcon,
	UsersIcon
} from "lucide-react"

interface CampaignStatsDashboardProps {
	// TODO: Define props for actual data later
	totalLeads?: number
	convertedLeads?: number
	callsMade?: number
	queuedCalls?: number
	meetingsBooked?: number
}

export function CampaignStatsDashboard({
	totalLeads = 0,
	convertedLeads = 0,
	callsMade = 0,
	queuedCalls = 0,
	meetingsBooked = 0
}: CampaignStatsDashboardProps) {
	// Placeholder data - replace with actual props later
	const stats = [
		{
			title: "Total Leads",
			value: totalLeads || 125,
			icon: UsersIcon,
			description: "All leads in this campaign",
			className: "bg-blue-50 border-blue-200 shadow-sm"
		},
		{
			title: "Converted Leads",
			value: convertedLeads || 18,
			icon: TargetIcon,
			description: "Leads marked as converted",
			className: "bg-green-50 border-green-200 shadow-sm"
		},
		{
			title: "Calls Made",
			value: callsMade || 350,
			icon: PhoneForwardedIcon,
			description: "Total calls initiated",
			className: "bg-purple-50 border-purple-200 shadow-sm"
		},
		{
			title: "Queued Calls",
			value: queuedCalls || 45,
			icon: ListChecksIcon,
			description: "Calls pending execution",
			className: "bg-yellow-50 border-yellow-200 shadow-sm"
		},
		{
			title: "Meetings Booked",
			value: meetingsBooked || 12,
			icon: CalendarPlusIcon,
			description: "Meetings scheduled from calls",
			className: "bg-sky-50 border-sky-200 shadow-sm"
		}
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
			{stats.map((stat) => (
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
