"use server"

import { db_ws } from "@/db"
import { chatMessages, chats, leads } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { type SQL, and, asc, desc, eq, gte, lte, sql } from "drizzle-orm"

// Define the chat filter interface
export interface ChatFilter {
	search?: string
	startDate?: Date
	endDate?: Date
	orderBy?: string
	orderDir?: "asc" | "desc"
}

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

		const processedData = chatsData.map((c) => ({
			...c,
			timestamp: c.timestamp.toISOString(),
			createdAt: c.createdAt?.toISOString(),
			updatedAt: c.updatedAt?.toISOString()
		}))
		return { data: processedData, success: true, error: null }
	} catch (error) {
		console.error("Error getting chats:", error)
		return { error: "Failed to get chats", success: false, data: null }
	}
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

		const finalMessages: ChatMessageOutput[] = messagesData.map((msg) => ({
			...msg,
			timestamp: (msg.timestamp as Date).toISOString(),
			role: msg.role as "assistant" | "user"
		}))

		const formattedDbChat = {
			...dbChat,
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
		return {
			success: false,
			error: "Failed to retrieve chat details",
			data: null
		}
	}
}
