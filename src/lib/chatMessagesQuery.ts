import { Message } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import { useChatStore } from "@/stores/chatStore";
import {
	filterMessagesForRoom,
	mergeMessageLists,
	shouldForceMessagesApiSync,
	sortMessagesByCreatedAt,
} from "@/utils/chatMessagesMerge";
import { fetchChatMessagesHttp, isAbortError } from "@/lib/chatMessagesSingleFlight";
import {
	lastMessageFromTranscriptTail,
} from "@/utils/pickAuthoritativeLastMessage";
import { isOptimisticMessageId } from "@/utils/optimisticChatMessage";

export const CHAT_MESSAGES_QUERY_KEY = "chat-messages";

export const chatMessagesQueryKey = (
	chatRoomId: string,
	page: number,
	limit: number
) => [CHAT_MESSAGES_QUERY_KEY, chatRoomId, page, limit] as const;

export type FetchChatMessagesOptions = {
	force?: boolean;
	signal?: AbortSignal;
};

const isActiveRoom = (chatRoomId: string) => {
	const { currentChatRoom } = useChatStore.getState();
	return currentChatRoom?.id == null || currentChatRoom.id === chatRoomId;
};

const applyMessagesForRoom = (chatRoomId: string, lists: Message[][]) => {
	if (!isActiveRoom(chatRoomId)) return;

	const storeForRoom = filterMessagesForRoom(
		useChatStore.getState().messages,
		chatRoomId
	);
	const merged = mergeMessageLists(...lists, storeForRoom);
	useChatStore
		.getState()
		.setMessages(filterMessagesForRoom(merged, chatRoomId));
};

/** Align chat-list preview with the newest loaded transcript page. */
const reconcileRoomLastMessageFromMessages = (
	chatRoomId: string,
	messages: Message[]
) => {
	const state = useChatStore.getState();
	const room = state.chatRooms.find(r => r.id === chatRoomId);
	if (!room) return;

	const forRoom = sortMessagesByCreatedAt(
		filterMessagesForRoom(messages, chatRoomId)
	);
	const tail = lastMessageFromTranscriptTail(forRoom) as Message | null;
	const currentLast = room.lastMessage;

	if (
		currentLast &&
		(currentLast.pendingOutgoing || isOptimisticMessageId(currentLast.id))
	) {
		const tailTime = tail ? new Date(tail.createdAt).getTime() : 0;
		const pendingTime = new Date(currentLast.createdAt).getTime();
		if (pendingTime >= tailTime) {
			return;
		}
	}

	// Page-1 server transcript is authoritative: drop ghost previews that are
	// not present (or not newest) in the loaded messages.
	if ((tail?.id ?? null) === (currentLast?.id ?? null)) {
		return;
	}

	state.updateChatRoom(chatRoomId, {
		lastMessage: tail ?? undefined,
		...(tail?.createdAt ? { updatedAt: tail.createdAt } : {}),
	});
};

export type HydrateChatMessagesResult = {
	cachedMessages: Message[];
	needsApi: boolean;
};

/** IndexedDB-first hydrate; decides whether an API sync is required. */
export async function hydrateChatMessagesFromCache(
	chatRoomId: string,
	page: number,
	limit: number,
	options?: FetchChatMessagesOptions
): Promise<HydrateChatMessagesResult> {
	const force = options?.force ?? false;
	const { setCurrentPage, setHasMoreMessages } = useChatStore.getState();

	setCurrentPage(page);
	setHasMoreMessages(true);

	const room = useChatStore.getState().chatRooms.find(r => r.id === chatRoomId);
	const storeForRoom = filterMessagesForRoom(
		useChatStore.getState().messages,
		chatRoomId
	);

	const hasCachedMessages = await indexedDBChatService.hasMessages(chatRoomId);
	let cachedMessages: Message[] = [];

	if (hasCachedMessages) {
		cachedMessages = await indexedDBChatService.getMessages(
			chatRoomId,
			limit,
			(page - 1) * limit
		);
	}

	if (cachedMessages.length > 0) {
		applyMessagesForRoom(chatRoomId, [cachedMessages, storeForRoom]);
		setCurrentPage(page);
		setHasMoreMessages(cachedMessages.length >= limit);

		const isCacheFresh = await indexedDBChatService.isMessagesCacheFresh(
			chatRoomId,
			5
		);
		const roomNow = useChatStore.getState().chatRooms.find(r => r.id === chatRoomId);
		const storeNow = filterMessagesForRoom(
			useChatStore.getState().messages,
			chatRoomId
		);
		const needsApi = shouldForceMessagesApiSync(roomNow, storeNow, {
			force,
			cacheFresh: isCacheFresh,
		});

		return { cachedMessages, needsApi };
	}

	const needsApi =
		shouldForceMessagesApiSync(room, storeForRoom, {
			force: true,
			cacheFresh: false,
		}) || storeForRoom.length === 0;

	if (!needsApi && storeForRoom.length > 0) {
		applyMessagesForRoom(chatRoomId, [storeForRoom]);
		setCurrentPage(page);
		setHasMoreMessages(storeForRoom.length >= limit);
	}

	return { cachedMessages, needsApi };
}

/** Fetch from API and merge into store + IndexedDB. */
export async function fetchChatMessagesFromApi(
	chatRoomId: string,
	page: number,
	limit: number,
	options?: FetchChatMessagesOptions
) {
	const response = await fetchChatMessagesHttp(chatRoomId, page, limit, {
		signal: options?.signal,
	});

	if (!isActiveRoom(chatRoomId)) {
		return response;
	}

	const storeNow = filterMessagesForRoom(
		useChatStore.getState().messages,
		chatRoomId
	);
	applyMessagesForRoom(chatRoomId, [response.messages, storeNow]);

	const { setCurrentPage, setHasMoreMessages, setError } = useChatStore.getState();
	setCurrentPage(page);
	setHasMoreMessages(response.hasMore);
	setError(null);

	await indexedDBChatService.saveMessages(chatRoomId, response.messages);

	// Newest page from API is authoritative for list preview vs transcript.
	if (page === 1) {
		const mergedForRoom = filterMessagesForRoom(
			useChatStore.getState().messages,
			chatRoomId
		);
		reconcileRoomLastMessageFromMessages(chatRoomId, [
			...response.messages,
			...mergedForRoom,
		]);
	}

	return response;
}

/** Imperative load for reconnect / switchToChatRoom. */
export async function loadChatMessagesPage(
	chatRoomId: string,
	page: number = 1,
	limit: number = 50,
	options?: FetchChatMessagesOptions
) {
	const { needsApi } = await hydrateChatMessagesFromCache(
		chatRoomId,
		page,
		limit,
		options
	);

	if (!needsApi) {
		return;
	}

	try {
		await fetchChatMessagesFromApi(chatRoomId, page, limit, options);
	} catch (error) {
		if (isAbortError(error)) {
			return;
		}
		if (!isActiveRoom(chatRoomId)) {
			throw error;
		}

		const storeForRoom = filterMessagesForRoom(
			useChatStore.getState().messages,
			chatRoomId
		);

		if (storeForRoom.length > 0) {
			applyMessagesForRoom(chatRoomId, [storeForRoom]);
			return;
		}

		useChatStore.getState().setError("Failed to load messages");
		useChatStore.getState().setMessages([]);
		throw error;
	}
}
