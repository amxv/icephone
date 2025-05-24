import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
	User,
	Phone,
	Bot,
	PhoneCall,
	MessageSquare,
	Mail,
	Calendar,
	Database,
	Settings
} from "lucide-react"
import { getRecentActivity } from "@/actions/admin"

function getActivityIcon(type: string) {
	switch (type) {
		case "lead_created":
		case "user_registered":
			return User
		case "call_completed":
			return PhoneCall
		case "agent_created":
			return Bot
		case "phone_assigned":
			return Phone
		case "lead_converted":
			return User
		case "message_sent":
			return MessageSquare
		case "email_sent":
			return Mail
		case "appointment_scheduled":
			return Calendar
		case "database_updated":
			return Database
		case "settings_changed":
			return Settings
		default:
			return User
	}
}

function getActivityBadgeColor(type: string) {
	switch (type) {
		case "lead_created":
		case "user_registered":
			return "bg-blue-500"
		case "call_completed":
			return "bg-green-500"
		case "agent_created":
			return "bg-purple-500"
		case "phone_assigned":
			return "bg-orange-500"
		case "lead_converted":
			return "bg-green-600"
		case "message_sent":
			return "bg-blue-600"
		case "email_sent":
			return "bg-red-500"
		case "appointment_scheduled":
			return "bg-teal-500"
		case "database_updated":
			return "bg-gray-500"
		case "settings_changed":
			return "bg-yellow-500"
		default:
			return "bg-gray-500"
	}
}

export async function AdminActivityFeed() {
	const activities = await getRecentActivity()

	return (
		<div className="space-y-4">
			{activities.length === 0 ? (
				<div className="text-center py-8 text-muted-foreground">
					<Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
					<p className="text-sm">No recent activity found</p>
				</div>
			) : (
				activities.map((activity) => {
					const Icon = getActivityIcon(activity.type)
					const badgeColor = getActivityBadgeColor(activity.type)

					return (
						<div
							key={activity.uniqueKey}
							className="flex items-start gap-3 p-3 rounded-2xl hover:bg-accent/30 transition-colors"
						>
							{/* Activity Icon */}
							<div
								className={`h-10 w-10 rounded-full ${badgeColor} flex items-center justify-center flex-shrink-0`}
							>
								<Icon className="h-4 w-4 text-white" />
							</div>

							{/* Activity Content */}
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<p className="text-sm font-medium">
										{activity.description}
									</p>
									<Badge
										variant="secondary"
										className="text-xs"
									>
										{activity.type.replace(/_/g, " ")}
									</Badge>
								</div>

								<div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
									<span>{activity.user.name}</span>
									<span>•</span>
									<span>{activity.user.email}</span>
								</div>

								{activity.metadata &&
									Object.keys(activity.metadata).length >
										0 && (
										<div className="text-xs text-muted-foreground">
											{Object.entries(activity.metadata)
												.filter(
													([key, value]) =>
														value != null &&
														value !== ""
												)
												.map(([key, value]) => (
													<span
														key={key}
														className="mr-3"
													>
														{key}:{" "}
														<span className="font-medium">
															{String(value)}
														</span>
													</span>
												))}
										</div>
									)}
							</div>

							{/* Timestamp */}
							<div className="text-xs text-muted-foreground flex-shrink-0">
								{activity.timestamp}
							</div>
						</div>
					)
				})
			)}
		</div>
	)
}
