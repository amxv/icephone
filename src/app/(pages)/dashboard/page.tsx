import { getDashboardData } from "@/actions/dashboard-analytics"
import DashboardClient from "@/components/dashboard-client"

export default async function Dashboard() {
	// Fetch initial dashboard data on the server
	const initialData = await getDashboardData("30d")

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-8 p-2 md:px-8 md:py-4 h-full">
				<DashboardClient initialData={initialData} />
			</div>
		</div>
	)
}
