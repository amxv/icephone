"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

import { listLeads, updateLeadStatus } from "@/actions/leads"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Lead } from "@/types"
import {
	type Active,
	type DataRef,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	MouseSensor,
	type Over,
	TouchSensor,
	useSensor,
	useSensors
} from "@dnd-kit/core"
import { SortableContext, arrayMove } from "@dnd-kit/sortable"
import { RefreshCcw } from "lucide-react"
import { coordinateGetter } from "./keyboard-coordinates"
import { LeadCard } from "./lead-card"
import type { LeadDragData } from "./lead-card"
import { PipelineBoardContainer, PipelineColumn } from "./pipeline-column"
import type { Column, ColumnDragData } from "./pipeline-column"

const pipelineStages: Column[] = [
	{
		id: "contacted",
		title: "Contacted",
		value: "contacted",
		color: "#8b5cf6" // violet
	},
	{
		id: "qualified",
		title: "Qualified",
		value: "qualified",
		color: "#10b981" // emerald
	},
	{
		id: "converted",
		title: "Converted",
		value: "converted",
		color: "#22c55e" // green
	},
	{
		id: "lost",
		title: "Lost",
		value: "lost",
		color: "#ef4444" // red
	}
]

export function PipelineBoard() {
	const [columns] = useState<Column[]>(pipelineStages)
	const [leads, setLeads] = useState<Lead[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [activeColumn, setActiveColumn] = useState<Column | null>(null)
	const [activeLead, setActiveLead] = useState<Lead | null>(null)
	const dndContextId = useId()

	const fetchLeads = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await listLeads()
			if (response.success && response.data) {
				setLeads(response.data as Lead[])
			} else {
				toast.error(response.error || "Failed to load leads")
			}
		} catch (error) {
			console.error("Error loading leads:", error)
			toast.error("Failed to load leads")
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchLeads()
	}, [fetchLeads])

	const sensors = useSensors(
		useSensor(MouseSensor),
		useSensor(TouchSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: coordinateGetter
		})
	)

	const hasDraggableData = <T extends Active | Over>(
		entry: T | null | undefined
	): entry is T & {
		data: DataRef<LeadDragData | ColumnDragData>
	} => {
		if (!entry) {
			return false
		}

		const data = entry.data.current

		if (data?.type === "Column" || data?.type === "Lead") {
			return true
		}

		return false
	}

	const columnsId = useMemo(() => columns.map((col) => col.id), [columns])

	const leadsGroupedByStatus = useMemo(() => {
		return columns.reduce<Record<string, Lead[]>>((acc, column) => {
			acc[column.id.toString()] = leads.filter(
				(lead) => lead.status === column.value
			)
			return acc
		}, {})
	}, [columns, leads])

	const onDragStart = (event: DragStartEvent) => {
		if (!hasDraggableData(event.active)) return

		const data = event.active.data.current

		if (data?.type === "Column") {
			setActiveColumn(data.column)
			return
		}

		if (data?.type === "Lead") {
			setActiveLead(data.lead)
			return
		}
	}

	const onDragEnd = async (event: DragEndEvent) => {
		setActiveColumn(null)
		setActiveLead(null)

		const { active, over } = event
		if (!over) return

		const activeId = active.id
		const overId = over.id

		if (!hasDraggableData(active)) return

		const activeData = active.data.current

		if (activeId === overId) return

		// Currently we don't allow reordering columns
		// Only focus on lead drag and drop between columns
		if (activeData?.type === "Lead") {
			// Get the new column/status value for the lead
			const targetColumnId = hasDraggableData(over)
				? over.data.current?.type === "Column"
					? over.id.toString()
					: over.data.current?.lead.status
				: over.id.toString()

			// Find the target column object to get its value
			const targetColumn = columns.find(
				(col) => col.id.toString() === targetColumnId
			)
			if (!targetColumn) return

			const leadId = Number(activeId)
			const newStatus = targetColumn.value as
				| "new"
				| "contacted"
				| "qualified"
				| "converted"
				| "lost"

			// If the status hasn't changed, no need to update
			if (activeLead?.status === newStatus) return

			// Update the lead in state optimistically
			setLeads((prevLeads) =>
				prevLeads.map((lead) =>
					lead.id === leadId ? { ...lead, status: newStatus } : lead
				)
			)

			// Update the lead status in the database
			try {
				const result = await updateLeadStatus(leadId, newStatus)
				if (!result.success) {
					toast.error(result.error || "Failed to update lead status")
					// Revert the optimistic update on failure
					fetchLeads()
				} else {
					toast.success("Lead status updated")
				}
			} catch (error) {
				console.error("Error updating lead status:", error)
				toast.error("Failed to update lead status")
				// Revert the optimistic update on error
				fetchLeads()
			}
		}
	}

	const onDragOver = (event: DragOverEvent) => {
		const { active, over } = event
		if (!over) return

		const activeId = active.id
		const overId = over.id

		if (activeId === overId) return

		if (!hasDraggableData(active) || !hasDraggableData(over)) return

		const activeData = active.data.current
		const overData = over.data.current

		// Only handle lead dragging for now
		if (activeData?.type !== "Lead") return

		// If dragging over another lead, we don't need special handling
		// The onDragEnd will handle the status update
	}

	if (isLoading) {
		return (
			<Card className="rounded-3xl bg-transparent shadow-none border-none flex-grow flex flex-col">
				<CardHeader className="border-b-0 p-0">
					<div className="py-1">
						<Skeleton className="h-10 w-28" />
					</div>
				</CardHeader>
				<CardContent className="px-0 pb-0 flex-grow">
					<div className="flex gap-2 items-start overflow-x-auto py-1">
						{/* Skeleton for each column */}
						{pipelineStages.map((column) => (
							<div
								key={`skeleton-column-${column.id}`}
								className="flex-shrink-0 w-[300px]"
							>
								<Skeleton className="h-12 w-full mb-2 rounded-2xl" />
								<div className="flex flex-col gap-3">
									{/* Skeleton cards */}
									{[1, 2, 3].map((num) => (
										<Skeleton
											key={`skeleton-card-${column.id}-${num}`}
											className="h-32 w-full rounded-2xl"
										/>
									))}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="rounded-3xl bg-transparent shadow-none border-none flex-grow flex flex-col">
			<CardHeader className="border-b-0 p-0">
				<div className="py-1 flex items-center justify-between">
					<Button variant="outline" size="sm" onClick={fetchLeads}>
						<RefreshCcw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent className="px-0 pb-0 flex-grow">
				<DndContext
					id={dndContextId}
					sensors={sensors}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					onDragOver={onDragOver}
				>
					<PipelineBoardContainer>
						<SortableContext items={columnsId}>
							{columns.map((column) => (
								<PipelineColumn
									key={column.id}
									column={column}
									leads={
										leadsGroupedByStatus[
											column.id.toString()
										] || []
									}
								/>
							))}
						</SortableContext>
					</PipelineBoardContainer>

					{typeof window !== "undefined" &&
						createPortal(
							<DragOverlay>
								{activeColumn && (
									<PipelineColumn
										column={activeColumn}
										leads={
											leadsGroupedByStatus[
												activeColumn.id.toString()
											] || []
										}
										isOverlay
									/>
								)}
								{activeLead && (
									<LeadCard lead={activeLead} isOverlay />
								)}
							</DragOverlay>,
							document.body
						)}
				</DndContext>
			</CardContent>
		</Card>
	)
}
