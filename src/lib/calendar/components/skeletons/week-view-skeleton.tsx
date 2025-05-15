import { Skeleton } from "@/components/ui/skeleton"

export function WeekViewSkeleton() {
	return (
		<div className="flex h-full flex-col">
			<div className="grid grid-cols-8 border-b">
				<div className="w-18" />
				{Array.from({ length: 7 }).map((_, i) => (
					<div
						key={`weekday-${i}`}
						className="flex flex-col items-center justify-center py-2"
					>
						<Skeleton className="h-6 w-14 rounded-full" />
					</div>
				))}
			</div>

			<div className="flex flex-1 overflow-y-auto">
				<div className="w-18 flex-shrink-0">
					{Array.from({ length: 12 }).map((_, i) => (
						<div
							key={`hour-label-${i}`}
							className="relative h-12 border-b pr-2 text-right"
						>
							<Skeleton className="ml-auto h-4 w-8" />
						</div>
					))}
				</div>

				<div className="grid flex-1 grid-cols-7 divide-x">
					{Array.from({ length: 7 }).map((_, dayIndex) => (
						<div
							key={`day-column-${dayIndex}`}
							className="relative"
						>
							{Array.from({ length: 12 }).map((_, hourIndex) => (
								<div
									key={`hour-slot-${dayIndex}-${hourIndex}`}
									className="h-12 border-b"
								/>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
