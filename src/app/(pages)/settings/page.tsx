"use client"

import { authClient } from "@/lib/auth-client"
import { useAuthUser } from "@/lib/auth/use-auth-user"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSettings } from "@/contexts/settings-context"
import { BellIcon, InfoIcon, LogOutIcon, MailIcon, UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Settings page header component
function PageHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
					Settings
				</h1>
			</div>
		</div>
	)
}

export default function SettingsPage() {
	const router = useRouter()
	const { user, isLoading: isUserLoading, isAuthenticated } = useAuthUser()
	const [isSigningOut, setIsSigningOut] = useState(false)
	const {
		tableRowsPerPage,
		setTableRowsPerPage,
		tableDenseMode,
		setTableDenseMode,
		emailNotificationsEnabled,
		setEmailNotificationsEnabled,
		inAppNotificationsEnabled,
		setInAppNotificationsEnabled,
		weeklyDigestEnabled,
		setWeeklyDigestEnabled
	} = useSettings()

	const handleSignOut = async () => {
		setIsSigningOut(true)
		try {
			await authClient.signOut()
			router.push("/sign-in")
		} catch (error) {
			console.error("Failed to sign out", error)
		} finally {
			setIsSigningOut(false)
		}
	}

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-8 p-2 md:px-8 md:py-4 h-full">
				<PageHeader />
				<Card className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm shadow-sm">
					<CardContent className="px-6 py-2">
						<Tabs defaultValue="display" className="space-y-12">
							<div className="flex justify-center w-full">
								<TabsList className="rounded-full bg-muted/80 shadow-inner">
									<TabsTrigger
										value="display"
										className="px-8  text-base font-medium rounded-full"
									>
										Display
									</TabsTrigger>
									<TabsTrigger
										value="account"
										className="px-8 text-base font-medium rounded-full"
									>
										Account
									</TabsTrigger>
									<TabsTrigger
										value="notifications"
										className="px-8 text-base font-medium rounded-full"
									>
										Notifications
									</TabsTrigger>
								</TabsList>
							</div>

							<TabsContent
								value="display"
								className="space-y-4 pt-4"
							>
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Table Settings
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Configure how tables are
												displayed throughout the
												application.
											</CardDescription>
										</div>
									</div>

									<div className="bg-muted/40 p-6 rounded-xl border border-border/50 shadow-sm">
										<div className="space-y-8">
											<div>
												<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
													<div className="space-y-1">
														<h3 className="text-sm font-medium leading-none">
															Rows per page
														</h3>
														<p className="text-xs text-muted-foreground">
															Number of rows to
															display in each
															table page
														</p>
													</div>
													<Select
														value={tableRowsPerPage.toString()}
														onValueChange={(
															value
														) =>
															setTableRowsPerPage(
																Number(value)
															)
														}
													>
														<SelectTrigger
															id="rows-per-page"
															aria-label="Select rows per page"
															className="w-40"
														>
															<SelectValue placeholder="Select rows" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="5">
																5 rows
															</SelectItem>
															<SelectItem value="10">
																10 rows
															</SelectItem>
															<SelectItem value="20">
																20 rows
															</SelectItem>
															<SelectItem value="50">
																50 rows
															</SelectItem>
															<SelectItem value="100">
																100 rows
															</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>

											<div className="flex items-center justify-between gap-4">
												<div className="space-y-1">
													<h3 className="text-sm font-medium leading-none">
														Dense mode
													</h3>
													<p className="text-xs text-muted-foreground">
														Compact table rows for
														higher data density
													</p>
												</div>
												<Switch
													checked={tableDenseMode}
													onCheckedChange={
														setTableDenseMode
													}
													aria-label="Enable dense table mode"
												/>
											</div>
										</div>
									</div>

									<div className="flex items-center bg-primary/5 border border-primary/20 rounded-lg p-3 mt-8">
										<div className="bg-primary/10 p-2 rounded-md mr-3">
											<InfoIcon className="size-4 text-primary" />
										</div>
										<p className="text-xs text-muted-foreground">
											These settings apply to all tables
											throughout the application.
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent
								value="account"
								className="space-y-4 pt-4"
							>
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Account Settings
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Review your active account and
												session controls.
											</CardDescription>
										</div>
									</div>

									<div className="bg-muted/40 p-6 rounded-xl border border-border/50 shadow-sm">
										{isUserLoading ? (
											<p className="text-sm text-muted-foreground">
												Loading account information...
											</p>
										) : isAuthenticated && user ? (
											<div className="space-y-4">
												<div className="flex items-center justify-between gap-4">
													<div className="space-y-1">
														<div className="flex items-center gap-2 text-sm font-medium">
															<UserIcon className="size-4 text-muted-foreground" />
															Name
														</div>
														<p className="text-sm text-muted-foreground">
															{user.name ||
																"Not set"}
														</p>
													</div>
												</div>
												<Separator />
												<div className="flex items-center justify-between gap-4">
													<div className="space-y-1">
														<div className="flex items-center gap-2 text-sm font-medium">
															<MailIcon className="size-4 text-muted-foreground" />
															Email
														</div>
														<p className="text-sm text-muted-foreground">
															{user.email}
														</p>
													</div>
												</div>
												<Separator />
												<div className="flex items-center justify-between gap-4">
													<div className="space-y-1">
														<h3 className="text-sm font-medium leading-none">
															Current Session
														</h3>
														<p className="text-xs text-muted-foreground">
															Sign out of this
															session on this
															device.
														</p>
													</div>
													<Button
														variant="outline"
														className="rounded-xl"
														onClick={handleSignOut}
														disabled={isSigningOut}
													>
														<LogOutIcon className="mr-2 size-4" />
														{isSigningOut
															? "Signing out..."
															: "Sign out"}
													</Button>
												</div>
											</div>
										) : (
											<p className="text-sm text-muted-foreground">
												No authenticated session was
												found.
											</p>
										)}
									</div>
								</div>
							</TabsContent>

							<TabsContent
								value="notifications"
								className="space-y-4 pt-4"
							>
								<div className="space-y-6">
									<div className="flex items-center gap-2">
										<div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
										<div>
											<CardTitle className="text-xl">
												Notification Settings
											</CardTitle>
											<CardDescription className="text-sm text-muted-foreground mt-1">
												Choose how updates are surfaced
												in your workspace.
											</CardDescription>
										</div>
									</div>

									<div className="bg-muted/40 p-6 rounded-xl border border-border/50 shadow-sm space-y-6">
										<div className="flex items-center justify-between gap-4">
											<div className="space-y-1">
												<h3 className="text-sm font-medium leading-none">
													Email notifications
												</h3>
												<p className="text-xs text-muted-foreground">
													Receive summaries and alerts
													through email.
												</p>
											</div>
											<Switch
												checked={
													emailNotificationsEnabled
												}
												onCheckedChange={
													setEmailNotificationsEnabled
												}
												aria-label="Toggle email notifications"
											/>
										</div>
										<Separator />
										<div className="flex items-center justify-between gap-4">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<BellIcon className="size-4 text-muted-foreground" />
													<h3 className="text-sm font-medium leading-none">
														In-app notifications
													</h3>
												</div>
												<p className="text-xs text-muted-foreground">
													Show operational updates in
													the app interface.
												</p>
											</div>
											<Switch
												checked={
													inAppNotificationsEnabled
												}
												onCheckedChange={
													setInAppNotificationsEnabled
												}
												aria-label="Toggle in-app notifications"
											/>
										</div>
										<Separator />
										<div className="flex items-center justify-between gap-4">
											<div className="space-y-1">
												<h3 className="text-sm font-medium leading-none">
													Weekly digest
												</h3>
												<p className="text-xs text-muted-foreground">
													Receive a weekly summary of
													calls, outcomes, and trends.
												</p>
											</div>
											<Switch
												checked={weeklyDigestEnabled}
												onCheckedChange={
													setWeeklyDigestEnabled
												}
												aria-label="Toggle weekly digest notifications"
											/>
										</div>
									</div>
								</div>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
