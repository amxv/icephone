import OpenAI from "openai"

export function getOpenAIClient() {
	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey) {
		throw new Error("OpenAI API key not configured")
	}

	return new OpenAI({ apiKey })
}
