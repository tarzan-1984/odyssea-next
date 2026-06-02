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

	private isHeicFile(file: File, filename: string): boolean {
		const lowerName = filename.toLowerCase();
		const lowerType = file.type.toLowerCase();
		return (
			lowerName.endsWith(".heic") ||
			lowerName.endsWith(".heif") ||
			lowerType === "image/heic" ||
			lowerType === "image/heif"
		);
	}

	private toJpegFilename(filename: string): string {
		if (/\.(heic|heif)$/i.test(filename)) {
			return filename.replace(/\.(heic|heif)$/i, ".jpg");
		}
		return `${filename.replace(/\.[^/.]+$/, "") || "image"}.jpg`;
	}

	private async convertHeicFile(file: File, filename: string): Promise<File> {
		const formData = new FormData();
		formData.append("file", file, filename);

		const response = await fetch("/api/storage/convert-heic", {
			method: "POST",
			body: formData,
			credentials: "include",
		});

		if (!response.ok) {
			const data = await response.json().catch(() => null);
			throw new Error(data?.error || "Failed to convert HEIC image");
		}

		const jpegBlob = await response.blob();
		return new File([jpegBlob], this.toJpegFilename(filename), {
			type: "image/jpeg",
			lastModified: file.lastModified || Date.now(),
		});
	}

	/**
	 * Upload a file to Wasabi via presigned URL obtained from your Nest backend.
	 */
	async upload(file: File, opts?: { filename?: string }) {
		let uploadFile = file;
		let filename = opts?.filename ?? file.name ?? "upload.bin";

		if (this.isHeicFile(uploadFile, filename)) {
			uploadFile = await this.convertHeicFile(uploadFile, filename);
			filename = uploadFile.name;
		}
		
		// Determine content type with fallback for SVG files
		let contentType = uploadFile.type;
		if (!contentType) {
			// Fallback based on file extension
			const extension = filename.toLowerCase().split('.').pop();
			switch (extension) {
				case 'svg':
					contentType = 'image/svg+xml';
					break;
				case 'jpg':
				case 'jpeg':
					contentType = 'image/jpeg';
					break;
				case 'png':
					contentType = 'image/png';
					break;
				case 'gif':
					contentType = 'image/gif';
					break;
				case 'webp':
					contentType = 'image/webp';
					break;
				case 'pdf':
					contentType = 'application/pdf';
					break;
				case 'txt':
					contentType = 'text/plain';
					break;
				case 'json':
					contentType = 'application/json';
					break;
				default:
					contentType = 'application/octet-stream';
			}
		}

		// Additional validation for SVG files
		if (contentType === 'image/svg+xml' || filename.toLowerCase().endsWith('.svg')) {
			// Validate SVG content by checking if it starts with proper SVG declaration
			const text = await uploadFile.text();
			if (!text.includes('<svg') || !text.includes('xmlns=')) {
				throw new Error('Invalid SVG file format');
			}
		}

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
				body: uploadFile,
			});

			if (!putRes.ok) {
				const errorText = await putRes.text().catch(() => "Unknown error");
				throw new Error(`Upload failed: ${putRes.status} ${errorText}`);
			}

			const etag = putRes.headers.get("ETag") ?? undefined;

			// 3) Return for further processing (e.g., save to DB)
			return { fileUrl, key, etag, fileName: filename, fileSize: uploadFile.size };
		} catch (error) {
			// Re-throw with more context
			if (error instanceof Error) {
				throw new Error(`S3 Upload failed: ${error.message}`);
			}
			throw new Error("S3 Upload failed: Unknown error");
		}
	}
}
