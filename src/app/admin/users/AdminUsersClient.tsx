"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
	Users,
	UserCheck,
	UserX,
	Search,
	MoreHorizontal,
	Mail,
	Shield,
	Eye,
	Ban,
	CheckCircle
} from "lucide-react"
import { updateUserStatus } from "@/actions/admin-users"
import { toast } from "sonner"

// Types from server actions
interface PlatformUser {
	id: string
	email: string | null
	firstName: string | null
	lastName: string | null
	imageUrl: string | null
	createdAt: number
	lastSignInAt: number | null
	leadsCount: number
	callsCount: number
	voiceAgentsCount: number
	phoneNumbersCount: number
	appointmentsCount: number
	campaignsCount: number
	lastActivityAt: Date | string | null
	isActive: boolean
}

interface UserStats {
	totalUsers: number
	activeUsers: number
	newUsersThisMonth: number
}

interface AdminUsersClientProps {
	initialUsers: PlatformUser[]
	initialStats: UserStats
}

export function AdminUsersClient({
	initialUsers,
	initialStats
}: AdminUsersClientProps) {
	const [searchQuery, setSearchQuery] = useState("")
	const [users, setUsers] = useState(initialUsers)
	const [isPending, startTransition] = useTransition()

	// Calculate derived stats
	const stats = {
		totalUsers: initialStats.totalUsers,
		activeUsers: initialStats.activeUsers,
		inactiveUsers: initialStats.totalUsers - initialStats.activeUsers,
		newUsersThisMonth: initialStats.newUsersThisMonth
	}

	const filteredUsers = users.filter((user) => {
		const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim()
		const userEmail = user.email || ""
		return (
			userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			userEmail.toLowerCase().includes(searchQuery.toLowerCase())
		)
	})

	const handleUpdateUserStatus = async (
		userId: string,
		status: "active" | "banned"
	) => {
		startTransition(async () => {
			try {
				await updateUserStatus(userId, status)

				// Update local state
				setUsers((prevUsers) =>
					prevUsers.map((user) =>
						user.id === userId
							? { ...user, isActive: status === "active" }
							: user
					)
				)

				toast.success(
					`User ${status === "banned" ? "banned" : "activated"} successfully`
				)
			} catch (error) {
				toast.error(
					`Failed to ${status === "banned" ? "ban" : "activate"} user`
				)
			}
		})
	}

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString()
	}

	const formatRelativeDate = (date: Date | string | null) => {
		if (!date) return "Never"

		// Convert to Date object if it's a string
		const dateObj = typeof date === "string" ? new Date(date) : date

		// Check if the date is valid
		if (Number.isNaN(dateObj.getTime())) return "Invalid date"

		const now = new Date()
		const diffMs = now.getTime() - dateObj.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) return "Today"
		if (diffDays === 1) return "Yesterday"
		if (diffDays < 7) return `${diffDays} days ago`
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
		return `${Math.floor(diffDays / 30)} months ago`
	}

	const StatusBadge = ({ isActive }: { isActive: boolean }) => {
		return (
			<Badge
				className={`px-3 py-1 ${
					isActive
						? "bg-green-100 text-green-800 hover:bg-green-100"
						: "bg-red-100 text-red-800 hover:bg-red-100"
				}`}
			>
				{isActive ? "Active" : "Inactive"}
			</Badge>
		)
	}

	const getInitials = (firstName: string | null, lastName: string | null) => {
		if (firstName && lastName) {
			return `${firstName.charAt(0)}${lastName.charAt(0)}`
		}
		if (firstName) return firstName.charAt(0)
		if (lastName) return lastName.charAt(0)
		return "U"
	}

	const getDisplayName = (
		firstName: string | null,
		lastName: string | null
	) => {
		if (firstName && lastName) {
			return `${firstName} ${lastName}`
		}
		if (firstName) return firstName
		if (lastName) return lastName
		return "Unknown User"
	}

	return (
		<div className="space-y-6">
			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<Users className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium text-muted-foreground">
								Total Users
							</span>
						</div>
						<div className="text-2xl font-bold mt-2">
							{stats.totalUsers}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							All registered users
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<UserCheck className="h-4 w-4 text-green-500" />
							<span className="text-sm font-medium text-muted-foreground">
								Active Users
							</span>
						</div>
						<div className="text-2xl font-bold mt-2 text-green-600">
							{stats.activeUsers}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Recently active
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<UserX className="h-4 w-4 text-red-500" />
							<span className="text-sm font-medium text-muted-foreground">
								Inactive Users
							</span>
						</div>
						<div className="text-2xl font-bold mt-2 text-red-600">
							{stats.inactiveUsers}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Not recently active
						</p>
					</CardContent>
				</Card>

				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="p-6">
						<div className="flex items-center gap-2">
							<Shield className="h-4 w-4 text-purple-500" />
							<span className="text-sm font-medium text-muted-foreground">
								New This Month
							</span>
						</div>
						<div className="text-2xl font-bold mt-2 text-purple-600">
							{stats.newUsersThisMonth}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							New registrations
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Search and Filters */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-6">
					<div className="flex items-center gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
							<Input
								placeholder="Search users by name or email..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10 bg-background/50"
							/>
						</div>
						<Button variant="outline" className="gap-2">
							<Mail className="h-4 w-4" />
							Export Users
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Users Table */}
			<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
				<CardContent className="p-6">
					<div className="flex items-center justify-between mb-6">
						<h3 className="text-lg font-medium">Platform Users</h3>
						<div className="text-sm text-muted-foreground">
							{filteredUsers.length} of {users.length} users
						</div>
					</div>

					<div className="rounded-2xl border border-border overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead>User</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Activity</TableHead>
									<TableHead>Joined</TableHead>
									<TableHead>Last Activity</TableHead>
									<TableHead className="text-right">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredUsers.map((user) => (
									<TableRow key={user.id}>
										<TableCell>
											<div className="flex items-center gap-3">
												<div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
													{getInitials(
														user.firstName,
														user.lastName
													)}
												</div>
												<div>
													<div className="font-medium">
														{getDisplayName(
															user.firstName,
															user.lastName
														)}
													</div>
													<div className="text-sm text-muted-foreground">
														{user.email ||
															"No email"}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<StatusBadge
												isActive={user.isActive}
											/>
										</TableCell>
										<TableCell>
											<div className="text-sm">
												<div>
													{user.leadsCount} leads
												</div>
												<div className="text-muted-foreground">
													{user.callsCount} calls,{" "}
													{user.voiceAgentsCount}{" "}
													agents
												</div>
											</div>
										</TableCell>
										<TableCell>
											<div className="text-sm">
												{formatDate(user.createdAt)}
											</div>
										</TableCell>
										<TableCell>
											<div className="text-sm">
												{formatRelativeDate(
													user.lastActivityAt
												)}
											</div>
										</TableCell>
										<TableCell className="text-right">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														disabled={isPending}
													>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem>
														<Eye className="mr-2 h-4 w-4" />
														View Details
													</DropdownMenuItem>
													<DropdownMenuItem>
														<Mail className="mr-2 h-4 w-4" />
														Send Email
													</DropdownMenuItem>
													{user.isActive ? (
														<DropdownMenuItem
															className="text-red-600"
															onClick={() =>
																handleUpdateUserStatus(
																	user.id,
																	"banned"
																)
															}
														>
															<Ban className="mr-2 h-4 w-4" />
															Ban User
														</DropdownMenuItem>
													) : (
														<DropdownMenuItem
															className="text-green-600"
															onClick={() =>
																handleUpdateUserStatus(
																	user.id,
																	"active"
																)
															}
														>
															<CheckCircle className="mr-2 h-4 w-4" />
															Activate User
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					{filteredUsers.length === 0 && (
						<div className="text-center py-8">
							<Users className="mx-auto h-12 w-12 text-muted-foreground" />
							<h3 className="mt-4 text-lg font-medium">
								No users found
							</h3>
							<p className="mt-2 text-muted-foreground">
								Try adjusting your search criteria.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
