"use client"

import { generateStreamingRAGResponse } from "@/actions/knowledge-base"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
// import { streamText } from "ai/react" // Will be used for future streaming implementation
import {
	Bot,
	Copy,
	ExternalLink,
	FileText,
	Loader2,
	MessageSquare,
	Send,
	User
} from "lucide-react"
import { useState } from "react"

interface Message {
	id: string
	role: "user" | "assistant"
	content: string
	sources?: Array<{
		id: number
		sourceName: string
		sourceType: string
		similarity: number
		contentPreview: string
		citationIndex: number
	}>
	timestamp: Date
}

interface StreamingChatProps {
	initialMessages?: Message[]
	className?: string
}

export default function StreamingRAGChat({
	initialMessages = [],
	className = ""
}: StreamingChatProps) {
	const [messages, setMessages] = useState<Message[]>(initialMessages)
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [currentStreamingMessage, setCurrentStreamingMessage] = useState("")

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!input.trim() || isLoading) return

		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: input.trim(),
			timestamp: new Date()
		}

		setMessages((prev) => [...prev, userMessage])
		setInput("")
		setIsLoading(true)
		setCurrentStreamingMessage("")

		try {
			// Step 1: Prepare RAG context
			const ragPrep = await generateStreamingRAGResponse(input.trim(), {
				limit: 5,
				threshold: 0.7
			})

			if (!ragPrep.success || !ragPrep.data) {
				throw new Error(ragPrep.error || "Failed to retrieve context")
			}

			const {
				systemPrompt,
				userPrompt,
				contextDocuments,
				searchMetadata
			} = ragPrep.data

			// Step 2: Start streaming response
			const assistantMessageId = (Date.now() + 1).toString()

			// Add placeholder message
			const assistantMessage: Message = {
				id: assistantMessageId,
				role: "assistant",
				content: "",
				sources: contextDocuments.map((doc, index) => ({
					id: doc.id,
					sourceName: String(doc.source_name || "Unknown"),
					sourceType: String(doc.source_type || "unknown"),
					similarity: doc.similarity || 0,
					contentPreview: `${String(doc.content_chunk || doc.contentChunk || "").substring(0, 150)}...`,
					citationIndex: index + 1
				})),
				timestamp: new Date()
			}

			setMessages((prev) => [...prev, assistantMessage])

			// Step 3: Stream the response using Vercel AI SDK
			const { generateAIText } = await import("@/lib/ai-helpers")

			// For now, we'll use non-streaming since we need to refactor for proper streaming
			const response = await generateAIText({
				prompt: userPrompt,
				system: systemPrompt,
				category: "text",
				task: "general",
				maxTokens: 1000,
				temperature: 0.1
			})

			// Update the message with the complete response
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId
						? { ...msg, content: response }
						: msg
				)
			)

			toast({
				title: "Response generated",
				description: `Used ${contextDocuments.length} sources for context`
			})
		} catch (error) {
			console.error("Chat error:", error)

			// Add error message
			const errorMessage: Message = {
				id: Date.now().toString(),
				role: "assistant",
				content:
					"I apologize, but I encountered an error while processing your question. Please try again or rephrase your question.",
				timestamp: new Date()
			}

			setMessages((prev) => [...prev, errorMessage])

			toast({
				title: "Error",
				description:
					error instanceof Error
						? error.message
						: "Failed to generate response",
				variant: "destructive"
			})
		} finally {
			setIsLoading(false)
			setCurrentStreamingMessage("")
		}
	}

	const copyToClipboard = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content)
			toast({
				title: "Copied",
				description: "Message copied to clipboard"
			})
		} catch {
			toast({
				title: "Failed to copy",
				description: "Could not copy to clipboard",
				variant: "destructive"
			})
		}
	}

	const clearChat = () => {
		setMessages([])
		setCurrentStreamingMessage("")
	}

	return (
		<div className={`flex flex-col h-full max-w-4xl mx-auto ${className}`}>
			{/* Chat Header */}
			<Card className="mb-4">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						AI Knowledge Assistant
					</CardTitle>
					<CardDescription>
						Ask questions about your knowledge base and get
						real-time answers with source citations
					</CardDescription>
				</CardHeader>
			</Card>

			{/* Messages */}
			<Card className="flex-1 flex flex-col">
				<CardContent className="flex-1 p-0">
					<ScrollArea className="h-[500px] p-4">
						{messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
								<Bot className="h-12 w-12 mb-4 opacity-50" />
								<h3 className="text-lg font-medium mb-2">
									Start a conversation
								</h3>
								<p className="text-sm">
									Ask questions about your knowledge base to
									get started
								</p>
							</div>
						) : (
							<div className="space-y-6">
								{messages.map((message) => (
									<div key={message.id} className="space-y-2">
										{/* Message Header */}
										<div className="flex items-center gap-2">
											{message.role === "user" ? (
												<User className="h-4 w-4" />
											) : (
												<Bot className="h-4 w-4" />
											)}
											<span className="text-sm font-medium">
												{message.role === "user"
													? "You"
													: "AI Assistant"}
											</span>
											<span className="text-xs text-muted-foreground">
												{message.timestamp.toLocaleTimeString()}
											</span>
										</div>

										{/* Message Content */}
										<div
											className={`p-3 rounded-lg ${
												message.role === "user"
													? "bg-primary text-primary-foreground ml-8"
													: "bg-muted mr-8"
											}`}
										>
											<div className="prose prose-sm max-w-none dark:prose-invert">
												{message.content ? (
													<div className="whitespace-pre-wrap">
														{message.content}
													</div>
												) : (
													<div className="flex items-center gap-2 text-muted-foreground">
														<Loader2 className="h-4 w-4 animate-spin" />
														Thinking...
													</div>
												)}
											</div>

											{/* Action Buttons */}
											{message.content &&
												message.role ===
													"assistant" && (
													<div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	message.content
																)
															}
														>
															<Copy className="h-3 w-3 mr-1" />
															Copy
														</Button>
													</div>
												)}
										</div>

										{/* Sources */}
										{message.sources &&
											message.sources.length > 0 && (
												<div className="mr-8 ml-6">
													<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
														<FileText className="h-4 w-4" />
														Sources (
														{message.sources.length}
														)
													</h4>
													<div className="grid gap-2 md:grid-cols-2">
														{message.sources.map(
															(source) => (
																<Card
																	key={
																		source.id
																	}
																	className="p-3"
																>
																	<div className="flex items-start justify-between gap-2">
																		<div className="flex-1 min-w-0">
																			<div className="flex items-center gap-2 mb-1">
																				<Badge
																					variant="outline"
																					className="text-xs"
																				>
																					[
																					{
																						source.citationIndex
																					}
																					]
																				</Badge>
																				<span className="text-sm font-medium truncate">
																					{
																						source.sourceName
																					}
																				</span>
																			</div>
																			<p className="text-xs text-muted-foreground mb-2">
																				{
																					source.contentPreview
																				}
																			</p>
																			<div className="flex items-center gap-2">
																				<Badge
																					variant="secondary"
																					className="text-xs"
																				>
																					{
																						source.sourceType
																					}
																				</Badge>
																				<Badge
																					variant="outline"
																					className="text-xs"
																				>
																					{(
																						source.similarity *
																						100
																					).toFixed(
																						1
																					)}
																					%
																					match
																				</Badge>
																			</div>
																		</div>
																		<Button
																			variant="ghost"
																			size="sm"
																			className="shrink-0"
																		>
																			<ExternalLink className="h-3 w-3" />
																		</Button>
																	</div>
																</Card>
															)
														)}
													</div>
												</div>
											)}
									</div>
								))}

								{/* Current streaming message */}
								{currentStreamingMessage && (
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Bot className="h-4 w-4" />
											<span className="text-sm font-medium">
												AI Assistant
											</span>
											<Loader2 className="h-3 w-3 animate-spin" />
										</div>
										<div className="bg-muted p-3 rounded-lg mr-8">
											<div className="prose prose-sm max-w-none dark:prose-invert">
												<div className="whitespace-pre-wrap">
													{currentStreamingMessage}
													<span className="animate-pulse">
														|
													</span>
												</div>
											</div>
										</div>
									</div>
								)}
							</div>
						)}
					</ScrollArea>
				</CardContent>

				<Separator />

				{/* Input Form */}
				<div className="p-4">
					<form onSubmit={handleSubmit} className="flex gap-2">
						<Input
							placeholder="Ask a question about your knowledge base..."
							value={input}
							onChange={(e) => setInput(e.target.value)}
							disabled={isLoading}
							className="flex-1"
						/>
						<Button
							type="submit"
							disabled={isLoading || !input.trim()}
						>
							{isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
					</form>

					{messages.length > 0 && (
						<div className="flex justify-end mt-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={clearChat}
							>
								Clear chat
							</Button>
						</div>
					)}
				</div>
			</Card>
		</div>
	)
}
