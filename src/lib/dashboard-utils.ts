// Helper function to filter data by time range (for compatibility with existing code)
export function filterDataByTimeRange<T extends { date: string }>(
	data: T[],
	timeRange: string
): T[] {
	if (!data || data.length === 0) return []

	let daysToKeep = 30
	if (timeRange === "7d") daysToKeep = 7
	else if (timeRange === "90d") daysToKeep = 90

	return data.slice(-daysToKeep)
}
