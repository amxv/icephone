import { retryWithBackoff } from "@/lib/utils/retry"
import { getOpenAIClient } from "./client"

export function getVectorStoreClient() {
	return getOpenAIClient()
}

export async function createVectorStore(name: string) {
	const client = getVectorStoreClient()
	return retryWithBackoff(() => client.vectorStores.create({ name }))
}

export async function uploadFileToOpenAI(file: File) {
	const client = getVectorStoreClient()
	return retryWithBackoff(() =>
		client.files.create({
			file,
			purpose: "assistants"
		})
	)
}

export async function addFileToVectorStore(
	vectorStoreId: string,
	fileId: string
) {
	const client = getVectorStoreClient()
	return retryWithBackoff(() =>
		client.vectorStores.files.create(vectorStoreId, {
			file_id: fileId
		})
	)
}

export async function getVectorStoreFileStatus(
	vectorStoreId: string,
	fileId: string
): Promise<{
	status: "in_progress" | "completed" | "failed" | "cancelled"
	lastError: { code: string; message: string } | null
}> {
	const client = getVectorStoreClient()
	const file = await retryWithBackoff(() =>
		client.vectorStores.files.retrieve(vectorStoreId, fileId)
	)

	return {
		status: file.status,
		lastError: file.last_error
			? {
					code: file.last_error.code,
					message: file.last_error.message
				}
			: null
	}
}

export async function searchVectorStore(
	vectorStoreId: string,
	query: string,
	maxNumResults = 10
) {
	const client = getVectorStoreClient()
	return retryWithBackoff(() =>
		client.vectorStores.search(vectorStoreId, {
			query,
			max_num_results: maxNumResults
		})
	)
}

export async function retrieveVectorStoreFileContent(
	vectorStoreId: string,
	fileId: string
): Promise<string> {
	const client = getVectorStoreClient()
	const response = await retryWithBackoff(() =>
		client.vectorStores.files.content(vectorStoreId, fileId)
	)

	const contentItems = response?.data ?? []
	const textChunks = contentItems
		.map((item) => item.text || "")
		.filter((chunk) => chunk.length > 0)

	if (textChunks.length === 0) {
		return ""
	}

	return textChunks.join("\n")
}

export async function removeFileFromVectorStore(
	vectorStoreId: string,
	fileId: string
) {
	const client = getVectorStoreClient()
	return retryWithBackoff(() =>
		client.vectorStores.files.del(vectorStoreId, fileId)
	)
}

export async function deleteOpenAIFile(fileId: string) {
	const client = getVectorStoreClient()
	const fileApi = client.files as {
		del?: (id: string) => Promise<unknown>
		delete?: (id: string) => Promise<unknown>
	}

	const deleteFn =
		fileApi.del ||
		fileApi.delete ||
		(() => {
			throw new Error("OpenAI file delete API not available")
		})

	return retryWithBackoff(() => deleteFn(fileId))
}
