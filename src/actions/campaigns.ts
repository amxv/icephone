"use server"

// Placeholder for campaign data fetching
// Replace with actual database queries and error handling
export async function getCampaigns() {
	try {
		// Simulate a delay
		await new Promise((resolve) => setTimeout(resolve, 500))

		// Placeholder data - replace with actual data from your DB
		const campaigns = [
			{
				id: 1,
				name: "Summer Sale Outreach",
				status: "running",
				leadsCount: 150,
				leadsConverted: 10,
				updatedAt: new Date().toISOString()
			},
			{
				id: 2,
				name: "New Product Launch",
				status: "completed",
				leadsCount: 200,
				leadsConverted: 35,
				updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
			},
			{
				id: 3,
				name: "Q4 Follow-ups",
				status: "paused",
				leadsCount: 80,
				leadsConverted: 5,
				updatedAt: new Date(Date.now() - 86400000 * 5).toISOString()
			},
			{
				id: 4,
				name: "Win-back Campaign",
				status: "draft",
				leadsCount: 0,
				leadsConverted: 0,
				updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
			},
			{
				id: 5,
				name: "High Value Prospects",
				status: "running",
				leadsCount: 50,
				leadsConverted: 2,
				updatedAt: new Date().toISOString()
			}
		]

		return { success: true, data: campaigns }
	} catch (error) {
		console.error("Error fetching campaigns:", error)
		return { success: false, error: "Failed to fetch campaigns" }
	}
}
