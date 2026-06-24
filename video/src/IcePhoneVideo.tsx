import React from "react"
import { AbsoluteFill } from "remotion"
import { TransitionSeries, linearTiming } from "@remotion/transitions"
import { fade } from "@remotion/transitions/fade"
import { AmbientBackground } from "./AmbientBackground"
import { ProblemScene } from "./scenes/ProblemScene"
import { SolutionScene } from "./scenes/SolutionScene"
import { BuildAgentScene } from "./scenes/BuildAgentScene"
import { ConnectStackScene } from "./scenes/ConnectStackScene"
import { LaunchMonitorScene } from "./scenes/LaunchMonitorScene"
import { CTAScene } from "./scenes/CTAScene"
import { SCENE_DURATIONS, TRANSITION_DURATION } from "./theme"

export const IcePhoneVideo: React.FC = () => {
	return (
		<AbsoluteFill>
			{/* Persistent ambient background layer */}
			<AmbientBackground />

			{/* Scene content with transitions */}
			<TransitionSeries>
				{/* Scene 1: The Problem */}
				<TransitionSeries.Sequence
					durationInFrames={SCENE_DURATIONS.problem}
				>
					<ProblemScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({
						durationInFrames: TRANSITION_DURATION
					})}
				/>

				{/* Scene 2: The Solution */}
				<TransitionSeries.Sequence
					durationInFrames={SCENE_DURATIONS.solution}
				>
					<SolutionScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({
						durationInFrames: TRANSITION_DURATION
					})}
				/>

				{/* Scene 3: Build Your Agent */}
				<TransitionSeries.Sequence
					durationInFrames={SCENE_DURATIONS.buildAgent}
				>
					<BuildAgentScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({
						durationInFrames: TRANSITION_DURATION
					})}
				/>

				{/* Scene 4: Connect Your Stack */}
				<TransitionSeries.Sequence
					durationInFrames={SCENE_DURATIONS.connectStack}
				>
					<ConnectStackScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({
						durationInFrames: TRANSITION_DURATION
					})}
				/>

				{/* Scene 5: Launch & Monitor */}
				<TransitionSeries.Sequence
					durationInFrames={SCENE_DURATIONS.launchMonitor}
				>
					<LaunchMonitorScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({
						durationInFrames: TRANSITION_DURATION
					})}
				/>

				{/* Scene 6: CTA */}
				<TransitionSeries.Sequence
					durationInFrames={SCENE_DURATIONS.cta}
				>
					<CTAScene />
				</TransitionSeries.Sequence>
			</TransitionSeries>
		</AbsoluteFill>
	)
}
