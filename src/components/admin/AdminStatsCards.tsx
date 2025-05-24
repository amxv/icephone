import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Phone, Bot, PhoneCall } from "lucide-react"
import { getAdminStats } from "@/actions/admin"

interface StatCardProps {
	title: string
	value: string | number
	change?: string
	icon: React.ComponentType<{ className?: string }>
	color: string
}

function StatCard({ title, value, change, icon: Icon, color }: StatCardProps) {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardContent className="p-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm text-muted-foreground">{title}</p>
						<p className="text-2xl font-bold">{value}</p>
						{change && (
							<p className="text-xs text-muted-foreground mt-1">
								{change}
							</p>
						)}
					</div>
					<div
						className={`h-12 w-12 rounded-2xl ${color} flex items-center justify-center`}
					>
						<Icon className="h-6 w-6 text-white" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

async function AdminStatsCardsContent() {
	const stats = await getAdminStats()

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<StatCard
				title="Total Users"
				value={stats.totalUsers}
				change={`+${stats.newUsersThisMonth} this month`}
				icon={Users}
				color="bg-blue-500"
			/>
			<StatCard
				title="Phone Numbers"
				value={stats.totalPhoneNumbers}
				change={`${stats.activePhoneNumbers} active`}
				icon={Phone}
				color="bg-green-500"
			/>
			<StatCard
				title="Voice Agents"
				value={stats.totalVoiceAgents}
				change={`${stats.activeVoiceAgents} active`}
				icon={Bot}
				color="bg-purple-500"
			/>
			<StatCard
				title="Total Calls"
				value={stats.totalCalls}
				change={`+${stats.callsThisMonth} this month`}
				icon={PhoneCall}
				color="bg-orange-500"
			/>
		</div>
	)
}

export function AdminStatsCards() {
	return (
		<Suspense fallback={<div>Loading stats...</div>}>
			<AdminStatsCardsContent />
		</Suspense>
	)
}
