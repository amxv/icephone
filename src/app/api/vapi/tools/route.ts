"use server"

import { type NextRequest, NextResponse } from "next/server"
import { VapiToolCallSchema } from "./schemas"
import { processToolCalls, getSupportedTools } from "./handler"
import { checkRateLimit } from "@/lib/rate-limit"
import {
	validateSecurity,
	validateRequestSize,
	validateRequestMethod,
	withTimeout
} from "@/lib/vapi-security"

// Main POST handler for Vapi tool calls
export async function POST(request: NextRequest) {
	try {
		// 1. Validate request method
		if (!validateRequestMethod(request, ["POST"])) {
			return NextResponse.json(
				{ error: "Method not allowed" },
				{ status: 405 }
			)
		}

		// 2. Validate request size (1MB limit)
		if (!validateRequestSize(request, 1024 * 1024)) {
			return NextResponse.json(
				{ error: "Request too large" },
				{ status: 413 }
			)
		}

		// 3. Comprehensive security validation
		const securityResult = await validateSecurity(request)
		if (!securityResult.valid) {
			return NextResponse.json(
				{ error: securityResult.error },
				{ status: securityResult.statusCode || 403 }
			)
		}

		// 4. Rate limiting check
		const rateLimitResult = checkRateLimit(request)
		if (!rateLimitResult.allowed) {
			return NextResponse.json(
				{
					error: "Rate limit exceeded",
					resetTime: rateLimitResult.resetTime
				},
				{
					status: 429,
					headers: {
						"X-RateLimit-Remaining":
							rateLimitResult.remaining.toString(),
						"X-RateLimit-Reset":
							rateLimitResult.resetTime.toString()
					}
				}
			)
		}

		// 5. Parse and validate request body with timeout
		const body = await withTimeout(request.json(), 10000) // 10 second timeout for JSON parsing
		const validatedData = VapiToolCallSchema.parse(body)

		// 6. Extract call information for user context
		const callId = validatedData.call?.id

		// 7. Process all tool calls
		const results = await processToolCalls(
			validatedData.message.toolCallList,
			callId,
			request
		)

		// 8. Return response in Vapi expected format with security headers
		return NextResponse.json(
			{ results },
			{
				headers: {
					"X-Content-Type-Options": "nosniff",
					"X-Frame-Options": "DENY",
					"X-XSS-Protection": "1; mode=block",
					"X-RateLimit-Remaining":
						rateLimitResult.remaining.toString(),
					"X-RateLimit-Reset": rateLimitResult.resetTime.toString()
				}
			}
		)
	} catch (error) {
		console.error("Error processing Vapi tool call:", error)

		// Enhanced error handling with different error types
		if (error instanceof Error) {
			if (error.message === "Request timeout") {
				return NextResponse.json(
					{ error: "Request timeout - operation took too long" },
					{ status: 408 }
				)
			}

			if (error.message.includes("JSON")) {
				return NextResponse.json(
					{ error: "Invalid JSON in request body" },
					{ status: 400 }
				)
			}
		}

		// Return error response in Vapi format
		return NextResponse.json(
			{ error: "Internal server error processing tool call" },
			{ status: 500 }
		)
	}
}

// Health check endpoint
export async function GET() {
	return NextResponse.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		supportedTools: getSupportedTools()
	})
}
