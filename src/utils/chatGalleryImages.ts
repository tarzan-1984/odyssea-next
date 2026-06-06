import {
	getMessageMultiAttachments,
	MESSAGE_MULTI_FILE_SEPARATOR,
	type ChatMessageAttachment,
	type Message,
} from "@/app-api/chatApi";

const IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"svg",
	"heic",
	"heif",
	"bmp",
	"tiff",
]);

export type ChatGalleryImage = ChatMessageAttachment & {
	messageId: string;
};

export function isChatImageFileName(fileName?: string | null): boolean {
	if (!fileName) return false;
	const ext = fileName.toLowerCase().split(".").pop();
	return Boolean(ext && IMAGE_EXTENSIONS.has(ext));
}

export function galleryImageKey(fileUrl: string, fileName: string): string {
	return `${fileUrl.trim().split("?")[0]}::${fileName.trim().toLowerCase()}`;
}

function parseAttachmentRecord(item: unknown): ChatMessageAttachment | null {
	if (!item || typeof item !== "object") return null;
	const o = item as Record<string, unknown>;
	const fileUrl = typeof o.fileUrl === "string" ? o.fileUrl.trim() : "";
	const fileName = typeof o.fileName === "string" ? o.fileName.trim() : "";
	if (!fileUrl || !fileName) return null;
	const fileSize = typeof o.fileSize === "number" ? o.fileSize : undefined;
	return { fileUrl, fileName, fileSize };
}

function pushUniqueImage(
	out: ChatGalleryImage[],
	seen: Set<string>,
	messageId: string,
	attachment: ChatMessageAttachment
) {
	if (!isChatImageFileName(attachment.fileName)) return;
	const key = galleryImageKey(attachment.fileUrl, attachment.fileName);
	if (seen.has(key)) return;
	seen.add(key);
	out.push({
		fileUrl: attachment.fileUrl,
		fileName: attachment.fileName,
		fileSize: attachment.fileSize,
		messageId,
	});
}

function collectFromPipeSeparated(
	out: ChatGalleryImage[],
	seen: Set<string>,
	messageId: string,
	fileUrl: string,
	fileName: string,
	fileSize?: number
) {
	const urls = fileUrl.split(MESSAGE_MULTI_FILE_SEPARATOR);
	const names = fileName.split(MESSAGE_MULTI_FILE_SEPARATOR);
	if (urls.length !== names.length) return;

	for (let i = 0; i < urls.length; i++) {
		const url = urls[i]?.trim() ?? "";
		const name = names[i]?.trim() ?? "";
		if (!url || !name) continue;
		pushUniqueImage(out, seen, messageId, {
			fileUrl: url,
			fileName: name,
			fileSize: i === 0 ? fileSize : undefined,
		});
	}
}

function getMessageImageAttachments(message: Message): ChatMessageAttachment[] {
	const fromArray: ChatMessageAttachment[] = [];
	if (Array.isArray(message.attachments)) {
		for (const item of message.attachments) {
			const att = parseAttachmentRecord(item);
			if (att) fromArray.push(att);
		}
	}
	if (fromArray.length > 0) return fromArray;

	const multi = getMessageMultiAttachments(message);
	if (multi) return multi;

	const fileUrl = message.fileUrl?.trim();
	const fileName = message.fileName?.trim();
	if (!fileUrl || !fileName) return [];

	if (
		fileUrl.includes(MESSAGE_MULTI_FILE_SEPARATOR) ||
		fileName.includes(MESSAGE_MULTI_FILE_SEPARATOR)
	) {
		const out: ChatMessageAttachment[] = [];
		const seen = new Set<string>();
		const temp: ChatGalleryImage[] = [];
		collectFromPipeSeparated(temp, seen, message.id, fileUrl, fileName, message.fileSize);
		return temp.map(({ fileUrl, fileName, fileSize }) => ({
			fileUrl,
			fileName,
			fileSize,
		}));
	}

	return [
		{
			fileUrl,
			fileName,
			fileSize: message.fileSize,
		},
	];
}

/** All image attachments in chat messages, chronological order. */
export function collectChatGalleryImages(messages: Message[]): ChatGalleryImage[] {
	const out: ChatGalleryImage[] = [];
	const seen = new Set<string>();

	for (const message of messages) {
		for (const attachment of getMessageImageAttachments(message)) {
			pushUniqueImage(out, seen, message.id, attachment);
		}
	}

	return out;
}

export function findChatGalleryImageIndex(
	images: ChatGalleryImage[],
	target: Pick<ChatGalleryImage, "fileUrl" | "fileName">
): number {
	const targetKey = galleryImageKey(target.fileUrl, target.fileName);
	return images.findIndex(
		img => galleryImageKey(img.fileUrl, img.fileName) === targetKey
	);
}

export function mergeGalleryWithClickedImage(
	images: ChatGalleryImage[],
	clicked: OpenImageInput
): { images: ChatGalleryImage[]; index: number } {
	const index = findChatGalleryImageIndex(images, clicked);
	if (index >= 0) {
		return { images, index };
	}

	const merged: ChatGalleryImage[] = [
		...images,
		{
			fileUrl: clicked.fileUrl,
			fileName: clicked.fileName,
			fileSize: clicked.fileSize,
			messageId: "",
		},
	];
	return { images: merged, index: merged.length - 1 };
}

export type OpenImageInput = Pick<ChatGalleryImage, "fileUrl" | "fileName" | "fileSize">;
