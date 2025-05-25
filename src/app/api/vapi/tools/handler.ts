import { type NextRequest } from "next/server"
import { TOOL_RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit"
import { withTimeout } from "@/lib/vapi-security"
import {
	logToolCall,
	getUserContextFromCall,
	getSessionIdFromCall
} from "./utils"

// Import all tool functions
import {
	updateLeadScore,
	updateLeadNotes,
	getLeadHistory,
	updateDealStage,
	updateLeadStatus,
	assignLead,
	detectDuplicateLeads
} from "./functions/lead-management"

import {
	sendFollowUpEmail,
	sendFollowUpSMS,
	searchCallTranscripts
} from "./functions/communication"

import {
	searchKnowledgeBase,
	analyzeConversation
} from "./functions/ai-features"

import {
	scheduleAppointment,
	createTask,
	setReminder
} from "./functions/scheduling"

import {
	transferToSpecialist,
	warmTransfer,
	recordAgentHandoff
} from "./functions/agent-coordination"

import { executeWithRetry, createFallbackResponse } from "./monitoring"

// Tool function type
type ToolFunction = (
	parameters: Record<string, unknown>,
	userId: string,
	toolCallId: string
) => Promise<{ toolCallId: string; result: string }>

// Registry of all available tools
const TOOL_REGISTRY: Record<string, ToolFunction> = {
	updateLeadScore,
	updateLeadNotes,
	sendFollowUpEmail,
	searchCallTranscripts,
	sendFollowUpSMS,
	getLeadHistory,
	searchKnowledgeBase,
	scheduleAppointment,
	analyzeConversation,
	createTask,
	updateDealStage,
	updateLeadStatus,
	assignLead,
	detectDuplicateLeads,
	setReminder,
	transferToSpecialist,
	warmTransfer,
	recordAgentHandoff
}

// Get list of supported tools
export function getSupportedTools(): string[] {
	return Object.keys(TOOL_REGISTRY)
}

// Main tool dispatcher with timing and logging
export async function executeToolCall(
	toolCall: { id: string; name: string; arguments: Record<string, unknown> },
	userId: string,
	callId?: string,
	sessionId?: string,
	request?: NextRequest
): Promise<{ toolCallId: string; result: string }> {
	const { id: toolCallId, name, arguments: parameters } = toolCall
	const startTime = Date.now()

	let result: { toolCallId: string; result: string }
	let success = false
	let error: string | undefined

	try {
		// Get the tool function from registry
		const toolFunction = TOOL_REGISTRY[name]

		if (!toolFunction) {
			result = {
				toolCallId,
				result: `Unknown tool: ${name}`
			}
			error = `Unknown tool: ${name}`
		} else {
			// Execute the tool function with retry logic for reliability
			try {
				result = await executeWithRetry(
					() => toolFunction(parameters, userId, toolCallId),
					{
						maxRetries: 2, // Reduced retries for real-time performance
						baseDelay: 500,
						maxDelay: 2000,
						backoffMultiplier: 2
					}
				)
			} catch (retryError) {
				// Use fallback response for graceful degradation
				result = createFallbackResponse(
					toolCallId,
					name,
					retryError as Error
				)
				error =
					retryError instanceof Error
						? retryError.message
						: "Tool execution failed after retries"
			}
		}

		success =
			!result.result.toLowerCase().includes("failed") &&
			!result.result.toLowerCase().includes("error") &&
			!error
	} catch (toolError) {
		console.error(`Error executing tool ${name}:`, toolError)
		error = toolError instanceof Error ? toolError.message : "Unknown error"
		result = {
			toolCallId,
			result: `Failed to execute tool ${name}: ${error}`
		}
	}

	const executionTime = Date.now() - startTime

	// Log the tool call execution
	await logToolCall(
		toolCallId,
		name,
		parameters,
		{
			success,
			message: result.result,
			error
		},
		executionTime,
		userId,
		callId,
		sessionId,
		request
	)

	return result
}

// Process multiple tool calls with rate limiting
export async function processToolCalls(
	toolCallList: Array<{
		id: string
		name: string
		arguments: Record<string, unknown>
	}>,
	callId?: string,
	request?: NextRequest
): Promise<Array<{ toolCallId: string; result: string }>> {
	// Get user context from the call
	const userId = await getUserContextFromCall(callId)

	if (!userId) {
		// Return error for all tool calls if no user context
		return toolCallList.map((toolCall) => ({
			toolCallId: toolCall.id,
			result: "Unable to determine user context from call"
		}))
	}

	// Get session ID if available
	const sessionId = (await getSessionIdFromCall(callId)) || undefined

	// Process each tool call with individual rate limiting
	const results: Array<{ toolCallId: string; result: string }> = []

	for (const toolCall of toolCallList) {
		// Check tool-specific rate limits
		const toolRateLimit = TOOL_RATE_LIMITS[toolCall.name]
		if (toolRateLimit && request) {
			const toolRateLimitResult = checkRateLimit(request, toolRateLimit)
			if (!toolRateLimitResult.allowed) {
				results.push({
					toolCallId: toolCall.id,
					result: `Rate limit exceeded for tool ${toolCall.name}. Try again later.`
				})
				continue
			}
		}

		// Execute tool call with timeout
		const result = await withTimeout(
			executeToolCall(toolCall, userId, callId, sessionId, request),
			25000 // 25 second timeout for tool execution
		)
		results.push(result)
	}

	return results
}
