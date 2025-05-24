import type { VoiceAgent } from "@/types"
import type { AgentRole } from "@/actions/agent-roles"
import type { VoicePreset } from "@/actions/voice-presets"
import type { CreateAssistantDTO } from "@vapi-ai/web/dist/api"

export interface VapiAssistantConfig {
	name: string
	model: {
		provider: "openai" | "anthropic" | "groq"
		model: string
		temperature?: number
		systemPrompt: string
		functions?: Array<{
			name: string
			async?: boolean
			description: string
			parameters: {
				type: "object"
				properties: Record<
					string,
					{
						type: string
						description: string
					}
				>
			}
		}>
	}
	voice: {
		provider: "11labs" | "playht" | "cartesia" | "deepgram"
		voiceId: string
	}
	firstMessage: string
	serverUrl?: string
}

/**
 * Gets the server URL for Vapi webhooks
 */
function getVapiServerUrl(): string | undefined {
	// Try to get from environment variables first
	let serverUrl = process.env.NEXT_PUBLIC_SERVER_URL

	// For production on Cloudflare, try to get from context
	if (!serverUrl && typeof window === "undefined") {
		try {
			const { getCloudflareContext } = require("@opennextjs/cloudflare")
			const { env } = getCloudflareContext()
			serverUrl = env.NEXT_PUBLIC_SERVER_URL
		} catch (error) {
			// Cloudflare context not available, continue without server URL
		}
	}

	// Only return URL if it's a valid HTTPS URL (for production) or localhost HTTPS (for dev tunneling)
	if (
		serverUrl &&
		(serverUrl.startsWith("https://") ||
			serverUrl.startsWith("http://localhost"))
	) {
		return `${serverUrl}/api/vapi/webhook`
	}

	// Return undefined if no valid server URL - Vapi will work without webhooks
	return undefined
}

/**
 * Creates a VAPI assistant configuration from simplified business configuration
 * This maps business-friendly settings to technical VAPI configuration
 */
export function createSimplifiedVapiAssistant(config: {
	name: string
	agentRole: AgentRole
	voicePreset: VoicePreset
	language: string
	industryContext?: string
}): CreateAssistantDTO {
	const serverUrl = getVapiServerUrl()

	// Customize system prompt based on industry context
	let systemPrompt = config.agentRole.systemPrompt
	if (config.industryContext) {
		systemPrompt = `${systemPrompt}\n\nIndustry Context: You are working in the ${config.industryContext} industry. Tailor your responses to be relevant to this industry's specific needs and terminology.`
	}

	// Map agent role default functions to VAPI function format
	const functions: Array<{
		name: string
		async?: boolean
		description: string
		parameters: {
			type: "object"
			properties: Record<string, { type: string; description: string }>
		}
	}> = []

	// Check if defaultFunctions is an array of strings or function objects
	const functionNames = Array.isArray(config.agentRole.defaultFunctions)
		? config.agentRole.defaultFunctions
		: []

	for (const funcName of functionNames) {
		// Handle both string function names and function objects
		const functionName =
			typeof funcName === "string" ? funcName : funcName.name || ""

		switch (functionName) {
			case "updateLeadStatus":
				functions.push({
					name: "updateLeadStatus",
					async: true,
					description:
						"Updates the status of a lead in the CRM system",
					parameters: {
						type: "object",
						properties: {
							leadId: {
								type: "string",
								description: "The ID of the lead to update"
							},
							status: {
								type: "string",
								description:
									"The new status for the lead (new, contacted, qualified, converted, lost)"
							}
						}
					}
				})
				break

			case "scheduleAppointment":
				functions.push({
					name: "scheduleAppointment",
					async: true,
					description: "Schedules an appointment with a lead",
					parameters: {
						type: "object",
						properties: {
							leadId: {
								type: "string",
								description:
									"The ID of the lead to schedule with"
							},
							dateTime: {
								type: "string",
								description:
									"The date and time for the appointment"
							},
							duration: {
								type: "string",
								description:
									"Duration of the appointment (e.g., '30 minutes', '1 hour')"
							}
						}
					}
				})
				break

			case "addNoteToLead":
				functions.push({
					name: "addNoteToLead",
					async: true,
					description: "Adds a note to a lead's record",
					parameters: {
						type: "object",
						properties: {
							leadId: {
								type: "string",
								description:
									"The ID of the lead to add a note to"
							},
							note: {
								type: "string",
								description: "The note content to add"
							}
						}
					}
				})
				break

			case "scheduleCallback":
				functions.push({
					name: "scheduleCallback",
					async: true,
					description: "Schedules a callback for a lead",
					parameters: {
						type: "object",
						properties: {
							leadId: {
								type: "string",
								description:
									"The ID of the lead for the callback"
							},
							dateTime: {
								type: "string",
								description: "When to call back"
							},
							notes: {
								type: "string",
								description: "Notes about the callback reason"
							}
						}
					}
				})
				break

			case "transferToAgent":
				functions.push({
					name: "transferToAgent",
					async: true,
					description: "Transfers the call to a human agent",
					parameters: {
						type: "object",
						properties: {
							reason: {
								type: "string",
								description: "Reason for the transfer"
							},
							leadId: {
								type: "string",
								description:
									"The ID of the lead being transferred"
							}
						}
					}
				})
				break

			case "checkAvailability":
				functions.push({
					name: "checkAvailability",
					async: true,
					description: "Checks calendar availability for scheduling",
					parameters: {
						type: "object",
						properties: {
							dateRange: {
								type: "string",
								description:
									"Date range to check (e.g., 'next week', 'this month')"
							},
							duration: {
								type: "string",
								description:
									"Duration needed for the appointment"
							}
						}
					}
				})
				break

			case "sendConfirmation":
				functions.push({
					name: "sendConfirmation",
					async: true,
					description: "Sends appointment confirmation to the lead",
					parameters: {
						type: "object",
						properties: {
							leadId: {
								type: "string",
								description:
									"The ID of the lead to send confirmation to"
							},
							appointmentId: {
								type: "string",
								description:
									"The ID of the appointment to confirm"
							}
						}
					}
				})
				break

			case "calculateQuote":
				functions.push({
					name: "calculateQuote",
					async: true,
					description: "Calculates a quote for the customer",
					parameters: {
						type: "object",
						properties: {
							productIds: {
								type: "string",
								description:
									"Comma-separated list of product IDs"
							},
							quantity: {
								type: "string",
								description: "Quantity for each product"
							},
							customizations: {
								type: "string",
								description:
									"Any customizations or special requirements"
							}
						}
					}
				})
				break
		}
	}

	const assistantConfig: VapiAssistantConfig = {
		name: config.name,
		model: {
			provider: "openai",
			model: "gpt-4o-mini",
			temperature: 0.7,
			systemPrompt,
			// Only include functions if we have a server URL for webhooks
			...(serverUrl && functions.length > 0 && { functions })
		},
		voice: {
			provider: config.voicePreset.vapiProvider as
				| "11labs"
				| "playht"
				| "cartesia"
				| "deepgram",
			voiceId: config.voicePreset.vapiVoiceId
		},
		firstMessage:
			config.agentRole.firstMessageTemplate?.replace(
				"{{agent_name}}",
				config.name
			) ||
			`Hello! I'm ${config.name}, your ${config.agentRole.displayName.toLowerCase()}. How can I help you today?`,
		// Only include serverUrl if we have a valid one
		...(serverUrl && { serverUrl })
	}

	return assistantConfig as CreateAssistantDTO
}

