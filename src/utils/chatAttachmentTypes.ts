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
