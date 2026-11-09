/** Same file types as chat attachment picker (ChatBoxSendForm). */
export const CHAT_ATTACHMENT_ACCEPT =
	"image/*,.heic,.heif,application/pdf,.doc,.docx,.txt";

export const CHAT_ATTACHMENT_TYPES = [
	"image/*",
	"application/pdf",
	".doc",
	".docx",
	".txt",
	".heic",
	".heif",
] as const;

export function isChatAttachmentFile(file: File): boolean {
	const fileType = file.type;
	const lowerName = file.name.toLowerCase();

	return CHAT_ATTACHMENT_TYPES.some(type => {
		if (type.startsWith(".")) {
			return lowerName.endsWith(type);
		}
		if (type.endsWith("/*")) {
			const baseType = type.slice(0, -2);
			return fileType.startsWith(baseType);
		}
		return fileType === type;
	});
}

export function isChatAttachmentImageFile(file: File): boolean {
	const lowerName = file.name.toLowerCase();
	if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) {
		return true;
	}
	return file.type.startsWith("image/");
}

export function isChatAttachmentNonImageFile(file: File): boolean {
	return isChatAttachmentFile(file) && !isChatAttachmentImageFile(file);
}

/** Video is allowed in chat only. News attachments keep CHAT_ATTACHMENT_TYPES. */
export const CHAT_VIDEO_ACCEPT =
	"video/mp4,video/quicktime,video/webm,video/3gpp,.mp4,.m4v,.mov,.webm,.3gp";

export const CHAT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const CHAT_VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mov", ".webm", ".3gp", ".3gpp"];

export function isChatVideoFile(file: { name?: string; type?: string }): boolean {
	const type = (file.type || "").toLowerCase().split(";")[0].trim();
	if (type.startsWith("video/")) return true;
	const name = (file.name || "").toLowerCase();
	return CHAT_VIDEO_EXTENSIONS.some(extension => name.endsWith(extension));
}

export function chatVideoContentType(fileName: string, type?: string): string | null {
	const raw = (type || "").toLowerCase().split(";")[0].trim();
	if (raw.startsWith("video/")) return raw;
	const extension = fileName.toLowerCase().split(".").pop() || "";
	const byExtension: Record<string, string> = {
		mp4: "video/mp4",
		m4v: "video/mp4",
		mov: "video/quicktime",
		webm: "video/webm",
		"3gp": "video/3gpp",
		"3gpp": "video/3gpp",
	};
	return byExtension[extension] ?? null;
}
