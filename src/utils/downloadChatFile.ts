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
	/** Saved filename. LOAD chats pass the load reference number. */
	downloadName?: string;
};

function sanitizeDownloadBase(value: string): string {
	return value.replace(/[\\/\r\n\t":*?<>|]/g, "").trim().slice(0, 120);
}

function chatDownloadExtension(fileName: string, fileUrl?: string, forcePdf?: boolean): string {
	if (forcePdf) return "pdf";
	if (isHeicFileName(fileName, fileUrl)) return "jpg";
	const name = (fileName || "").trim();
	const dot = name.lastIndexOf(".");
	if (dot > 0 && dot < name.length - 1) {
		const ext = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
		if (ext && ext.length <= 8) return ext;
	}
	return "";
}

/**
 * LOAD chat download/save name: `{referenceNumber}.{ext}`.
 * Returns null when there is no reference number (other chat types keep the original name).
 */
export function loadReferenceDownloadFilename(
	referenceNumber: string | null | undefined,
	fileName: string,
	fileUrl?: string,
	options?: { forcePdf?: boolean }
): string | null {
	const base = sanitizeDownloadBase(referenceNumber ?? "");
	if (!base) return null;
	const ext = chatDownloadExtension(fileName, fileUrl, options?.forcePdf);
	return ext ? `${base}.${ext}` : base;
}

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
	const saveName = (options?.downloadName || name).trim() || name;
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
			triggerBlobDownload(blob, toJpegDownloadFilename(saveName));
			return;
		}

		triggerProxyDownload(fileUrl, saveName);
	} finally {
		if (isHeic) {
			options?.onConvertingEnd?.();
		}
	}
}
