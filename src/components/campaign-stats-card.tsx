import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface CampaignStatsCardProps {
	title: string
	value: string | number
	icon: LucideIcon
	description?: string
	className?: string
}

export function CampaignStatsCard({
	title,
	value,
	icon: Icon,
	description,
	className
}: CampaignStatsCardProps) {
	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-5 w-5 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{value}</div>
				{description && (
					<p className="text-xs text-muted-foreground">
						{description}
					</p>
				)}
			</CardContent>
		</Card>
	)
}
