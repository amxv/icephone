import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { retryWithBackoff } from "@/lib/utils/retry"
import { r2Client, R2_BUCKET_NAME } from "./r2"

export async function deleteObject(key: string) {
	return retryWithBackoff(() =>
		r2Client.send(
			new DeleteObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: key
			})
		)
	)
}
