import { PutObjectCommand } from "@aws-sdk/client-s3"
import { retryWithBackoff } from "@/lib/utils/retry"
import { r2Client, R2_BUCKET_NAME } from "./r2"

export interface UploadBufferParams {
	buffer: Buffer
	key: string
	contentType?: string
	metadata?: Record<string, string>
}

export async function uploadBuffer({
	buffer,
	key,
	contentType,
	metadata
}: UploadBufferParams): Promise<string> {
	await retryWithBackoff(async () => {
		await r2Client.send(
			new PutObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: key,
				Body: buffer,
				ContentType: contentType,
				Metadata: metadata
			})
		)
	})

	return key
}

export interface UploadFromUrlParams {
	url: string
	key: string
	contentType?: string
	metadata?: Record<string, string>
}

export async function uploadFromUrl({
	url,
	key,
	contentType,
	metadata
}: UploadFromUrlParams): Promise<string> {
	await retryWithBackoff(async () => {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(
				`Failed to download from ${url}: ${response.statusText}`
			)
		}

		const buffer = Buffer.from(await response.arrayBuffer())

		await r2Client.send(
			new PutObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: key,
				Body: buffer,
				ContentType: contentType,
				Metadata: metadata
			})
		)
	})

	return key
}
