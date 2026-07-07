import type { Message } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import { useChatStore } from "@/stores/chatStore";
import { sortMessagesByCreatedAt } from "@/utils/chatMessagesMerge";
import { isOptimisticMessageId } from "@/utils/optimisticChatMessage";

export function isDeletableChatMessage(message: Message): boolean {
	if (message.pendingOutgoing) return false;
	if (isOptimisticMessageId(message.id)) return false;
	if (message.isArchivedMessage) return false;
	return true;
}

export type LocalMessageDeleteSnapshot = {
	message: Message;
	chatRoomId: string;
	previousLastMessage: Message | undefined;
};

/** Remove message from Zustand store and IndexedDB immediately (optimistic UI). */
export function removeChatMessageLocally(
	messageId: string
): LocalMessageDeleteSnapshot | null {
	const state = useChatStore.getState();
	const message = state.messages.find(msg => msg.id === messageId);
	if (!message) {
		return null;
	}

	const chatRoomId = message.chatRoomId;
	const chatRoom = state.chatRooms.find(room => room.id === chatRoomId);
	const previousLastMessage = chatRoom?.lastMessage;

	const updatedMessages = state.messages.filter(msg => msg.id !== messageId);
	state.setMessages(updatedMessages);

	indexedDBChatService.deleteMessage(messageId).catch((error: Error) => {
		console.error("Failed to delete message from IndexedDB:", error);
	});

	if (chatRoom && chatRoom.lastMessage?.id === messageId) {
		const remainingMessages = updatedMessages.filter(msg => msg.chatRoomId === chatRoomId);
		const newLastMessage =
			remainingMessages.length > 0
				? remainingMessages[remainingMessages.length - 1]
				: undefined;

		state.setChatRooms(
			state.chatRooms.map(room =>
				room.id === chatRoomId ? { ...room, lastMessage: newLastMessage } : room
			)
		);
	}

	return { message, chatRoomId, previousLastMessage };
}

/** Roll back optimistic delete when the API request fails. */
export function restoreChatMessageLocally(snapshot: LocalMessageDeleteSnapshot): void {
	const state = useChatStore.getState();
	const { message, chatRoomId, previousLastMessage } = snapshot;

	const updatedMessages = sortMessagesByCreatedAt([...state.messages, message]);
	state.setMessages(updatedMessages);

	indexedDBChatService.saveMessages(chatRoomId, [message]).catch((error: Error) => {
		console.error("Failed to restore message in IndexedDB:", error);
	});

	if (previousLastMessage?.id === message.id) {
		return;
	}

	state.setChatRooms(
		state.chatRooms.map(room =>
			room.id === chatRoomId ? { ...room, lastMessage: previousLastMessage } : room
		)
	);
}
