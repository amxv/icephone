"use client"

import { getEmails, getEmailById } from "@/actions/emails" // Changed from getCalls
import { EmailsTable } from "@/components/emails-table" // Changed from CallsTable
import type { EmailItem } from "@/components/emails-table" // Changed from CallItem
import { EmailThreadModal } from "@/components/email-thread-modal" // Added new import
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
// ColumnFiltersState might not be strictly needed if not implementing type/status filters from URL for emails yet
import type { ColumnFiltersState } from "@tanstack/react-table"
import type { EmailThread } from "@/types" // Added new import
import { format } from "date-fns"
import {
	ClockIcon,
	FileTextIcon,
	MailIcon, // Changed from various phone icons
	MessageSquareIcon, // Re-evaluate if transcript is a thing for emails, or use for body
	XIcon
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// Skeleton component for the emails table
function EmailsTableSkeleton() {
	// Renamed from CallsTableSkeleton
	return (
		<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
			<CardContent className="px-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
						<Skeleton className="h-10 w-64" />
						<div className="flex gap-2">
							{/* Fewer filter buttons for emails initially */}
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
					Emails
				</h1>
			</div>
		</div>
	)
}

// Email details component
function EmailDetails({ email }: { email: EmailItem }) {
	// Renamed from CallDetails, param to email
	// const [showFullContent, setShowFullContent] = useState(false); // If email body is long

	return (
		<div className="flex-1 overflow-hidden flex flex-col">
			<div className="p-4 overflow-y-auto h-full">
				{/* Header with email info */}
				<div className="mb-4">
					<div className="flex items-center gap-2 mb-3">
						<div className="rounded-full bg-card p-2 border border-border/40 shadow-sm">
							{/* Generic Mail Icon for Emails */}
							<MailIcon className="h-5 w-5 text-blue-600" />
						</div>
						<div>
							<h2 className="text-xl font-semibold">
								{email.leadName || "Unknown Lead"}
							</h2>
							<div className="text-sm text-muted-foreground">
								{format(
									new Date(email.sentAt),
									"MMMM d, yyyy 'at' h:mm a"
								)}
							</div>
						</div>
					</div>

					{/* Badges - Simplified for email, can add more if needed (e.g. Status: Sent/Received/Draft) */}
					<div className="flex flex-wrap gap-2 mb-2">
						<Badge
							variant="outline"
							className="bg-blue-50 text-blue-800 hover:bg-blue-50 border-blue-200"
						>
							<MailIcon className="h-3.5 w-3.5 mr-1" />
							Email
						</Badge>
						<Badge
							variant="outline"
							className="bg-purple-50 text-purple-800 hover:bg-purple-50 border-purple-200"
						>
							<ClockIcon className="h-3.5 w-3.5 mr-1" />
							{format(new Date(email.sentAt), "h:mm a")}
						</Badge>
					</div>
				</div>

				{/* Main content card for email summary/body */}
				<div className="bg-card/40 backdrop-blur-sm rounded-3xl border border-border/40 shadow-sm overflow-hidden">
					{/* Email Summary / Content */}
					<div className="p-4">
						<div className="flex items-center gap-3 mb-3">
							<div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
								<FileTextIcon className="h-5 w-5 text-amber-800" />
							</div>
							<h3 className="font-medium">Summary</h3>
						</div>
						<div className="bg-background/60 p-3 rounded-xl shadow-sm min-h-[100px]">
							{email.summary || (
								<span className="text-muted-foreground italic">
									No summary available
								</span>
							)}
						</div>
					</div>
					{/* Could add a section for full email body if summary is just a snippet */}
				</div>
			</div>
		</div>
	)
}

// Main Emails Page Client Component
export function EmailsPageClient() {
	// Renamed from CallsPageClient
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()

	const [loading, setLoading] = useState(true)
	const [emailsData, setEmailsData] = useState<EmailItem[]>([]) // Changed from callsData
	const [error, setError] = useState<string | null>(null)
	const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null) // Changed from selectedCall
	const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null) // Added for email thread modal
	const [isMobile, setIsMobile] = useState(false)
	const [searchQuery, setSearchQuery] = useState<string>(
		searchParams.get("search") || ""
	)

	// Handle window resize (copied, adjust rows per page if needed for emails)
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

	// Get the email ID from URL
	const emailIdParam = searchParams.get("emailId") // Changed from callId
	const searchQueryParam = searchParams.get("search")

	// Load email from URL param
	// Handle row click to open thread modal
	const handleRowClick = useCallback(
		async (email: EmailItem) => {
			// Changed from call
			setSelectedEmail(email) // Changed from setSelectedCall
			const params = new URLSearchParams(searchParams.toString())
			params.set("emailId", email.id.toString()) // Changed from callId
			if (searchQuery) {
				params.set("search", searchQuery)
			}
			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
            
			// Load detailed email for modal
			try {
				const emailDetail = await getEmailById(email.id)
				if (emailDetail.success && emailDetail.data) {
					// Create thread from email detail
					const thread: EmailThread = {
						thread_id: `thread_${email.id}`,
						name: email.leadName,
						email: emailDetail.data.leadId ? 'user@example.com' : null, // Placeholder for demo
						messages: [
							{
								content: emailDetail.data.content || emailDetail.data.subject || "No content available",
								role: emailDetail.data.type === "incoming" ? "user" : "assistant",
								timestamp: emailDetail.data.sentAt
							},
							// For demo purposes, add a response if it's an incoming email
							...(emailDetail.data.type === "incoming" ? [{
								content: "Thank you for your email. Your request has been received and our team will process it shortly.",
								role: "assistant",
								timestamp: new Date(new Date(emailDetail.data.sentAt).getTime() + 3600000).toISOString() // 1 hour later
							}] : [])
						]
					}
					setSelectedThread(thread)
				}
			} catch (err) {
				console.error("Error loading email details:", err)
			}
		},
		[searchParams, pathname, router, searchQuery]
	)

	const handleClosePanel = useCallback(() => {
		setSelectedEmail(null) // Changed from setSelectedCall
		setSelectedThread(null) // Clear thread data
		const params = new URLSearchParams(searchParams.toString())
		params.delete("emailId") // Changed from callId
		if (searchQuery) {
			params.set("search", searchQuery)
		}
		router.replace(`${pathname}?${params.toString()}`, { scroll: false })
	}, [searchParams, pathname, router, searchQuery])

	// Load email from URL param if available
	useEffect(() => {
		if (emailIdParam && emailsData.length > 0) {
			const emailId = Number.parseInt(emailIdParam, 10)
			const email = emailsData.find((e) => e.id === emailId)
			if (email) {
				setSelectedEmail(email)
				// Load thread details
				handleRowClick(email)
			}
		}
	}, [emailIdParam, emailsData, handleRowClick])

	useEffect(() => {
		if (searchQueryParam !== null) {
			setSearchQuery(searchQueryParam)
		}
	}, [searchQueryParam])

	// Handle filter changes (simplified as no specific type/status filters yet for emails)
	const handleFilterChange = useCallback(
		(filters: ColumnFiltersState) => {
			const params = new URLSearchParams(searchParams.toString())
			// If specific email filters (like status: sent/received) were added, handle them here.
			// Example:
			// const statusFilter = filters.find((f) => f.id === "status")
			// if (statusFilter?.value && Array.isArray(statusFilter.value) && statusFilter.value.length > 0) {
			// 	params.set("status", statusFilter.value.join(","))
			// } else {
			// 	params.delete("status")
			// }

			if (selectedEmail) {
				params.set("emailId", selectedEmail.id.toString()) // Changed from callId
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
		[searchParams, pathname, router, selectedEmail, searchQuery]
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
			if (selectedEmail) {
				params.set("emailId", selectedEmail.id.toString()) // Changed from callId
			}
			router.replace(`${pathname}?${params.toString()}`, {
				scroll: false
			})
		},
		[searchParams, pathname, router, selectedEmail]
	)

	

	// Fetch emails data
	useEffect(() => {
		async function fetchData() {
			setLoading(true)
			try {
				const result = await getEmails() // Changed from getCalls

				if (result.success && result.data) {
					// Transform data for the emails table
					const transformedData = result.data.map((email) => ({
						id: email.id,
						leadId: email.leadId || null,
						leadName: email.leadName || null,
						sentAt:
							typeof email.sentAt === "string"
								? email.sentAt
								: (email.sentAt as Date).toISOString(), // Cast to Date if not string
						summary: email.summary || null,
						createdAt:
							typeof email.createdAt === "string"
								? email.createdAt
								: (email.createdAt as Date).toISOString(), // Cast to Date
						updatedAt:
							typeof email.updatedAt === "string"
								? email.updatedAt
								: (email.updatedAt as Date).toISOString() // Cast to Date
					}))
					setEmailsData(transformedData as EmailItem[]) // Ensure type assertion
				} else {
					setError(result.error || "Failed to fetch emails data")
				}
			} catch (err) {
				console.error("Error fetching emails:", err)
				setError("An unexpected error occurred")
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-4 p-2 md:px-8 md:py-4 h-full">
				<PageHeader />

				{/* Render the EmailThreadModal when we have thread data */}
				{selectedThread && (
					<EmailThreadModal 
						thread={selectedThread} 
						onClose={handleClosePanel} 
					/>
				)}

				{loading ? (
					<EmailsTableSkeleton />
				) : error ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-10">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full bg-background p-3 border border-border/40 shadow-sm">
									<MailIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									Error Loading Emails
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									{error}
								</p>
							</div>
						</CardContent>
					</Card>
				) : emailsData.length === 0 ? (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
						<CardContent className="py-12">
							<div className="flex flex-col items-center justify-center text-center">
								<div className="rounded-full p-3 border border-border/40 shadow-sm">
									<MailIcon className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mt-4 text-lg font-medium">
									No Emails Yet
								</h3>
								<p className="mt-2 text-sm text-muted-foreground max-w-xs">
									No emails have been processed or sent yet.
									As emails are handled, they will appear
									here.
								</p>
							</div>
						</CardContent>
					</Card>
				) : (
					<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm flex-1 flex flex-col overflow-hidden">
						<CardContent className="px-6 pb-3 h-full flex flex-col overflow-hidden">
							<div className="flex h-full overflow-hidden">
								<div className="w-full flex flex-col overflow-hidden">
									<div className="custom-emails-table flex-1 flex flex-col overflow-y-auto">
										<EmailsTable
											data={emailsData}
											// initialColumnFilters={initialColumnFilters} // Removed for now
											onRowClick={handleRowClick}
											selectedEmailId={
												selectedEmail?.id
											} // Changed from selectedCallId
											searchQuery={searchQuery}
											onSearchChange={
												handleSearchChange
											}
										/>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	)
}
