/**
 * Chat inline previews use compressed JPEG thumbnails stored in Wasabi (files/thumbs/...).
 * Full-quality originals load only in the lightbox / download flow.
 */
export const CHAT_IMAGE_PREVIEW_ENABLED = true;

/** Max width for thumbnails in the message list (px). */
export const CHAT_IMAGE_PREVIEW_MAX_WIDTH = 240;

/** Smaller thumbs for compact multi-attach grid cells. */
export const CHAT_IMAGE_PREVIEW_COMPACT_MAX_WIDTH = 160;

/** Reserved inline preview height (px) — must match FilePreview / placeholder min-heights. */
export const CHAT_IMAGE_PREVIEW_MIN_HEIGHT_PX = 180;

/** Max rendered inline image height (Tailwind max-h-64). */
export const CHAT_IMAGE_PREVIEW_MAX_HEIGHT_PX = 256;

/** Compact grid cell height (Tailwind h-24). */
export const CHAT_IMAGE_PREVIEW_COMPACT_HEIGHT_PX = 96;

/** PDF/DOC inline iframe height (Tailwind h-64). */
export const CHAT_DOCUMENT_PREVIEW_HEIGHT_PX = 256;

/** JPEG quality for chat thumbnails (40–90). Lower = smaller files, faster chat load. */
export const CHAT_IMAGE_PREVIEW_QUALITY = 40;

export function getChatImageListThumbOptions(compact = false): {
	maxWidth: number;
	quality: number;
} {
	return {
		maxWidth: compact
			? CHAT_IMAGE_PREVIEW_COMPACT_MAX_WIDTH
			: CHAT_IMAGE_PREVIEW_MAX_WIDTH,
		quality: CHAT_IMAGE_PREVIEW_QUALITY,
	};
}

/** Abort inline preview if the image has not loaded within this time (ms). */
export const CHAT_IMAGE_PREVIEW_LOAD_TIMEOUT_MS = 8_000;

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
	"dng",
]);

export function isChatImageThumbnailCandidate(fileName: string): boolean {
	const ext = fileName.toLowerCase().split(".").pop();
	return Boolean(ext && THUMBNAIL_EXTENSIONS.has(ext));
}

/** Build direct Wasabi URL for a stored chat thumbnail. */
export function buildChatImageThumbnailUrl(
	fileUrl: string,
	maxWidth: number = CHAT_IMAGE_PREVIEW_MAX_WIDTH,
	quality: number = CHAT_IMAGE_PREVIEW_QUALITY
): string | null {
	if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
		return null;
	}

	try {
		const parsed = new URL(fileUrl);
		const marker = "/files/";
		const filesIdx = parsed.pathname.indexOf(marker);
		if (filesIdx === -1) {
			return null;
		}

		const afterFiles = parsed.pathname.slice(filesIdx + marker.length);
		if (!afterFiles || afterFiles.startsWith("thumbs/")) {
			return fileUrl;
		}

		const withoutExt = afterFiles.replace(/\.[^./\\]+$/, "");
		const prefix = parsed.pathname.slice(0, filesIdx + marker.length);
		const thumbPath = `${prefix}thumbs/${withoutExt}_w${maxWidth}_q${quality}.jpg`;
		return `${parsed.origin}${thumbPath}`;
	} catch {
		return null;
	}
}

export function getChatImageThumbnailUrl(
	fileUrl: string,
	fileName: string,
	options?: { maxWidth?: number; quality?: number }
): string | null {
	if (!CHAT_IMAGE_PREVIEW_ENABLED || !fileUrl || !isChatImageThumbnailCandidate(fileName)) {
		return null;
	}

	return buildChatImageThumbnailUrl(
		fileUrl,
		options?.maxWidth ?? CHAT_IMAGE_PREVIEW_MAX_WIDTH,
		options?.quality ?? CHAT_IMAGE_PREVIEW_QUALITY
	);
}

export function buildChatImagePreviewProxyUrl(
	fileUrl: string,
	options?: { maxWidth?: number; quality?: number }
): string {
	const params = new URLSearchParams({ url: fileUrl });
	params.set("w", String(options?.maxWidth ?? CHAT_IMAGE_PREVIEW_MAX_WIDTH));
	params.set("q", String(options?.quality ?? CHAT_IMAGE_PREVIEW_QUALITY));
	return `/api/storage/image-preview?${params.toString()}`;
}

export function isStoredChatImageThumbnailUrl(url: string): boolean {
	return url.includes("/files/thumbs/") && /_w\d+_q\d+\.jpg(?:\?|$)/i.test(url);
}

/** @deprecated Legacy Vercel proxy URL; kept for fallback detection during rollout. */
export function isLegacyChatImagePreviewProxyUrl(url: string): boolean {
	return url.includes("/api/storage/image-preview");
}

export function isChatImageThumbnailUrl(url: string): boolean {
	return isStoredChatImageThumbnailUrl(url) || isLegacyChatImagePreviewProxyUrl(url);
}
