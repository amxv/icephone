import "./index.css"
import React from "react"
import { Composition } from "remotion"
import { IcePhoneVideo } from "./IcePhoneVideo"
import { FPS, TOTAL_DURATION } from "./theme"

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="IcePhoneVideo"
			component={IcePhoneVideo}
			durationInFrames={TOTAL_DURATION}
			fps={FPS}
			width={1920}
			height={1080}
		/>
	)
}
