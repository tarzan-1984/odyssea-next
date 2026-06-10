/**
 * Chat inline previews use a compressed JPEG from /api/storage/image-preview.
 * Full-quality originals load only in the lightbox / download flow.
 */
export const CHAT_IMAGE_PREVIEW_ENABLED = true;

/** Max width for thumbnails in the message list (px). */
export const CHAT_IMAGE_PREVIEW_MAX_WIDTH = 640;

/** JPEG quality for chat thumbnails (40–90). */
export const CHAT_IMAGE_PREVIEW_QUALITY = 72;

const THUMBNAIL_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"bmp",
	"tiff",
	"heic",
	"heif",
	"gif",
]);

export function isChatImageThumbnailCandidate(fileName: string): boolean {
	const ext = fileName.toLowerCase().split(".").pop();
	return Boolean(ext && THUMBNAIL_EXTENSIONS.has(ext));
}

export function getChatImageThumbnailUrl(
	fileUrl: string,
	fileName: string,
	options?: { maxWidth?: number; quality?: number }
): string | null {
	if (!CHAT_IMAGE_PREVIEW_ENABLED || !fileUrl || !isChatImageThumbnailCandidate(fileName)) {
		return null;
	}

	const params = new URLSearchParams({
		url: fileUrl,
		w: String(options?.maxWidth ?? CHAT_IMAGE_PREVIEW_MAX_WIDTH),
		q: String(options?.quality ?? CHAT_IMAGE_PREVIEW_QUALITY),
	});

	return `/api/storage/image-preview?${params.toString()}`;
}
