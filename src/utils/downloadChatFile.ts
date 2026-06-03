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

export type DownloadChatFileOptions = {
	/** Called when HEIC download/conversion starts (show loader). */
	onConvertingStart?: () => void;
	/** Called when HEIC download/conversion ends (hide loader). */
	onConvertingEnd?: () => void;
};

function triggerBlobDownload(blob: Blob, downloadName: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = downloadName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

function triggerProxyDownload(fileUrl: string, fileName: string) {
	const link = document.createElement("a");
	link.href = `/api/storage/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

/**
 * Download a chat attachment. HEIC/HEIF is converted to JPEG via `/api/storage/download`.
 * Falls back to raw file if conversion is unavailable.
 */
export async function downloadChatFile(
	fileUrl: string,
	fileName: string,
	options?: DownloadChatFileOptions
): Promise<void> {
	const name = (fileName || "download").trim();
	const isHeic = isHeicFileName(name, fileUrl);

	if (isHeic) {
		options?.onConvertingStart?.();
	}

	try {
		if (isHeic) {
			const response = await fetch(
				`/api/storage/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(name)}`,
				{ credentials: "include", cache: "no-store" }
			);
			if (!response.ok) {
				throw new Error("Download failed");
			}
			const blob = await response.blob();
			triggerBlobDownload(blob, toJpegDownloadFilename(name));
			return;
		}

		triggerProxyDownload(fileUrl, name);
	} finally {
		if (isHeic) {
			options?.onConvertingEnd?.();
		}
	}
}
