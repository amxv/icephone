import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/lib/calendar/components/calendar"
import { CalendarSkeleton } from "@/lib/calendar/components/skeletons/calendar-skeleton"
import type { Metadata } from "next"
import { Suspense } from "react"

export const metadata: Metadata = {
	title: "Appointments | IcePhone",
	description: "Manage your appointments and scheduled calls"
}

// Page header component
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-500">
					Appointments
				</h1>
				<p className="text-sm md:text-base text-muted-foreground mt-2">
					Manage your appointments and scheduled calls with prospects
				</p>
			</div>
		</div>
	)
}

export default async function AppointmentsPage() {
	return (
		<div className="container py-2">
			<div className="flex flex-col gap-8 p-2 md:p-10">
				<PageHeader />

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-0">
						<Suspense fallback={<CalendarSkeleton />}>
							<Calendar />
						</Suspense>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
