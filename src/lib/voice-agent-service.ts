import type { AgentRole } from "@/actions/agent-roles"
import type { VoicePreset } from "@/actions/voice-presets"
import { VapiClient, VapiError, type Vapi } from "@vapi-ai/server-sdk"

// Environment variable access pattern for Cloudflare Workers + development
async function getEnvironmentVariables() {
	let publicKey: string | undefined
	let secretKey: string | undefined
	let endPoint: string | undefined

	// Try to get from Cloudflare context first (for production)
	try {
		const { getCloudflareContext } = await import("@opennextjs/cloudflare")
		const { env } = getCloudflareContext()
		publicKey = env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
		secretKey = env.VAPI_SECRET_KEY
		endPoint = env.NEXT_PUBLIC_VAPI_ENDPOINT
	} catch {
		// Fallback to process.env for development
		publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
		secretKey = process.env.VAPI_SECRET_KEY
		endPoint = process.env.NEXT_PUBLIC_VAPI_ENDPOINT
	}

	return { publicKey, secretKey, endPoint }
}

// Voice codename to VAPI configuration mapping with fallbacks
const VOICE_CODENAME_MAPPING = {
	// English voices
	professional: {
		provider: "11labs",
		voiceId: "pNInz6obpgDQGcFmaJgB", // Adam - professional male voice
		fallback: "JBFqnCBsd6RMkjVDRZzb" // George - fallback professional voice
	},
	friendly: {
		provider: "11labs",
		voiceId: "XrExE9yKIg1WjnnlVkGX", // Matilda - friendly female voice
		fallback: "EXAVITQu4vr4xnSDxMaL" // Bella - fallback friendly voice
	},
	warm: {
		provider: "11labs",
		voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella - warm female voice
		fallback: "XrExE9yKIg1WjnnlVkGX" // Matilda - fallback warm voice
	},
	confident: {
		provider: "11labs",
		voiceId: "ErXwobaYiN019PkySvjV", // Antoni - confident male voice
		fallback: "pNInz6obpgDQGcFmaJgB" // Adam - fallback confident voice
	},
	energetic: {
		provider: "11labs",
		voiceId: "MF3mGyEYCl7XYWbV9V6O", // Elli - energetic female voice
		fallback: "XrExE9yKIg1WjnnlVkGX" // Matilda - fallback energetic voice
	},

	// Spanish voices
	"carlos-profesional": {
		provider: "11labs",
		voiceId: "pNInz6obpgDQGcFmaJgB", // Using Adam for Spanish professional
		fallback: "JBFqnCBsd6RMkjVDRZzb"
	},
	"maria-amigable": {
		provider: "11labs",
		voiceId: "XrExE9yKIg1WjnnlVkGX", // Using Matilda for Spanish friendly
		fallback: "EXAVITQu4vr4xnSDxMaL"
	},

	// French voices
	"pierre-professionnel": {
		provider: "11labs",
		voiceId: "pNInz6obpgDQGcFmaJgB",
		fallback: "JBFqnCBsd6RMkjVDRZzb"
	},
	"sophie-chaleureuse": {
		provider: "11labs",
		voiceId: "EXAVITQu4vr4xnSDxMaL",
		fallback: "XrExE9yKIg1WjnnlVkGX"
	},

	// German voices
	"hans-professionell": {
		provider: "11labs",
		voiceId: "pNInz6obpgDQGcFmaJgB",
		fallback: "JBFqnCBsd6RMkjVDRZzb"
	},
	"anna-freundlich": {
		provider: "11labs",
		voiceId: "XrExE9yKIg1WjnnlVkGX",
		fallback: "EXAVITQu4vr4xnSDxMaL"
	}
} as const

// Language to STT/TTS model mapping with fallbacks
const LANGUAGE_MODEL_MAPPING = {
	en: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	es: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	fr: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	de: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	it: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	pt: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	zh: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	hi: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	ar: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	},
	ja: {
		stt: "nova-2-general",
		tts: "tts-1",
		fallbackStt: "nova-2",
		fallbackTts: "tts-1-hd"
	}
} as const

