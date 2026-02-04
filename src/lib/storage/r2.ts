import { S3Client } from "@aws-sdk/client-s3"

export const r2Client = new S3Client({
	region: "auto",
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ""
	},
	forcePathStyle: true
})

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || ""

export function sanitizeFilename(filename: string) {
	return filename.replace(/[^a-zA-Z0-9.-]/g, "_")
}

export function getUploadKey(
	teamId: string,
	filename: string,
	prefix = "uploads",
	timestamp: number = Date.now()
): string {
	return `${prefix}/${teamId}/${timestamp}-${sanitizeFilename(filename)}`
}

export function getKnowledgeFileKey(
	teamId: string,
	sourceId: number,
	filename: string,
	timestamp: number = Date.now()
): string {
	return getUploadKey(teamId, filename, `knowledge/${sourceId}`, timestamp)
}
