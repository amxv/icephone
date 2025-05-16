"use server"

import { db_ws } from "@/db"
import { chatMessages, chats, leads } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { type SQL, and, asc, desc, eq, gte, lte, sql } from "drizzle-orm"

// Define types for filtering
type ChatFilter = {
	search?: string
	startDate?: Date
	endDate?: Date
	orderBy?: string
	orderDir?: "asc" | "desc"
}

// Define a type for mock chat entries
type MockChatEntry = {
	id: number
	leadId: number | null
	summary: string | null
	timestamp: Date
	userId: string
	leadName: string | null
	createdAt?: Date
	updatedAt?: Date
}

// Mock data for development and demonstration
const MOCK_CHATS: MockChatEntry[] = [
	{
		id: 1,
		leadId: 1,
		summary:
			"Discussed project requirements and timelines for implementation.",
		timestamp: new Date("2023-06-01T10:30:00"),
		userId: "user_123",
		leadName: "Ashray"
	},
	{
		id: 2,
		leadId: 2,
		summary:
			"Explored pricing options and subscription plans for enterprise usage.",
		timestamp: new Date("2023-06-03T14:45:00"),
		userId: "user_123",
		leadName: "Sarah Johnson"
	},
	{
		id: 3,
		leadId: 3,
		summary:
			"Demo scheduled for next week, client requested feature documentation.",
		timestamp: new Date("2023-06-04T09:15:00"),
		userId: "user_123",
		leadName: "Michael Torres"
	}
]

// Get all chats with optional filtering
export async function getChats(filter: ChatFilter = {}) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { error: "Unauthorized", success: false, data: null }
		}

		const whereConditions: SQL[] = [eq(chats.userId, userId)]

		if (filter.search) {
			const searchPattern = `%${filter.search}%`
			whereConditions.push(sql`(${chats.summary} ILIKE ${searchPattern})`)
		}
		if (filter.startDate) {
			whereConditions.push(gte(chats.timestamp, filter.startDate))
		}
		if (filter.endDate) {
			whereConditions.push(lte(chats.timestamp, filter.endDate))
		}

		const condition = and(...whereConditions)

		const chatsData = await db_ws
			.select({
				id: chats.id,
				leadId: chats.leadId,
				leadName: leads.name,
				summary: chats.summary,
				timestamp: chats.timestamp,
				createdAt: chats.createdAt,
				updatedAt: chats.updatedAt
			})
			.from(chats)
			.leftJoin(leads, eq(chats.leadId, leads.id))
			.where(condition)
			.orderBy(desc(chats.timestamp))

		if (chatsData.length === 0) {
			const processedMockData = MOCK_CHATS.map((c: MockChatEntry) => ({
				...c,
				timestamp: c.timestamp.toISOString(),
				createdAt: c.createdAt?.toISOString(),
				updatedAt: c.updatedAt?.toISOString()
			}))
			return { data: processedMockData, success: true, error: null }
		}

		const processedData = chatsData.map((c) => ({
			...c,
			// Assuming c.timestamp, c.createdAt, c.updatedAt from db_ws.select are Date objects or null
			timestamp: c.timestamp.toISOString(),
			createdAt: c.createdAt?.toISOString(),
			updatedAt: c.updatedAt?.toISOString()
		}))
		return { data: processedData, success: true, error: null }
	} catch (error) {
		console.error("Error getting chats:", error)
		if (
			error instanceof Error &&
			error.message.includes('relation "chats" does not exist')
		) {
			console.warn("Chats table not found, returning mock data.")
			const processedMockData = MOCK_CHATS.map((c: MockChatEntry) => ({
				...c,
				timestamp: c.timestamp.toISOString(),
				createdAt: c.createdAt?.toISOString(),
				updatedAt: c.updatedAt?.toISOString()
			}))
			return {
				data: processedMockData,
				success: true,
				error: "Chats table not found, using mock data."
			}
		}
		return { error: "Failed to get chats", success: false, data: null }
	}
}