// Performance metrics interface
interface VapiMetrics {
	callQuality: number
	averageLatency: number
	successRate: number
	errorRate: number
	lastUpdated: Date
	totalCalls: number
	failedCalls: number
}

// Health status interface
interface HealthStatus {
	status: "healthy" | "degraded" | "down"
	details: string
	lastChecked: Date
	errors: string[]
}

// Assistant configuration for VAPI
interface VapiAssistantConfig {
	name: string
	model: {
		provider: "openai" | "anthropic" | "together-ai"
		model: string
		messages: Array<{
			role: "system" | "user" | "assistant"
			content: string
		}>
		temperature?: number
		maxTokens?: number
	}
	voice: {
		provider: "11labs" | "playht" | "azure"
		voiceId: string
		speed?: number
		stability?: number
		similarityBoost?: number
	}
	transcriber: {
		provider: "deepgram" | "assembly-ai" | "whisper"
		model: string
		language?: string
	}
	firstMessage?: string
	recordingEnabled?: boolean
	silenceTimeoutSeconds?: number
	maxDurationSeconds?: number
	backgroundSound?: "office" | "call-center" | "none"
	backchannelingEnabled?: boolean
	backgroundDenoisingEnabled?: boolean
	modelOutputInMessagesEnabled?: boolean
}

// Call data interface for webhook processing
interface CallData {
	id: string
	assistantId: string
	status: "queued" | "ringing" | "in-progress" | "forwarding" | "ended"
	startedAt?: string
	endedAt?: string
	cost?: number
	costBreakdown?: {
		transport: number
		stt: number
		llm: number
		tts: number
		vapi: number
		total: number
	}
	messages?: Array<{
		role: string
		message: string
		time: number
		endTime?: number
		secondsFromStart: number
	}>
	transcript?: string
	summary?: string
	endedReason?: string
	recordingUrl?: string
	metadata?: Record<string, unknown>
}

/**
 * VoiceAgentService - Complete abstraction layer for VAPI AI with reliability features
 *
 * This service provides:
 * - Real VAPI SDK integration with automatic retries
 * - Graceful failure management with fallbacks
 * - Business continuity through backup configurations
 * - Health monitoring and automatic recovery
 * - Performance optimization based on call metrics
 */
export class VoiceAgentService {
	private static instance: VoiceAgentService
	private vapiClient: VapiClient | null = null
	private metricsCache = new Map<string, VapiMetrics>()
	private healthStatus: HealthStatus = {
		status: "healthy",
		details: "Service starting",
		lastChecked: new Date(),
		errors: []
	}
	private lastHealthCheck = 0
	private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
	private readonly MAX_RETRIES = 3
	private readonly RETRY_DELAY = 1000 // 1 second

	private constructor() {}

	static getInstance(): VoiceAgentService {
		if (!VoiceAgentService.instance) {
			VoiceAgentService.instance = new VoiceAgentService()
		}
		return VoiceAgentService.instance
	}

