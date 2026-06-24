import React from "react"
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { colors, fonts } from "../theme"

export const ProblemScene: React.FC = () => {
	const frame = useCurrentFrame()

	// Line 1: "Your phones are silent."
	const line1Opacity = interpolate(frame, [5, 18], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})
	const line1Y = interpolate(frame, [5, 18], [25, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	// Line 2: "Leads you'll never reach..."
	const line2Opacity = interpolate(frame, [22, 38], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})
	const line2Y = interpolate(frame, [22, 38], [20, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	// Fade out near the end (transition handles the final crossfade)
	const fadeOut = interpolate(frame, [55, 72], [1, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center",
				opacity: fadeOut
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 24,
					maxWidth: 900,
					textAlign: "center"
				}}
			>
				<div
					style={{
						fontFamily: fonts.headline,
						fontSize: 68,
						fontWeight: 400,
						color: colors.whiteHeadline,
						opacity: line1Opacity,
						transform: `translateY(${line1Y}px)`,
						lineHeight: 1.15,
						letterSpacing: "-0.02em"
					}}
				>
					Your phones are silent.
				</div>
				<div
					style={{
						fontFamily: fonts.body,
						fontSize: 26,
						fontWeight: 400,
						color: colors.whiteBody,
						opacity: line2Opacity,
						transform: `translateY(${line2Y}px)`,
						lineHeight: 1.5
					}}
				>
					Leads you&apos;ll never reach. Revenue you&apos;ll never
					see.
				</div>
			</div>
		</AbsoluteFill>
	)
}
