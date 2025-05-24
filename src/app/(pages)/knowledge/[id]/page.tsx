import {
	getDocumentsForSource,
	getKnowledgeBaseSourceById
} from "@/actions/knowledge-base"
import KnowledgeBaseDocumentsList from "@/components/knowledge-base/KnowledgeBaseDocumentsList"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { KnowledgeBaseDocument } from "@/types"
import { ChevronLeft, Database } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

interface KnowledgeBaseSourcePageProps {
	params: Promise<{
		id: string
	}>
}

export default async function KnowledgeBaseSourcePage({
	params
}: KnowledgeBaseSourcePageProps) {
	const { id } = await params
	const sourceId = Number.parseInt(id, 10)

	if (Number.isNaN(sourceId)) {
		notFound()
	}

	const sourceResult = await getKnowledgeBaseSourceById(sourceId)
	const documentsResult = await getDocumentsForSource(sourceId)

	if (!sourceResult.success || !sourceResult.data) {
		notFound()
	}

	const source = sourceResult.data
	const documents =
		documentsResult.success && documentsResult.data
			? (documentsResult.data as unknown as KnowledgeBaseDocument[])
			: []

	const formatDate = (dateString: string | Date | null) => {
		if (!dateString) return "Never"
		const date = new Date(dateString)
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(date)
	}

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="rounded-2xl"
						asChild
					>
						<Link href="/knowledge">
							<ChevronLeft className="h-4 w-4 mr-1" /> Back
						</Link>
					</Button>
				</div>

				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight pb-2 pt-4 text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700">
					{source.name}
				</h1>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
					<div className="flex items-center gap-2">
						<Database className="h-4 w-4 text-muted-foreground" />
						<span className="font-medium">Type:</span> {source.type}
					</div>
					<div>
						<span className="font-medium">Location:</span>{" "}
						{source.uri}
					</div>
					<div>
						<span className="font-medium">Last Indexed:</span>{" "}
						{formatDate(source.lastIndexedAt)}
					</div>
				</div>

				<Separator className="my-2" />

				<div className="flex-1 overflow-auto">
					<h2 className="text-lg font-medium mb-4">Documents</h2>
					<Suspense fallback={<div>Loading documents...</div>}>
						<KnowledgeBaseDocumentsList
							sourceId={sourceId}
							documents={documents}
						/>
					</Suspense>
				</div>
			</div>
		</div>
	)
}
