import type React from "react"

type SpinnerProps = React.SVGAttributes<SVGElement> & {
	speed?: number
	thickness?: number
	color?: string
	size?: number | string
}

const defaultProps = {
	speed: 100,
	thickness: 150,
	color: "text-primary",
	size: 100
}

const coords = [
	{ x: 22, y: -20 },
	{ x: 29, y: 0 },
	{ x: 22, y: 20 },
	{ x: 0, y: 30 },
	{ x: -23, y: 20 },
	{ x: -30, y: 0 },
	{ x: -23, y: -20 },
	{ x: 0, y: -30 }
]

export const DottedSpinner: React.FC<SpinnerProps> = ({
	speed = defaultProps.speed,
	thickness = defaultProps.thickness,
	color = defaultProps.color,
	size = defaultProps.size,

	...svgProps
}) => {
	const duration = 200 / speed
	const normalizedSize = typeof size === "number" ? `${size}px` : size

	return (
		<svg
			fill="none"
			viewBox="0 0 66 66"
			className={`overflow-visible ${color}`}
			style={
				{
					width: normalizedSize,
					height: normalizedSize,
					"--duration": `${duration}s`
				} as React.CSSProperties
			}
			{...svgProps}
		>
			<title>Loading...</title>
			{coords.map((c, i) => (
				<circle
					key={`${c.x}-${c.y}`}
					cx="33"
					cy="33"
					r={3 * (thickness / 100)}
					className="fill-current animate-spinners-react-dotted-shrink"
					style={
						{
							transform: `translate(${c.x}px, ${c.y}px)`,
							"--delay": `${(duration / 20) * i}s`
						} as React.CSSProperties
					}
				/>
			))}
			<circle
				cx="33"
				cy="33"
				r={7 * (thickness / 100)}
				className="fill-current animate-spinners-react-dotted-center origin-center"
			/>
		</svg>
	)
}
