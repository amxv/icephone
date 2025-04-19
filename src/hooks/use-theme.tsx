import { useEffect, useState } from "react"

const useThemeDetector = () => {
	const [isLightMode, setIsLightMode] = useState(true)

	useEffect(() => {
		const mediaQueryList = window.matchMedia(
			"(prefers-color-scheme: light)"
		)
		setIsLightMode(mediaQueryList.matches)

		const listener = (event: MediaQueryListEvent) => {
			setIsLightMode(event.matches)
		}

		mediaQueryList.addEventListener("change", listener)

		return () => {
			mediaQueryList.removeEventListener("change", listener)
		}
	}, [])

	return isLightMode
}

export default useThemeDetector
