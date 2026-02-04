"use client"

import { deleteKnowledgeBaseSource } from "@/actions/knowledge-base"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"
import type { KnowledgeBaseSource } from "@/types"
import {
	ExternalLink,
	FileText,
	Loader2,
	MoreVertical,
	Trash2
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface KnowledgeBaseSourcesListProps {
	sources: KnowledgeBaseSource[]
}

export default function KnowledgeBaseSourcesList({
	sources
}: KnowledgeBaseSourcesListProps) {
	const [deletingId, setDeletingId] = useState<number | null>(null)

	if (sources.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-48 text-center">
				<FileText className="h-10 w-10 text-muted-foreground mb-2" />
				<h3 className="text-lg font-medium">
					No knowledge sources yet
				</h3>
				<p className="text-sm text-muted-foreground mb-4">
					Add your first knowledge source to get started
				</p>
				<Button variant="outline" asChild>
					<Link href="/knowledge">Add Source</Link>
				</Button>
			</div>
		)
	}

	const handleDelete = async (id: number) => {
		try {
			setDeletingId(id)
			const result = await deleteKnowledgeBaseSource(id)

			if (result.success) {
				toast({
					title: "Source deleted",
					description:
						"Knowledge base source has been deleted successfully"
				})
			} else {
				toast({
					title: "Error",
					description: result.error || "Failed to delete source",
					variant: "destructive"
				})
			}
		} catch (error) {
			toast({
				title: "Error",
				description: "An unexpected error occurred",
				variant: "destructive"
			})
		} finally {
			setDeletingId(null)
		}
	}

	const formatDate = (dateString: string | Date) => {
		const date = new Date(dateString)
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(date)
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{sources.map((source) => (
				<Card key={source.id} className="overflow-hidden">
					<CardHeader className="pb-2">
						<div className="flex justify-between items-start">
							<div>
								<CardTitle className="text-xl">
									{source.name}
								</CardTitle>
								<CardDescription className="truncate max-w-xs">
									{source.uri}
								</CardDescription>
							</div>
							<div className="flex items-center">
								<Badge variant="outline" className="mr-2">
									{source.type}
								</Badge>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon">
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											<Link
												href={`/knowledge/${source.id}`}
											>
												View Documents
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() =>
												handleDelete(source.id)
											}
										>
											Delete Source
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</CardHeader>
					<CardContent className="pb-2">
						<div className="text-sm text-muted-foreground">
							<div>
								<span className="font-medium">
									Last Indexed:
								</span>{" "}
								{source.lastIndexedAt
									? formatDate(source.lastIndexedAt)
									: "Never"}
							</div>
							<div>
								<span className="font-medium">Created:</span>{" "}
								{formatDate(source.createdAt)}
							</div>
						</div>
					</CardContent>
					<CardFooter>
						<div className="flex justify-between items-center w-full">
							<Button variant="outline" size="sm" asChild>
								<Link href={`/knowledge/${source.id}`}>
									View Documents
								</Link>
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="text-destructive hover:text-destructive"
								disabled={deletingId === source.id}
								onClick={() => handleDelete(source.id)}
							>
								{deletingId === source.id ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Deleting...
									</>
								) : (
									<>
										<Trash2 className="h-4 w-4 mr-2" />
										Delete
									</>
								)}
							</Button>
						</div>
					</CardFooter>
				</Card>
			))}
		</div>
	)
}
