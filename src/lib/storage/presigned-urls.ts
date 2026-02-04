import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2Client, R2_BUCKET_NAME } from "./r2"

const VIEW_EXPIRY = 60 * 60 * 24 * 7
const DOWNLOAD_EXPIRY = 60 * 60
const UPLOAD_EXPIRY = 60 * 15

export async function getViewUrl(
	key: string,
	expiresIn: number = VIEW_EXPIRY
): Promise<string> {
	const command = new GetObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key
	})

	return getSignedUrl(r2Client, command, { expiresIn })
}

export async function getDownloadUrl(
	key: string,
	expiresIn: number = DOWNLOAD_EXPIRY
): Promise<string> {
	const command = new GetObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key
	})

	return getSignedUrl(r2Client, command, { expiresIn })
}

export async function getUploadUrl(
	key: string,
	contentType: string,
	expiresIn: number = UPLOAD_EXPIRY
): Promise<string> {
	const command = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key,
		ContentType: contentType
	})

	return getSignedUrl(r2Client, command, { expiresIn })
}

export async function getViewUrls(
	keys: string[]
): Promise<Map<string, string>> {
	const results = await Promise.all(
		keys.map(async (key) => ({ key, url: await getViewUrl(key) }))
	)

	const urlMap = new Map<string, string>()
	for (const { key, url } of results) {
		urlMap.set(key, url)
	}

	return urlMap
}
