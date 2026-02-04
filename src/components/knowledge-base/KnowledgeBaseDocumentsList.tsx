"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import { checkKnowledgeFileStatus } from "@/actions/knowledge-base"
import type { KnowledgeBaseDocument } from "@/types"
import { Eye, FileText, RefreshCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "@/components/ui/use-toast"

interface KnowledgeBaseDocumentsListProps {
	sourceId: number
	documents: KnowledgeBaseDocument[]
}

export default function KnowledgeBaseDocumentsList({
	sourceId,
	documents
}: KnowledgeBaseDocumentsListProps) {
	const [selectedDocument, setSelectedDocument] =
		useState<KnowledgeBaseDocument | null>(null)
	const [items, setItems] = useState<KnowledgeBaseDocument[]>(documents)
	const [refreshingId, setRefreshingId] = useState<number | null>(null)

	useEffect(() => {
		setItems(documents)
	}, [documents])

	if (!items || items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-48 text-center">
				<FileText className="h-10 w-10 text-muted-foreground mb-2" />
				<h3 className="text-lg font-medium">No documents yet</h3>
				<p className="text-sm text-muted-foreground">
					This knowledge source doesn't have any indexed documents yet
				</p>
			</div>
		)
	}

	const formatDate = (dateString: string | Date) => {
		const date = new Date(dateString)
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium"
		}).format(date)
	}

	const truncateContent = (content: string, maxLength = 100) => {
		if (content.length <= maxLength) return content
		return `${content.substring(0, maxLength)}...`
	}

	const handleRefresh = async (docId: number) => {
		try {
			setRefreshingId(docId)
			const result = await checkKnowledgeFileStatus(docId)

			if (result.success && result.data) {
				setItems((prev) =>
					prev.map((doc) =>
						doc.id === docId
							? {
									...doc,
									contentChunk:
										result.data.extractedTextPreview ||
										doc.contentChunk,
									metadata: {
										...doc.metadata,
										status: result.data.status,
										lastError: result.data.lastError
									}
								}
							: doc
					)
				)

				toast({
					title: "Status refreshed",
					description: `File status is now ${result.data.status}`
				})
			} else {
				toast({
					title: "Refresh failed",
					description: result.error || "Unable to refresh status",
					variant: "destructive"
				})
			}
		} catch (error) {
			toast({
				title: "Refresh failed",
				description: "An unexpected error occurred",
				variant: "destructive"
			})
		} finally {
			setRefreshingId(null)
		}
	}

	return (
		<>
			<div className="rounded-2xl border overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ID</TableHead>
							<TableHead>Content Preview</TableHead>
							<TableHead>Embedding Model</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((doc) => (
							<TableRow key={doc.id}>
								<TableCell className="font-medium">
									{doc.id}
								</TableCell>
								<TableCell>
									{truncateContent(doc.contentChunk)}
								</TableCell>
								<TableCell>
									<Badge variant="outline">
										{doc.textEmbeddingModel}
									</Badge>
								</TableCell>
								<TableCell>
									<Badge variant="secondary">
										{(doc.metadata?.status as string) ||
											"unknown"}
									</Badge>
								</TableCell>
								<TableCell>
									{formatDate(doc.createdAt)}
								</TableCell>
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="sm"
										disabled={refreshingId === doc.id}
										onClick={() => handleRefresh(doc.id)}
									>
										<RefreshCcw className="h-4 w-4 mr-1" />
										{refreshingId === doc.id
											? "Refreshing..."
											: "Refresh"}
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setSelectedDocument(doc)}
									>
										<Eye className="h-4 w-4 mr-1" />
										View
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Document Content Dialog */}
			<Dialog
				open={!!selectedDocument}
				onOpenChange={(open) => !open && setSelectedDocument(null)}
			>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
					<DialogHeader>
						<DialogTitle>Document Content</DialogTitle>
						<DialogDescription>
							ID: {selectedDocument?.id} - Model:{" "}
							{selectedDocument?.textEmbeddingModel}
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4">
						<h4 className="text-sm font-medium mb-1">Content:</h4>
						<div className="p-4 bg-muted rounded-2xl whitespace-pre-wrap">
							{selectedDocument?.contentChunk}
						</div>
					</div>
					<div className="mt-4">
						<h4 className="text-sm font-medium mb-1">Metadata:</h4>
						<div className="p-4 bg-muted rounded-2xl">
							<pre className="text-xs overflow-auto">
								{JSON.stringify(
									selectedDocument?.metadata,
									null,
									2
								)}
							</pre>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
