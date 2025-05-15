import { COLORS } from "@/lib/calendar/constants"
import type { IEvent, IUser } from "@/lib/calendar/interfaces"

export const USERS_MOCK: IUser[] = [
	{
		id: "f3b035ac-49f7-4e92-a715-35680bf63175",
		name: "Michael Doe",
		picturePath: null
	},
	{
		id: "3e36ea6e-78f3-40dd-ab8c-a6c737c3c422",
		name: "Alice Johnson",
		picturePath: null
	},
	{
		id: "a7aff6bd-a50a-4d6a-ab57-76f76bb27cf5",
		name: "Robert Smith",
		picturePath: null
	},
	{
		id: "dd503cf9-6c38-43cf-94cc-0d4032e2f77a",
		name: "Emily Davis",
		picturePath: null
	}
]

// Sales call events for today (May 15, 2025)

// Helper function to create a specific date time for May 15, 2025
const createMay15Date = (hour: number, minute = 0) => {
	const date = new Date(2025, 4, 15, hour, minute)
	return date
}

// Create sales call events for today
export const CALENDAR_ITEMS_MOCK: IEvent[] = [
	{
		id: 1,
		startDate: createMay15Date(9, 0).toISOString(),
		endDate: createMay15Date(10, 0).toISOString(),
		title: "Sales Call with XYZ Corp",
		color: "blue",
		description:
			"Initial sales discussion about our AI-powered voice agents with potential client XYZ Corp.",
		user: USERS_MOCK[0] // Michael Doe
	},
	{
		id: 2,
		startDate: createMay15Date(11, 30).toISOString(),
		endDate: createMay15Date(12, 30).toISOString(),
		title: "Follow-up Call with Acme Inc",
		color: "green",
		description:
			"Follow-up discussion regarding the proposal sent last week.",
		user: USERS_MOCK[1] // Alice Johnson
	},
	{
		id: 3,
		startDate: createMay15Date(14, 0).toISOString(),
		endDate: createMay15Date(14, 45).toISOString(),
		title: "Demo Call with TechStart",
		color: "purple",
		description: "Product demonstration for TechStart's leadership team.",
		user: USERS_MOCK[0] // Michael Doe
	},
	{
		id: 4,
		startDate: createMay15Date(15, 30).toISOString(),
		endDate: createMay15Date(16, 15).toISOString(),
		title: "Prospecting Call - Financial Sector",
		color: "orange",
		description: "Cold calling potential clients in the financial sector.",
		user: USERS_MOCK[2] // Robert Smith
	},
	{
		id: 5,
		startDate: createMay15Date(17, 0).toISOString(),
		endDate: createMay15Date(17, 30).toISOString(),
		title: "Contract Negotiation with Global Partners",
		color: "red",
		description:
			"Final discussion about contract terms with Global Partners.",
		user: USERS_MOCK[3] // Emily Davis
	}
]
