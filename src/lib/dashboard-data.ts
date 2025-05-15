// Dashboard chart data for the CRM system

// Lead conversion funnel data
export const leadFunnelData = [
	{ name: "New", value: 386 },
	{ name: "Contacted", value: 245 },
	{ name: "Qualified", value: 172 },
	{ name: "Converted", value: 89 },
	{ name: "Lost", value: 58 }
]

// Lead acquisition over time (last 90 days)
export const leadAcquisitionData = (() => {
	const data = []
	const today = new Date()

	// Base pattern values for more consistent trends
	const baseTrend = [
		5,
		6,
		8,
		7,
		9,
		10,
		8, // Week 1
		6,
		5,
		8,
		9,
		11,
		10,
		8, // Week 2
		7,
		8,
		10,
		12,
		11,
		9,
		7, // Week 3
		6,
		8,
		9,
		10,
		11,
		12,
		9, // Week 4
		8,
		10,
		12,
		14,
		13,
		11,
		9, // Week 5
		7,
		9,
		11,
		13,
		15,
		14,
		12, // Week 6
		10,
		13,
		15,
		17,
		16,
		14,
		12, // Week 7
		11,
		14,
		16,
		18,
		19,
		17,
		15, // Week 8
		13,
		16,
		19,
		22,
		25,
		24,
		20, // Week 9
		18,
		22,
		25,
		28,
		27,
		24,
		19, // Week 10
		17,
		20,
		24,
		26,
		28,
		25,
		22, // Week 11
		20,
		23,
		26,
		28,
		30,
		29,
		25, // Week 12
		22,
		25,
		28,
		30,
		32,
		31,
		26 // Week 13
	]

	// Generate 90 days of data, going backwards from today
	for (let i = 90; i >= 1; i--) {
		const date = new Date()
		date.setDate(today.getDate() - i)
		const dateStr = date.toISOString().split("T")[0]

		const isWeekend = date.getDay() === 0 || date.getDay() === 6
		const dayIndex = 90 - i // Convert to 0-89 index for our baseTrend array

		// Base values with a consistent pattern
		const baseValue = baseTrend[Math.min(dayIndex, baseTrend.length - 1)]

		// Weekend dips (30-40% reduction)
		let newLeads = isWeekend ? Math.round(baseValue * 0.65) : baseValue

		// Special campaign effects - big jump starting at day 30
		if (i <= 30) {
			// Add a promotional spike that gradually normalizes
			const daysFromPromo = 30 - i
			if (daysFromPromo < 5) {
				// First 5 days of promo - big spike
				newLeads += 15
			} else if (daysFromPromo < 10) {
				// Next 5 days - sustained high
				newLeads += 12
			} else if (daysFromPromo < 15) {
				// Next 5 days - tapering off
				newLeads += 8
			} else {
				// Lingering effect - new baseline
				newLeads += 5
			}
		}

		// Calculate qualified leads as a proportion of new leads
		// Qualification rate improves over time (showing process improvement)
		let qualificationRate = 0.3 // Start at 30%
		if (i <= 60) qualificationRate = 0.35 // Improved to 35%
		if (i <= 30) qualificationRate = 0.45 // Further improved to 45%

		// Calculate qualified leads with some randomness
		const qualifiedLeads = Math.round(
			newLeads * qualificationRate * (0.9 + Math.random() * 0.2)
		)

		data.push({
			date: dateStr,
			newLeads,
			qualifiedLeads
		})
	}

	return data
})()

