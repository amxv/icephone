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

export default function SettingsPage() {
	const { tableRowsPerPage, setTableRowsPerPage } = useSettings()

	return (
		<div className="container mx-auto py-10">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Settings
					</h1>
					<p className="text-muted-foreground">
						Manage your application preferences and settings.
					</p>
				</div>
				<Separator />
				<Tabs defaultValue="display" className="space-y-4">
					<TabsList>
						<TabsTrigger value="display">Display</TabsTrigger>
						<TabsTrigger value="account">Account</TabsTrigger>
						<TabsTrigger value="notifications">
							Notifications
						</TabsTrigger>
					</TabsList>

					<TabsContent value="display" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Table Settings</CardTitle>
								<CardDescription>
									Configure how tables are displayed
									throughout the application.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-2">
									<div className="grid gap-2">
										<div className="grid grid-cols-2 items-center gap-4">
											<label
												htmlFor="rows-per-page"
												className="text-sm font-medium leading-none"
											>
												Rows per page
											</label>
											<Select
												value={tableRowsPerPage.toString()}
												onValueChange={(value) =>
													setTableRowsPerPage(
														Number(value)
													)
												}
											>
												<SelectTrigger
													id="rows-per-page"
													aria-label="Select rows per page"
												>
													<SelectValue placeholder="Select rows per page" />
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
									<p className="text-xs text-muted-foreground">
										This setting applies to all tables in
										the application.
									</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="account" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Account Settings</CardTitle>
								<CardDescription>
									Manage your account settings and
									preferences.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Account settings will be available soon.
								</p>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="notifications" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Notification Settings</CardTitle>
								<CardDescription>
									Configure how you receive notifications.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Notification settings will be available
									soon.
								</p>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	)
}
