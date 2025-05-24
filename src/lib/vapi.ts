import Vapi from "@vapi-ai/web"

// Initialize Vapi client with proper configuration
export const createVapiClient = (): Vapi => {
	let webToken: string | undefined

	// Try to get from environment variables (client-side or development)
	if (typeof window !== "undefined") {
		// Client-side - use environment variable directly
		webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN
	} else {
		// Server-side - try both environment and Cloudflare context
		webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN

		if (!webToken) {
			try {
				// This will only work on the server side in production
				const {
					getCloudflareContext
				} = require("@opennextjs/cloudflare")
				const { env } = getCloudflareContext()
				webToken = env.NEXT_PUBLIC_VAPI_WEB_TOKEN
			} catch (error) {
				console.log(
					"Cloudflare context not available, using environment variable"
				)
			}
		}
	}

	if (!webToken) {
		throw new Error(
			"NEXT_PUBLIC_VAPI_WEB_TOKEN is not configured. Please check your environment variables."
		)
	}

	// Create Vapi instance with proper configuration
	return new Vapi(
		webToken,
		"https://api.vapi.ai", // API base URL
		{
			// Daily call config
			alwaysIncludeMicInPermissionPrompt: true
		},
		{
			// Daily call object options
			audioSource: true,
			startAudioOff: false
		}
	)
}

// Export factory function instead of singleton
export { Vapi }
