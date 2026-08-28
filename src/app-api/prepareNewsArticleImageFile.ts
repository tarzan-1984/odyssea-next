const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;
const MIN_SIZE_TO_OPTIMIZE_BYTES = 350 * 1024;
const SKIP_OPTIMIZE_TYPES = new Set(["image/gif", "image/svg+xml"]);

function formatMegabytes(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toJpegFilename(filename: string): string {
	const base = filename.replace(/\.[^/.]+$/, "") || "image";
	return `${base}.jpg`;
}

/**
 * Downscale large raster photos before upload to reduce S3 PUT time.
 * GIF/SVG and small files are kept as-is.
 */
export async function prepareNewsArticleImageFile(file: File): Promise<File> {
	if (!file.type.startsWith("image/") || SKIP_OPTIMIZE_TYPES.has(file.type)) {
		return file;
	}
	if (file.size < MIN_SIZE_TO_OPTIMIZE_BYTES) {
		return file;
	}

	let bitmap: ImageBitmap | null = null;
	try {
		bitmap = await createImageBitmap(file);
		const longestSide = Math.max(bitmap.width, bitmap.height);
		const scale = Math.min(1, MAX_IMAGE_DIMENSION / longestSide);
		const shouldReencode =
			scale < 1 || file.type !== "image/jpeg" || file.size >= MIN_SIZE_TO_OPTIMIZE_BYTES;

		if (!shouldReencode) {
			return file;
		}

		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext("2d");
		if (!context) {
			return file;
		}

		context.drawImage(bitmap, 0, 0, width, height);

		const blob = await new Promise<Blob | null>(resolve => {
			canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
		});

		if (!blob) {
			return file;
		}

		return new File([blob], toJpegFilename(file.name), {
			type: "image/jpeg",
			lastModified: file.lastModified || Date.now(),
		});
	} catch {
		return file;
	} finally {
		bitmap?.close();
	}
}

export function formatUploadSizeLabel(bytes: number): string {
	return formatMegabytes(bytes);
}
