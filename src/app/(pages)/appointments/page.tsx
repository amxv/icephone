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
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Appointments
				</h1>
				
			</div>
		</div>
	)
}

export default async function AppointmentsPage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<PageHeader />

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-grow overflow-hidden">
					<CardContent className="p-0 h-full">
						<Suspense fallback={<CalendarSkeleton />}>
							<Calendar />
						</Suspense>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
