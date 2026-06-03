import { useChatStore } from "@/stores/chatStore";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

type MessagesMarkedAsReadEvent = {
	chatRoomId: string;
	messageIds: string[];
	userId: string;
};

const pendingByRoom = new Map<string, MessagesMarkedAsReadEvent>();
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

	const existing = pendingByRoom.get(data.chatRoomId);
	if (existing) {
		const mergedIds = new Set([...existing.messageIds, ...data.messageIds]);
		pendingByRoom.set(data.chatRoomId, {
			chatRoomId: data.chatRoomId,
			userId: data.userId,
			messageIds: [...mergedIds],
		});
	} else {
		pendingByRoom.set(data.chatRoomId, {
			chatRoomId: data.chatRoomId,
			userId: data.userId,
			messageIds: [...data.messageIds],
		});
	}

	scheduleFlush();
};

export const flushPendingMessagesMarkedAsRead = () => {
	flushScheduled = false;
	if (pendingByRoom.size === 0) {
		return;
	}

	const batch = [...pendingByRoom.values()];
	pendingByRoom.clear();

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