// Helper function to generate mock chat messages
// generateMockMessages timestamps are already ISO strings.
function generateMockMessages(chatId: number) {
	const messages = []
	messages.push({
		id: 1,
		chatId,
		content: "Hello! How can I assist you today?",
		role: "assistant" as const,
		timestamp: new Date(Date.now() - 15 * 60000).toISOString()
	})
	if (chatId === 1) {
		messages.push({
			id: 2,
			chatId,
			content:
				"I need to discuss project requirements for our implementation.",
			role: "user" as const,
			timestamp: new Date(Date.now() - 10 * 60000).toISOString()
		})
		messages.push({
			id: 3,
			chatId,
			content:
				"I'd be happy to discuss that! Here are the key areas we should cover:\n\n## Project Requirements\n\n* **Timeline**: When do you want to launch?\n* **Features**: Which of the following are priorities?\n  - Voice automation\n  - CRM integration\n  - Analytics dashboard\n* **User Access**: How many team members need access?\n\nCould you provide details on these points?",
			role: "assistant" as const,
			timestamp: new Date(Date.now() - 5 * 60000).toISOString()
		})
	} else if (chatId === 2) {
		messages.push({
			id: 2,
			chatId,
			content: "What are your pricing options for enterprise use?",
			role: "user" as const,
			timestamp: new Date(Date.now() - 10 * 60000).toISOString()
		})
		messages.push({
			id: 3,
			chatId,
			content:
				"Our enterprise pricing is tailored to your organization's needs. Here's an overview:\n\n### Enterprise Plan Options\n\nFeature | Standard | Premium | Ultimate\n--- | --- | --- | ---\nUser seats | 25 | 100 | Unlimited\nStorage | 500GB | 2TB | 10TB\nSupport | 24/5 | 24/7 | 24/7 Priority\n\nWould you like to schedule a call with our enterprise team for a **custom quote**?",
			role: "assistant" as const,
			timestamp: new Date(Date.now() - 5 * 60000).toISOString()
		})
	} else {
		messages.push({
			id: 2,
			chatId,
			content: "I'm interested in scheduling a demo next week.",
			role: "user" as const,
			timestamp: new Date(Date.now() - 10 * 60000).toISOString()
		})
		messages.push({
			id: 3,
			chatId,
			content:
				"Great! I'd be happy to set up a demo for you next week. Here are some available slots:\n\n- **Monday**: 10am - 12pm EST\n- **Tuesday**: 2pm - 4pm EST\n- **Thursday**: 11am - 3pm EST\n\n_The demo typically takes 45 minutes and includes:_\n\n1. Overview of key features\n2. Live demonstration\n3. Q&A session\n\nWhich time works best for you?",
			role: "assistant" as const,
			timestamp: new Date(Date.now() - 5 * 60000).toISOString()
		})
		messages.push({
			id: 4,
			chatId,
			content:
				"Thursday at 2pm works for me. Can you also send over the feature documentation beforehand?",
			role: "user" as const,
			timestamp: new Date(Date.now() - 2 * 60000).toISOString()
		})
	}
	return messages
}

// Get a single chat by ID with messages
export async function getChatById(chatId: number) {
	try {
		const { userId } = await auth()
		if (!userId) {
			return { success: false, error: "Unauthorized", data: null }
		}

		const chatResult = await db_ws
			.select({
				id: chats.id,
				leadId: chats.leadId,
				leadName: leads.name,
				summary: chats.summary,
				timestamp: chats.timestamp,
				createdAt: chats.createdAt,
				updatedAt: chats.updatedAt,
				userId: chats.userId
			})
			.from(chats)
			.leftJoin(leads, eq(chats.leadId, leads.id))
			.where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
			.limit(1)

		if (!chatResult || chatResult.length === 0) {
			const mockChat = MOCK_CHATS.find(
				(c: MockChatEntry) => c.id === chatId
			)
			if (mockChat) {
				const mockMessages = generateMockMessages(mockChat.id)
				const formattedMockChat = {
					...mockChat,
					timestamp: mockChat.timestamp.toISOString(),
					createdAt: mockChat.createdAt?.toISOString(),
					updatedAt: mockChat.updatedAt?.toISOString(),
					messages: mockMessages
				}
				return {
					success: true,
					data: formattedMockChat,
					error: "Chat not found in DB, using mock data."
				}
			}
			return { success: false, error: "Chat not found", data: null }
		}

		const dbChat = chatResult[0]

		const messagesData = await db_ws
			.select({
				id: chatMessages.id,
				chatId: chatMessages.chatId,
				content: chatMessages.content,
				role: chatMessages.role,
				timestamp: chatMessages.timestamp
			})
			.from(chatMessages)
			.where(
				and(
					eq(chatMessages.chatId, chatId),
					eq(chatMessages.userId, userId)
				)
			)
			.orderBy(asc(chatMessages.timestamp))

		type ChatMessageOutput = {
			id: number
			chatId: number
			content: string
			role: "user" | "assistant"
			timestamp: string
		}
		let finalMessages: ChatMessageOutput[]
		if (messagesData.length === 0 && dbChat.id) {
			finalMessages = generateMockMessages(dbChat.id)
		} else {
			finalMessages = messagesData.map((msg) => ({
				...msg,
				timestamp: (msg.timestamp as Date).toISOString(),
				role: msg.role as "assistant" | "user"
			}))
		}

		const formattedDbChat = {
			...dbChat,
			// Assuming dbChat.timestamp, .createdAt, .updatedAt from DB are Date objects or null
			timestamp: dbChat.timestamp.toISOString(),
			createdAt: dbChat.createdAt?.toISOString(),
			updatedAt: dbChat.updatedAt?.toISOString(),
			messages: finalMessages
		}

		return {
			success: true,
			data: formattedDbChat,
			error: null
		}
	} catch (error) {
		console.error("Error getting chat details:", error)
		if (
			error instanceof Error &&
			error.message.includes('relation "chats" does not exist')
		) {
			console.warn(
				`Chat table not found when trying to get chat by ID: ${chatId}`
			)
			const mockChat = MOCK_CHATS.find(
				(c: MockChatEntry) => c.id === chatId
			)
			if (mockChat) {
				const mockMessages = generateMockMessages(mockChat.id)
				const formattedMockChatFallback = {
					...mockChat,
					timestamp: mockChat.timestamp.toISOString(),
					createdAt: mockChat.createdAt?.toISOString(),
					updatedAt: mockChat.updatedAt?.toISOString(),
					messages: mockMessages
				}
				return {
					success: true,
					data: formattedMockChatFallback,
					error: "Chat table not found, using mock data."
				}
			}
		}
		return {
			success: false,
			error: "Failed to retrieve chat details",
			data: null
		}
	}
}
