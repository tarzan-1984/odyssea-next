import { useChatStore } from "@/stores/chatStore";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

export type MessagesMarkedAsReadEvent = {
	chatRoomId: string;
	messageIds: string[];
	userId: string;
	/** Full readBy from DB when provided by the server (authoritative). */
	messages?: { id: string; readBy?: string[]; isRead?: boolean }[];
};

const pendingEvents: MessagesMarkedAsReadEvent[] = [];
let flushScheduled = false;

const scheduleFlush = () => {
	if (flushScheduled) {
		return;
	}
	flushScheduled = true;
	queueMicrotask(flushPendingMessagesMarkedAsRead);
};

export const queueMessagesMarkedAsRead = (data: MessagesMarkedAsReadEvent) => {
	if (!data?.chatRoomId) {
		return;
	}

	pendingEvents.push({
		chatRoomId: data.chatRoomId,
		userId: data.userId,
		messageIds: [...data.messageIds],
		messages: data.messages?.map(m => ({
			id: m.id,
			readBy: m.readBy ? [...m.readBy] : undefined,
			isRead: m.isRead,
		})),
	});

	scheduleFlush();
};

export const flushPendingMessagesMarkedAsRead = () => {
	flushScheduled = false;
	if (pendingEvents.length === 0) {
		return;
	}

	const batch = pendingEvents.splice(0, pendingEvents.length);

	const state = useChatStore.getState();
	const didUpdate = state.applyBulkMessagesMarkedAsRead(batch);
	if (!didUpdate) {
		return;
	}

	const messagesAfter = useChatStore.getState().messages;
	const messageById = new Map(messagesAfter.map(m => [m.id, m]));

	for (const event of batch) {
		for (const messageId of event.messageIds) {
			const message = messageById.get(messageId);
			if (!message) {
				continue;
			}
			indexedDBChatService
				.updateMessage(messageId, {
					isRead: true,
					readBy: message.readBy,
				})
				.catch((error: Error) => {
					console.error("Failed to update message as read in IndexedDB:", error);
				});
		}
	}
};
