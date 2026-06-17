import type { ChatMessageAttachment, Message, User } from "@/app-api/chatApi";
import { getMessageMultiAttachments, MESSAGE_MULTI_FILE_SEPARATOR } from "@/app-api/chatApi";
import type { ChatOutboxItem } from "@/services/chatOutboxService";
import { createClientMessageId } from "@/services/chatOutboxService";

export type PendingOutgoingStatus = "uploading" | "sending" | "acknowledged" | "failed";

export type PendingOutgoingKind = "text" | "media";

export type PendingOutgoingMeta = {
	kind: PendingOutgoingKind;
	status: PendingOutgoingStatus;
	clientMessageId: string;
	serverMessageId?: string;
	expectedFileUrls?: string[];
	retryPayload?: {
		content: string;
		replyData?: Message["replyData"];
	};
};

const PENDING_ID_PREFIX = "pending-";

export function pendingIdForClientMessage(clientMessageId: string): string {
	return `${PENDING_ID_PREFIX}${clientMessageId}`;
}

export function clientMessageIdFromPendingId(messageId: string): string | null {
	if (!messageId.startsWith(PENDING_ID_PREFIX)) return null;
	return messageId.slice(PENDING_ID_PREFIX.length) || null;
}

export function isOptimisticMessageId(messageId: string): boolean {
	return messageId.startsWith(PENDING_ID_PREFIX);
}

function normalizeFileUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return "";
	try {
		return decodeURIComponent(new URL(trimmed).pathname);
	} catch {
		return decodeURIComponent(trimmed.split("?")[0] ?? trimmed);
	}
}

function fileUrlKey(url: string): string {
	const normalized = normalizeFileUrl(url);
	const basename = normalized.split("/").pop() ?? normalized;
	return basename.toLowerCase();
}

function getMessageAttachmentUrls(message: Message): string[] {
	const multi = getMessageMultiAttachments(message);
	if (multi?.length) {
		return multi.map(item => item.fileUrl);
	}
	if (message.fileUrl?.trim()) {
		return [message.fileUrl.trim()];
	}
	return [];
}

function applyUploadedFilesToMessage(
	message: Message,
	attachments: ChatMessageAttachment[]
): Message {
	if (attachments.length === 0) return message;
	if (attachments.length === 1) {
		const file = attachments[0];
		return {
			...message,
			fileUrl: file.fileUrl,
			fileName: file.fileName,
			fileSize: file.fileSize,
		};
	}
	return {
		...message,
		fileUrl: attachments.map(file => file.fileUrl).join(MESSAGE_MULTI_FILE_SEPARATOR),
		fileName: attachments.map(file => file.fileName).join(MESSAGE_MULTI_FILE_SEPARATOR),
		fileSize: attachments[0]?.fileSize,
		attachments,
	};
}

function buildOptimisticMessage(params: {
	clientMessageId: string;
	chatRoomId: string;
	sender: User;
	content: string;
	kind: PendingOutgoingKind;
	replyData?: Message["replyData"];
	status?: PendingOutgoingStatus;
	expectedFileUrls?: string[];
	uploadedAttachments?: ChatMessageAttachment[];
}): Message {
	const now = new Date().toISOString();
	const base: Message = {
		id: pendingIdForClientMessage(params.clientMessageId),
		chatRoomId: params.chatRoomId,
		senderId: params.sender.id,
		content: params.content,
		isRead: false,
		readBy: [params.sender.id],
		createdAt: now,
		replyData: params.replyData,
		sender: params.sender,
		clientMessageId: params.clientMessageId,
		pendingOutgoing: {
			kind: params.kind,
			status: params.status ?? "sending",
			clientMessageId: params.clientMessageId,
			expectedFileUrls: params.expectedFileUrls,
			retryPayload: {
				content: params.content,
				replyData: params.replyData,
			},
		},
	};

	if (params.uploadedAttachments?.length) {
		return applyUploadedFilesToMessage(base, params.uploadedAttachments);
	}
	return base;
}

export function createOptimisticTextMessage(params: {
	clientMessageId?: string;
	chatRoomId: string;
	sender: User;
	content: string;
	replyData?: Message["replyData"];
}): Message {
	const clientMessageId = params.clientMessageId ?? createClientMessageId();
	return buildOptimisticMessage({
		clientMessageId,
		chatRoomId: params.chatRoomId,
		sender: params.sender,
		content: params.content,
		kind: "text",
		replyData: params.replyData,
		status: "sending",
	});
}

export function createOptimisticMediaMessage(params: {
	clientMessageId?: string;
	chatRoomId: string;
	sender: User;
	content: string;
	attachments: ChatMessageAttachment[];
	replyData?: Message["replyData"];
}): Message {
	const clientMessageId = params.clientMessageId ?? createClientMessageId();
	const expectedFileUrls = params.attachments.map(file => file.fileUrl);
	return buildOptimisticMessage({
		clientMessageId,
		chatRoomId: params.chatRoomId,
		sender: params.sender,
		content: params.content,
		kind: "media",
		replyData: params.replyData,
		status: "sending",
		expectedFileUrls,
		uploadedAttachments: params.attachments,
	});
}

