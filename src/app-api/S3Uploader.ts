// Lightweight client class to upload a File via presigned PUT URL.

import { chatApi } from "./chatApi";

export type PresignResponse = {
	uploadUrl: string;
	fileUrl: string;
	key: string;
};

export class S3Uploader {
	constructor(
		private presignEndpoint?: string,
		private extraHeaders: Record<string, string> = {}
	) {}

	/**
	 * Upload a file to Wasabi via presigned URL obtained from your Nest backend.
	 */
	async upload(file: File, opts?: { filename?: string }) {
		const filename = opts?.filename ?? file.name ?? "upload.bin";
		const contentType = file.type || "application/octet-stream";

		try {
			// 1) Ask Nest for a presigned URL
			let presignData: PresignResponse;

			if (this.presignEndpoint) {
				// Use direct endpoint (legacy mode)
				const presignRes = await fetch(this.presignEndpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...this.extraHeaders,
					},
					body: JSON.stringify({ filename, contentType }),
					cache: "no-store",
				});

				if (!presignRes.ok) {
					const errorText = await presignRes.text().catch(() => "Unknown error");
					throw new Error(
						`Failed to get presigned URL: ${presignRes.status} ${errorText}`
					);
				}

				presignData = (await presignRes.json()) as PresignResponse;
			} else {
				// Use chatApi client
				presignData = await chatApi.getPresignedUrl(filename, contentType);
			}

			const { uploadUrl, fileUrl, key } = presignData;

			// Validate response
			if (!uploadUrl || !fileUrl || !key) {
				throw new Error("Invalid presigned URL response");
			}

			// 2) PUT upload to Wasabi
			const putRes = await fetch(uploadUrl, {
				method: "PUT",
				headers: { "Content-Type": contentType },
				body: file,
			});

			if (!putRes.ok) {
				const errorText = await putRes.text().catch(() => "Unknown error");
				throw new Error(`Upload failed: ${putRes.status} ${errorText}`);
			}

			const etag = putRes.headers.get("ETag") ?? undefined;

			// 3) Return for further processing (e.g., save to DB)
			return { fileUrl, key, etag };
		} catch (error) {
			// Re-throw with more context
			if (error instanceof Error) {
				throw new Error(`S3 Upload failed: ${error.message}`);
			}
			throw new Error("S3 Upload failed: Unknown error");
		}
	}
}
