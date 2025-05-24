"use server"

import {
	createKnowledgeBaseSource,
	insertKnowledgeBaseDocument
} from "@/actions/knowledge-base"
import { AI_MODELS, HYDE_SETTINGS } from "@/lib/ai-config"
import type {
	HydeResult,
	KnowledgeBaseSourceType,
	MultimodalInput,
	ProcessingOptions,
	QueryType
} from "@/types"
import { currentUser } from "@clerk/nextjs/server"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { generateText } from "ai"
import PDFParser from "pdf2json"
import { VoyageAIClient } from "voyageai"

// Voyage AI configuration
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const EMBEDDING_MODEL = "voyage-3.5" // Voyage AI model
const MULTIMODAL_MODEL = "voyage-multimodal-3" // Voyage multimodal model

// Generate text embeddings using Voyage AI
async function generateEmbeddings(
	texts: string[],
	inputType: "query" | "document" = "document"
): Promise<number[][]> {
	if (!VOYAGE_API_KEY) {
		console.warn(
			"No Voyage API key found. Using simulated embeddings for development."
		)
		// Return simulated embeddings for development purposes
		return texts.map(
			() => Array.from({ length: 1024 }, () => Math.random() * 2 - 1) // Voyage 3.5 is 1024 dimensions
		)
	}

	try {
		// Initialize Voyage AI client
		const client = new VoyageAIClient({
			apiKey: VOYAGE_API_KEY
		})

		// Generate embeddings for all texts
		const response = await client.embed({
			input: texts,
			model: EMBEDDING_MODEL,
			inputType // Specify whether these are queries or documents
		})

		if (!response.data || !Array.isArray(response.data)) {
			throw new Error("Invalid response from Voyage AI")
		}

		const embeddings = response.data.map((item) => {
			if (!item.embedding || !Array.isArray(item.embedding)) {
				throw new Error("Invalid embedding data from Voyage AI")
			}
			return item.embedding
		})

		// Validate embedding dimensions
		if (
			embeddings.length > 0 &&
			embeddings[0] &&
			embeddings[0].length !== 1024
		) {
			console.warn(
				`Expected 1024 dimensions, got ${embeddings[0].length}`
			)
		}

		return embeddings
	} catch (error) {
		console.error("Error generating embeddings with Voyage AI:", error)
		// Fallback to simulated embeddings
		console.warn("Falling back to simulated embeddings")
		return texts.map(() =>
			Array.from({ length: 1024 }, () => Math.random() * 2 - 1)
		)
	}
}

// Generate multimodal embeddings using Voyage multimodal-3
async function generateMultimodalEmbeddings(
	inputs: MultimodalInput[],
	inputType: "query" | "document" = "document"
): Promise<number[][]> {
	if (!VOYAGE_API_KEY) {
		console.warn(
			"No Voyage API key found. Falling back to text embeddings."
		)
		// Fallback to text embeddings
		const texts = inputs.map((input) =>
			typeof input.content === "string" ? input.content : input.text || ""
		)
		return generateEmbeddings(texts, inputType)
	}

	try {
		// For now, simplify to text-only until we have proper multimodal implementation
		// TODO: Implement proper multimodal API call when voyageai client supports it
		const texts = inputs.map((input) => {
			if (input.type === "text") {
				return input.content as string
			}
			// For images and mixed content, use the text description
			return input.text || "Visual content"
		})

		return generateEmbeddings(texts, inputType)
	} catch (error) {
		console.error("Error generating multimodal embeddings:", error)
		// Fallback to text embeddings
		const texts = inputs.map((input) =>
			typeof input.content === "string" ? input.content : input.text || ""
		)
		return generateEmbeddings(texts, inputType)
	}
}

