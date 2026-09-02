import type { Message } from "@/app-api/chatApi";
import { mergeReadByArrays } from "@/utils/chatMessagesMerge";

const MAX_PENDING_RECEIPTS = 1000;
const CATCH_UP_TTL_MS = 10 * 60 * 1000;

/** messageId → user ids who read it before the message was in the store. */
const pendingReceipts = new Map<string, Set<string>>();

/** `${chatRoomId}\t${userId}` → latest createdAt (ms) that user has caught up to. */
const catchUpUntilMs = new Map<string, number>();

const catchUpKey = (chatRoomId: string, userId: string) => `${chatRoomId}\t${userId}`;

export function resetPendingMessageReadReceipts() {
	pendingReceipts.clear();
	catchUpUntilMs.clear();
}

export function stashReadReceipt(messageId: string, userId: string) {
	if (!messageId || !userId) {
		return;
	}
	if (pendingReceipts.size >= MAX_PENDING_RECEIPTS && !pendingReceipts.has(messageId)) {
		const oldest = pendingReceipts.keys().next().value;
		if (oldest) {
			pendingReceipts.delete(oldest);
		}
	}
	let readers = pendingReceipts.get(messageId);
	if (!readers) {
		readers = new Set();
		pendingReceipts.set(messageId, readers);
	}
	readers.add(userId);
}

export function takeReadReceipts(messageId: string): string[] {
	const readers = pendingReceipts.get(messageId);
	if (!readers) {
		return [];
	}
	pendingReceipts.delete(messageId);
	return [...readers];
}

export function stashCatchUpRead(chatRoomId: string, userId: string, untilIso: string) {
	if (!chatRoomId || !userId) {
		return;
	}
	const untilMs = new Date(untilIso).getTime();
	if (!Number.isFinite(untilMs)) {
		return;
	}
	pruneCatchUpWatermarks();
	const key = catchUpKey(chatRoomId, userId);
	const previous = catchUpUntilMs.get(key) ?? 0;
	catchUpUntilMs.set(key, Math.max(previous, untilMs));
}

function pruneCatchUpWatermarks() {
	const cutoff = Date.now() - CATCH_UP_TTL_MS;
	for (const [key, untilMs] of catchUpUntilMs) {
		if (untilMs < cutoff) {
			catchUpUntilMs.delete(key);
		}
	}
}

function catchUpReaderIdsForMessage(message: Message): string[] {
	if (!message.chatRoomId || catchUpUntilMs.size === 0) {
		return [];
	}
	const createdAtMs = new Date(message.createdAt).getTime();
	if (!Number.isFinite(createdAtMs)) {
		return [];
	}

	const readers: string[] = [];
	for (const [key, untilMs] of catchUpUntilMs) {
		const sep = key.indexOf("\t");
		if (sep < 0) {
			continue;
		}
		const roomId = key.slice(0, sep);
		const userId = key.slice(sep + 1);
		if (roomId !== message.chatRoomId) {
			continue;
		}
		if (message.senderId === userId) {
			continue;
		}
		if (createdAtMs > untilMs) {
			continue;
		}
		readers.push(userId);
	}
	return readers;
}

export type ApplyPendingReadsOptions = {
	/** Apply room catch-up watermarks (new/live messages only, not history prepend). */
	applyCatchUp?: boolean;
};

/**
 * Merge stashed read receipts (and optional catch-up) into a message.
 * Per-message receipts are consumed; catch-up watermarks stay for later adds.
 */
export function applyPendingReadsToMessage(
	message: Message,
	options?: ApplyPendingReadsOptions
): Message {
	const fromReceipts = takeReadReceipts(message.id);
	const fromCatchUp = options?.applyCatchUp ? catchUpReaderIdsForMessage(message) : [];
	if (fromReceipts.length === 0 && fromCatchUp.length === 0) {
		return message;
	}

	const mergedReadBy = mergeReadByArrays(message.readBy, [...fromReceipts, ...fromCatchUp]);
	const prevReadBy = message.readBy ?? [];
	const readByUnchanged =
		mergedReadBy.length === prevReadBy.length &&
		mergedReadBy.every(id => prevReadBy.includes(id));
	if (readByUnchanged && message.isRead) {
		return message;
	}

	return {
		...message,
		isRead: true,
		readBy: mergedReadBy,
	};
}

export function applyPendingReadsToMessages(
	messages: Message[],
	options?: ApplyPendingReadsOptions
): Message[] {
	let changed = false;
	const next = messages.map(message => {
		const updated = applyPendingReadsToMessage(message, options);
		if (updated !== message) {
			changed = true;
		}
		return updated;
	});
	return changed ? next : messages;
}
