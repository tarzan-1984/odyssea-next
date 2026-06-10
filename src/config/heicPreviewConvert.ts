/**
 * HEIC preview uses /api/storage/convert-heic when enabled.
 * In chat, conversion starts only after messages load and preview is in viewport (see FilePreview).
 */
export const HEIC_PREVIEW_CONVERT_ENABLED = true;

export function getHeicConvertPreviewUrl(fileUrl: string): string | null {
	if (!HEIC_PREVIEW_CONVERT_ENABLED) {
		return null;
	}
	return `/api/storage/convert-heic?url=${encodeURIComponent(fileUrl)}`;
}
