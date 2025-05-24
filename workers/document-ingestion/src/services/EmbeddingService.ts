export interface EmbeddingResult {
	embedding: number[]
	model: string
	usage?: {
		totalTokens: number
	}
}

interface VoyageEmbeddingResponse {
	data: Array<{
		embedding: number[]
	}>
	usage?: {
		totalTokens: number
	}
}

export interface EmbeddingBatchResult {
	embeddings: number[][]
	model: string
	usage?: {
		totalTokens: number
	}
}

export class EmbeddingService {
	private apiKey: string
	private defaultModel = "voyage-3"

	constructor(apiKey: string) {
		this.apiKey = apiKey
	}

	async generateEmbedding(
		text: string,
		model?: string
	): Promise<EmbeddingResult> {
		const modelToUse = model || this.defaultModel

		// If no API key, return a mock embedding for development
		if (!this.apiKey || this.apiKey === "mock") {
			return this.generateMockEmbedding(text, modelToUse)
		}

		try {
			const response = await fetch(
				"https://api.voyageai.com/v1/embeddings",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify({
						input: [text],
						model: modelToUse
					})
				}
			)

			if (!response.ok) {
				const error = await response.text()
				console.error("Voyage AI API error:", error)
				// Fallback to mock embedding on error
				return this.generateMockEmbedding(text, modelToUse)
			}

			const data = (await response.json()) as VoyageEmbeddingResponse

			return {
				embedding: data.data[0].embedding,
				model: modelToUse,
				usage: data.usage
			}
		} catch (error) {
			console.error("Embedding generation error:", error)
			// Fallback to mock embedding on error
			return this.generateMockEmbedding(text, modelToUse)
		}
	}

	async generateEmbeddingsBatch(
		texts: string[],
		model?: string
	): Promise<EmbeddingBatchResult> {
		const modelToUse = model || this.defaultModel

		// If no API key, return mock embeddings for development
		if (!this.apiKey || this.apiKey === "mock") {
			return this.generateMockEmbeddingsBatch(texts, modelToUse)
		}

		try {
			const response = await fetch(
				"https://api.voyageai.com/v1/embeddings",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify({
						input: texts,
						model: modelToUse
					})
				}
			)

			if (!response.ok) {
				const error = await response.text()
				console.error("Voyage AI API error:", error)
				// Fallback to mock embeddings on error
				return this.generateMockEmbeddingsBatch(texts, modelToUse)
			}

			const data = (await response.json()) as VoyageEmbeddingResponse

			return {
				embeddings: data.data.map((item) => item.embedding),
				model: modelToUse,
				usage: data.usage
			}
		} catch (error) {
			console.error("Batch embedding generation error:", error)
			// Fallback to mock embeddings on error
			return this.generateMockEmbeddingsBatch(texts, modelToUse)
		}
	}

	private generateMockEmbedding(
		text: string,
		model: string
	): EmbeddingResult {
		// Create a deterministic mock embedding based on text content
		const seed = this.hashString(text)
		const embedding = this.generateDeterministicVector(seed, 1024)

		return {
			embedding,
			model: `${model}-mock`,
			usage: {
				totalTokens: Math.ceil(text.length / 4) // Rough token estimation
			}
		}
	}

	private generateMockEmbeddingsBatch(
		texts: string[],
		model: string
	): EmbeddingBatchResult {
		const embeddings = texts.map((text) => {
			const seed = this.hashString(text)
			return this.generateDeterministicVector(seed, 1024)
		})

		return {
			embeddings,
			model: `${model}-mock`,
			usage: {
				totalTokens: texts.reduce(
					(sum, text) => sum + Math.ceil(text.length / 4),
					0
				)
			}
		}
	}

	private hashString(str: string): number {
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return Math.abs(hash)
	}

	private generateDeterministicVector(
		seed: number,
		dimensions: number
	): number[] {
		const vector: number[] = []
		let rng = seed

		for (let i = 0; i < dimensions; i++) {
			// Simple linear congruential generator
			rng = (rng * 1664525 + 1013904223) % 4294967296
			// Normalize to [-1, 1] range
			vector.push((rng / 4294967296) * 2 - 1)
		}

		// Normalize the vector to unit length
		const magnitude = Math.sqrt(
			vector.reduce((sum, val) => sum + val * val, 0)
		)
		return vector.map((val) => val / magnitude)
	}

	async generateQueryEmbedding(
		query: string,
		model?: string
	): Promise<number[]> {
		const result = await this.generateEmbedding(query, model)
		return result.embedding
	}

	async generateMultimodalEmbedding(
		text: string,
		images?: string[],
		model?: string
	): Promise<EmbeddingResult> {
		// For now, just return text embedding (multimodal support can be added later)
		const modelToUse = model || "voyage-multimodal-3"
		return this.generateEmbedding(text, modelToUse)
	}
}
