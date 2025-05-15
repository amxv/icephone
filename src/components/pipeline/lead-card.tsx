import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Lead } from "@/types"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cva } from "class-variance-authority"
import { GripVertical, Mail, Phone, Star } from "lucide-react"
import Link from "next/link"

type LeadCardProps = {
	lead: Lead
	isOverlay?: boolean
}

export type LeadDragData = {
	type: "Lead"
	lead: Lead
}

export function LeadCard({ lead, isOverlay }: LeadCardProps) {
	const {
		setNodeRef,
		attributes,
		listeners,
		transform,
		transition,
		isDragging
	} = useSortable({
		id: lead.id,
		data: {
			type: "Lead",
			lead
		} satisfies LeadDragData,
		attributes: {
			roleDescription: "Lead"
		}
	})

	const style = {
		transition,
		transform: CSS.Translate.toString(transform)
	}

	const variants = cva(
		"bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl",
		{
			variants: {
				dragging: {
					over: "ring-2 opacity-30",
					overlay: "ring-2 ring-primary"
				}
			}
		}
	)

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={`${variants({
				dragging: isOverlay
					? "overlay"
					: isDragging
						? "over"
						: undefined
			})} hover:shadow-md transition-all hover:border-border/60`}
		>
			<CardContent className="p-3 flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1 flex-1 min-w-0">
						<Button
							variant="ghost"
							{...attributes}
							{...listeners}
							className="p-1 text-muted-foreground -ml-1.5 h-auto cursor-grab hover:text-foreground/80"
						>
							<span className="sr-only">Move lead</span>
							<GripVertical className="h-4 w-4" />
						</Button>

						<Link
							href={`/leads/${lead.id}`}
							className="font-medium truncate text-sm hover:text-primary transition-colors"
						>
							{lead.name}
						</Link>
					</div>

					<Badge variant="outline" className="capitalize">
						{lead.score} pts
					</Badge>
				</div>

				<div className="flex flex-col gap-1 text-xs text-muted-foreground">
					{lead.email && (
						<div className="flex items-center gap-2">
							<Mail className="h-3 w-3" />
							<span className="truncate">{lead.email}</span>
						</div>
					)}

					{lead.phone && (
						<div className="flex items-center gap-2">
							<Phone className="h-3 w-3" />
							<span>{lead.phone}</span>
						</div>
					)}
				</div>

				{lead.source && (
					<div className="flex items-center mt-1">
						<Badge variant="secondary" className="text-xs">
							{lead.source}
						</Badge>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
