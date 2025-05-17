"use client"

import { getChatById, getChats } from "@/actions/chats" // Changed from getCalls
import { ChatsTable } from "@/components/chats-table"
import type { ChatItem } from "@/components/chats-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { Chat, ChatMessage } from "@/types"
import type { ColumnFiltersState } from "@tanstack/react-table"
import { format } from "date-fns"
import {
	ClockIcon,
	FileTextIcon,
	MessageSquareIcon,
	MessageSquareTextIcon,
	XIcon
} from "lucide-react"
import Markdown from "markdown-to-jsx"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// Skeleton component for the chats table
function ChatsTableSkeleton() {
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardContent className="px-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
						<Skeleton className="h-10 w-64" />
						<div className="flex gap-2">
							{/* Fewer filter buttons for chats */}
							<Skeleton className="h-10 w-24" />
						</div>
					</div>
					<div className="overflow-x-auto rounded-2xl border">
						<Skeleton className="h-[300px] w-full" />
					</div>
					<div className="flex flex-row items-center justify-end space-x-2 py-4">
						<div className="hidden items-center space-x-2 lg:flex">
							<Skeleton className="h-4 w-24 rounded" />
							<Skeleton className="h-8 w-[70px] rounded" />
						</div>
						<Skeleton className="h-4 w-32 rounded" />
						<div className="flex items-center space-x-2">
							<Skeleton className="h-8 w-8 rounded hidden lg:block" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded" />
							<Skeleton className="h-8 w-8 rounded hidden lg:block" />
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Main page component with title and description
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Chats
				</h1>
			</div>
		</div>
	)
}

