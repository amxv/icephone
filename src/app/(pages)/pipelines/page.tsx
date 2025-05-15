import { PipelineBoard } from "@/components/pipeline/pipeline-board"

export const metadata = {
	title: "Sales Pipeline | IcePhone CRM",
	description: "Manage your sales pipeline with a visual Kanban board"
}

export default function PipelinesPage() {
	return (
		<div className="container py-1 overflow-y-hidden h-screen">
			<div className="flex flex-col gap-4 p-2 md:p-4">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-500">
						Sales Pipeline
					</h1>
					<p className="text-sm md:text-base text-muted-foreground mt-2">
						Manage your leads through the sales process with a
						visual Kanban board.
					</p>
				</div>

				<PipelineBoard />
			</div>
		</div>
	)
}
