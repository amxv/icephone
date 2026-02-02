import { NextRequest, NextResponse } from "next/server"

/**
 * Cron job endpoint for automatic call queue processing
 * This should be called every minute via Cloudflare Workers Cron Triggers
 * or external cron services like GitHub Actions or Vercel Cron
 */
export async function GET(request: NextRequest) {
	try {
		// Simple authentication using environment variable
		const secret = process.env.CALL_QUEUE_PROCESSOR_SECRET
		const authToken = request.headers
			.get("authorization")
			?.replace("Bearer ", "")

		if (!secret || authToken !== secret) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		console.log("🕒 Starting automatic call queue processing...")

		// Call the main processing endpoint internally
		const processUrl = new URL("/api/call-queue/process", request.url)

		const processResponse = await fetch(processUrl.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${secret}`
			},
			body: JSON.stringify({
				maxUsers: 20,
				batchSize: 3,
				forceProcessing: false // Only process calls that are ready
			})
		})

		const result = (await processResponse.json()) as {
			processed?: number
			successful?: number
			failed?: number
			error?: string
		}

		if (!processResponse.ok) {
			console.error("Call queue processing failed:", result)
			return NextResponse.json(
				{ error: "Processing failed", details: result },
				{ status: 500 }
			)
		}

		console.log("✅ Automatic call queue processing completed:", {
			processed: result.processed || 0,
			successful: result.successful || 0,
			failed: result.failed || 0
		})

		return NextResponse.json({
			success: true,
			message: "Call queue processed successfully",
			processed: result.processed || 0,
			successful: result.successful || 0,
			failed: result.failed || 0
		})
	} catch (error) {
		console.error("Error in automatic call queue processing:", error)
		return NextResponse.json(
			{
				error: "Internal server error",
				details:
					error instanceof Error ? error.message : "Unknown error"
			},
			{ status: 500 }
		)
	}
}

// Handle POST as well for manual triggers
export async function POST(request: NextRequest) {
	return GET(request)
}
