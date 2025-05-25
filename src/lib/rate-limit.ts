import type { NextRequest } from "next/server"

// Simple in-memory rate limiter
// In production, you'd want to use Redis or a similar store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

interface RateLimitConfig {
	windowMs: number // Time window in milliseconds
	maxRequests: number // Maximum requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 100 // 100 requests per minute per IP
}

export function checkRateLimit(
	request: NextRequest,
	config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetTime: number } {
	const ip = getClientIP(request)
	const now = Date.now()
	const key = `rate_limit:${ip}`

	// Clean up expired entries
	cleanupExpiredEntries(now)

	const entry = rateLimitStore.get(key)

	if (!entry || now > entry.resetTime) {
		// First request or window expired, create new entry
		const resetTime = now + config.windowMs
		rateLimitStore.set(key, { count: 1, resetTime })
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			resetTime
		}
	}

	if (entry.count >= config.maxRequests) {
		// Rate limit exceeded
		return {
			allowed: false,
			remaining: 0,
			resetTime: entry.resetTime
		}
	}

	// Increment count
	entry.count++
	rateLimitStore.set(key, entry)

	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		resetTime: entry.resetTime
	}
}

function getClientIP(request: NextRequest): string {
	return (
		request.headers.get("x-forwarded-for") ||
		request.headers.get("x-real-ip") ||
		"unknown"
	)
}

function cleanupExpiredEntries(now: number): void {
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now > entry.resetTime) {
			rateLimitStore.delete(key)
		}
	}
}

// Tool-specific rate limits
export const TOOL_RATE_LIMITS: Record<string, RateLimitConfig> = {
	updateLeadScore: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 50 // 50 score updates per minute
	},
	updateLeadNotes: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 100 // 100 note updates per minute
	},
	sendFollowUpEmail: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 10 // 10 emails per minute (to prevent spam)
	},
	searchCallTranscripts: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 200 // 200 searches per minute
	},
	sendFollowUpSMS: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 5 // 5 SMS messages per minute (to prevent SMS spam)
	},
	searchKnowledgeBase: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 100 // 100 knowledge base searches per minute (generous for voice conversations)
	},
	scheduleAppointment: {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 20 // 20 appointment scheduling attempts per minute (reasonable for voice calls)
	}
}
