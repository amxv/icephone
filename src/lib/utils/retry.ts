export interface RetryOptions {
	maxAttempts?: number
	initialDelay?: number
}

export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	const { maxAttempts = 3, initialDelay = 1000 } = options
	let lastError: unknown

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error
			if (attempt === maxAttempts) {
				break
			}
			const delay = initialDelay * Math.pow(2, attempt - 1)
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	throw lastError
}
