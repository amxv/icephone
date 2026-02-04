import type { CRMCallSyncInput } from "@/lib/crm/types"

export function buildCallNoteBody(input: CRMCallSyncInput) {
	const lines = [
		`IcePhone call sync (${input.callId})`,
		`Timestamp: ${input.callTimestamp.toISOString()}`,
		input.status ? `Status: ${input.status}` : null,
		input.disposition ? `Disposition: ${input.disposition}` : null,
		typeof input.durationSeconds === "number"
			? `Duration: ${Math.max(0, Math.round(input.durationSeconds))}s`
			: null,
		input.summary ? `Summary: ${input.summary}` : null,
		input.autoNote ? `Recommended follow-up: ${input.autoNote}` : null,
		input.transcript
			? `Transcript: ${input.transcript.slice(0, 3500)}`
			: null,
		input.campaignId ? `Campaign ID: ${input.campaignId}` : null,
		input.agentId ? `Agent ID: ${input.agentId}` : null
	]

	return lines.filter(Boolean).join("\n")
}

export function toNumberOrNull(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) {
			return parsed
		}
	}

	return null
}
