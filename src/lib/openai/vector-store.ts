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
		client.vectorStores.files.retrieve(fileId, {
			vector_store_id: vectorStoreId
		})
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
		client.vectorStores.files.content(fileId, {
			vector_store_id: vectorStoreId
		})
	)

	if (typeof response === "string") {
		return response
	}

	if (typeof response?.content === "string") {
		return response.content
	}

	return JSON.stringify(response)
}

export async function removeFileFromVectorStore(
	vectorStoreId: string,
	fileId: string
) {
	const client = getVectorStoreClient()
	const filesApi = client.vectorStores.files as {
		del?: (fileId: string, params: { vector_store_id: string }) => Promise<unknown>
		delete?: (fileId: string, params: { vector_store_id: string }) => Promise<unknown>
	}

	const deleteFn =
		filesApi.del ||
		filesApi.delete ||
		(() => {
			throw new Error("Vector store file delete API not available")
		})

	return retryWithBackoff(() =>
		deleteFn(fileId, { vector_store_id: vectorStoreId })
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
