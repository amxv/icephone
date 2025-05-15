import { CalendarHeaderSkeleton } from "@/lib/calendar/components/skeletons/calendar-header-skeleton"
import { MonthViewSkeleton } from "@/lib/calendar/components/skeletons/month-view-skeleton"

export function CalendarSkeleton() {
	return (
		<div className="w-full">
			<div className="flex flex-col">
				<CalendarHeaderSkeleton />
				<div className="flex-1">
					<MonthViewSkeleton />
				</div>
			</div>
		</div>
	)
}
