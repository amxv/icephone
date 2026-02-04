import { GetObjectCommand } from "@aws-sdk/client-s3"
import { retryWithBackoff } from "@/lib/utils/retry"
import { r2Client, R2_BUCKET_NAME } from "./r2"

export async function downloadAsBuffer(key: string): Promise<Buffer> {
	const buffer = await retryWithBackoff(async () => {
		const response = await r2Client.send(
			new GetObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: key
			})
		)

		if (!response.Body) {
			throw new Error(`No body returned for R2 key: ${key}`)
		}

		const chunks: Uint8Array[] = []
		for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk)
		}

		return Buffer.concat(chunks)
	})

	if (!buffer || buffer.length === 0) {
		throw new Error(`Failed to download from R2: ${key} (empty buffer)`) 
	}

	return buffer
}
