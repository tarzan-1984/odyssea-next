import {
	chatApi,
	ChatRoom,
	Message,
	SyncMessagesBatchRoomRequest,
	SyncMessagesBatchRoomResult,
} from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import { useChatStore } from "@/stores/chatStore";
import {
	filterMessagesForRoom,
	mergeMessageLists,
	messagesTailLagsBehindRoom,
} from "@/utils/chatMessagesMerge";

const SYNC_BATCH_CHUNK_SIZE = 50;

const normalizeParticipants = (participants: ChatRoom["participants"]) =>
	participants.map(p => ({
		...p,
		user: {
			...p.user,
			avatar: p.user?.avatar ?? p.user?.profilePhoto ?? "",
		},
	}));

export function roomNeedsMessageSync(
	apiRoom: ChatRoom,
	localLastMessageId: string | null | undefined,
	localMessages: Message[]
): boolean {
	if (!apiRoom.lastMessage?.id) {
		return false;
	}
	if (!localLastMessageId) {
		return true;
	}
	return messagesTailLagsBehindRoom(apiRoom, localMessages);
}

async function resolveLocalLastMessageId(
	chatRoomId: string,
	storeMessages: Message[],
	storeRoomLastId?: string | null
): Promise<string | null> {
	const cached = await indexedDBChatService.getMessages(chatRoomId);
	const cachedLast = cached.length > 0 ? cached[cached.length - 1].id : null;
	const storeLast =
		storeMessages.length > 0 ? storeMessages[storeMessages.length - 1].id : null;
	return storeLast ?? cachedLast ?? storeRoomLastId ?? null;
}

async function applySyncBatchResults(results: SyncMessagesBatchRoomResult[]): Promise<void> {
	const state = useChatStore.getState();
	const currentChatRoomId = state.currentChatRoom?.id;

	for (const roomResult of results) {
		const { chatRoomId, messages, unreadCount, lastMessage } = roomResult;

		state.updateChatRoom(chatRoomId, {
			unreadCount,
			...(lastMessage
				? { lastMessage, updatedAt: lastMessage.createdAt }
				: {}),
		});

		if (messages.length === 0) {
			continue;
		}

		const cached = await indexedDBChatService.getMessages(chatRoomId);
		const storeMsgs = filterMessagesForRoom(state.messages, chatRoomId);
		const merged = mergeMessageLists(cached, storeMsgs, messages);
		await indexedDBChatService.saveMessages(chatRoomId, merged);

		if (currentChatRoomId === chatRoomId) {
			state.setMessages(merged);
		}
	}
}

/**
 * After WebSocket reconnect: refresh chat rooms from API, then batch-sync only rooms
 * whose local message tail lags behind the server.
 */
export async function catchUpChatsOnReconnect(): Promise<void> {
	const apiRooms = await chatApi.getChatRooms();
	const state = useChatStore.getState();
	const previousRooms = state.chatRooms;

	const normalizedRooms: ChatRoom[] = apiRooms.map(room => ({
		...room,
		participants: normalizeParticipants(room.participants || []),
	}));

	const mergedRooms = normalizedRooms.map(apiRoom => {
		const storeRoom = previousRooms.find(r => r.id === apiRoom.id);
		return {
			...apiRoom,
			unreadCount: apiRoom.unreadCount ?? storeRoom?.unreadCount ?? 0,
			lastMessage: apiRoom.lastMessage ?? storeRoom?.lastMessage,
			updatedAt: apiRoom.updatedAt ?? storeRoom?.updatedAt ?? apiRoom.createdAt,
		};
	});

	state.setChatRooms(mergedRooms);
	await indexedDBChatService.saveChatRooms(mergedRooms);

	const roomsToSync: SyncMessagesBatchRoomRequest[] = [];

	for (const apiRoom of mergedRooms) {
		const storeRoom = previousRooms.find(r => r.id === apiRoom.id);
		const storeMessages = filterMessagesForRoom(state.messages, apiRoom.id);
		const cachedMessages = await indexedDBChatService.getMessages(apiRoom.id);
		const localMessages =
			storeMessages.length > 0 ? storeMessages : cachedMessages;

		const localLastId = await resolveLocalLastMessageId(
			apiRoom.id,
			storeMessages,
			storeRoom?.lastMessage?.id
		);

		if (roomNeedsMessageSync(apiRoom, localLastId, localMessages)) {
			roomsToSync.push({
				chatRoomId: apiRoom.id,
				lastMessageId: localLastId,
			});
		}
	}

	if (roomsToSync.length === 0) {
		return;
	}

	for (let i = 0; i < roomsToSync.length; i += SYNC_BATCH_CHUNK_SIZE) {
		const chunk = roomsToSync.slice(i, i + SYNC_BATCH_CHUNK_SIZE);
		const response = await chatApi.syncMessagesBatch(chunk);
		await applySyncBatchResults(response.rooms);
	}
}
