import { Resend } from "resend"

// Initialize function that works in both development and production
async function getResendClient(): Promise<Resend> {
	let apiKey: string | undefined

	apiKey = process.env.RESEND_API_KEY

	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured")
	}

	return new Resend(apiKey)
}

export interface SendEmailOptions {
	to: string[]
	subject: string
	html: string
	from?: string
	replyTo?: string
}

export async function sendEmail(options: SendEmailOptions) {
	const resend = await getResendClient()

	try {
		const response = await resend.emails.send({
			from: options.from || "IcePhone CRM <noreply@icephone.com>",
			to: options.to,
			subject: options.subject,
			html: options.html,
			replyTo: options.replyTo
		})

		return {
			success: true,
			messageId: response.data?.id,
			error: null
		}
	} catch (error) {
		console.error("Failed to send email:", error)
		return {
			success: false,
			messageId: null,
			error:
				error instanceof Error
					? error.message
					: "Unknown error occurred"
		}
	}
}

// Re-export the template function from the templates file
export { generateFollowUpEmailTemplate } from "./email-templates"
