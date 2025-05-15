import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { Lead } from "@/types"
import { type UniqueIdentifier, useDndContext } from "@dnd-kit/core"
import { SortableContext, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cva } from "class-variance-authority"
import { useMemo } from "react"
import { LeadCard } from "./lead-card"

export interface Column {
	id: UniqueIdentifier
	title: string
	value: string
	color?: string
}

export type ColumnType = "Column"

export type ColumnDragData = {
	type: ColumnType
	column: Column
}

interface PipelineColumnProps {
	column: Column
	leads: Lead[]
	isOverlay?: boolean
}

export function PipelineColumn({
	column,
	leads,
	isOverlay
}: PipelineColumnProps) {
	const leadIds = useMemo(() => {
		return leads.map((lead) => lead.id)
	}, [leads])

	const { setNodeRef, transform, transition, isDragging } = useSortable({
		id: column.id,
		data: {
			type: "Column",
			column
		} satisfies ColumnDragData,
		attributes: {
			roleDescription: `Column: ${column.title}`
		}
	})

	const style = {
		transition,
		transform: CSS.Translate.toString(transform)
	}

	const variants = cva(
		"h-full w-[280px] bg-card flex flex-col flex-shrink-0 snap-center rounded-3xl border border-border/40 backdrop-blur-sm shadow-sm",
		{
			variants: {
				dragging: {
					default: "border border-border/40",
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
			className={variants({
				dragging: isOverlay
					? "overlay"
					: isDragging
						? "over"
						: undefined
			})}
		>
			<CardHeader className="py-1 px-4 font-medium border-b flex flex-row items-center justify-between bg-muted/30">
				<div className="flex items-center gap-2">
					{column.color && (
						<div
							className="w-3 h-3 rounded-full"
							style={{ backgroundColor: column.color }}
						/>
					)}
					<h3 className="text-sm font-medium">{column.title}</h3>
				</div>
				<Badge variant="outline">{leads.length}</Badge>
			</CardHeader>
			<ScrollArea className="flex-grow flex flex-col">
				<CardContent className="flex flex-col gap-2 p-2 flex-grow bg-card/40">
					<SortableContext items={leadIds}>
						{leads.length === 0 ? (
							<div className="flex flex-grow items-center justify-center h-24">
								<p className="text-muted-foreground text-xs">
									No leads in this stage.
								</p>
							</div>
						) : (
							leads.map((lead) => (
								<LeadCard key={lead.id} lead={lead} />
							))
						)}
					</SortableContext>
				</CardContent>
			</ScrollArea>
		</Card>
	)
}

export function PipelineBoardContainer({
	children
}: { children: React.ReactNode }) {
	const dndContext = useDndContext()

	const variations = cva("px-0 flex justify-start lg:justify-center pb-2", {
		variants: {
			dragging: {
				default: "snap-x snap-mandatory",
				active: "snap-none"
			}
		}
	})

	return (
		<ScrollArea
			className={`${variations({
				dragging: dndContext.active ? "active" : "default"
			})} flex-grow`}
		>
			<div className="flex gap-2 items-start py-1 flex-grow">
				{children}
			</div>
			<ScrollBar orientation="horizontal" className="h-2" />
		</ScrollArea>
	)
}
