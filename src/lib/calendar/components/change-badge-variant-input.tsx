"use client"

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from "@/components/ui/tooltip"
import { buttonHover } from "@/lib/calendar/animations"
import { MotionButton } from "@/lib/calendar/components/header/calendar-header"
import { useCalendar } from "@/lib/calendar/contexts/calendar-context"
import { DotIcon, PaletteIcon } from "lucide-react"

export function ChangeBadgeVariantInput() {
	const { badgeVariant, setBadgeVariant } = useCalendar()

	return (
		<div className="space-y-1">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<MotionButton
							variant="outline"
							size="icon"
							variants={buttonHover}
							whileHover="hover"
							whileTap="tap"
							onClick={() =>
								setBadgeVariant(
									badgeVariant === "dot" ? "colored" : "dot"
								)
							}
						>
							{badgeVariant === "dot" ? (
								<DotIcon className="w-5 h-5" />
							) : (
								<PaletteIcon className="w-5 h-5" />
							)}
						</MotionButton>
					</TooltipTrigger>
					<TooltipContent>Badge variant</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	)
}
