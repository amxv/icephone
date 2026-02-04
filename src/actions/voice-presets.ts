"use server"

import { db_ws as db } from "@/db"
import { voicePresets } from "@/db/schema"
import {
	OPENAI_REALTIME_MODEL,
	normalizeOpenAIVoiceId
} from "@/lib/openai/realtime-voice"
import { and, asc, eq } from "drizzle-orm"

type VoicePresetLanguage =
	| "en"
	| "es"
	| "fr"
	| "de"
	| "it"
	| "pt"
	| "zh"
	| "hi"
	| "ar"
	| "ja"
type VoicePresetGender = "male" | "female" | "neutral"
type VoicePresetProvider = "openai"

export type VoicePreset = {
	id: number
	codename: string
	displayName: string
	language: VoicePresetLanguage
	gender: VoicePresetGender
	description: string
	vapiVoiceId: string
	vapiProvider: VoicePresetProvider
	vapiModel?: string | null
	sampleAudioUrl?: string | null
	isDefault: boolean
	sortOrder: number
	createdAt: Date
	updatedAt: Date
}

function normalizePreset(
	preset: Omit<VoicePreset, "vapiProvider" | "vapiVoiceId" | "vapiModel"> & {
		vapiProvider: string
		vapiVoiceId: string
		vapiModel?: string | null
	}
): VoicePreset {
	return {
		...preset,
		vapiProvider: "openai",
		vapiVoiceId: normalizeOpenAIVoiceId(
			preset.vapiVoiceId,
			Math.max((preset.sortOrder || 1) - 1, 0)
		),
		vapiModel: OPENAI_REALTIME_MODEL
	}
}

/**
 * Get all voice presets available in the system
 * @param language - Optional language filter
 * @returns Array of voice presets
 */
export async function getVoicePresets(
	language?: string
): Promise<VoicePreset[]> {
	try {
		const whereClause = language
			? eq(voicePresets.language, language as VoicePresetLanguage)
			: undefined

		const presets = await db.query.voicePresets.findMany({
			where: whereClause,
			orderBy: [
				asc(voicePresets.sortOrder),
				asc(voicePresets.displayName)
			]
		})

		return presets.map((preset) => normalizePreset(preset as VoicePreset))
	} catch (error) {
		console.error("Failed to get voice presets:", error)
		throw new Error("Failed to get voice presets")
	}
}

/**
 * Get voice presets for a specific language with default first
 * @param language - Language code (e.g., 'en', 'es')
 * @returns Array of voice presets for the language
 */
export async function getVoicePresetsForLanguage(
	language: string
): Promise<VoicePreset[]> {
	try {
		const presets = await db.query.voicePresets.findMany({
			where: eq(voicePresets.language, language as VoicePresetLanguage),
			orderBy: [
				// Default voices first, then by sort order
				asc(voicePresets.isDefault),
				asc(voicePresets.sortOrder),
				asc(voicePresets.displayName)
			]
		})

		return presets.map((preset) => normalizePreset(preset as VoicePreset))
	} catch (error) {
		console.error("Failed to get voice presets for language:", error)
		throw new Error("Failed to get voice presets for language")
	}
}

/**
 * Get a specific voice preset by ID
 * @param id - Voice preset ID
 * @returns Voice preset or null if not found
 */
export async function getVoicePreset(id: number): Promise<VoicePreset | null> {
	try {
		const preset = await db.query.voicePresets.findFirst({
			where: eq(voicePresets.id, id)
		})

		return preset ? normalizePreset(preset as VoicePreset) : null
	} catch (error) {
		console.error("Failed to get voice preset:", error)
		throw new Error("Failed to get voice preset")
	}
}

/**
 * Get default voice preset for a language
 * @param language - Language code
 * @returns Default voice preset for the language or null
 */
export async function getDefaultVoicePreset(
	language: string
): Promise<VoicePreset | null> {
	try {
		const preset = await db.query.voicePresets.findFirst({
			where: and(
				eq(voicePresets.language, language as VoicePresetLanguage),
				eq(voicePresets.isDefault, true)
			)
		})

		return preset ? normalizePreset(preset as VoicePreset) : null
	} catch (error) {
		console.error("Failed to get default voice preset:", error)
		throw new Error("Failed to get default voice preset")
	}
}

/**
 * Get voice sample URL for preview
 * @param voiceId - Voice preset ID
 * @returns Sample audio URL or null
 */
export async function getVoiceSample(voiceId: number): Promise<string | null> {
	try {
		const preset = await db.query.voicePresets.findFirst({
			where: eq(voicePresets.id, voiceId),
			columns: {
				sampleAudioUrl: true
			}
		})

		return preset?.sampleAudioUrl || null
	} catch (error) {
		console.error("Failed to get voice sample:", error)
		throw new Error("Failed to get voice sample")
	}
}

/**
 * Get available languages with voice presets
 * @returns Array of language codes that have voice presets
 */
export async function getAvailableLanguages(): Promise<string[]> {
	try {
		const result = await db
			.selectDistinct({ language: voicePresets.language })
			.from(voicePresets)

		return result.map((r) => r.language).filter(Boolean)
	} catch (error) {
		console.error("Failed to get available languages:", error)
		throw new Error("Failed to get available languages")
	}
}
