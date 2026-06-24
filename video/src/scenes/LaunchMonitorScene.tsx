import React from "react"
import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
	Easing
} from "remotion"
import { colors, fonts } from "../theme"

// Animated counter that ticks up to a target value
const AnimatedCounter: React.FC<{
	target: number
	suffix?: string
	prefix?: string
	label: string
	delay: number
	frame: number
	fps: number
}> = ({ target, suffix = "", prefix = "", label, delay, frame, fps }) => {
	const entrance = spring({
		frame,
		fps,
		config: { damping: 200 },
		delay
	})

	const countProgress = interpolate(frame, [delay + 3, delay + 35], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: Easing.out(Easing.quad)
	})

	const currentValue = Math.floor(countProgress * target)
	const opacity = interpolate(entrance, [0, 1], [0, 1])
	const translateY = interpolate(entrance, [0, 1], [30, 0])

	return (
		<div
			style={{
				opacity,
				transform: `translateY(${translateY}px)`,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 8,
				padding: "24px 32px",
				borderRadius: 20,
				border: `1px solid ${colors.cardBorder}`,
				backgroundColor: colors.cardBg,
				minWidth: 200
			}}
		>
			<span
				style={{
					fontFamily: fonts.body,
					fontSize: 42,
					fontWeight: 700,
					color: colors.amber,
					letterSpacing: "-0.02em"
				}}
			>
				{prefix}
				{currentValue.toLocaleString()}
				{suffix}
			</span>
			<span
				style={{
					fontFamily: fonts.body,
					fontSize: 14,
					fontWeight: 500,
					color: colors.whiteMuted
				}}
			>
				{label}
			</span>
		</div>
	)
}

// Simple bar chart
const BarChart: React.FC<{
	frame: number
	fps: number
}> = ({ frame, fps }) => {
	const bars = [65, 42, 78, 55, 90, 68, 85]
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

	const chartEntrance = spring({
		frame,
		fps,
		config: { damping: 200 },
		delay: 25
	})

	const chartOpacity = interpolate(chartEntrance, [0, 1], [0, 1])

	return (
		<div
			style={{
				opacity: chartOpacity,
				padding: "20px 24px",
				borderRadius: 20,
				border: `1px solid ${colors.cardBorder}`,
				backgroundColor: colors.cardBg
			}}
		>
			<span
				style={{
					fontFamily: fonts.body,
					fontSize: 14,
					fontWeight: 500,
					color: colors.whiteSubtle,
					marginBottom: 16,
					display: "block"
				}}
			>
				Calls This Week
			</span>
			<div
				style={{
					display: "flex",
					alignItems: "flex-end",
					gap: 10,
					height: 120
				}}
			>
				{bars.map((value, i) => {
					const barDelay = 30 + i * 4
					const barGrowth = interpolate(
						frame,
						[barDelay, barDelay + 22],
						[0, 1],
						{
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
							easing: Easing.out(Easing.quad)
						}
					)

					const barHeight = value * barGrowth * 1.1

					return (
						<div
							key={i}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 6
							}}
						>
							<div
								style={{
									width: 32,
									height: barHeight,
									borderRadius: 6,
									backgroundColor:
										value >= 80
											? colors.amber
											: "rgba(255, 202, 128, 0.3)"
								}}
							/>
							<span
								style={{
									fontFamily: fonts.mono,
									fontSize: 10,
									color: colors.whiteSubtle
								}}
							>
								{days[i]}
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

// Sentiment indicator dots
const SentimentIndicator: React.FC<{
	frame: number
	fps: number
}> = ({ frame, fps }) => {
	const entrance = spring({
		frame,
		fps,
		config: { damping: 200 },
		delay: 35
	})

	const opacity = interpolate(entrance, [0, 1], [0, 1])
	const translateY = interpolate(entrance, [0, 1], [20, 0])

	const sentiments = [
		{ label: "Positive", value: 72, color: "#4ade80" },
		{ label: "Neutral", value: 21, color: "#facc15" },
		{ label: "Negative", value: 7, color: "#f87171" }
	]

	return (
		<div
			style={{
				opacity,
				transform: `translateY(${translateY}px)`,
				padding: "20px 24px",
				borderRadius: 20,
				border: `1px solid ${colors.cardBorder}`,
				backgroundColor: colors.cardBg
			}}
		>
			<span
				style={{
					fontFamily: fonts.body,
					fontSize: 14,
					fontWeight: 500,
					color: colors.whiteSubtle,
					marginBottom: 16,
					display: "block"
				}}
			>
				Call Sentiment
			</span>
			<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
				{sentiments.map((s) => {
					const barWidth = interpolate(
						frame,
						[40, 70],
						[0, s.value],
						{
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
							easing: Easing.out(Easing.quad)
						}
					)

					return (
						<div
							key={s.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10
							}}
						>
							<span
								style={{
									fontFamily: fonts.body,
									fontSize: 12,
									color: colors.whiteMuted,
									width: 60
								}}
							>
								{s.label}
							</span>
							<div
								style={{
									flex: 1,
									height: 8,
									borderRadius: 4,
									backgroundColor:
										"rgba(255, 255, 255, 0.05)",
									overflow: "hidden"
								}}
							>
								<div
									style={{
										width: `${barWidth}%`,
										height: "100%",
										borderRadius: 4,
										backgroundColor: s.color,
										opacity: 0.7
									}}
								/>
							</div>
							<span
								style={{
									fontFamily: fonts.mono,
									fontSize: 12,
									color: colors.whiteMuted,
									width: 30,
									textAlign: "right"
								}}
							>
								{Math.round(barWidth)}%
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export const LaunchMonitorScene: React.FC = () => {
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

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center",
				padding: "0 100px"
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 36,
					width: "100%",
					maxWidth: 1200
				}}
			>
				{/* Step label */}
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 18,
							color: "rgba(251, 191, 36, 0.6)",
							opacity: labelOpacity,
							transform: `translateX(${labelX}px)`
						}}
					>
						03
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
						Launch and monitor.
					</span>
				</div>

				{/* Dashboard mockup */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 20
					}}
				>
					{/* Counter row */}
					<div
						style={{
							display: "flex",
							gap: 20,
							justifyContent: "flex-start"
						}}
					>
						<AnimatedCounter
							target={1247}
							label="Calls Made"
							delay={12}
							frame={frame}
							fps={fps}
						/>
						<AnimatedCounter
							target={89}
							label="Appointments Booked"
							delay={18}
							frame={frame}
							fps={fps}
						/>
						<AnimatedCounter
							target={94}
							suffix="%"
							label="Positive Sentiment"
							delay={24}
							frame={frame}
							fps={fps}
						/>
					</div>

					{/* Charts row */}
					<div style={{ display: "flex", gap: 20 }}>
						<div style={{ flex: 1 }}>
							<BarChart frame={frame} fps={fps} />
						</div>
						<div style={{ flex: 1 }}>
							<SentimentIndicator frame={frame} fps={fps} />
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	)
}
