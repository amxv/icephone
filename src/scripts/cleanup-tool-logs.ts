#!/usr/bin/env bun

/**
 * Automated cleanup script for Vapi tool call logs
 *
 * This script should be run periodically (e.g., daily via cron job) to:
 * - Remove old tool call logs (default: 90 days)
 * - Remove old lead interactions (default: 90 days)
 * - Generate cleanup reports
 * - Monitor cleanup performance
 *
 * Usage:
 *   bun run scripts/cleanup-tool-logs.ts [--retention-days=90] [--dry-run]
 */

import { cleanupOldLogs } from "@/app/api/vapi/tools/analytics"
import { db_ws } from "@/db"
import { toolCalls, leadInteractions } from "@/db/schema"
import { sql, count, gte } from "drizzle-orm"

interface CleanupOptions {
	retentionDays: number
	dryRun: boolean
	verbose: boolean
}

interface CleanupReport {
	startTime: Date
	endTime: Date
	retentionDays: number
	beforeCleanup: {
		toolCalls: number
		leadInteractions: number
		totalRecords: number
	}
	afterCleanup: {
		toolCalls: number
		leadInteractions: number
		totalRecords: number
	}
	deleted: {
		toolCalls: number
		leadInteractions: number
		totalRecords: number
	}
	durationMs: number
	success: boolean
	error?: string
}

async function getRecordCounts(): Promise<{
	toolCalls: number
	leadInteractions: number
}> {
	try {
		const toolCallsCount = await db_ws
			.select({ count: count() })
			.from(toolCalls)

		const leadInteractionsCount = await db_ws
			.select({ count: count() })
			.from(leadInteractions)

		return {
			toolCalls: Number(toolCallsCount[0]?.count || 0),
			leadInteractions: Number(leadInteractionsCount[0]?.count || 0)
		}
	} catch (error) {
		console.error("Error getting record counts:", error)
		return { toolCalls: 0, leadInteractions: 0 }
	}
}

async function getOldRecordCounts(
	retentionDays: number
): Promise<{ toolCalls: number; leadInteractions: number }> {
	try {
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

		const oldToolCallsCount = await db_ws
			.select({ count: count() })
			.from(toolCalls)
			.where(sql`${toolCalls.createdAt} < ${cutoffDate}`)

		const oldLeadInteractionsCount = await db_ws
			.select({ count: count() })
			.from(leadInteractions)
			.where(sql`${leadInteractions.createdAt} < ${cutoffDate}`)

		return {
			toolCalls: Number(oldToolCallsCount[0]?.count || 0),
			leadInteractions: Number(oldLeadInteractionsCount[0]?.count || 0)
		}
	} catch (error) {
		console.error("Error getting old record counts:", error)
		return { toolCalls: 0, leadInteractions: 0 }
	}
}

async function performCleanup(options: CleanupOptions): Promise<CleanupReport> {
	const startTime = new Date()
	let report: CleanupReport

	try {
		console.log(
			`🧹 Starting cleanup with ${options.retentionDays} day retention...`
		)

		// Get counts before cleanup
		const beforeCounts = await getRecordCounts()
		const oldCounts = await getOldRecordCounts(options.retentionDays)

		if (options.verbose) {
			console.log(`📊 Current records:`)
			console.log(
				`   Tool calls: ${beforeCounts.toolCalls.toLocaleString()}`
			)
			console.log(
				`   Lead interactions: ${beforeCounts.leadInteractions.toLocaleString()}`
			)
			console.log(
				`   Total: ${(beforeCounts.toolCalls + beforeCounts.leadInteractions).toLocaleString()}`
			)
			console.log()
			console.log(
				`🗑️  Records to delete (older than ${options.retentionDays} days):`
			)
			console.log(
				`   Tool calls: ${oldCounts.toolCalls.toLocaleString()}`
			)
			console.log(
				`   Lead interactions: ${oldCounts.leadInteractions.toLocaleString()}`
			)
			console.log(
				`   Total: ${(oldCounts.toolCalls + oldCounts.leadInteractions).toLocaleString()}`
			)
		}

		if (options.dryRun) {
			console.log(`🔍 DRY RUN - No records will be deleted`)

			report = {
				startTime,
				endTime: new Date(),
				retentionDays: options.retentionDays,
				beforeCleanup: {
					toolCalls: beforeCounts.toolCalls,
					leadInteractions: beforeCounts.leadInteractions,
					totalRecords:
						beforeCounts.toolCalls + beforeCounts.leadInteractions
				},
				afterCleanup: {
					toolCalls: beforeCounts.toolCalls,
					leadInteractions: beforeCounts.leadInteractions,
					totalRecords:
						beforeCounts.toolCalls + beforeCounts.leadInteractions
				},
				deleted: {
					toolCalls: oldCounts.toolCalls,
					leadInteractions: oldCounts.leadInteractions,
					totalRecords:
						oldCounts.toolCalls + oldCounts.leadInteractions
				},
				durationMs: Date.now() - startTime.getTime(),
				success: true
			}
		} else {
			// Perform actual cleanup
			const cleanup = await cleanupOldLogs(options.retentionDays)

			// Get counts after cleanup
			const afterCounts = await getRecordCounts()

			const endTime = new Date()
			const durationMs = endTime.getTime() - startTime.getTime()

			report = {
				startTime,
				endTime,
				retentionDays: options.retentionDays,
				beforeCleanup: {
					toolCalls: beforeCounts.toolCalls,
					leadInteractions: beforeCounts.leadInteractions,
					totalRecords:
						beforeCounts.toolCalls + beforeCounts.leadInteractions
				},
				afterCleanup: {
					toolCalls: afterCounts.toolCalls,
					leadInteractions: afterCounts.leadInteractions,
					totalRecords:
						afterCounts.toolCalls + afterCounts.leadInteractions
				},
				deleted: {
					toolCalls: cleanup.deletedToolCalls,
					leadInteractions: cleanup.deletedInteractions,
					totalRecords:
						cleanup.deletedToolCalls + cleanup.deletedInteractions
				},
				durationMs,
				success: true
			}

			if (options.verbose) {
				console.log(`✅ Cleanup completed successfully!`)
				console.log(
					`   Deleted tool calls: ${cleanup.deletedToolCalls.toLocaleString()}`
				)
				console.log(
					`   Deleted lead interactions: ${cleanup.deletedInteractions.toLocaleString()}`
				)
				console.log(
					`   Total deleted: ${(cleanup.deletedToolCalls + cleanup.deletedInteractions).toLocaleString()}`
				)
				console.log(`   Duration: ${durationMs}ms`)
			}
		}

		return report
	} catch (error) {
		const endTime = new Date()
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error"

		console.error(`❌ Cleanup failed:`, error)

		// Try to get current counts for error report
		const currentCounts = await getRecordCounts().catch(() => ({
			toolCalls: 0,
			leadInteractions: 0
		}))
		const totalCurrentRecords =
			currentCounts.toolCalls + currentCounts.leadInteractions

		return {
			startTime,
			endTime,
			retentionDays: options.retentionDays,
			beforeCleanup: {
				toolCalls: currentCounts.toolCalls,
				leadInteractions: currentCounts.leadInteractions,
				totalRecords: totalCurrentRecords
			},
			afterCleanup: {
				toolCalls: currentCounts.toolCalls,
				leadInteractions: currentCounts.leadInteractions,
				totalRecords: totalCurrentRecords
			},
			deleted: {
				toolCalls: 0,
				leadInteractions: 0,
				totalRecords: 0
			},
			durationMs: endTime.getTime() - startTime.getTime(),
			success: false,
			error: errorMessage
		}
	}
}

