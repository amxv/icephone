"use client"

import { generateRAGResponse, performRAGQuery } from "@/actions/knowledge-base"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import type { RAGResponse } from "@/types"
import {
	Brain,
	ExternalLink,
	FileText,
	Loader2,
	MessageSquare,
	Search
} from "lucide-react"
import { useState } from "react"

interface SearchResult {
	id: number
	source_id: number
	content_chunk: string
	metadata: Record<string, unknown>
	source_name: string
	source_type: string
}

export default function KnowledgeBaseSearch() {
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<SearchResult[]>([])
	const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null)
	const [isSearching, setIsSearching] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)
	const [isRagMode, setIsRagMode] = useState(false)

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!query.trim()) {
			toast({
				title: "Search query required",
				description: "Please enter a search term",
				variant: "destructive"
			})
			return
		}

		setIsSearching(true)
		setHasSearched(false)
		setResults([])
		setRagResponse(null)

		try {
			if (isRagMode) {
				// Generate RAG response
				const result = await generateRAGResponse(query.trim(), {
					limit: 5,
					threshold: 0.7,
					includeMetadata: true
				})

				if (result.success && result.data) {
					setRagResponse(result.data as RAGResponse)
					setHasSearched(true)
					toast({
						title: "AI response generated",
						description: `Generated response using ${result.data.sources.length} sources`
					})
				} else {
					toast({
						title: "Response generation failed",
						description:
							result.error ||
							"An error occurred during response generation",
						variant: "destructive"
					})
				}
			} else {
				// Perform document search
				const result = await performRAGQuery(query.trim(), {
					limit: 10
				})

				if (result.success && result.data) {
					setResults(result.data as unknown as SearchResult[])
					setHasSearched(true)
					toast({
						title: "Search completed",
						description: `Found ${result.data.length} results for "${query}"`
					})
				} else {
					toast({
						title: "Search failed",
						description:
							result.error || "An error occurred during search",
						variant: "destructive"
					})
				}
			}
		} catch (error) {
			console.error("Search error:", error)
			toast({
				title: "Search failed",
				description: "An unexpected error occurred",
				variant: "destructive"
			})
		} finally {
			setIsSearching(false)
			setHasSearched(true)
		}
	}

	const truncateText = (text: string, maxLength = 200) => {
		return text.length > maxLength
			? `${text.substring(0, maxLength)}...`
			: text
	}

	const highlightSearchTerm = (text: string, searchTerm: string) => {
		if (!searchTerm.trim()) return text

		const regex = new RegExp(
			`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
			"gi"
		)
		const parts = text.split(regex)

		return parts.map((part, index) =>
			regex.test(part) ? (
				<mark
					key={index}
					className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded"
				>
					{part}
				</mark>
			) : (
				<span key={index}>{part}</span>
			)
		)
	}

	return (
		<div className="space-y-6">
			{/* Search Form */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						{isRagMode ? (
							<>
								<Brain className="h-5 w-5" />
								AI Knowledge Assistant
							</>
						) : (
							<>
								<Search className="h-5 w-5" />
								Search Knowledge Base
							</>
						)}
					</CardTitle>
					<CardDescription>
						{isRagMode
							? "Ask questions and get AI-generated answers from your knowledge base"
							: "Search through your uploaded documents and knowledge sources"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Mode Toggle */}
					<div className="flex items-center space-x-2">
						<Switch
							id="rag-mode"
							checked={isRagMode}
							onCheckedChange={setIsRagMode}
						/>
						<Label
							htmlFor="rag-mode"
							className="flex items-center gap-2"
						>
							{isRagMode ? (
								<>
									<MessageSquare className="h-4 w-4" />
									AI Assistant Mode
								</>
							) : (
								<>
									<Search className="h-4 w-4" />
									Document Search Mode
								</>
							)}
						</Label>
					</div>

					{/* Search Input */}
					<form onSubmit={handleSearch} className="flex gap-2">
						<Input
							placeholder={
								isRagMode
									? "Ask a question about your knowledge base..."
									: "Enter your search query..."
							}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							disabled={isSearching}
							className="flex-1"
						/>
						<Button
							type="submit"
							disabled={isSearching || !query.trim()}
							size="default"
						>
							{isSearching ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{isRagMode
										? "Generating..."
										: "Searching..."}
								</>
							) : (
								<>
									{isRagMode ? (
										<Brain className="h-4 w-4 mr-2" />
									) : (
										<Search className="h-4 w-4 mr-2" />
									)}
									{isRagMode ? "Ask AI" : "Search"}
								</>
							)}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Results */}
			{hasSearched && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-medium">
							{isRagMode ? "AI Response" : "Search Results"}
							{!isRagMode &&
								results.length > 0 &&
								` (${results.length})`}
						</h3>
						{(results.length > 0 || ragResponse) && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setResults([])
									setRagResponse(null)
									setHasSearched(false)
									setQuery("")
								}}
							>
								Clear
							</Button>
						)}
					</div>

					{/* RAG Response */}
					{isRagMode && ragResponse && (
						<div className="space-y-4">
							{/* AI Answer */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<MessageSquare className="h-5 w-5" />
										AI Answer
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="prose prose-sm max-w-none dark:prose-invert">
										<div className="whitespace-pre-wrap leading-relaxed">
											{ragResponse.answer}
										</div>
									</div>
									{ragResponse.metadata && (
										<div className="mt-4 pt-4 border-t">
											<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
												<Badge variant="outline">
													{
														ragResponse.metadata
															.modelProvider
													}{" "}
													{
														ragResponse.metadata
															.modelName
													}
												</Badge>
												<Badge variant="outline">
													{
														ragResponse.metadata
															.contextDocumentsUsed
													}{" "}
													sources used
												</Badge>
												<Badge variant="outline">
													{
														ragResponse.metadata
															.searchType
													}{" "}
													search
												</Badge>
											</div>
										</div>
									)}
								</CardContent>
							</Card>

							{/* Sources */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<FileText className="h-5 w-5" />
										Sources ({ragResponse.sources.length})
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{ragResponse.sources.map((source) => (
											<div
												key={`${source.id}-${source.citationIndex}`}
												className="border rounded-lg p-3"
											>
												<div className="flex items-start justify-between mb-2">
													<div className="space-y-1">
														<div className="flex items-center gap-2">
															<Badge
																variant="secondary"
																className="text-xs"
															>
																[
																{
																	source.citationIndex
																}
																]
															</Badge>
															<span className="font-medium text-sm">
																{
																	source.sourceName
																}
															</span>
															<Badge
																variant="outline"
																className="text-xs"
															>
																{
																	source.sourceType
																}
															</Badge>
														</div>
														<div className="text-xs text-muted-foreground">
															Similarity:{" "}
															{(
																source.similarity *
																100
															).toFixed(1)}
															%
														</div>
													</div>
													<Button
														variant="ghost"
														size="sm"
														asChild
													>
														<a
															href={`/knowledge/${source.sourceId}`}
														>
															<ExternalLink className="h-4 w-4" />
														</a>
													</Button>
												</div>
												<div className="text-sm text-muted-foreground">
													{source.contentPreview}
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Document Search Results */}
					{!isRagMode &&
						(results.length === 0 ? (
							<Card>
								<CardContent className="text-center py-8">
									<FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
									<h4 className="text-lg font-medium mb-1">
										No results found
									</h4>
									<p className="text-sm text-muted-foreground">
										Try different keywords or check your
										uploaded documents
									</p>
								</CardContent>
							</Card>
						) : (
							<div className="space-y-3">
								{results.map((result, index) => (
									<Card
										key={`${result.id}-${index}`}
										className="overflow-hidden"
									>
										<CardHeader className="pb-2">
											<div className="flex items-start justify-between">
												<div className="space-y-1">
													<CardTitle className="text-base">
														{result.source_name}
													</CardTitle>
													<div className="flex items-center gap-2">
														<Badge
															variant="outline"
															className="text-xs"
														>
															{result.source_type}
														</Badge>
														{result.metadata &&
															typeof result.metadata ===
																"object" &&
															"fileName" in
																result.metadata && (
																<span className="text-xs text-muted-foreground">
																	{
																		result
																			.metadata
																			.fileName as string
																	}
																</span>
															)}
													</div>
												</div>
												<Button
													variant="ghost"
													size="sm"
													asChild
												>
													<a
														href={`/knowledge/${result.source_id}`}
													>
														<ExternalLink className="h-4 w-4" />
													</a>
												</Button>
											</div>
										</CardHeader>
										<CardContent>
											<div className="text-sm leading-relaxed">
												{highlightSearchTerm(
													truncateText(
														result.content_chunk
													),
													query
												)}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						))}
				</div>
			)}
		</div>
	)
}
