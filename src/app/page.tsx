import type { Metadata } from "next"
import { Instrument_Serif } from "next/font/google"
import { LandingPage } from "@/components/landing-page"

const instrumentSerif = Instrument_Serif({
	weight: "400",
	subsets: ["latin"],
	display: "swap",
	variable: "--font-instrument-serif"
})

export const metadata: Metadata = {
	title: "IcePhone — AI Voice Agents for Sales, Support, and Collections",
	description:
		"Deploy AI voice agents that make and receive real phone calls. Automate outbound campaigns, inbound support, appointment setting, and collections with IcePhone."
}

export default function Page() {
	return (
		<div className={instrumentSerif.variable}>
			<LandingPage />
		</div>
	)
}
