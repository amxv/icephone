"use client"

import { useTheme } from "next-themes"
import type * as React from "react"
import {
	Area,
	Bar,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	Pie,
	AreaChart as RechartsAreaChart,
	BarChart as RechartsBarChart,
	LineChart as RechartsLineChart,
	PieChart as RechartsPieChart,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis
} from "recharts"

export interface ChartConfig {
	[key: string]: {
		label: string
		color?: string
		formatter?: (value: number) => string
	}
}

interface ChartContainerProps {
	children: React.ReactNode
	config: ChartConfig
	className?: string
}

function ChartContext({
	children,
	config
}: {
	children: React.ReactNode
	config: ChartConfig
}) {
	const { theme } = useTheme()
	const isDark = theme === "dark"

	// Create a style object with CSS variables
	const styleObj: Record<string, string> = {
		"--chart-1": isDark ? "hsl(220, 95%, 60%)" : "hsl(220, 70%, 50%)",
		"--chart-2": isDark ? "hsl(180, 80%, 60%)" : "hsl(180, 70%, 45%)",
		"--chart-3": isDark ? "hsl(40, 85%, 50%)" : "hsl(40, 80%, 45%)",
		"--chart-4": isDark ? "hsl(300, 80%, 60%)" : "hsl(300, 70%, 50%)",
		"--chart-5": isDark ? "hsl(0, 85%, 65%)" : "hsl(0, 80%, 55%)"
	}

	// Add config colors to the style object
	for (const [key, value] of Object.entries(config)) {
		if (value.color) {
			styleObj[`--color-${key}`] = value.color
		}
	}

	return <div style={styleObj as React.CSSProperties}>{children}</div>
}

export function ChartContainer({
	children,
	config,
	className
}: ChartContainerProps) {
	return (
		<ChartContext config={config}>
			<div className={className}>{children}</div>
		</ChartContext>
	)
}

interface ChartTooltipContentProps {
	active?: boolean
	payload?: Array<{
		name?: string
		value?: number | string
		stroke?: string
		fill?: string
	}>
	formatter?: (value: number | string) => React.ReactNode
	labelFormatter?: (label: string | number) => React.ReactNode
	indicator?: "line" | "dot"
}

export function ChartTooltipContent({
	active,
	payload,
	label,
	formatter,
	labelFormatter,
	indicator = "line",
	...props
}: ChartTooltipContentProps & { label?: string | number }) {
	if (!active || !payload?.length) {
		return null
	}

	return (
		<div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md">
			<div className="mb-2 text-sm font-medium text-foreground">
				{labelFormatter
					? labelFormatter(label as string | number)
					: label}
			</div>
			<div className="space-y-1">
				{payload.map((item, index) => (
					<div
						key={`item-${item.name || ""}-${index}`}
						className="flex items-center text-xs justify-between gap-3"
					>
						<div className="flex items-center gap-1">
							{indicator === "line" ? (
								<div
									className="h-[2px] w-3"
									style={{
										backgroundColor:
											item.stroke || item.fill
									}}
								/>
							) : (
								<div
									className="h-2 w-2 rounded-full"
									style={{
										backgroundColor:
											item.stroke || item.fill
									}}
								/>
							)}
							<div className="whitespace-nowrap text-muted-foreground">
								{item.name}:
							</div>
						</div>
						<div className="font-medium">
							{formatter && item.value !== undefined
								? formatter(item.value)
								: item.value}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export const ChartTooltip = RechartsTooltip