// Chat details component
function ChatDetails({
	chat
}: { chat: ChatItem & { messages?: ChatMessage[] } }) {
	// Custom overrides for markdown elements
	const markdownOverrides = {
		h1: { props: { className: "text-2xl font-medium my-4" } },
		h2: { props: { className: "text-xl font-medium my-3" } },
		h3: { props: { className: "text-lg font-medium my-2" } },
		p: { props: { className: "text-sm mb-2" } },
		ul: {
			props: { className: "list-disc list-outside my-3 ml-5 text-sm" }
		},
		ol: {
			props: { className: "list-decimal list-outside my-3 ml-5 text-sm" }
		},
		li: { props: { className: "mb-1" } }, // text-sm inherited
		a: {
			props: {
				className: "text-primary hover:underline",
				target: "_blank",
				rel: "noopener noreferrer"
			}
		},
		code: { props: { className: "bg-muted rounded px-1 py-0.5 text-sm" } },
		pre: {
			props: {
				className: "bg-muted rounded p-2 mb-2 overflow-x-auto text-sm"
			}
		},
		table: {
			props: {
				className:
					"min-w-full divide-y divide-border border border-border rounded-lg my-3 text-sm"
			}
		},
		thead: { props: { className: "bg-muted/50" } },
		th: {
			props: {
				className:
					"px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
			}
		},
		tbody: {
			props: { className: "divide-y divide-border bg-background" }
		},
		tr: { props: { className: "hover:bg-muted/30" } },
		td: {
			props: {
				className: "px-3 py-2 whitespace-nowrap"
			}
		}
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Chat Summary */}
			{chat.summary && (
				<div className="pb-2 border-b border-border/30 bg-accents">
					<h4 className="text-sm font-semibold text-muted-foreground">
						Summary
					</h4>
					<div className="max-h-40 overflow-y-auto">
						<p className="whitespace-pre-wrap text-sm">
							{chat.summary}
						</p>
					</div>
				</div>
			)}

			{/* Chat Messages */}
			<div
				className={`flex-1 overflow-y-auto p-4 ${!chat.summary ? "pt-4" : "pt-2"}`}
			>
				<div className="space-y-4">
					{chat.messages && chat.messages.length > 0 ? (
						chat.messages.map((message) => (
							<div
								key={message.id}
								className={`flex ${message.role === "assistant" ? "justify-end" : "justify-start"}`}
							>
								<div
									className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
										message.role === "assistant"
											? "bg-primary text-primary-foreground"
											: "bg-secondary text-secondary-foreground"
									}`}
								>
									{message.role === "user" ? (
										<div className="whitespace-pre-wrap text-sm">
											{message.content}
										</div>
									) : (
										<Markdown
											options={{
												overrides: markdownOverrides,
												forceBlock: true
											}}
										>
											{message.content}
										</Markdown>
									)}
									<div className="text-xs mt-1.5 opacity-80 text-right">
										{format(
											new Date(message.timestamp),
											"p"
										)}
									</div>
								</div>
							</div>
						))
					) : (
						<div className="text-center py-4">
							<span className="text-muted-foreground italic">
								No conversation history available
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// Main Chats Page Client Component
export function ChatsPageClient() {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const [loading, setLoading] = useState(true)
	const [chatsData, setChatsData] = useState<ChatItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [selectedChat, setSelectedChat] = useState<
		(ChatItem & { messages?: ChatMessage[] }) | null
	>(null)
	const [isLoadingChat, setIsLoadingChat] = useState(false)
	const [currentFetchingChatId, setCurrentFetchingChatId] = useState<
		number | null
	>(null)
	const [isMobile, setIsMobile] = useState(false)
	const [searchQuery, setSearchQuery] = useState<string>(
		searchParams.get("search") || ""
	)

	// Handle window resize (same as calls page)
	useEffect(() => {
		const checkMobile = () => {
			const width = window.innerWidth
			setIsMobile(width < 768)

			const height = window.innerHeight
			let newRowsPerPage = 12
			if (height < 700) {
				newRowsPerPage = 5
			} else if (height < 900) {
				newRowsPerPage = 8
			}

			const currentStoredRows = Number.parseInt(
				localStorage.getItem("tableRowsPerPage") || "12",
				10
			)
			if (currentStoredRows !== newRowsPerPage) {
				localStorage.setItem(
					"tableRowsPerPage",
					newRowsPerPage.toString()
				)
			}
		}

		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	const chatIdParam = searchParams.get("chatId") // Changed from callIdParam
	const searchQueryParam = searchParams.get("search")

	// Define fetchChatDetails before using it
	const fetchChatDetails = useCallback(
		async (chatId: number) => {
			// Prevent concurrent fetches for the same chat ID or if already selected with messages
			if (selectedChat?.id === chatId && selectedChat.messages) {
				// Already have this chat with messages, no need to re-fetch.
				// Ensure loading is false if somehow set.
				if (isLoadingChat) setIsLoadingChat(false)
				return
			}
			if (isLoadingChat && currentFetchingChatId === chatId) {
				return
			}

			setIsLoadingChat(true)
			setCurrentFetchingChatId(chatId)
			try {
				const result = await getChatById(chatId)
				if (result.success && result.data) {
					setSelectedChat(
						result.data as unknown as
							| (ChatItem & { messages?: ChatMessage[] })
							| null
					)
				} else {
					console.error("Error fetching chat details:", result.error)
					// Clear selectedChat only if the failed fetch was for the currently intended selection
					setSelectedChat((prev) =>
						prev && prev.id === chatId ? null : prev
					)
				}
			} catch (err) {
				console.error("Error fetching chat details:", err)
				setSelectedChat((prev) =>
					prev && prev.id === chatId ? null : prev
				)
			} finally {
				setIsLoadingChat(false)
				setCurrentFetchingChatId(null)
			}
		},
		[selectedChat, isLoadingChat, currentFetchingChatId]
	)

	// Load chat from URL param
	useEffect(() => {
		if (chatIdParam) {
			const chatId = Number.parseInt(chatIdParam, 10)

			// If this chat is already selected and has messages, do nothing.
			if (selectedChat?.id === chatId && selectedChat.messages) {
				// If loading was true for some reason, set it to false.
				if (isLoadingChat && currentFetchingChatId !== chatId)
					setIsLoadingChat(false)
				return
			}

			// If a fetch is in progress for a *different* chat, don't interrupt,
			// but if it's for *this* chat, let it continue (the check in fetchChatDetails will handle it).
			if (
				isLoadingChat &&
				currentFetchingChatId !== null &&
				currentFetchingChatId !== chatId
			) {
				return
			}

			const chatFromList = chatsData.find((c) => c.id === chatId)

			if (chatFromList) {
				// Set basic info immediately if not already set or if it's a different chat,
				// and messages are not yet present.
				if (selectedChat?.id !== chatId || !selectedChat?.messages) {
					setSelectedChat(
						// Keep existing messages if we are just updating basic info for the same chat
						// This case should ideally be handled by the `selectedChat.messages` check above.
						// For safety, retain messages if switching to a chat that was already fully loaded.
						(prev) =>
							prev?.id === chatId && prev?.messages
								? prev
								: (chatFromList as ChatItem & {
										messages?: ChatMessage[]
									})
					)
				}
				fetchChatDetails(chatId)
			} else if (chatsData.length > 0 && !chatFromList) {
				// Chat ID in URL but not found in loaded chatsData (and chatsData is loaded), likely an invalid ID
				setSelectedChat(null)
				// Optionally, remove invalid chatId from URL
				const params = new URLSearchParams(searchParams.toString())
				params.delete("chatId")
				router.replace(`${pathname}?${params.toString()}`, {
					scroll: false
				})
			}
			// If chatsData is not yet loaded, this effect will re-run when it is.
		} else {
			// No chatIdParam, so no chat selected, unless one is actively being fetched.
			if (!isLoadingChat) {
				setSelectedChat(null)
			}
		}
	}, [
		chatIdParam,
		chatsData,
		fetchChatDetails,
		selectedChat,
		isLoadingChat,
		currentFetchingChatId,
		pathname,
		router,
		searchParams
	])

	useEffect(() => {
		if (searchQueryParam !== null) {
			setSearchQuery(searchQueryParam)
		}
	}, [searchQueryParam])

	// For chats, we currently don't have type/status filters like calls page,
	// so initialColumnFilters will be empty or not used for now.
	const initialColumnFilters = useState<ColumnFiltersState>([])[0]

	// Handle filter changes (kept for consistency, but no active filters for chats yet)
	const handleFilterChange = useCallback(
		(filters: ColumnFiltersState) => {
			const params = new URLSearchParams(searchParams.toString())

			// Example if we add a filter later, e.g., by source:
			// const sourceFilter = filters.find((f) => f.id === "source");
			// if (sourceFilter?.value && Array.isArray(sourceFilter.value) && sourceFilter.value.length > 0) {
			//   params.set("source", sourceFilter.value.join(","));
			// } else {
			//   params.delete("source");
			// }

			if (selectedChat) {
				params.set("chatId", selectedChat.id.toString()) // Changed from callId
			}

			if (searchQuery) {
				params.set("search", searchQuery)
			} else {
				params.delete("search")
			}

			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, selectedChat, searchQuery]
	)

	const handleSearchChange = useCallback(
		(query: string) => {
			setSearchQuery(query)
			const params = new URLSearchParams(searchParams.toString())
			if (query) {
				params.set("search", query)
			} else {
				params.delete("search")
			}
			if (selectedChat) {
				params.set("chatId", selectedChat.id.toString()) // Changed from callId
			}
			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, selectedChat]
	)

	const handleRowClick = useCallback(
		(chat: ChatItem) => {
			// Update URL params - this will trigger the useEffect above to handle loading
			const params = new URLSearchParams(searchParams.toString())
			params.set("chatId", chat.id.toString())
			if (searchQuery) {
				params.set("search", searchQuery)
			}
			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
			// No direct call to setSelectedChat or fetchChatDetails here.
			// The useEffect listening to chatIdParam will handle it.
		},
		[searchParams, pathname, router, searchQuery] // Removed fetchChatDetails from dependencies
	)

	const handleClosePanel = useCallback(() => {
		setSelectedChat(null)
		const params = new URLSearchParams(searchParams.toString())
		params.delete("chatId") // Changed from callId
		if (searchQuery) {
			params.set("search", searchQuery)
		}
		router.replace(`${pathname}?${params.toString()}`, { scroll: false })
	}, [searchParams, pathname, router, searchQuery])

	// Fetch chats data
	useEffect(() => {
		async function fetchData() {
			setLoading(true)
			try {
				const result = await getChats()

				if (result.success && result.data) {
					const transformedData = result.data.map((chat) => ({
						id: chat.id,
						leadId: chat.leadId || null,
						leadName: chat.leadName || null,
						summary: chat.summary || null,
						timestamp: chat.timestamp, // Should be string
						createdAt: chat.createdAt, // Should be string or undefined
						updatedAt: chat.updatedAt // Should be string or undefined
					}))
					setChatsData(transformedData as ChatItem[])
				} else {
					setError(result.error || "Failed to fetch chats data")
				}
			} catch (err) {
				console.error("Error fetching chats:", err)
				setError("An unexpected error occurred")
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	return (
		<div className="container flex flex-col h-full overflow-hidden">
			<div className="flex flex-col gap-4 h-full overflow-hidden">
				<PageHeader />

				{loading ? (
					<ChatsTableSkeleton />
				) : error ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-10">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
									{/* Changed icon to reflect chats/messages */}
									<MessageSquareTextIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									Error Loading Chats
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									{error}
								</p>
							</div>
						</CardContent>
					</Card>
				) : chatsData.length === 0 ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-12">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full p-3 border border-border/40 shadow-sm">
									<MessageSquareTextIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									No Chats Yet
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									No chats have been recorded yet. As chats
									occur, they will appear here.
								</p>
							</div>
						</CardContent>
					</Card>
				) : (
					<>
						{/* Mobile Dialog for Chat Details */}
						<Dialog
							open={!!selectedChat && isMobile}
							onOpenChange={(open) => {
								if (!open) handleClosePanel()
							}}
						>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>Chat Details</DialogTitle>
								</DialogHeader>
								{selectedChat && (
									<div className="max-h-[60vh] overflow-y-auto">
										{isLoadingChat ? (
											<div className="flex items-center justify-center p-8">
												<div className="flex flex-col items-center gap-2">
													<ClockIcon className="h-8 w-8 animate-pulse text-muted-foreground" />
													<p className="text-sm text-muted-foreground">
														Loading conversation...
													</p>
												</div>
											</div>
										) : (
											<ChatDetails chat={selectedChat} />
										)}
									</div>
								)}
							</DialogContent>
						</Dialog>

						{/* Desktop Layout */}
						<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-1 flex flex-col overflow-hidden">
							<CardContent className="px-6 pb-3 h-full flex flex-col overflow-hidden">
								<div className="flex h-full overflow-hidden">
									<div
										className={
											selectedChat && !isMobile
												? "w-1/2 pr-4 flex flex-col overflow-hidden"
												: "w-full flex flex-col overflow-hidden"
										}
									>
										<div className="custom-chats-table flex-1 flex flex-col overflow-y-auto">
											<ChatsTable
												data={chatsData}
												initialColumnFilters={
													initialColumnFilters
												}
												onFilterChange={
													handleFilterChange
												}
												onRowClick={handleRowClick}
												selectedChatId={
													selectedChat?.id
												}
												searchQuery={searchQuery}
												onSearchChange={
													handleSearchChange
												}
											/>
										</div>
									</div>

									{selectedChat && !isMobile && (
										<div className="w-1/2 border-l border-border pl-4 h-full flex flex-col overflow-hidden">
											<div className="flex items-center justify-between mb-2 pt-1 pb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-10 border-b border-border/30 pr-4">
												<div>
													<h3
														className="font-medium text-lg truncate max-w-xs"
														title={
															selectedChat.leadName ||
															"Unknown Lead"
														}
													>
														{selectedChat.leadName ||
															"Unknown Lead"}
													</h3>
													<p className="text-xs text-muted-foreground">
														Last updated:{" "}
														{format(
															new Date(
																selectedChat.timestamp
															),
															"MMM d, yyyy, h:mm a"
														)}
													</p>
												</div>
												<Button
													size="sm"
													variant="outline"
													onClick={handleClosePanel}
													className="h-8 w-8 p-0 rounded-full"
													aria-label="Close panel"
												>
													<XIcon className="h-4 w-4" />
												</Button>
											</div>
											{isLoadingChat ? (
												<div className="flex items-center justify-center h-full">
													<div className="flex flex-col items-center gap-2">
														<ClockIcon className="h-8 w-8 animate-pulse text-muted-foreground" />
														<p className="text-sm text-muted-foreground">
															Loading
															conversation...
														</p>
													</div>
												</div>
											) : (
												<ChatDetails
													chat={selectedChat}
												/>
											)}
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</div>
	)
}