	/**
	 * Initialize VAPI client with automatic retry and error handling
	 */
	private async initializeVapiClient(): Promise<VapiClient> {
		if (this.vapiClient) {
			return this.vapiClient
		}

		const { secretKey } = await getEnvironmentVariables()

		if (!secretKey) {
			throw new Error("VAPI_SECRET_KEY environment variable is required")
		}

		try {
			this.vapiClient = new VapiClient({
				token: secretKey
			})

			// Test the connection
			await this.healthCheck()

			return this.vapiClient
		} catch (error) {
			console.error("Failed to initialize VAPI client:", error)
			throw new Error(
				`VAPI initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	/**
	 * Convert simple business configuration to complex VAPI assistant with fallbacks
	 */
	async createVAPIAssistant(config: {
		name: string
		agentRole: AgentRole
		voicePreset: VoicePreset
		language: string
		industryContext?: string
		phoneNumberId?: number
	}): Promise<{ assistantId: string; configuration: VapiAssistantConfig }> {
		const vapiClient = await this.initializeVapiClient()

		const voiceConfig = this.mapVoiceToVapiConfig(
			config.voicePreset.codename,
			config.language
		)

		// Build the assistant configuration using proper VAPI types
		const assistantConfig: Vapi.CreateAssistantDto = {
			name: config.name,
			transcriber: {
				provider: "deepgram",
				model: "nova-2-phonecall" as Vapi.DeepgramTranscriberModel,
				language: this.mapLanguageToDeepgramLanguage(config.language)
			},
			model: {
				provider: "openai",
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: this.generateSystemPrompt(
							config.agentRole,
							config.industryContext || ""
						)
					}
				],
				temperature: 0.7,
				maxTokens: 150
			},
			voice: {
				provider: "11labs",
				voiceId: voiceConfig.voiceId,
				speed: 1.0,
				stability: 0.5,
				similarityBoost: 0.7
			},
			firstMessage: this.generateFirstMessage(
				config.agentRole,
				config.language
			),
			silenceTimeoutSeconds: 30,
			maxDurationSeconds: 1800,
			backgroundSound: "office",
			artifactPlan: {
				recordingEnabled: true
			},
			clientMessages: ["status-update", "transcript"],
			serverMessages: ["status-update", "function-call", "transcript"]
		}

		try {
			const result = await vapiClient.assistants.create(assistantConfig)

			// Initialize performance metrics tracking
			this.metricsCache.set(result.id, {
				callQuality: 1.0,
				averageLatency: 0,
				successRate: 1.0,
				errorRate: 0,
				lastUpdated: new Date(),
				totalCalls: 0,
				failedCalls: 0
			})

			console.log(`Successfully created VAPI assistant ${result.id}`)

			// Convert the result to our internal config format
			const internalConfig: VapiAssistantConfig = {
				name: result.name || config.name,
				model: {
					provider: "openai",
					model: "gpt-4o-mini",
					messages: [
						{
							role: "system",
							content: this.generateSystemPrompt(
								config.agentRole,
								config.industryContext || ""
							)
						}
					],
					temperature: 0.7,
					maxTokens: 150
				},
				voice: {
					provider: "11labs",
					voiceId: voiceConfig.voiceId,
					speed: 1.0,
					stability: 0.5,
					similarityBoost: 0.7
				},
				transcriber: {
					provider: "deepgram",
					model: "nova-2-phonecall",
					language: config.language
				},
				firstMessage: assistantConfig.firstMessage,
				recordingEnabled: true,
				silenceTimeoutSeconds: assistantConfig.silenceTimeoutSeconds,
				maxDurationSeconds: assistantConfig.maxDurationSeconds,
				backgroundSound: assistantConfig.backgroundSound as
					| "office"
					| "call-center"
					| "none",
				backchannelingEnabled: false,
				backgroundDenoisingEnabled: false,
				modelOutputInMessagesEnabled: false
			}

			return {
				assistantId: result.id,
				configuration: internalConfig
			}
		} catch (error) {
			console.error("Failed to create VAPI assistant:", error)
			throw new Error(
				`VAPI assistant creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	/**
	 * Handle configuration updates with automatic retry and fallback
	 */
	async updateVAPIAssistant(
		assistantId: string,
		changes: {
			name?: string
			agentRole?: AgentRole
			voicePreset?: VoicePreset
			language?: string
			industryContext?: string
		}
	): Promise<void> {
		let lastError: Error | null = null

		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const vapiClient = await this.initializeVapiClient()

				// Build partial configuration update
				const updateConfig: Partial<Vapi.UpdateAssistantDto> = {}

				if (changes.name) {
					updateConfig.name = changes.name
				}

				if (changes.agentRole || changes.industryContext) {
					const systemPrompt = changes.agentRole?.systemPrompt || ""
					const industryContext = changes.industryContext
						? `\n\nIndustry Context: ${changes.industryContext}`
						: ""

					updateConfig.model = {
						provider: "openai",
						model: "gpt-4o-mini",
						messages: [
							{
								role: "system",
								content: systemPrompt + industryContext
							}
						],
						temperature: 0.7,
						maxTokens: 1000
					}
				}

				if (changes.voicePreset && changes.language) {
					const voiceConfig = this.mapVoiceToVapiConfig(
						changes.voicePreset.codename,
						changes.language
					)
					updateConfig.voice = {
						provider: "11labs",
						voiceId: voiceConfig.voiceId,
						speed: 1.0,
						stability: 0.8,
						similarityBoost: 0.8
					}
				}

				if (changes.language) {
					updateConfig.transcriber = {
						provider: "deepgram",
						model: "nova-2-phonecall" as Vapi.DeepgramTranscriberModel,
						language: this.mapLanguageToDeepgramLanguage(
							changes.language
						)
					}
				}

				// Apply updates to VAPI assistant
				await vapiClient.assistants.update(assistantId, updateConfig)

				console.log(
					`Successfully updated VAPI assistant ${assistantId} on attempt ${attempt}`
				)
				return
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error("Unknown error")
				console.error(
					`Attempt ${attempt} failed to update VAPI assistant:`,
					lastError.message
				)

				if (error instanceof VapiError && error.statusCode === 404) {
					throw new Error(`Assistant ${assistantId} not found`)
				}

				if (attempt === this.MAX_RETRIES) {
					break
				}

				await this.delay(this.RETRY_DELAY * 2 ** (attempt - 1))
			}
		}

		this.recordGlobalError(
			`Failed to update assistant ${assistantId} after ${this.MAX_RETRIES} attempts: ${lastError?.message}`
		)
		throw new Error(
			`Failed to update VAPI assistant after ${this.MAX_RETRIES} attempts: ${lastError?.message}`
		)
	}

	/**
	 * Delete assistant with retry logic
	 */
	async deleteVAPIAssistant(assistantId: string): Promise<void> {
		let lastError: Error | null = null

		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const vapiClient = await this.initializeVapiClient()
				await vapiClient.assistants.delete(assistantId)

				// Clean up metrics cache
				this.metricsCache.delete(assistantId)

				console.log(
					`Successfully deleted VAPI assistant ${assistantId}`
				)
				return
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error("Unknown error")
				console.error(
					`Attempt ${attempt} failed to delete VAPI assistant:`,
					lastError.message
				)

				// 404 is acceptable for delete operations
				if (error instanceof VapiError && error.statusCode === 404) {
					console.log(`Assistant ${assistantId} already deleted`)
					this.metricsCache.delete(assistantId)
					return
				}

				if (attempt === this.MAX_RETRIES) {
					break
				}

				await this.delay(this.RETRY_DELAY * 2 ** (attempt - 1))
			}
		}

