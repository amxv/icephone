import React from "react"
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig
} from "remotion"
import { colors, fonts } from "../theme"
import { Logo } from "../Logo"

export const CTAScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	// Main headline entrance
	const headlineProgress = spring({
		frame,
		fps,
		config: { damping: 200 },
		delay: 3,
		durationInFrames: 20
	})

	const headlineOpacity = interpolate(headlineProgress, [0, 1], [0, 1])
	const headlineY = interpolate(headlineProgress, [0, 1], [30, 0])

	// Logo entrance
	const logoProgress = spring({
		frame,
		fps,
		config: { damping: 200 },
		delay: 15,
		durationInFrames: 20
	})

	const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1])
	const logoScale = interpolate(logoProgress, [0, 1], [0.8, 1])

	// Shimmer effect on the headline
	const shimmerX = interpolate(frame, [25, 65], [-200, 1200], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	// Ambient glow intensification
	const glowIntensity = interpolate(frame, [0, 35], [0, 0.15], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center"
			}}
		>
			{/* Extra glow for CTA scene */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: 800,
					height: 600,
					borderRadius: "50%",
					background: `radial-gradient(ellipse, rgba(255, 202, 128, ${glowIntensity}) 0%, transparent 70%)`,
					pointerEvents: "none"
				}}
			/>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 48,
					maxWidth: 900,
					textAlign: "center"
				}}
			>
				{/* Main headline */}
				<div
					style={{
						position: "relative",
						opacity: headlineOpacity,
						transform: `translateY(${headlineY}px)`
					}}
				>
					<span
						style={{
							fontFamily: fonts.headline,
							fontSize: 60,
							fontWeight: 400,
							color: colors.white,
							lineHeight: 1.15,
							letterSpacing: "-0.02em"
						}}
					>
						Turn every phone line into a{" "}
						<span style={{ color: "rgba(252, 211, 77, 0.9)" }}>
							growth engine.
						</span>
					</span>

					{/* Shimmer overlay */}
					<div
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							overflow: "hidden",
							pointerEvents: "none",
							borderRadius: 8
						}}
					>
						<div
							style={{
								position: "absolute",
								top: -20,
								left: shimmerX,
								width: 100,
								height: 200,
								background:
									"linear-gradient(90deg, transparent, rgba(255, 202, 128, 0.08), transparent)",
								transform: "skewX(-20deg)"
							}}
						/>
					</div>
				</div>

				{/* Logo */}
				<div
					style={{
						opacity: logoOpacity,
						transform: `scale(${logoScale})`
					}}
				>
					<Logo width={140} height={80} color={colors.amber} />
				</div>
			</div>
		</AbsoluteFill>
	)
}
