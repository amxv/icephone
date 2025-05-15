"use client"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSettings } from "@/contexts/settings-context"
import { InfoIcon } from "lucide-react"

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
	const { tableRowsPerPage, setTableRowsPerPage } = useSettings()

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

											{/* Placeholder for future table settings */}
											<div className="flex items-center justify-between gap-4 opacity-50">
												<div className="space-y-1">
													<h3 className="text-sm font-medium leading-none">
														Dense mode
													</h3>
													<p className="text-xs text-muted-foreground">
														Compact table rows for
														higher data density
													</p>
												</div>
												<div className="text-xs text-muted-foreground">
													Coming soon
												</div>
											</div>
										</div>
									</div>

									<div className="flex items-center bg-primary/5 border border-primary/20 rounded-lg p-3 mt-8">
										<div className="bg-primary/10 p-2 rounded-md mr-3">
											<InfoIcon className="size-4 text-primary" />
										</div>
										<p className="text-xs text-muted-foreground">
											These settings apply to all tables
											throughout the application. More
											table customization options coming
											soon.
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent
								value="account"
								className="space-y-4 pt-4"
							>
								<div>
									<CardTitle>Account Settings</CardTitle>
									<CardDescription>
										Manage your account settings and
										preferences.
									</CardDescription>
									<div className="mt-4">
										<p className="text-sm text-muted-foreground">
											Account settings will be available
											soon.
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent
								value="notifications"
								className="space-y-4 pt-4"
							>
								<div>
									<CardTitle>Notification Settings</CardTitle>
									<CardDescription>
										Configure how you receive notifications.
									</CardDescription>
									<div className="mt-4">
										<p className="text-sm text-muted-foreground">
											Notification settings will be
											available soon.
										</p>
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