// Call activity data (last 90 days)
export const callActivityData = (() => {
	const data = []
	const today = new Date()

	// Base pattern values for outbound calls - showing a strategic approach
	const baseOutboundTrend = [
		12,
		15,
		18,
		20,
		15,
		10,
		8, // Week 1
		14,
		17,
		20,
		22,
		16,
		11,
		9, // Week 2
		15,
		18,
		22,
		25,
		18,
		12,
		10, // Week 3
		16,
		20,
		24,
		26,
		19,
		13,
		11, // Week 4
		18,
		22,
		27,
		30,
		22,
		14,
		12, // Week 5
		22,
		26,
		32,
		34,
		25,
		16,
		13, // Week 6
		25,
		30,
		35,
		38,
		30,
		20,
		15, // Week 7
		28,
		33,
		38,
		42,
		34,
		22,
		16, // Week 8
		30,
		36,
		42,
		45,
		38,
		25,
		18, // Week 9
		32,
		38,
		45,
		48,
		40,
		26,
		19, // Week 10
		35,
		40,
		46,
		50,
		42,
		28,
		20, // Week 11
		36,
		42,
		48,
		52,
		45,
		30,
		22, // Week 12
		38,
		45,
		50,
		55,
		48,
		32,
		24 // Week 13
	]

	// Base pattern for inbound calls - typically follows outbound with delay
	const baseInboundMultiplier = 0.3 // Inbound calls as percentage of outbound

	// Generate 90 days of data, going backwards from today
	for (let i = 90; i >= 1; i--) {
		const date = new Date()
		date.setDate(today.getDate() - i)
		const dateStr = date.toISOString().split("T")[0]

		const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
		const dayIndex = 90 - i // Convert to 0-89 index

		// Get base outbound value
		let outbound =
			baseOutboundTrend[Math.min(dayIndex, baseOutboundTrend.length - 1)]

		// Special campaign 1: Major outbound push from day 60-40
		if (i <= 60 && i > 40) {
			// Gradually increasing intensity
			const campaignDay = 60 - i
			outbound += Math.min(20, campaignDay * 1.5)
		}

		// Special campaign 2: Massive push around day 30-25
		if (i <= 30 && i > 20) {
			outbound += 35

			// Even higher on weekdays
			if (dayOfWeek > 0 && dayOfWeek < 6) {
				outbound += 10
			}
		}

		// Recent period sustaining higher activity
		if (i <= 20) {
			outbound += 25
		}

		// Calculate inbound calls as a response to outbound efforts
		// Inbound lags behind outbound with a delay of approximately 7-10 days
		const inboundBase = Math.round(outbound * baseInboundMultiplier)

		// Add delayed effect from previous outbound efforts
		let inbound = inboundBase

		// Delayed effect from campaign 1
		if (i <= 53 && i > 33) {
			inbound += 8
		}

		// Delayed effect from campaign 2
		if (i <= 23 && i > 13) {
			inbound += 15
		}

		// Sustained effect in recent period
		if (i <= 13) {
			inbound += 10
		}

		// Weekend dips for both inbound and outbound
		if (dayOfWeek === 0 || dayOfWeek === 6) {
			outbound = Math.round(outbound * 0.6)
			inbound = Math.round(inbound * 0.7)
		}

		data.push({
			date: dateStr,
			inbound,
			outbound
		})
	}

	return data
})()

// Lead sources distribution
export const leadSourceData = [
	{ name: "Website", value: 120 },
	{ name: "Cold Call", value: 98 },
	{ name: "Referral", value: 75 },
	{ name: "Social Media", value: 62 },
	{ name: "Email", value: 31 }
]

// Performance by agent data
export const agentPerformanceData = [
	{ name: "Sarah", calls: 156, appointments: 35, conversions: 22 },
	{ name: "Jessica", calls: 178, appointments: 42, conversions: 26 },
	{ name: "Mike", calls: 132, appointments: 28, conversions: 15 },
	{ name: "David", calls: 145, appointments: 32, conversions: 19 },
	{ name: "Emily", calls: 140, appointments: 25, conversions: 12 }
]

// Time periods for filtering
export const timeRangeOptions = [
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
	{ value: "90d", label: "Last 3 months" }
]

// Filter data for the specified time range
export function filterDataByTimeRange(
	data: Array<Record<string, unknown>>,
	timeRange: string,
	dateKey = "date"
) {
	// Make sure we have data to work with
	if (!data || data.length === 0) {
		return []
	}

	// Use actual filtering based on the selected time range
	let daysToSubtract = 30

	if (timeRange === "7d") {
		daysToSubtract = 7
	} else if (timeRange === "90d") {
		daysToSubtract = 90
	}

	// For demo purposes, this ensures consistent visualization
	if (timeRange === "7d") {
		return data.slice(-7) // Last 7 items
	}

	if (timeRange === "30d") {
		return data.slice(-30) // Last 30 items
	}

	return data // All data for 90d
}