function printReport(report: CleanupReport) {
	console.log(`\n📋 CLEANUP REPORT`)
	console.log(`==================================================`)
	console.log(`Started: ${report.startTime.toISOString()}`)
	console.log(`Ended: ${report.endTime.toISOString()}`)
	console.log(`Duration: ${report.durationMs}ms`)
	console.log(`Retention: ${report.retentionDays} days`)
	console.log(`Success: ${report.success ? "✅" : "❌"}`)

	if (report.error) {
		console.log(`Error: ${report.error}`)
	}

	console.log()
	console.log(`BEFORE CLEANUP:`)
	console.log(
		`  Tool calls: ${report.beforeCleanup.toolCalls.toLocaleString()}`
	)
	console.log(
		`  Lead interactions: ${report.beforeCleanup.leadInteractions.toLocaleString()}`
	)
	console.log(
		`  Total: ${report.beforeCleanup.totalRecords.toLocaleString()}`
	)

	console.log()
	console.log(`DELETED:`)
	console.log(`  Tool calls: ${report.deleted.toolCalls.toLocaleString()}`)
	console.log(
		`  Lead interactions: ${report.deleted.leadInteractions.toLocaleString()}`
	)
	console.log(`  Total: ${report.deleted.totalRecords.toLocaleString()}`)

	console.log()
	console.log(`AFTER CLEANUP:`)
	console.log(
		`  Tool calls: ${report.afterCleanup.toolCalls.toLocaleString()}`
	)
	console.log(
		`  Lead interactions: ${report.afterCleanup.leadInteractions.toLocaleString()}`
	)
	console.log(`  Total: ${report.afterCleanup.totalRecords.toLocaleString()}`)

	if (report.success && report.deleted.totalRecords > 0) {
		const deletionPercentage = (
			(report.deleted.totalRecords / report.beforeCleanup.totalRecords) *
			100
		).toFixed(1)
		console.log(`  Reduction: ${deletionPercentage}%`)
	}

	console.log(`==================================================`)
}

// Parse command line arguments
function parseArgs(): CleanupOptions {
	const args = process.argv.slice(2)
	const options: CleanupOptions = {
		retentionDays: 90,
		dryRun: false,
		verbose: false
	}

	for (const arg of args) {
		if (arg === "--dry-run") {
			options.dryRun = true
		} else if (arg === "--verbose" || arg === "-v") {
			options.verbose = true
		} else if (arg.startsWith("--retention-days=")) {
			const days = parseInt(arg.split("=")[1])
			if (!Number.isNaN(days) && days > 0) {
				options.retentionDays = days
			}
		} else if (arg === "--help" || arg === "-h") {
			console.log(`
Usage: bun run scripts/cleanup-tool-logs.ts [options]

Options:
  --retention-days=N  Keep logs for N days (default: 90)
  --dry-run          Show what would be deleted without deleting
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

Examples:
  bun run scripts/cleanup-tool-logs.ts
  bun run scripts/cleanup-tool-logs.ts --retention-days=30 --dry-run
  bun run scripts/cleanup-tool-logs.ts --verbose
			`)
			process.exit(0)
		}
	}

	return options
}

// Main execution
async function main() {
	const options = parseArgs()

	console.log(`🚀 Vapi Tool Logs Cleanup`)
	console.log(`Retention: ${options.retentionDays} days`)
	console.log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}`)
	console.log()

	const report = await performCleanup(options)
	printReport(report)

	if (!report.success) {
		process.exit(1)
	}
}

// Main execution when run directly
main().catch((error) => {
	console.error("Cleanup script failed:", error)
	process.exit(1)
})

export { performCleanup, type CleanupReport, type CleanupOptions }
