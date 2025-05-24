"use client"

import { generateRAGResponse } from "@/actions/knowledge-base"
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
import { toast } from "@/components/ui/use-toast"
import type { RAGResponse } from "@/types"
import {
	Brain,
	ExternalLink,
	FileText,
	Loader2,
	MessageSquare
} from "lucide-react"
import { useState } from "react"

export default function RAGAssistant() {
	const [query, setQuery] = useState("")
	const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null)
	const [isGenerating, setIsGenerating] = useState(false)
	const [hasAsked, setHasAsked] = useState(false)

	const handleAskQuestion = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!query.trim()) {
			toast({
				title: "Question required",
				description: "Please enter a question",
				variant: "destructive"
			})
			return
		}

		setIsGenerating(true)
		setHasAsked(false)
		setRagResponse(null)

		try {
			const result = await generateRAGResponse(query.trim(), {
				limit: 5,
				threshold: 0.7,
				includeMetadata: true
			})

			if (result.success && result.data) {
				setRagResponse(result.data as RAGResponse)
				setHasAsked(true)
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
		} catch (error) {
			console.error("RAG error:", error)
			toast({
				title: "Response generation failed",
				description: "An unexpected error occurred",
				variant: "destructive"
			})
		} finally {
			setIsGenerating(false)
			setHasAsked(true)
		}
	}

	return (
		<div className="space-y-6">
			{/* Question Form */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Brain className="h-5 w-5" />
						AI Knowledge Assistant
					</CardTitle>
					<CardDescription>
						Ask questions and get AI-generated answers from your
						knowledge base
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleAskQuestion} className="flex gap-2">
						<Input
							placeholder="Ask a question about your knowledge base..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							disabled={isGenerating}
							className="flex-1"
						/>
						<Button
							type="submit"
							disabled={isGenerating || !query.trim()}
							size="default"
						>
							{isGenerating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<Brain className="h-4 w-4 mr-2" />
									Ask AI
								</>
							)}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* AI Response */}
			{hasAsked && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-medium">AI Response</h3>
						{ragResponse && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setRagResponse(null)
									setHasAsked(false)
									setQuery("")
								}}
							>
								Clear
							</Button>
						)}
					</div>

					{ragResponse ? (
						<div className="space-y-4">
							{/* AI Answer */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<MessageSquare className="h-5 w-5" />
										Answer
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
					) : (
						<Card>
							<CardContent className="text-center py-8">
								<MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
								<h4 className="text-lg font-medium mb-1">
									No response generated
								</h4>
								<p className="text-sm text-muted-foreground">
									There was an issue generating a response.
									Please try again.
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			)}
		</div>
	)
}
