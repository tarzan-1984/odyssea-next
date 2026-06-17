import type { Message } from "@/app-api/chatApi";

/** Max messages kept in Zustand for the open chat (DOM window is smaller via virtualization). */
export const MAX_MESSAGES_IN_STORE = 250;

/** Newest messages always kept in RAM while trimming the scroll-back buffer. */
export const PINNED_TAIL_MESSAGES = 50;

/**
 * Sliding window: when over max, keep the oldest part of the scroll buffer plus a pinned tail.
 * Drops the middle chunk (still available from IndexedDB / API on scroll).
 */
export function trimChatMessagesWindow(
	messages: Message[],
	max: number = MAX_MESSAGES_IN_STORE,
	pinnedTail: number = PINNED_TAIL_MESSAGES
): Message[] {
	if (messages.length <= max) {
		return messages;
	}

	const pinCount = Math.min(pinnedTail, max, messages.length);
	const pinned = messages.slice(-pinCount);
	const head = messages.slice(0, -pinCount);
	const headBudget = max - pinCount;

	if (head.length <= headBudget) {
		return [...head, ...pinned];
	}

	const keptHead = head.slice(0, headBudget);
	return [...keptHead, ...pinned];
}
