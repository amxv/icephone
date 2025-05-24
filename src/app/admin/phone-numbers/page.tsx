import { Suspense } from "react"

import { AdminPhoneNumbersClient } from "./AdminPhoneNumbersClient"
import {
	getAllPhoneNumbers,
	getPhoneNumberStats
} from "@/actions/admin-phone-numbers"

// Database version that allows nullable fields from Drizzle
type DatabasePhoneNumber = {
	id: number
	number: string
	friendlyName: string
	type: "inbound" | "outbound" | "both"
	status: "active" | "inactive" | "pending" | "suspended" | null
	isDefault: boolean | null
	provider: string | null
	providerSid: string | null
	userId: string
	capabilities: {
		voice: boolean
		sms: boolean
		mms: boolean
		fax: boolean
	} | null
	configuration: Record<string, unknown> | null
	costPerMinute: string | null
	createdAt: Date
	updatedAt: Date
}

export default async function AdminPhoneNumbersPage() {
	// Fetch initial data in parallel
	const [phoneNumbers, stats] = await Promise.all([
		getAllPhoneNumbers(),
		getPhoneNumberStats()
	])

	return (
		<div className="container h-[calc(100vh-5rem)]">
			<div className="flex flex-col gap-6 p-2 md:px-8 md:py-4 h-full">
				{/* Page Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-4xl lg:text-3xl font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-neutral-700 pb-2 pt-4">
							Phone Numbers
						</h1>
						<p className="text-muted-foreground">
							Manage phone numbers across all users and integrate
							with Vapi
						</p>
					</div>
				</div>

				{/* Phone Numbers Management Interface */}
				<Suspense
					fallback={
						<div className="flex-1 flex items-center justify-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						</div>
					}
				>
					<AdminPhoneNumbersClient
						initialPhoneNumbers={
							phoneNumbers as DatabasePhoneNumber[]
						}
						initialStats={stats}
					/>
				</Suspense>
			</div>
		</div>
	)
}