/**
 * Creates a Vapi assistant configuration from our VoiceAgent data
 */
export function createVapiAssistant(agent: VoiceAgent): CreateAssistantDTO {
	const serverUrl = getVapiServerUrl()

	const config: VapiAssistantConfig = {
		name: agent.name,
		model: {
			provider: "openai",
			model: "gpt-4o-mini",
			temperature: 0.7,
			systemPrompt:
				agent.prompt ||
				`You are ${agent.name}, a helpful AI voice assistant. Be friendly, conversational, and helpful in your responses.`,
			// Only include functions if we have a server URL for webhooks
			...(serverUrl && {
				functions: [
					{
						name: "updateLeadStatus",
						async: true,
						description:
							"Updates the status of a lead in the CRM system",
						parameters: {
							type: "object",
							properties: {
								leadId: {
									type: "string",
									description: "The ID of the lead to update"
								},
								status: {
									type: "string",
									description:
										"The new status for the lead (new, contacted, qualified, converted, lost)"
								}
							}
						}
					},
					{
						name: "scheduleAppointment",
						async: true,
						description: "Schedules an appointment with a lead",
						parameters: {
							type: "object",
							properties: {
								leadId: {
									type: "string",
									description:
										"The ID of the lead to schedule with"
								},
								dateTime: {
									type: "string",
									description:
										"The date and time for the appointment"
								},
								duration: {
									type: "string",
									description:
										"Duration of the appointment (e.g., '30 minutes', '1 hour')"
								}
							}
						}
					},
					{
						name: "addNoteToLead",
						async: true,
						description: "Adds a note to a lead's record",
						parameters: {
							type: "object",
							properties: {
								leadId: {
									type: "string",
									description:
										"The ID of the lead to add a note to"
								},
								note: {
									type: "string",
									description: "The note content to add"
								}
							}
						}
					}
				]
			})
		},
		voice: {
			provider: "11labs",
			voiceId: "sarah" // Default voice, can be customized later
		},
		firstMessage:
			agent.firstMessage ||
			`Hello! I'm ${agent.name}. How can I help you today?`,
		// Only include serverUrl if we have a valid one
		...(serverUrl && { serverUrl })
	}

	return config as CreateAssistantDTO
}

/**
 * Default assistant configuration for testing
 */
export const defaultVapiAssistant: VapiAssistantConfig = {
	name: "Test Voice Assistant",
	model: {
		provider: "openai",
		model: "gpt-4o-mini",
		temperature: 0.7,
		systemPrompt:
			"You are a helpful AI voice assistant for IcePhone CRM. Be friendly and conversational. Help users with their customer management needs."
	},
	voice: {
		provider: "11labs",
		voiceId: "sarah"
	},
	firstMessage:
		"Hello! I'm your IcePhone voice assistant. How can I help you today?"
}