		this.recordGlobalError(
			`Failed to delete assistant ${assistantId} after ${this.MAX_RETRIES} attempts: ${lastError?.message}`
		)
		throw new Error(
			`Failed to delete VAPI assistant after ${this.MAX_RETRIES} attempts: ${lastError?.message}`
		)
	}

	/**
	 * Automatic performance optimization based on call metrics
	 */
	async optimizeAssistantPerformance(assistantId: string): Promise<void> {
		try {
			const metrics = this.metricsCache.get(assistantId)
			if (!metrics || metrics.totalCalls < 5) {
				return // Need more data for optimization
			}

			// Check if performance has declined
			const needsOptimization =
				metrics.callQuality < 0.8 ||
				metrics.averageLatency > 3000 ||
				metrics.errorRate > 0.1 ||
				metrics.successRate < 0.9

			if (!needsOptimization) {
				return
			}

			console.log(
				`Optimizing assistant ${assistantId} - Performance metrics below threshold`
			)

			// Apply automatic optimizations
			const optimizations: Record<string, unknown> = {}

			// Switch to more stable model if error rate is high
			if (metrics.errorRate > 0.1) {
				optimizations.model = {
					provider: "openai",
					model: "gpt-4o", // More stable than gpt-4o-mini
					temperature: 0.5 // More conservative
				}
			}

			// Switch to fallback voice if quality is poor
			if (metrics.callQuality < 0.8) {
				optimizations.voice = {
					provider: "11labs",
					voiceId: "pNInz6obpgDQGcFmaJgB", // Adam - reliable fallback
					speed: 0.9, // Slightly slower for clarity
					stability: 0.9,
					similarityBoost: 0.7
				}
			}

			// Adjust timeout settings if latency is high
			if (metrics.averageLatency > 3000) {
				optimizations.silenceTimeoutSeconds = 20 // Shorter timeout
				optimizations.backgroundDenoisingEnabled = false // Reduce processing
			}

			if (Object.keys(optimizations).length > 0) {
				await this.updateVAPIAssistant(assistantId, optimizations)
				console.log(`Applied optimizations to assistant ${assistantId}`)
			}
		} catch (error) {
			console.error(`Failed to optimize assistant ${assistantId}:`, error)
			this.recordGlobalError(
				`Optimization failed for ${assistantId}: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	/**
	 * Process VAPI webhook events with error handling
	 */
	async handleVAPIWebhook(payload: {
		type:
			| "assistant-request"
			| "status-update"
			| "end-of-call-report"
			| "function-call"
			| "hang"
			| "speech-update"
			| "transcript"
			| "tool-calls"
		call?: CallData
		message?: unknown
		assistantId?: string
	}): Promise<void> {
		try {
			const { type, call, assistantId } = payload

			if (!assistantId && !call?.assistantId) {
				console.warn("Webhook received without assistant ID")
				return
			}

			const effectiveAssistantId = assistantId || call?.assistantId || ""

			switch (type) {
				case "status-update":
					if (call?.status === "in-progress") {
						console.log(
							`Call started for assistant ${effectiveAssistantId}`
						)
					}
					break

				case "end-of-call-report":
					if (call) {
						// Update performance metrics
						await this.updatePerformanceMetrics(
							effectiveAssistantId,
							{
								duration:
									call.endedAt && call.startedAt
										? new Date(call.endedAt).getTime() -
											new Date(call.startedAt).getTime()
										: 0,
								successful:
									call.status === "ended" &&
									call.endedReason !== "assistant-error",
								cost: call.cost || 0,
								transcript: call.transcript
							}
						)

						// Trigger automatic optimization if needed
						await this.optimizeAssistantPerformance(
							effectiveAssistantId
						)
					}
					break

				case "function-call":
					// Handle function call webhook
					console.log(
						`Function call received for assistant ${effectiveAssistantId}`
					)
					break

				case "transcript":
					// Process transcript for insights
					console.log(
						`Transcript received for assistant ${effectiveAssistantId}`
					)
					break

				default:
					console.log(`Unhandled webhook type: ${type}`)
			}
		} catch (error) {
			console.error("Failed to process VAPI webhook:", error)
			this.recordGlobalError(
				`Webhook processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
			)
		}
	}

	/**
	 * Comprehensive health check with service monitoring
	 */
	async healthCheck(): Promise<HealthStatus> {
		const now = Date.now()

		// Return cached status if checked recently
		if (
			now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL &&
			this.healthStatus.status !== "down"
		) {
			return this.healthStatus
		}

		this.lastHealthCheck = now
		const errors: string[] = []

		try {
			const { secretKey } = await getEnvironmentVariables()

			if (!secretKey) {
				errors.push("VAPI_SECRET_KEY environment variable missing")
				this.healthStatus = {
					status: "down",
					details: "Missing API configuration",
					lastChecked: new Date(),
					errors
				}
				return this.healthStatus
			}

			// Test VAPI connectivity
			const vapiClient = await this.initializeVapiClient()

			// Try to list assistants to test API connectivity
			const assistants = await vapiClient.assistants.list({
				limit: 1
			})

			// Check if we can access the API
			if (assistants) {
				this.healthStatus = {
					status: "healthy",
					details: "All systems operational",
					lastChecked: new Date(),
					errors: []
				}
			} else {
				errors.push("VAPI API returned unexpected response")
				this.healthStatus = {
					status: "degraded",
					details: "API connectivity issues",
					lastChecked: new Date(),
					errors
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error"
			errors.push(`VAPI connectivity test failed: ${errorMessage}`)

			this.healthStatus = {
				status: "down",
				details: "Service unavailable",
				lastChecked: new Date(),
				errors
			}
		}

		return this.healthStatus
	}

	/**
	 * Get current health status
	 */
	getHealthStatus(): HealthStatus {
		return { ...this.healthStatus }
	}

	/**
	 * Map voice codename to VAPI voice configuration with fallbacks
	 */
	private mapVoiceToVapiConfig(
		codename: string,
		language: string
	): { voiceId: string; fallbackVoiceId: string } {
		const voiceConfig =
			VOICE_CODENAME_MAPPING[
				codename as keyof typeof VOICE_CODENAME_MAPPING
			]

		if (voiceConfig) {
			return {
				voiceId: voiceConfig.voiceId,
				fallbackVoiceId: voiceConfig.fallback
			}
		}

		// Fallback to default voice for language
		const fallbackVoices = {
			en: VOICE_CODENAME_MAPPING.professional,
			es: VOICE_CODENAME_MAPPING["carlos-profesional"],
			fr: VOICE_CODENAME_MAPPING["pierre-professionnel"],
			de: VOICE_CODENAME_MAPPING["hans-professionell"]
		}

		const fallback =
			fallbackVoices[language as keyof typeof fallbackVoices] ||
			VOICE_CODENAME_MAPPING.professional

		return {
			voiceId: fallback.voiceId,
			fallbackVoiceId: fallback.fallback
		}
	}

	/**
	 * Map language to appropriate STT/TTS models with fallbacks
	 */
	private mapLanguageToModels(language: string): {
		stt: string
		tts: string
		fallbackStt: string
		fallbackTts: string
	} {
		return (
			LANGUAGE_MODEL_MAPPING[
				language as keyof typeof LANGUAGE_MODEL_MAPPING
			] || LANGUAGE_MODEL_MAPPING.en
		)
	}

	/**
	 * Update performance metrics for an assistant
	 */
	private async updatePerformanceMetrics(
		assistantId: string,
		callData: {
			duration: number
			successful: boolean
			cost?: number
			transcript?: string
		}
	): Promise<void> {
		const current = this.metricsCache.get(assistantId) || {
			callQuality: 1.0,
			averageLatency: 0,
			successRate: 1.0,
			errorRate: 0,
			lastUpdated: new Date(),
			totalCalls: 0,
			failedCalls: 0
		}

		const newTotalCalls = current.totalCalls + 1
		const newFailedCalls =
			current.failedCalls + (callData.successful ? 0 : 1)
		const newSuccessRate = (newTotalCalls - newFailedCalls) / newTotalCalls
		const newErrorRate = newFailedCalls / newTotalCalls

		// Calculate call quality based on success rate and transcript quality
		let callQuality = newSuccessRate
		if (callData.transcript && callData.transcript.length > 50) {
			// Boost quality for calls with substantial conversation
			callQuality = Math.min(callQuality + 0.1, 1.0)
		}

		// Update average latency (simplified calculation based on duration)
		const newLatency =
			callData.duration > 0
				? (current.averageLatency * current.totalCalls +
						callData.duration) /
					newTotalCalls
				: current.averageLatency

		this.metricsCache.set(assistantId, {
			callQuality,
			averageLatency: newLatency,
			successRate: newSuccessRate,
			errorRate: newErrorRate,
			totalCalls: newTotalCalls,
			failedCalls: newFailedCalls,
			lastUpdated: new Date()
		})
	}

	/**
	 * Record global error for monitoring
	 */
	private recordGlobalError(error: string): void {
		this.healthStatus.errors.push(`${new Date().toISOString()}: ${error}`)

		// Keep only last 10 errors
		if (this.healthStatus.errors.length > 10) {
			this.healthStatus.errors = this.healthStatus.errors.slice(-10)
		}

		// Update health status if we're seeing too many errors
		if (this.healthStatus.errors.length > 5) {
			this.healthStatus.status = "degraded"
			this.healthStatus.details = "Multiple errors detected"
		}
	}

	/**
	 * Get performance metrics for an assistant
	 */
	getPerformanceMetrics(assistantId: string): VapiMetrics | null {
		return this.metricsCache.get(assistantId) || null
	}

	/**
	 * Utility function for delays in retry logic
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Clear all cached data (useful for testing)
	 */
	clearCache(): void {
		this.metricsCache.clear()
		this.vapiClient = null
		this.healthStatus = {
			status: "healthy",
			details: "Cache cleared",
			lastChecked: new Date(),
			errors: []
		}
	}

	/**
	 * Generate system prompt based on agent role and industry context
	 */
	private generateSystemPrompt(
		agentRole: AgentRole,
		industryContext: string
	): string {
		let basePrompt = agentRole.systemPrompt

		if (industryContext) {
			basePrompt += `\n\nIndustry Context: ${industryContext}`
		}

		// Add general AI assistant guidelines
		basePrompt += `\n\nGeneral Guidelines:
- Keep responses concise and natural
- Ask clarifying questions when needed
- Be professional but friendly
- If you don't know something, say so
- End calls politely when appropriate`

		return basePrompt
	}

	/**
	 * Generate appropriate first message based on agent role and language
	 */
	private generateFirstMessage(
		agentRole: AgentRole,
		language: string
	): string {
		// Use the firstMessageTemplate if available, otherwise create a default based on display name
		const template =
			agentRole.firstMessageTemplate ||
			`Hello! I'm your ${agentRole.displayName.toLowerCase()}. How can I help you today?`

		// For non-English languages, provide basic translations for the default template
		if (!agentRole.firstMessageTemplate) {
			const languageGreetings: Record<string, string> = {
				en: template,
				es: `¡Hola! Soy tu ${agentRole.displayName.toLowerCase()}. ¿En qué puedo ayudarte hoy?`,
				fr: `Bonjour ! Je suis votre ${agentRole.displayName.toLowerCase()}. Comment puis-je vous aider aujourd'hui ?`,
				de: `Hallo! Ich bin Ihr ${agentRole.displayName.toLowerCase()}. Wie kann ich Ihnen heute helfen?`,
				it: `Ciao! Sono il tuo ${agentRole.displayName.toLowerCase()}. Come posso aiutarti oggi?`,
				pt: `Olá! Sou seu ${agentRole.displayName.toLowerCase()}. Como posso ajudá-lo hoje?`
			}

			return languageGreetings[language] || template
		}

		return template
	}

	/**
	 * Map language code to VAPI Deepgram language format
	 */
	private mapLanguageToDeepgramLanguage(
		language: string
	): Vapi.DeepgramTranscriberLanguage {
		const languageMapping: Record<
			string,
			Vapi.DeepgramTranscriberLanguage
		> = {
			en: "en-US",
			es: "es",
			fr: "fr",
			de: "de",
			it: "it",
			pt: "pt",
			zh: "zh",
			hi: "hi",
			ar: "multi", // Arabic often works better with multi
			ja: "ja"
		}

		return languageMapping[language] || "en-US"
	}
}

// Export singleton instance
export const voiceAgentService = VoiceAgentService.getInstance()
