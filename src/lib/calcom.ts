const CALCOM_API_VERSION = "2024-08-13"
const CALCOM_BASE_URL =
	process.env.CALCOM_API_BASE_URL || "https://api.cal.com"

export interface CalcomRequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE"
	apiKey: string
	body?: Record<string, unknown>
}

async function calcomRequest<T>(
	path: string,
	{ method = "GET", apiKey, body }: CalcomRequestOptions
): Promise<T> {
	const response = await fetch(`${CALCOM_BASE_URL}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"cal-api-version": CALCOM_API_VERSION
		},
		body: body ? JSON.stringify(body) : undefined
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(
			`Cal.com API error ${response.status}: ${errorText || response.statusText}`
		)
	}

	return (await response.json()) as T
}

export async function createCalcomBooking<T>(
	apiKey: string,
	payload: Record<string, unknown>
) {
	return calcomRequest<T>("/v2/bookings", {
		method: "POST",
		apiKey,
		body: payload
	})
}

export async function getCalcomBookings<T>(
	apiKey: string,
	query: Record<string, string | number | undefined> = {}
) {
	const searchParams = new URLSearchParams()
	Object.entries(query).forEach(([key, value]) => {
		if (value === undefined || value === null) return
		searchParams.set(key, String(value))
	})

	const queryString = searchParams.toString()
	const path = queryString ? `/v2/bookings?${queryString}` : "/v2/bookings"
	return calcomRequest<T>(path, { apiKey })
}

export async function cancelCalcomBooking<T>(
	apiKey: string,
	bookingUid: string,
	payload: Record<string, unknown>
) {
	return calcomRequest<T>(`/v2/bookings/${bookingUid}/cancel`, {
		method: "POST",
		apiKey,
		body: payload
	})
}

export async function rescheduleCalcomBooking<T>(
	apiKey: string,
	bookingUid: string,
	payload: Record<string, unknown>
) {
	return calcomRequest<T>(`/v2/bookings/${bookingUid}/reschedule`, {
		method: "POST",
		apiKey,
		body: payload
	})
}
