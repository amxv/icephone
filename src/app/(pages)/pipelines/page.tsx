import { PipelineBoard } from "@/components/pipeline/pipeline-board"

export const metadata = {
	title: "Sales Pipeline | IcePhone CRM",
	description: "Manage your sales pipeline with a visual Kanban board"
}

export default function PipelinesPage() {
	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<div>
					<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
						Sales Pipeline
					</h1>
				</div>

				<PipelineBoard />
			</div>
		</div>
	)
}
