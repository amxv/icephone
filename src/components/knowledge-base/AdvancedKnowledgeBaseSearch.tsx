"use client"

import { performAdvancedRAGQuery } from "@/actions/knowledge-base"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
	Brain,
	FileText,
	Image,
	Loader2,
	Search,
	Settings,
	Sparkles,
	Zap
} from "lucide-react"
import { useState } from "react"

interface AdvancedSearchResult {
	id: number
	sourceId: number | null
	contentChunk: string
	similarity: number
	retrievalStrategy?: string
	strategyWeight?: number
	reranked?: boolean
	source_name: string
	source_type: string
	metadata: Record<string, unknown>
}

interface SearchMetadata {
	queryAnalysis: {
		hasVisualContent: boolean
		complexity: string
		queryType: string
	}
	strategiesUsed: string[]
	totalDocumentsRetrieved: number
	documentsAfterDeduplication: number
	finalDocuments: number
	rerankingEnabled: boolean
}

export default function AdvancedKnowledgeBaseSearch() {
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<AdvancedSearchResult[]>([])
	const [metadata, setMetadata] = useState<SearchMetadata | null>(null)
	const [isSearching, setIsSearching] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)

	// Advanced options
	const [enableQueryRewriting, setEnableQueryRewriting] = useState(true)
	const [enableHyde, setEnableHyde] = useState(true)
	const [enableReranking, setEnableReranking] = useState(true)
	const [limit, setLimit] = useState(5)
	const [threshold, setThreshold] = useState(0.7)
	const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

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

		try {
			const result = await performAdvancedRAGQuery(query.trim(), {
				limit,
				threshold,
				enableQueryRewriting,
				enableHyde,
				enableReranking
			})

			if (result.success && result.data) {
				setResults(result.data as AdvancedSearchResult[])
				setMetadata(result.metadata as SearchMetadata)
				setHasSearched(true)

				toast({
					title: "Advanced search completed",
					description: `Found ${result.data.length} results using ${result.metadata?.strategiesUsed?.length || 1} strategies`
				})
			} else {
				toast({
					title: "Search failed",
					description:
						result.error || "An error occurred during search",
					variant: "destructive"
				})
				setResults([])
				setMetadata(null)
			}
		} catch (error) {
			console.error("Search error:", error)
			toast({
				title: "Search failed",
				description: "An unexpected error occurred",
				variant: "destructive"
			})
			setResults([])
			setMetadata(null)
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

	const getStrategyIcon = (strategy: string) => {
		switch (strategy) {
			case "multimodal":
				return <Image className="h-3 w-3" />
			case "hyde":
				return <Brain className="h-3 w-3" />
			case "rewritten":
				return <Sparkles className="h-3 w-3" />
			default:
				return <FileText className="h-3 w-3" />
		}
	}

	const getStrategyColor = (strategy: string) => {
		switch (strategy) {
			case "multimodal":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
			case "hyde":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
			case "rewritten":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
		}
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Zap className="h-5 w-5" />
						Advanced Knowledge Base Search
					</CardTitle>
					<CardDescription>
						Search using advanced RAG techniques including query
						rewriting, HyDE, and intelligent reranking
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSearch} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="query">Search Query</Label>
							<Textarea
								id="query"
								placeholder="Ask any question about your knowledge base..."
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								disabled={isSearching}
								rows={3}
							/>
						</div>

						{/* Advanced Options Toggle */}
						<div className="flex items-center space-x-2">
							<Switch
								id="advanced-options"
								checked={showAdvancedOptions}
								onCheckedChange={setShowAdvancedOptions}
							/>
							<Label
								htmlFor="advanced-options"
								className="flex items-center gap-2"
							>
								<Settings className="h-4 w-4" />
								Show Advanced Options
							</Label>
						</div>

						{showAdvancedOptions && (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
								<div className="space-y-4">
									<div className="flex items-center space-x-2">
										<Switch
											id="query-rewriting"
											checked={enableQueryRewriting}
											onCheckedChange={
												setEnableQueryRewriting
											}
											disabled={isSearching}
										/>
										<Label htmlFor="query-rewriting">
											Query Rewriting
										</Label>
									</div>

									<div className="flex items-center space-x-2">
										<Switch
											id="hyde"
											checked={enableHyde}
											onCheckedChange={setEnableHyde}
											disabled={isSearching}
										/>
										<Label htmlFor="hyde">
											HyDE (Hypothetical Document
											Embeddings)
										</Label>
									</div>

									<div className="flex items-center space-x-2">
										<Switch
											id="reranking"
											checked={enableReranking}
											onCheckedChange={setEnableReranking}
											disabled={isSearching}
										/>
										<Label htmlFor="reranking">
											Intelligent Reranking
										</Label>
									</div>
								</div>

								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="limit">
											Results Limit
										</Label>
										<Input
											id="limit"
											type="number"
											min="1"
											max="20"
											value={limit}
											onChange={(e) =>
												setLimit(
													Number.parseInt(
														e.target.value
													) || 5
												)
											}
											disabled={isSearching}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="threshold">
											Similarity Threshold
										</Label>
										<Input
											id="threshold"
											type="number"
											min="0"
											max="1"
											step="0.1"
											value={threshold}
											onChange={(e) =>
												setThreshold(
													Number.parseFloat(
														e.target.value
													) || 0.7
												)
											}
											disabled={isSearching}
										/>
									</div>
								</div>
							</div>
						)}

						<Button
							type="submit"
							className="w-full"
							disabled={isSearching || !query.trim()}
						>
							{isSearching ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Searching...
								</>
							) : (
								<>
									<Search className="mr-2 h-4 w-4" />
									Advanced Search
								</>
							)}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Search Metadata */}
			{metadata && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">
							Search Analytics
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
							<div>
								<div className="font-medium">Query Type</div>
								<Badge variant="outline">
									{metadata.queryAnalysis.queryType}
								</Badge>
							</div>
							<div>
								<div className="font-medium">Complexity</div>
								<Badge variant="outline">
									{metadata.queryAnalysis.complexity}
								</Badge>
							</div>
							<div>
								<div className="font-medium">
									Strategies Used
								</div>
								<div className="flex flex-wrap gap-1 mt-1">
									{metadata.strategiesUsed.map(
										(strategy, index) => (
											<Badge
												key={index}
												className={`text-xs ${getStrategyColor(strategy)}`}
											>
												{getStrategyIcon(strategy)}
												<span className="ml-1">
													{strategy}
												</span>
											</Badge>
										)
									)}
								</div>
							</div>
							<div>
								<div className="font-medium">
									Documents Processed
								</div>
								<div className="text-xs text-muted-foreground">
									Retrieved:{" "}
									{metadata.totalDocumentsRetrieved} →
									Deduplicated:{" "}
									{metadata.documentsAfterDeduplication} →
									Final: {metadata.finalDocuments}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Search Results */}
			{hasSearched && (
				<Card>
					<CardHeader>
						<CardTitle>Search Results</CardTitle>
						{results.length > 0 && (
							<CardDescription>
								Found {results.length} relevant documents
							</CardDescription>
						)}
					</CardHeader>
					<CardContent>
						{results.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								<Search className="mx-auto h-12 w-12 mb-4" />
								<p>No results found</p>
								<p className="text-sm">
									Try adjusting your search terms or lowering
									the similarity threshold
								</p>
							</div>
						) : (
							<div className="space-y-4">
								{results.map((result, index) => (
									<Card
										key={`${result.id}-${index}`}
										className="border-l-4 border-l-blue-500"
									>
										<CardContent className="pt-4">
											<div className="space-y-3">
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-2 text-sm text-muted-foreground">
														<FileText className="h-4 w-4" />
														<span>
															{result.source_name}
														</span>
														<Badge
															variant="secondary"
															className="text-xs"
														>
															{result.source_type}
														</Badge>
													</div>
													<div className="flex items-center gap-2">
														{result.retrievalStrategy && (
															<Badge
																className={`text-xs ${getStrategyColor(result.retrievalStrategy)}`}
															>
																{getStrategyIcon(
																	result.retrievalStrategy
																)}
																<span className="ml-1">
																	{
																		result.retrievalStrategy
																	}
																</span>
															</Badge>
														)}
														{result.reranked && (
															<Badge
																variant="outline"
																className="text-xs"
															>
																<Zap className="h-3 w-3 mr-1" />
																Reranked
															</Badge>
														)}
														<Badge
															variant="outline"
															className="text-xs"
														>
															{(
																result.similarity *
																100
															).toFixed(1)}
															% match
														</Badge>
													</div>
												</div>

												<div className="text-sm leading-relaxed">
													{highlightSearchTerm(
														truncateText(
															result.contentChunk
														),
														query
													)}
												</div>

												{result.metadata &&
													Object.keys(result.metadata)
														.length > 0 && (
														<div className="text-xs text-muted-foreground">
															<details>
																<summary className="cursor-pointer hover:text-foreground">
																	View
																	metadata
																</summary>
																<pre className="mt-2 p-2 bg-muted rounded text-xs">
																	{JSON.stringify(
																		result.metadata,
																		null,
																		2
																	)}
																</pre>
															</details>
														</div>
													)}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