// Generate HyDE (Hypothetical Document Embeddings)
async function generateHydeEmbeddings(
	documentContent: string,
	queryType: QueryType
): Promise<HydeResult | null> {
	const OPENAI_API_KEY = process.env.OPENAI_API_KEY

	if (!OPENAI_API_KEY) {
		console.warn("No OpenAI API key found. Skipping HyDE generation.")
		return null
	}

	try {
		// Generate hypothetical answer using Vercel AI SDK
		const prompts = {
			factual: `Answer this question with specific facts and details based on the following content: ${documentContent}`,
			analytical: `Provide a comprehensive analysis of the following content: ${documentContent}`,
			contextual: `Explain thoroughly and provide context for the following content: ${documentContent}`,
			procedural: `Describe the process or procedures outlined in the following content: ${documentContent}`,
			multimodal: `Describe both textual and visual aspects of the following content: ${documentContent}`
		}

		const prompt = prompts[queryType] || prompts.factual

		const { text: hypotheticalAnswer } = await generateText({
			model: AI_MODELS.text.general,
			system: "You are an expert on the content provided. Generate a detailed, accurate response that captures the essence of the information.",
			prompt,
			maxTokens: HYDE_SETTINGS.maxTokens,
			temperature: HYDE_SETTINGS.temperature
		})

		// Generate embedding for the hypothetical answer
		const embedding = await generateEmbeddings(
			[hypotheticalAnswer],
			"document"
		)

		return {
			hypotheticalAnswer,
			embedding: embedding[0],
			originalQuery: documentContent,
			queryType
		}
	} catch (error) {
		console.error("Error generating HyDE embeddings:", error)
		return null
	}
}

// Export for use in RAG queries
export async function generateQueryEmbedding(query: string): Promise<number[]> {
	const embeddings = await generateEmbeddings([query], "query")
	return embeddings[0]
}

// Export multimodal query processing
export async function generateMultimodalQueryEmbedding(
	query: string,
	images?: string[]
): Promise<number[]> {
	if (!images || images.length === 0) {
		return generateQueryEmbedding(query)
	}

	const inputs: MultimodalInput[] = [
		{
			type: "mixed",
			content: images[0], // Use first image
			text: query
		}
	]

	const embeddings = await generateMultimodalEmbeddings(inputs, "query")
	return embeddings[0]
}

