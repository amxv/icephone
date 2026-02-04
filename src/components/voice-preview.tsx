"use client"

import type { VoicePreset } from "@/actions/voice-presets"
import { getVoiceSample } from "@/actions/voice-presets"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
	LoaderIcon,
	PauseIcon,
	PlayIcon,
	VolumeIcon,
	VolumeXIcon
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface VoicePreviewProps {
	voicePreset: VoicePreset
	isSelected?: boolean
	onSelect?: (preset: VoicePreset) => void
	showPlayButton?: boolean
	compact?: boolean
}

export function VoicePreview({
	voicePreset,
	isSelected = false,
	onSelect,
	showPlayButton = true,
	compact = false
}: VoicePreviewProps) {
	const [isPlaying, setIsPlaying] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [hasAudio, setHasAudio] = useState(false)
	const [volume, setVolume] = useState(0.7)
	const audioRef = useRef<HTMLAudioElement | null>(null)

	// Check if voice has sample audio
	useEffect(() => {
		setHasAudio(!!voicePreset.sampleAudioUrl)
	}, [voicePreset.sampleAudioUrl])

	const playPreview = async () => {
		if (!hasAudio) {
			toast.error("No audio sample available for this voice")
			return
		}

		setIsLoading(true)

		try {
			// If we already have an audio element and URL, just play it
			if (audioRef.current && voicePreset.sampleAudioUrl) {
				if (
					!audioRef.current.src ||
					audioRef.current.src !== voicePreset.sampleAudioUrl
				) {
					audioRef.current.src = voicePreset.sampleAudioUrl
				}

				audioRef.current.volume = volume
				await audioRef.current.play()
				setIsPlaying(true)
				return
			}

			// Otherwise, fetch the sample URL if needed
			let audioUrl = voicePreset.sampleAudioUrl

			if (!audioUrl) {
				audioUrl = await getVoiceSample(voicePreset.id)
				if (!audioUrl) {
					toast.error("Audio sample not available")
					return
				}
			}

			// Create new audio element if needed
			if (!audioRef.current) {
				audioRef.current = new Audio()
				audioRef.current.addEventListener("ended", () =>
					setIsPlaying(false)
				)
				audioRef.current.addEventListener("error", () => {
					toast.error("Failed to play audio sample")
					setIsPlaying(false)
				})
			}

			audioRef.current.src = audioUrl
			audioRef.current.volume = volume
			await audioRef.current.play()
			setIsPlaying(true)
		} catch (error) {
			console.error("Error playing voice preview:", error)
			toast.error("Failed to play voice preview")
		} finally {
			setIsLoading(false)
		}
	}

	const stopPreview = () => {
		if (audioRef.current) {
			audioRef.current.pause()
			audioRef.current.currentTime = 0
		}
		setIsPlaying(false)
	}

	const togglePreview = () => {
		if (isPlaying) {
			stopPreview()
		} else {
			playPreview()
		}
	}

	// Clean up audio on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current = null
			}
		}
	}, [])

	const handleSelect = () => {
		onSelect?.(voicePreset)
	}

	const genderColors = {
		male: "bg-blue-100 text-blue-800",
		female: "bg-pink-100 text-pink-800",
		neutral: "bg-gray-100 text-gray-800"
	}

	const languageNames: Record<string, string> = {
		en: "English",
		es: "Spanish",
		fr: "French",
		de: "German",
		it: "Italian",
		pt: "Portuguese",
		zh: "Chinese",
		hi: "Hindi",
		ar: "Arabic",
		ja: "Japanese"
	}

	if (compact) {
		return (
			<div
				className={`flex items-center gap-3 p-2 rounded-2xl border transition-all cursor-pointer hover:bg-card/60 w-full text-left ${
					isSelected
						? "border-primary bg-primary/5 shadow-sm"
						: "border-border bg-card/40"
				}`}
				onClick={handleSelect}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault()
						handleSelect()
					}
				}}
				role="button"
				tabIndex={0}
				aria-label={`Select ${voicePreset.displayName} voice preset`}
			>
				{showPlayButton && (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0 shrink-0"
						onClick={(e) => {
							e.stopPropagation()
							togglePreview()
						}}
						disabled={!hasAudio || isLoading}
					>
						{isLoading ? (
							<LoaderIcon className="h-3 w-3 animate-spin" />
						) : isPlaying ? (
							<PauseIcon className="h-3 w-3" />
						) : (
							<PlayIcon className="h-3 w-3" />
						)}
					</Button>
				)}

				<div className="flex-1 min-w-0">
					<div className="font-medium text-sm truncate">
						{voicePreset.displayName}
					</div>
					<div className="text-xs text-muted-foreground">
						{voicePreset.description}
					</div>
				</div>

				<div className="flex items-center gap-1 shrink-0">
					<Badge
						variant="outline"
						className={`text-xs px-2 py-0 ${genderColors[voicePreset.gender]}`}
					>
						{voicePreset.gender}
					</Badge>
				</div>
			</div>
		)
	}

	return (
		<Card
			className={`rounded-3xl border transition-all hover:shadow-md ${
				isSelected
					? "border-primary bg-primary/5 shadow-sm"
					: "border-border bg-card/40 backdrop-blur-sm hover:bg-card/60"
			}`}
		>
			<CardContent className="p-5">
				<div
					className="w-full text-left cursor-pointer"
					onClick={handleSelect}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							handleSelect()
						}
					}}
					role="button"
					tabIndex={0}
					aria-label={`Select ${voicePreset.displayName} voice preset`}
				>
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-2">
								<h3 className="font-medium text-base truncate">
									{voicePreset.displayName}
								</h3>
								{voicePreset.isDefault && (
									<Badge
										variant="outline"
										className="text-xs px-2 py-0 bg-amber-100 text-amber-800"
									>
										Default
									</Badge>
								)}
							</div>

							<p className="text-sm text-muted-foreground mb-3 line-clamp-2">
								{voicePreset.description}
							</p>

							<div className="flex items-center gap-2 flex-wrap">
								<Badge
									variant="outline"
									className={`text-xs px-2 py-1 ${genderColors[voicePreset.gender]}`}
								>
									{voicePreset.gender}
								</Badge>

								<Badge
									variant="outline"
									className="text-xs px-2 py-1"
								>
									{languageNames[voicePreset.language] ||
										voicePreset.language.toUpperCase()}
								</Badge>

								<Badge
									variant="outline"
									className="text-xs px-2 py-1 text-muted-foreground"
								>
									OpenAI
								</Badge>
							</div>
						</div>

						{showPlayButton && (
							<div className="ml-3 shrink-0">
								<Button
									variant="outline"
									size="sm"
									className="h-10 w-10 p-0 rounded-2xl"
									onClick={(e) => {
										e.stopPropagation()
										togglePreview()
									}}
									disabled={!hasAudio || isLoading}
								>
									{isLoading ? (
										<LoaderIcon className="h-4 w-4 animate-spin" />
									) : isPlaying ? (
										<PauseIcon className="h-4 w-4" />
									) : hasAudio ? (
										<PlayIcon className="h-4 w-4" />
									) : (
										<VolumeXIcon className="h-4 w-4" />
									)}
								</Button>
							</div>
						)}
					</div>
				</div>

				{/* Volume control when playing */}
				{isPlaying && (
					<div className="mt-3 pt-3 border-t border-border/40">
						<div className="flex items-center gap-2">
							<VolumeIcon className="h-3 w-3 text-muted-foreground" />
							<input
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={volume}
								onChange={(e) => {
									const newVolume = Number.parseFloat(
										e.target.value
									)
									setVolume(newVolume)
									if (audioRef.current) {
										audioRef.current.volume = newVolume
									}
								}}
								className="flex-1 h-1"
								onClick={(e) => e.stopPropagation()}
							/>
							<span className="text-xs text-muted-foreground w-8">
								{Math.round(volume * 100)}%
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

// Voice Preview Grid for showing multiple voices
interface VoicePreviewGridProps {
	voicePresets: VoicePreset[]
	selectedVoice?: VoicePreset | null
	onVoiceSelect: (preset: VoicePreset) => void
	isLoading?: boolean
	compact?: boolean
	columns?: number
}

export function VoicePreviewGrid({
	voicePresets,
	selectedVoice,
	onVoiceSelect,
	isLoading = false,
	compact = false,
	columns = 2
}: VoicePreviewGridProps) {
	if (isLoading) {
		return (
			<div
				className={`grid gap-4 ${columns === 1 ? "grid-cols-1" : `grid-cols-1 sm:grid-cols-${columns}`}`}
			>
				{Array.from({ length: 4 }).map((_, i) => (
					<Card
						key={i}
						className="rounded-3xl border border-border bg-card/40 backdrop-blur-sm"
					>
						<CardContent className="p-5">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<Skeleton className="h-5 w-32 mb-2" />
									<Skeleton className="h-4 w-48 mb-3" />
									<div className="flex gap-2">
										<Skeleton className="h-6 w-16" />
										<Skeleton className="h-6 w-20" />
									</div>
								</div>
								<Skeleton className="h-10 w-10 rounded-2xl" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	if (voicePresets.length === 0) {
		return (
			<div className="text-center py-8">
				<VolumeXIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
				<h3 className="font-medium mb-2">No voices available</h3>
				<p className="text-sm text-muted-foreground">
					No voice presets found for the selected language.
				</p>
			</div>
		)
	}

	return (
		<div
			className={`grid gap-4 ${columns === 1 ? "grid-cols-1" : `grid-cols-1 sm:grid-cols-${columns}`}`}
		>
			{voicePresets.map((preset) => (
				<VoicePreview
					key={preset.id}
					voicePreset={preset}
					isSelected={selectedVoice?.id === preset.id}
					onSelect={onVoiceSelect}
					compact={compact}
				/>
			))}
		</div>
	)
}
