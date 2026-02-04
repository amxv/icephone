import type {
	TelephonyExecutionInput,
	TelephonyExecutionProvider,
	TelephonyExecutionResult
} from "@/lib/telephony/types"

function randomDurationSeconds() {
	return 45 + Math.floor(Math.random() * 120)
}

export const mockTelephonyExecutionProvider: TelephonyExecutionProvider = {
	name: "mock",
	async execute(
		input: TelephonyExecutionInput
	): Promise<TelephonyExecutionResult> {
		const durationSeconds = randomDurationSeconds()

		return {
			status: "completed",
			provider: "mock",
			durationSeconds,
			callStatus: "completed",
			completedAt: new Date(
				input.startedAt.getTime() + durationSeconds * 1000
			),
			outcome: "simulated_completed",
			summary: "Simulated call execution completed via mock provider.",
			notes: "Processed by mock call executor",
			metadata: {
				simulated: true,
				queueId: input.queueEntry.id
			}
		}
	}
}