export async function processAndEmbedFile(
	file: File,
	sourceName?: string,
	sourceType?: KnowledgeBaseSourceType
) {
	try {
		// Check authentication
		const user = await currentUser()
		if (!user) {
			return {
				success: false,
				error: "Authentication required"
			}
		}

		// Determine source type from file extension if not provided
		const fileExtension = file.name.split(".").pop()?.toLowerCase()
		let detectedSourceType: KnowledgeBaseSourceType =
			sourceType || "txt_upload"

		if (!sourceType) {
			switch (fileExtension) {
				case "pdf":
					detectedSourceType = "pdf_upload"
					break
				case "txt":
				case "md":
					detectedSourceType = "txt_upload"
					break
				default:
					detectedSourceType = "txt_upload"
			}
		}

		// Extract text content from file
		const fileBuffer = await file.arrayBuffer()
		let fileText: string
		let extractedMetadata: Record<string, unknown> = {}

		try {
			if (detectedSourceType === "pdf_upload") {
				// Parse PDF using pdf2json
				console.log("Parsing PDF file...")

				const pdfParser = new PDFParser()

				// Create a promise to handle the async PDF parsing
				const pdfData = await new Promise<{
					text: string
					pages: number
				}>((resolve, reject) => {
					pdfParser.on("pdfParser_dataError", (errData: unknown) => {
						const error = errData as { parserError?: string }
						reject(
							new Error(
								`PDF parsing error: ${error.parserError || "Unknown error"}`
							)
						)
					})

					pdfParser.on("pdfParser_dataReady", (pdfData: unknown) => {
						try {
							// Extract text from all pages
							let fullText = ""
							let pageCount = 0

							const data = pdfData as {
								Pages?: Array<{
									Texts?: Array<{ R?: Array<{ T?: string }> }>
								}>
							}

							if (data.Pages && Array.isArray(data.Pages)) {
								pageCount = data.Pages.length

								for (const page of data.Pages) {
									if (
										page.Texts &&
										Array.isArray(page.Texts)
									) {
										for (const textItem of page.Texts) {
											if (
												textItem.R &&
												Array.isArray(textItem.R)
											) {
												for (const run of textItem.R) {
													if (run.T) {
														fullText += `${decodeURIComponent(
															run.T
														)} `
													}
												}
											}
										}
									}
									fullText += "\n"
								}
							}

							resolve({
								text: fullText.trim(),
								pages: pageCount
							})
						} catch (error) {
							reject(error)
						}
					})

					// Parse the PDF buffer
					pdfParser.parseBuffer(Buffer.from(fileBuffer))
				})

				fileText = pdfData.text
				extractedMetadata = {
					numberOfPages: pdfData.pages,
					processingMethod: "pdf2json"
				}
				console.log(
					`Extracted ${pdfData.text.length} characters from ${pdfData.pages} pages`
				)
			} else {
				// Handle text files and other formats
				fileText = new TextDecoder().decode(fileBuffer)
			}

			if (!fileText.trim()) {
				return {
					success: false,
					error: "No text content found in the file. The document may be empty or contain only images."
				}
			}
		} catch (error) {
			console.error("Error extracting text from file:", error)
			return {
				success: false,
				error: `Failed to extract text from ${detectedSourceType}: ${error instanceof Error ? error.message : "Unknown error"}`
			}
		}

		// 1. Create knowledge base source
		const sourceResult = await createKnowledgeBaseSource({
			name: sourceName || file.name,
			type: detectedSourceType,
			uri: file.name
		})

		if (!sourceResult.success || !sourceResult.data) {
			return {
				success: false,
				error:
					sourceResult.error ||
					"Failed to create knowledge base source"
			}
		}

		const sourceId = sourceResult.data.id

		// 2. Chunk the document
		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 1000,
			chunkOverlap: 200,
			separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""]
		})

		const documents = await splitter.createDocuments([fileText])
		const textChunks = documents.map((doc) => doc.pageContent)

		if (textChunks.length === 0) {
			return {
				success: false,
				error: "No text chunks could be created from the file."
			}
		}

		// 3. Generate embeddings
		const embeddings = await generateEmbeddings(textChunks)

		if (embeddings.length !== textChunks.length) {
			return {
				success: false,
				error: "Mismatch between number of chunks and embeddings."
			}
		}

		// 4. Store chunks and embeddings in database
		const storedDocuments = []
		let successCount = 0
		let failureCount = 0

		for (let i = 0; i < textChunks.length; i++) {
			const chunk = textChunks[i]
			const embedding = embeddings[i]

			const docResult = await insertKnowledgeBaseDocument({
				sourceId,
				contentChunk: chunk,
				textEmbeddingModel: EMBEDDING_MODEL,
				textEmbedding: embedding,
				metadata: {
					fileName: file.name,
					fileSize: file.size,
					fileType: file.type,
					chunkIndex: i,
					totalChunks: textChunks.length,
					processedAt: new Date().toISOString(),
					...extractedMetadata
				}
			})

			if (docResult.success) {
				storedDocuments.push(docResult.data)
				successCount++
			} else {
				console.error(`Failed to store chunk ${i}:`, docResult.error)
				failureCount++
			}
		}

		if (successCount === 0) {
			return {
				success: false,
				error: "Failed to store any document chunks."
			}
		}

		return {
			success: true,
			message: `File processed successfully. ${successCount} chunks stored${failureCount > 0 ? `, ${failureCount} failed` : ""}.`,
			sourceId,
			chunkCount: successCount,
			failedChunks: failureCount
		}
	} catch (error) {
		console.error("Error processing and embedding file:", error)
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "An unknown error occurred."
		}
	}
}
