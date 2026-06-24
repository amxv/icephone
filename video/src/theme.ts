import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif"
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist"
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono"

const { fontFamily: instrumentSerif } = loadInstrumentSerif("normal", {
	weights: ["400"],
	subsets: ["latin"]
})

const { fontFamily: geistSans } = loadGeist("normal", {
	weights: ["400", "500", "600", "700"],
	subsets: ["latin"]
})

const { fontFamily: geistMono } = loadGeistMono("normal", {
	weights: ["400"],
	subsets: ["latin"]
})

export const fonts = {
	headline: instrumentSerif,
	body: geistSans,
	mono: geistMono
} as const

export const colors = {
	bg: "#0c0013",
	amber: "#ffca80",
	amberBright: "#fcd34d",
	amberButton: "rgba(251, 191, 36, 0.9)",
	amberGlow: "rgba(245, 158, 11, 0.2)",
	amberIcon: "rgba(251, 191, 36, 0.55)",
	white: "#ffffff",
	whiteHeadline: "#ffffff",
	whiteBody: "rgba(255, 255, 255, 0.5)",
	whiteMuted: "rgba(255, 255, 255, 0.45)",
	whiteSubtle: "rgba(255, 255, 255, 0.3)",
	cardBg: "rgba(255, 255, 255, 0.02)",
	cardBorder: "rgba(255, 255, 255, 0.06)",
	cardBorderHover: "rgba(251, 191, 36, 0.2)",
	divider: "rgba(255, 255, 255, 0.05)"
} as const

export const FPS = 30

// Scene durations in frames
export const SCENE_DURATIONS = {
	problem: 75, // 2.5s
	solution: 60, // 2s
	buildAgent: 105, // 3.5s
	connectStack: 105, // 3.5s
	launchMonitor: 105, // 3.5s
	cta: 75 // 2.5s
} as const

export const TRANSITION_DURATION = 10 // frames (faster transitions too)

// Global frame offsets for when each scene starts (accounting for transition overlaps)
export const SCENE_STARTS = {
	problem: 0,
	solution: SCENE_DURATIONS.problem - TRANSITION_DURATION, // 105
	buildAgent:
		SCENE_DURATIONS.problem +
		SCENE_DURATIONS.solution -
		2 * TRANSITION_DURATION, // 180
	connectStack:
		SCENE_DURATIONS.problem +
		SCENE_DURATIONS.solution +
		SCENE_DURATIONS.buildAgent -
		3 * TRANSITION_DURATION, // 345
	launchMonitor:
		SCENE_DURATIONS.problem +
		SCENE_DURATIONS.solution +
		SCENE_DURATIONS.buildAgent +
		SCENE_DURATIONS.connectStack -
		4 * TRANSITION_DURATION, // 510
	cta:
		SCENE_DURATIONS.problem +
		SCENE_DURATIONS.solution +
		SCENE_DURATIONS.buildAgent +
		SCENE_DURATIONS.connectStack +
		SCENE_DURATIONS.launchMonitor -
		5 * TRANSITION_DURATION // 675
} as const

export const TOTAL_DURATION =
	SCENE_DURATIONS.problem +
	SCENE_DURATIONS.solution +
	SCENE_DURATIONS.buildAgent +
	SCENE_DURATIONS.connectStack +
	SCENE_DURATIONS.launchMonitor +
	SCENE_DURATIONS.cta -
	5 * TRANSITION_DURATION // 795 frames = 26.5s
