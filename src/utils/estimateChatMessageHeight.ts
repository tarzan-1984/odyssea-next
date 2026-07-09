import { Message, getMessageMultiAttachments } from "@/app-api/chatApi";

const BASE_HEIGHT_PX = 20;
const LINE_HEIGHT_PX = 20;
const CHARS_PER_LINE = 42;
const MAX_TEXT_HEIGHT_PX = 480;
const REPLY_BLOCK_PX = 68;
const REACTIONS_PX = 40;
const SINGLE_ATTACHMENT_CARD_PX = 160;
const IMAGE_ATTACHMENT_PX = SINGLE_ATTACHMENT_CARD_PX;
const PDF_ATTACHMENT_PX = SINGLE_ATTACHMENT_CARD_PX;
const GENERIC_FILE_PX = 76;
const MULTI_ATTACHMENT_CELL_PX = 148;
const TWO_ATTACHMENT_CELL_PX = 168;
const MULTI_ATTACHMENT_GRID_GAP_PX = 8;
const INCOMING_NAME_PX = 24;
const INCOMING_FOOTER_PX = 24;
const INCOMING_PHONE_PX = 26;
const OUTGOING_META_PX = 24;
const PENDING_FAILED_PX = 32;

export interface EstimateChatMessageHeightOptions {
	currentUserId?: string | null;
	chatRoomType?: string;
}

function isImageFileName(fileName: string): boolean {
	return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff|svg|dng)$/i.test(fileName);
}

function isPdfFileName(fileName: string): boolean {
	return /\.pdf$/i.test(fileName);
}

function attachmentHeight(fileName: string): number {
	if (isImageFileName(fileName)) return IMAGE_ATTACHMENT_PX;
	if (isPdfFileName(fileName)) return PDF_ATTACHMENT_PX;
	return GENERIC_FILE_PX;
}

function multiAttachmentGridHeight(count: number): number {
	const columns = count > 3 ? 3 : 2;
	const rows = Math.max(1, Math.ceil(count / columns));
	const cellHeight = count === 2 ? TWO_ATTACHMENT_CELL_PX : MULTI_ATTACHMENT_CELL_PX;
	return rows * cellHeight + Math.max(0, rows - 1) * MULTI_ATTACHMENT_GRID_GAP_PX;
}

function shouldEstimateIncomingPhone(message: Message, chatRoomType?: string): boolean {
	const phone = String(message.sender.phone ?? "").trim();
	if (!phone) return false;

	const role = message.sender.role?.toUpperCase().trim() ?? "";
	const isDriverSender = role === "DRIVER";
	const isLoadTrackingRoleSender = [
		"TRACKING_TL",
		"TRACKING",
		"MORNING_TRACKING",
		"NIGHTSHIFT_TRACKING",
	].includes(role);

	return chatRoomType === "LOAD" ? isDriverSender || isLoadTrackingRoleSender : isDriverSender;
}

function hasVisibleMessageBody(message: Message): boolean {
	const multi = getMessageMultiAttachments(message);
	return Boolean(message.content?.trim() || message.fileUrl || (multi && multi.length > 0));
}

/** Heuristic row height for virtual list before/without DOM measurement. */
export function estimateChatMessageHeight(
	message: Message,
	options?: EstimateChatMessageHeightOptions
): number {
	let height = BASE_HEIGHT_PX;

	const text = message.content?.trim() ?? "";
	if (text) {
		const lineCount = Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));
		height += Math.min(lineCount * LINE_HEIGHT_PX, MAX_TEXT_HEIGHT_PX);
	}

	if (message.replyData) {
		height += REPLY_BLOCK_PX;
	}

	const multi = getMessageMultiAttachments(message);
	if (multi && multi.length >= 2) {
		height += multiAttachmentGridHeight(multi.length);
	} else if (message.fileName) {
		height += attachmentHeight(message.fileName);
	}

	if (message.reactions && message.reactions.length > 0) {
		height += REACTIONS_PX;
	}

	const isSender = options?.currentUserId != null && message.senderId === options.currentUserId;

	if (!isSender) {
		if (hasVisibleMessageBody(message)) {
			height += INCOMING_NAME_PX;
		}
		height += INCOMING_FOOTER_PX;
		if (shouldEstimateIncomingPhone(message, options?.chatRoomType)) {
			height += INCOMING_PHONE_PX;
		}
	} else {
		height += OUTGOING_META_PX;
		if (message.pendingOutgoing?.status === "failed") {
			height += PENDING_FAILED_PX;
		}
	}

	return Math.max(height, isSender ? 64 : 72);
}
