/** HEIC/HEIF attachment — convert to JPEG on download (legacy messages). */

export function isHeicFileName(fileName: string, fileUrl?: string): boolean {
	const name = (fileName || "").trim();
	if (/\.(heic|heif)$/i.test(name)) return true;
	const url = (fileUrl || "").trim();
	return /\.(heic|heif)(?:\?|$)/i.test(url);
}

export function toJpegDownloadFilename(fileName: string): string {
	const name = (fileName || "image").trim();
	if (/\.(heic|heif)$/i.test(name)) {
		return name.replace(/\.(heic|heif)$/i, ".jpg");
	}
	return `${name.replace(/\.[^/.]+$/, "") || "image"}.jpg`;
}

/**
 * Download a chat attachment. HEIC/HEIF is converted to JPEG via `/api/storage/download`.
 * Falls back to raw file if conversion is unavailable.
 */
export async function downloadChatFile(fileUrl: string, fileName: string): Promise<void> {
	const name = (fileName || "download").trim();
	const link = document.createElement("a");
	link.href = `/api/storage/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(name)}`;
	link.download = isHeicFileName(name, fileUrl) ? toJpegDownloadFilename(name) : name;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
