import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Emails | IcePhone",
	description: "View and manage email records"
}

import { EmailsPageClient } from "@/components/emails-page-client"

export default function EmailsPage() {
	return <EmailsPageClient />
}