export function outboxItemToOptimisticMessage(item: ChatOutboxItem, sender: User): Message {
	const pendingStatus: PendingOutgoingStatus =
		item.status === "failed"
			? "failed"
			: item.serverMessageId
				? "acknowledged"
				: item.status === "uploading"
					? "uploading"
					: "sending";

	const attachments = item.uploadedAttachments ?? [];

	if (item.kind === "text") {
		return {
			...buildOptimisticMessage({
				clientMessageId: item.clientMessageId,
				chatRoomId: item.chatRoomId,
				sender,
				content: item.content,
				kind: "text",
				replyData: item.replyData,
				status: pendingStatus,
			}),
			pendingOutgoing: {
				kind: "text",
				status: pendingStatus,
				clientMessageId: item.clientMessageId,
				serverMessageId: item.serverMessageId,
				retryPayload: {
					content: item.content,
					replyData: item.replyData,
				},
			},
		};
	}

	return {
		...buildOptimisticMessage({
			clientMessageId: item.clientMessageId,
			chatRoomId: item.chatRoomId,
			sender,
			content: item.content,
			kind: "media",
			replyData: item.replyData,
			status: pendingStatus,
			expectedFileUrls: attachments.map(row => row.fileUrl),
			uploadedAttachments: attachments,
		}),
		pendingOutgoing: {
			kind: "media",
			status: pendingStatus,
			clientMessageId: item.clientMessageId,
			serverMessageId: item.serverMessageId,
			expectedFileUrls: attachments.map(row => row.fileUrl),
			retryPayload: {
				content: item.content,
				replyData: item.replyData,
			},
		},
	};
}

export function patchOptimisticMessage(
	message: Message,
	patch: Partial<PendingOutgoingMeta>
): Message {
	if (!message.pendingOutgoing) return message;
	return {
		...message,
		pendingOutgoing: {
			...message.pendingOutgoing,
			...patch,
		},
	};
}

function attachmentUrlsMatch(expected: string[], serverUrls: string[]): boolean {
	if (expected.length === 0 || serverUrls.length === 0) return false;
	if (expected.length !== serverUrls.length) return false;

	const normalizedExpected = expected.map(normalizeFileUrl).sort();
	const normalizedServer = serverUrls.map(normalizeFileUrl).sort();
	if (normalizedExpected.every((url, index) => url === normalizedServer[index])) {
		return true;
	}

	const basenameExpected = expected.map(fileUrlKey).sort();
	const basenameServer = serverUrls.map(fileUrlKey).sort();
	return basenameExpected.every((key, index) => key === basenameServer[index]);
}

/** True when a confirmed server message replaces this optimistic bubble. */
export function messageReplacesOptimistic(
	optimistic: Message,
	serverMessages: Message[],
	currentUserId?: string
): boolean {
	if (!optimistic.pendingOutgoing || !currentUserId) return false;
	if (optimistic.senderId !== currentUserId) return false;

	const clientMessageId = optimistic.pendingOutgoing.clientMessageId;
	const serverMessageId = optimistic.pendingOutgoing.serverMessageId;
	if (serverMessageId) {
		for (const serverMsg of serverMessages) {
			if (serverMsg.id === serverMessageId) return true;
		}
	}
	if (clientMessageId) {
		for (const serverMsg of serverMessages) {
			if (serverMsg.clientMessageId === clientMessageId) return true;
		}
	}

	const kind = optimistic.pendingOutgoing.kind;
	if (kind === "text") {
		const optimisticCreatedAt = new Date(optimistic.createdAt).getTime();
		const normalizedContent = optimistic.content.trim();
		for (const serverMsg of serverMessages) {
			if (serverMsg.senderId !== currentUserId) continue;
			if (isOptimisticMessageId(serverMsg.id)) continue;
			if (serverMsg.clientMessageId === clientMessageId) return true;
			const serverTime = new Date(serverMsg.createdAt).getTime();
			if (serverTime < optimisticCreatedAt - 5000) continue;
			if (serverTime > optimisticCreatedAt + 120_000) continue;
			if (serverMsg.content.trim() !== normalizedContent) continue;
			if (getMessageAttachmentUrls(serverMsg).length > 0) continue;
			return true;
		}
		return false;
	}

	const expected = optimistic.pendingOutgoing.expectedFileUrls ?? [];
	const expectedCount = expected.length;
	if (expectedCount === 0) return false;

	const optimisticCreatedAt = new Date(optimistic.createdAt).getTime();

	for (const serverMsg of serverMessages) {
		if (serverMsg.senderId !== currentUserId) continue;
		if (isOptimisticMessageId(serverMsg.id)) continue;
		if (serverMsg.clientMessageId === clientMessageId) return true;

		const serverTime = new Date(serverMsg.createdAt).getTime();
		if (serverTime < optimisticCreatedAt - 5000) continue;
		if (serverTime > optimisticCreatedAt + 120_000) continue;

		const serverUrls = getMessageAttachmentUrls(serverMsg);
		if (serverUrls.length === 0) continue;

		if (expected.length > 0 && attachmentUrlsMatch(expected, serverUrls)) {
			return true;
		}

		if (
			(optimistic.pendingOutgoing.status === "sending" ||
				optimistic.pendingOutgoing.status === "acknowledged") &&
			serverUrls.length === expectedCount &&
			serverTime >= optimisticCreatedAt - 1000
		) {
			return true;
		}
	}

	return false;
}

export function removeOptimisticByClientMessageId(
	optimisticMessages: Message[],
	clientMessageId: string
): Message[] {
	return optimisticMessages.filter(
		msg => msg.pendingOutgoing?.clientMessageId !== clientMessageId
	);
}
