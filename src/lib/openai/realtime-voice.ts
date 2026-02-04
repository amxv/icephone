export const OPENAI_REALTIME_MODEL = "gpt-realtime-mini-2025-12-15"

export const OPENAI_REALTIME_VOICES = [
	"alloy",
	"ash",
	"ballad",
	"coral",
	"echo",
	"marin",
	"sage",
	"shimmer",
	"verse"
] as const

export type OpenAIRealtimeVoiceId = (typeof OPENAI_REALTIME_VOICES)[number]

const OPENAI_REALTIME_VOICE_SET = new Set<string>(OPENAI_REALTIME_VOICES)

export function isOpenAIRealtimeVoiceId(
	voiceId: string | null | undefined
): voiceId is OpenAIRealtimeVoiceId {
	return !!voiceId && OPENAI_REALTIME_VOICE_SET.has(voiceId)
}

export function getOpenAIVoiceLabel(
	voiceId: string | null | undefined
): string {
	if (!isOpenAIRealtimeVoiceId(voiceId)) {
		return "Alloy"
	}

	return `${voiceId.charAt(0).toUpperCase()}${voiceId.slice(1)}`
}

export function normalizeOpenAIVoiceId(
	voiceId: string | null | undefined,
	fallbackIndex: number = 0
): OpenAIRealtimeVoiceId {
	if (isOpenAIRealtimeVoiceId(voiceId)) {
		return voiceId
	}

	const safeIndex =
		fallbackIndex >= 0 ? fallbackIndex % OPENAI_REALTIME_VOICES.length : 0

	return OPENAI_REALTIME_VOICES[safeIndex]
}
