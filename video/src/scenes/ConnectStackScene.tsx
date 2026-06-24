import React from "react"
import {
	AbsoluteFill,
	Img,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig
} from "remotion"
import { colors, fonts } from "../theme"

const INTEGRATIONS = [
	{ name: "Twilio", logo: "twilio.png", startX: -300, startY: -200 },
	{ name: "Telnyx", logo: "telnyx.png", startX: 300, startY: -200 },
	{ name: "Vonage", logo: "vonage.png", startX: -350, startY: 0 },
	{ name: "HubSpot", logo: "hubspot.png", startX: 350, startY: 0 },
	{ name: "Salesforce", logo: "salesforce.png", startX: -300, startY: 200 },
	{ name: "GoHighLevel", logo: "gohighlevel.png", startX: 300, startY: 200 },
	{ name: "Pipedrive", logo: "pipedrive.png", startX: -150, startY: 280 },
	{ name: "Cal.com", logo: "calcom.png", startX: 150, startY: 280 }
]

// Position on a circle around center
const getTargetPosition = (index: number, total: number) => {
	const angle = (index / total) * Math.PI * 2 - Math.PI / 2
	const radius = 240
	return {
		x: Math.cos(angle) * radius,
		y: Math.sin(angle) * radius
	}
}

const IntegrationNode: React.FC<{
	integration: (typeof INTEGRATIONS)[number]
	index: number
	frame: number
	fps: number
}> = ({ integration, index, frame, fps }) => {
	const delay = 15 + index * 7
	const target = getTargetPosition(index, INTEGRATIONS.length)

	const entrance = spring({
		frame,
		fps,
		config: { damping: 14, stiffness: 150 },
		delay
	})

	const x = interpolate(entrance, [0, 1], [integration.startX, target.x])
	const y = interpolate(entrance, [0, 1], [integration.startY, target.y])
	const opacity = interpolate(entrance, [0, 1], [0, 1])
	const scale = interpolate(entrance, [0, 1], [0.5, 1])

	return (
		<div
			style={{
				position: "absolute",
				left: "50%",
				top: "55%",
				transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`,
				opacity,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 8
			}}
		>
			<div
				style={{
					width: 56,
					height: 56,
					borderRadius: 14,
					border: `1px solid ${colors.cardBorder}`,
					backgroundColor: "rgba(255, 255, 255, 0.04)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					overflow: "hidden"
				}}
			>
				<Img
					src={staticFile(`logos/${integration.logo}`)}
					style={{
						width: 36,
						height: 36,
						objectFit: "contain"
					}}
				/>
			</div>
			<span
				style={{
					fontFamily: fonts.body,
					fontSize: 12,
					color: colors.whiteMuted,
					textAlign: "center"
				}}
			>
				{integration.name}
			</span>
		</div>
	)
}

// Animated connection lines from each integration to center
const ConnectionLines: React.FC<{
	frame: number
	fps: number
}> = ({ frame }) => {
	return (
		<svg
			width={1920}
			height={1080}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				pointerEvents: "none"
			}}
		>
			<title>Animated integration connection lines</title>
			{INTEGRATIONS.map((_, index) => {
				const target = getTargetPosition(index, INTEGRATIONS.length)
				const lineDelay = 35 + index * 7

				const lineProgress = interpolate(
					frame,
					[lineDelay, lineDelay + 20],
					[0, 1],
					{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
				)

				const cx = 960
				const cy = 594 // 55% of 1080

				const startX = cx + target.x
				const startY = cy + target.y

				// Line draws from integration toward center
				const endX = interpolate(lineProgress, [0, 1], [startX, cx])
				const endY = interpolate(lineProgress, [0, 1], [startY, cy])

				return (
					<line
						key={index}
						x1={startX}
						y1={startY}
						x2={endX}
						y2={endY}
						stroke={colors.amber}
						strokeWidth={1.5}
						opacity={lineProgress * 0.25}
					/>
				)
			})}
		</svg>
	)
}

export const ConnectStackScene: React.FC = () => {
	const frame = useCurrentFrame()
	const { fps } = useVideoConfig()

	// Step label entrance
	const labelEntrance = spring({
		frame,
		fps,
		config: { damping: 200 },
		durationInFrames: 15
	})

	const labelX = interpolate(labelEntrance, [0, 1], [-40, 0])
	const labelOpacity = interpolate(labelEntrance, [0, 1], [0, 1])

	const titleOpacity = interpolate(frame, [5, 18], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})
	const titleY = interpolate(frame, [5, 18], [20, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	// Center node (IcePhone)
	const centerEntrance = spring({
		frame,
		fps,
		config: { damping: 12, stiffness: 150 },
		delay: 10
	})

	const centerScale = interpolate(centerEntrance, [0, 1], [0, 1])
	const centerOpacity = interpolate(centerEntrance, [0, 1], [0, 1])

	// Center glow
	const centerGlow = interpolate(frame, [25, 55], [0, 0.3], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp"
	})

	return (
		<AbsoluteFill>
			{/* Step label - top left area */}
			<div
				style={{
					position: "absolute",
					top: 80,
					left: 120,
					display: "flex",
					alignItems: "center",
					gap: 16,
					zIndex: 10
				}}
			>
				<span
					style={{
						fontFamily: fonts.mono,
						fontSize: 18,
						color: "rgba(251, 191, 36, 0.6)",
						opacity: labelOpacity,
						transform: `translateX(${labelX}px)`
					}}
				>
					02
				</span>
				<span
					style={{
						fontFamily: fonts.headline,
						fontSize: 48,
						fontWeight: 400,
						color: colors.white,
						opacity: titleOpacity,
						transform: `translateY(${titleY}px)`,
						letterSpacing: "-0.01em"
					}}
				>
					Connect your phones & CRM.
				</span>
			</div>

			{/* Connection lines */}
			<ConnectionLines frame={frame} fps={fps} />

			{/* Center glow */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "55%",
					transform: "translate(-50%, -50%)",
					width: 200,
					height: 200,
					borderRadius: "50%",
					background: `radial-gradient(ellipse, rgba(255, 202, 128, ${centerGlow}) 0%, transparent 70%)`,
					pointerEvents: "none"
				}}
			/>

			{/* Center IcePhone node */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: "55%",
					transform: `translate(-50%, -50%) scale(${centerScale})`,
					opacity: centerOpacity,
					width: 110,
					height: 50,
					borderRadius: 14,
					border: `2px solid ${colors.cardBorderHover}`,
					backgroundColor: "rgba(255, 202, 128, 0.08)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				}}
			>
				<span
					style={{
						fontFamily: fonts.headline,
						fontSize: 16,
						fontWeight: 400,
						color: colors.amber,
						textAlign: "center",
						whiteSpace: "nowrap"
					}}
				>
					IcePhone
				</span>
			</div>

			{/* Integration nodes */}
			{INTEGRATIONS.map((integration, i) => (
				<IntegrationNode
					key={integration.name}
					integration={integration}
					index={i}
					frame={frame}
					fps={fps}
				/>
			))}
		</AbsoluteFill>
	)
}
