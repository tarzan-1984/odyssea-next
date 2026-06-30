import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { ChatRoom, Message, User, isMessageReadByUser } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import { mergeMessageLists, mergeReadByArrays, filterMessagesForRoom } from "@/utils/chatMessagesMerge";
import {
	archiveDayHasRemaining,
	archiveDayKey,
	ArchivedDayCacheEntry,
	sortArchiveDayMessages,
	takeNextArchiveChunk,
} from "@/utils/archiveChunkHelpers";
import { MAX_CACHED_MESSAGES_PER_ROOM } from "@/constants/chatCacheLimits";
import { trimChatMessagesWindow } from "@/utils/trimChatMessagesWindow";
import { mergeChatRoomParticipants } from "@/utils/normalizeChatParticipants";
import { useUserStore } from "./userStore";

// Helper function to sort chat rooms by pin, unread, mute status, and last message date
const sortChatRoomsByLastMessage = (chatRooms: ChatRoom[]): ChatRoom[] => {
	const compareByDate = (a: ChatRoom, b: ChatRoom) => {
		const aDate = a.lastMessage?.createdAt || a.createdAt;
		const bDate = b.lastMessage?.createdAt || b.createdAt;
		return new Date(bDate).getTime() - new Date(aDate).getTime();
	};

	const hasUnread = (room: ChatRoom) => (room.unreadCount ?? 0) > 0;

	return [...chatRooms].sort((a, b) => {
		// 1. Pinned chats first
		if (a.isPinned && !b.isPinned) return -1;
		if (!a.isPinned && b.isPinned) return 1;

		// 2. Unread chats before read (within the same pin group)
		const aUnread = hasUnread(a);
		const bUnread = hasUnread(b);
		if (aUnread && !bUnread) return -1;
		if (!aUnread && bUnread) return 1;

		// 3. Among non-pinned: muted chats go to the bottom
		if (!a.isPinned && !b.isPinned) {
			if (a.isMuted && !b.isMuted) return 1;
			if (!a.isMuted && b.isMuted) return -1;
		}

		// 4. Sort by last message date
		return compareByDate(a, b);
	});
};

// Interface for chat store state
interface ChatState {
	// Current active chat room
	currentChatRoom: ChatRoom | null;

	// Messages for current chat room
	messages: Message[];

	// All chat rooms list
	chatRooms: ChatRoom[];

	// Loading states
	isLoadingMessages: boolean;
	isLoadingChatRooms: boolean;
	isSendingMessage: boolean;

	// Error states
	error: string | null;

	// Pagination for messages
	hasMoreMessages: boolean;
	currentPage: number;

	// Archive state
	hasArchivedMessages: boolean;
	isLoadingArchivedMessages: boolean;
	isLoadingAvailableArchives: boolean; // Loading list of available archives
	archivedMessagesCache: Map<string, ArchivedDayCacheEntry>;
	availableArchives: {
		year: number;
		month: number;
		day: number;
		messageCount: number;
		createdAt: string;
	}[];
	currentArchiveIndex: number; // Index of next archive to load
	pendingArchiveLoad: boolean; // User scrolled up while archives were loading
	/** chatRoomId for which availableArchives was fetched (even if empty). */
	archiveDaysLoadedForRoomId: string | null;
	archiveDaysInflightRoomId: string | null;

	// Actions for managing chat rooms
	setCurrentChatRoom: (chatRoom: ChatRoom | null) => void;
	setChatRooms: (chatRooms: ChatRoom[]) => void;
	addChatRoom: (chatRoom: ChatRoom) => void;
	updateChatRoom: (chatRoomId: string, updates: Partial<ChatRoom>) => void;
	removeChatRoom: (chatRoomId: string) => void;

	// Actions for managing messages
	setMessages: (messages: Message[]) => void;
	/** WebSocket `messagesMarkedAsRead` — single atomic update, skips when nothing changed. */
	applyMessagesMarkedAsRead: (data: {
		chatRoomId: string;
		messageIds: string[];
		userId: string;
	}) => boolean;
	/** Apply multiple read events in one store update (avoids update loops on "Read all"). */
	applyBulkMessagesMarkedAsRead: (
		events: {
			chatRoomId: string;
			messageIds: string[];
			userId: string;
			messages?: { id: string; readBy?: string[]; isRead?: boolean }[];
		}[]
	) => boolean;
	/** Single read receipt from `messageRead` WebSocket event. */
	applyMessageReadReceipt: (data: {
		messageId: string;
		readByUserId: string;
	}) => boolean;
	/** Optimistic local sync when user clicks "Read all" before WebSocket events arrive. */
	markChatRoomsAsReadLocally: (chatRoomIds: string[]) => void;
	addMessage: (message: Message) => void;
	updateMessage: (messageId: string, updates: Partial<Message>) => void;
	prependMessages: (messages: Message[]) => void;
	clearMessages: () => void;

	// Actions for loading states
	setLoadingMessages: (loading: boolean) => void;
	setLoadingChatRooms: (loading: boolean) => void;
	setSendingMessage: (sending: boolean) => void;
	setError: (error: string | null) => void;

	// Actions for pagination
	setHasMoreMessages: (hasMore: boolean) => void;
	setCurrentPage: (page: number) => void;

	// Actions for archive
	setHasArchivedMessages: (hasArchived: boolean) => void;
	setLoadingArchivedMessages: (loading: boolean) => void;
	addArchivedMessages: (year: number, month: number, messages: Message[]) => void;
	clearArchivedMessagesCache: () => void;

	// Action to load messages from IndexedDB
	loadMessagesFromCache: (chatRoomId: string) => Promise<void>;

	// Action to save messages to IndexedDB
	saveMessagesToCache: (chatRoomId: string, messages: Message[]) => Promise<void>;

	// Action to clear all data (for logout)
	clearAllData: () => void;

	// Action to clear cache from IndexedDB
	clearCache: () => Promise<void>;

	// Action to load more messages (for infinite scroll)
	loadMoreMessages: () => Promise<void>;

	// Archive-related actions
	loadArchivedMessages: (year: number, month: number, day: number) => Promise<void>;
	checkArchivedMessagesExists: (year: number, month: number, day: number) => Promise<boolean>;
	getNextArchiveMonth: () => { year: number; month: number } | null;
	getAvailableArchiveDays: () => Promise<
		{ year: number; month: number; day: number; messageCount: number; createdAt: string }[]
	>;
	setAvailableArchives: (
		archives: {
			year: number;
			month: number;
			day: number;
			messageCount: number;
			createdAt: string;
		}[]
	) => void;
	getNextAvailableArchive: () => {
		year: number;
		month: number;
		day: number;
		messageCount: number;
		createdAt: string;
	} | null;
	setPendingArchiveLoad: (pending: boolean) => void;
	triggerPendingArchiveLoad: () => void;
	/** Fetch S3 archive day list only when needed (scroll / empty PG). Deduped per room. */
	ensureAvailableArchiveDays: () => Promise<
		{ year: number; month: number; day: number; messageCount: number; createdAt: string }[]
	>;
	/** Load the next archive day after ensuring the day list is available. */
	tryLoadNextArchivePage: () => Promise<void>;
	/** When PostgreSQL returned no rows, load the newest archived day immediately. */
	loadInitialArchiveIfPgEmpty: () => Promise<void>;

	// User join date methods
	getUserJoinDate: () => Date | null;
}

// Create the chat store with Zustand
export const useChatStore = create<ChatState>()(
	devtools(
		persist(
			(set, get) => ({
				// Initial state
				currentChatRoom: null,
				messages: [],
				chatRooms: [],
				isLoadingMessages: false,
				isLoadingChatRooms: false,
				isSendingMessage: false,
				error: null,
				hasMoreMessages: false,
				currentPage: 1,

				// Archive state
				hasArchivedMessages: false,
				isLoadingArchivedMessages: false,
				isLoadingAvailableArchives: false,
				archivedMessagesCache: new Map(),
				availableArchives: [],
				currentArchiveIndex: 0,
				pendingArchiveLoad: false,
				archiveDaysLoadedForRoomId: null,
				archiveDaysInflightRoomId: null,

				// Chat room actions
				setCurrentChatRoom: chatRoom => {
					const prev = get().currentChatRoom;
					if (chatRoom && prev?.id === chatRoom.id) {
						set(
							{ currentChatRoom: chatRoom, error: null },
							false,
							"setCurrentChatRoom:sameRoom"
						);
						return;
					}

					set(
						{
							currentChatRoom: chatRoom,
							error: null,
							pendingArchiveLoad: false,
							isLoadingAvailableArchives: false,
							availableArchives: [],
							currentArchiveIndex: 0,
							archiveDaysLoadedForRoomId: null,
							archiveDaysInflightRoomId: null,
							archivedMessagesCache: new Map(),
						},
						false,
						"setCurrentChatRoom"
					);
				},

				setChatRooms: chatRooms => {
					// Sort chat rooms by last message date when setting
					const sortedRooms = sortChatRoomsByLastMessage(chatRooms);
					const { currentChatRoom } = get();
					let nextCurrentChatRoom = currentChatRoom;
					if (currentChatRoom) {
						const matchingRoom = sortedRooms.find(r => r.id === currentChatRoom.id);
						if (matchingRoom) {
							nextCurrentChatRoom = {
								...currentChatRoom,
								participants: mergeChatRoomParticipants(
									matchingRoom.participants,
									currentChatRoom.participants
								),
							};
						}
					}
					set(
						{
							chatRooms: sortedRooms,
							currentChatRoom: nextCurrentChatRoom,
							error: null,
						},
						false,
						"setChatRooms"
					);
				},

				addChatRoom: chatRoom => {
					const { chatRooms, currentChatRoom } = get();
					const existingIndex = chatRooms.findIndex(room => room.id === chatRoom.id);

					if (existingIndex >= 0) {
						// Update existing room
						const updatedRooms = [...chatRooms];
						updatedRooms[existingIndex] = chatRoom;
						// Sort after update
						const sortedRooms = sortChatRoomsByLastMessage(updatedRooms);
						const patch: Partial<ChatState> = { chatRooms: sortedRooms };
						if (currentChatRoom?.id === chatRoom.id) {
							patch.currentChatRoom = {
								...currentChatRoom,
								...chatRoom,
								participants: mergeChatRoomParticipants(
									chatRoom.participants,
									currentChatRoom.participants
								),
							};
						}
						set(patch, false, "addChatRoom:update");
					} else {
						// Add new room and sort
						const newRooms = [chatRoom, ...chatRooms];
						const sortedRooms = sortChatRoomsByLastMessage(newRooms);
						set({ chatRooms: sortedRooms }, false, "addChatRoom:add");
					}
				},

				updateChatRoom: (chatRoomId, updates) => {
					const { chatRooms, currentChatRoom } = get();

					const updatedRooms = chatRooms.map(room =>
						room.id === chatRoomId ? { ...room, ...updates } : room
					);

					// Sort chat rooms by last message date after update
					const sortedRooms = sortChatRoomsByLastMessage(updatedRooms);

					const updatedState: Partial<ChatState> = { chatRooms: sortedRooms };
					if (currentChatRoom?.id === chatRoomId) {
						updatedState.currentChatRoom = { ...currentChatRoom, ...updates } as ChatRoom;
					}
					set(updatedState, false, "updateChatRoom");

					// Sync to IndexedDB
					indexedDBChatService.updateChatRoom(chatRoomId, updates).catch(error => {
						console.error("Failed to update chat room in IndexedDB:", error);
					});
				},

				removeChatRoom: chatRoomId => {
					const { chatRooms, currentChatRoom } = get();
					const updatedRooms = chatRooms.filter(room => room.id !== chatRoomId);
					const updatedState: Partial<ChatState> = { chatRooms: updatedRooms };

					// If the removed room was the current chat, clear it
					if (currentChatRoom?.id === chatRoomId) {
						updatedState.currentChatRoom = null;
						updatedState.messages = [];
					}

					set(updatedState, false, "removeChatRoom");

					// Remove from IndexedDB
					indexedDBChatService.deleteChatRoom(chatRoomId).catch(error => {
						console.error("Failed to delete chat room from IndexedDB:", error);
					});
				},

				// Message actions
				setMessages: messages => {
					set(
						{ messages: trimChatMessagesWindow(messages), error: null },
						false,
						"setMessages"
					);
				},

				applyBulkMessagesMarkedAsRead: events => {
					if (events.length === 0) {
						return false;
					}

					const { messages, chatRooms } = get();
					const currentUserId = useUserStore.getState().currentUser?.id;

					const readersToAdd = new Map<string, Set<string>>();
					const readByFromServer = new Map<string, string[]>();
					const roomsToClearUnread = new Set<string>();

					for (const event of events) {
						if (
							currentUserId &&
							event.userId === currentUserId &&
							event.chatRoomId
						) {
							roomsToClearUnread.add(event.chatRoomId);
						}
						for (const snapshot of event.messages ?? []) {
							if (snapshot.id && snapshot.readBy?.length) {
								readByFromServer.set(snapshot.id, snapshot.readBy);
							}
						}
						for (const messageId of event.messageIds) {
							if (!readersToAdd.has(messageId)) {
								readersToAdd.set(messageId, new Set());
							}
							readersToAdd.get(messageId)!.add(event.userId);
						}
					}

					let messagesChanged = false;
					const nextMessages =
						readersToAdd.size === 0 && readByFromServer.size === 0
							? messages
							: messages.map(msg => {
									const serverReadBy = readByFromServer.get(msg.id);
									const addIds = readersToAdd.get(msg.id);
									if (!serverReadBy && !addIds?.size) {
										return msg;
									}

									const mergedReadBy = serverReadBy
										? mergeReadByArrays(msg.readBy, serverReadBy)
										: mergeReadByArrays(
												msg.readBy,
												addIds ? [...addIds] : []
											);

									const prevReadBy = msg.readBy ?? [];
									if (
										msg.isRead !== false &&
										mergedReadBy.length === prevReadBy.length &&
										mergedReadBy.every(id => prevReadBy.includes(id))
									) {
										return msg;
									}

									messagesChanged = true;
									return {
										...msg,
										isRead: true,
										readBy: mergedReadBy,
									};
								});

					let roomsChanged = false;
					const nextRooms = chatRooms.map(room => {
						if (!roomsToClearUnread.has(room.id)) {
							return room;
						}
						if ((room.unreadCount ?? 0) === 0) {
							return room;
						}
						roomsChanged = true;
						indexedDBChatService
							.updateChatRoom(room.id, { unreadCount: 0 })
							.catch((error: Error) => {
								console.error("Failed to update chat room in IndexedDB:", error);
							});
						return { ...room, unreadCount: 0 };
					});

					if (!messagesChanged && !roomsChanged) {
						return false;
					}

					const patch: Partial<ChatState> = { error: null };
					if (messagesChanged) {
						patch.messages = trimChatMessagesWindow(nextMessages);
					}
					if (roomsChanged) {
						patch.chatRooms = sortChatRoomsByLastMessage(nextRooms);
					}

					set(patch, false, "applyBulkMessagesMarkedAsRead");
					return true;
				},

				applyMessagesMarkedAsRead: data =>
					get().applyBulkMessagesMarkedAsRead([data]),

				applyMessageReadReceipt: data => {
					const { messages } = get();
					const message = messages.find(m => m.id === data.messageId);
					if (!message) {
						return false;
					}
					if (
						isMessageReadByUser(message, data.readByUserId) &&
						message.isRead !== false
					) {
						return false;
					}
					const updatedReadBy = mergeReadByArrays(message.readBy, [
						data.readByUserId,
					]);
					const updatedMessages = messages.map(msg =>
						msg.id === data.messageId
							? { ...msg, isRead: true, readBy: updatedReadBy }
							: msg
					);
					set(
						{ messages: updatedMessages, error: null },
						false,
						"applyMessageReadReceipt"
					);
					indexedDBChatService
						.updateMessage(data.messageId, {
							isRead: true,
							readBy: updatedReadBy,
						})
						.catch((error: Error) => {
							console.error(
								"Failed to update message read receipt in IndexedDB:",
								error
							);
						});
					return true;
				},

				markChatRoomsAsReadLocally: chatRoomIds => {
					if (chatRoomIds.length === 0) {
						return;
					}
					const currentUserId = useUserStore.getState().currentUser?.id;
					if (!currentUserId) {
						return;
					}

					const { messages } = get();
					get().applyBulkMessagesMarkedAsRead(
						chatRoomIds.map(chatRoomId => ({
							chatRoomId,
							messageIds: messages
								.filter(m => m.chatRoomId === chatRoomId)
								.filter(m => !isMessageReadByUser(m, currentUserId))
								.map(m => m.id),
							userId: currentUserId,
						}))
					);
				},

				addMessage: message => {
					const { messages, chatRooms, currentChatRoom } = get();

					const updatedRooms = chatRooms.map(room => {
						if (room.id === message.chatRoomId) {
							return {
								...room,
								lastMessage: message,
								updatedAt: message.createdAt,
							};
						}
						return room;
					});
					const sortedRooms = sortChatRoomsByLastMessage(updatedRooms);

					// Only mutate the open chat transcript (avoid mixing rooms in one array)
					if (currentChatRoom?.id !== message.chatRoomId) {
						set({ chatRooms: sortedRooms }, false, "addMessage:roomOnly");
						return;
					}

					const roomMessages = messages.filter(m => m.chatRoomId === message.chatRoomId);
					if (roomMessages.some(msg => msg.id === message.id)) {
						set({ chatRooms: sortedRooms }, false, "addMessage:duplicate");
						return;
					}

					set(
						{
							messages: trimChatMessagesWindow([...roomMessages, message]),
							chatRooms: sortedRooms,
						},
						false,
						"addMessage"
					);
				},

				updateMessage: (messageId, updates) => {
					const { messages } = get();
					const message = messages.find(msg => msg.id === messageId);
					if (!message) {
						return;
					}
					const hasChanges = (Object.keys(updates) as (keyof Message)[]).some(
						key => !Object.is(message[key], updates[key])
					);
					if (!hasChanges) {
						return;
					}
					const updatedMessages = messages.map(msg =>
						msg.id === messageId ? { ...msg, ...updates } : msg
					);

					// Always save updated message to IndexedDB
					indexedDBChatService.updateMessage(messageId, updates).catch((error: Error) => {
						console.error("Failed to update message in IndexedDB:", error);
					});

					set({ messages: updatedMessages }, false, "updateMessage");
				},

				prependMessages: newMessages => {
					const { messages } = get();
					// Filter out messages that already exist to avoid duplicates
					const uniqueNewMessages = newMessages.filter(
						newMsg => !messages.some(existingMsg => existingMsg.id === newMsg.id)
					);
					set(
						{
							messages: trimChatMessagesWindow([
								...uniqueNewMessages,
								...messages,
							]),
						},
						false,
						"prependMessages"
					);
				},

				clearMessages: () => {
					set({ messages: [] }, false, "clearMessages");
				},

				// Loading state actions
				setLoadingMessages: loading => {
					set({ isLoadingMessages: loading }, false, "setLoadingMessages");
				},

				setLoadingChatRooms: loading => {
					set({ isLoadingChatRooms: loading }, false, "setLoadingChatRooms");
				},

				setSendingMessage: sending => {
					set({ isSendingMessage: sending }, false, "setSendingMessage");
				},

				setError: error => {
					set({ error }, false, "setError");
				},

				// Pagination actions
				setHasMoreMessages: hasMore => {
					set({ hasMoreMessages: hasMore }, false, "setHasMoreMessages");
				},

				setCurrentPage: page => {
					set({ currentPage: page }, false, "setCurrentPage");
				},

				// Cache management actions
				loadMessagesFromCache: async chatRoomId => {
					try {
						const cachedMessages = await indexedDBChatService.getMessages(
							chatRoomId,
							MAX_CACHED_MESSAGES_PER_ROOM
						);
						if (cachedMessages.length > 0) {
							const { messages: currentMessages, currentChatRoom } = get();
							if (currentChatRoom?.id === chatRoomId) {
								const roomStore = filterMessagesForRoom(
									currentMessages,
									chatRoomId
								);
								set(
									{
										messages: trimChatMessagesWindow(
											mergeMessageLists(cachedMessages, roomStore)
										),
									},
									false,
									"loadMessagesFromCache"
								);
							}
						}
					} catch (error) {
						console.error("Failed to load messages from cache:", error);
					}
				},

				saveMessagesToCache: async (chatRoomId, messages) => {
					try {
						await indexedDBChatService.saveMessages(chatRoomId, messages);
					} catch (error) {
						console.error("Failed to save messages to cache:", error);
					}
				},

				// Clear all data
				clearAllData: () => {
					set(
						{
							currentChatRoom: null,
							messages: [],
							chatRooms: [],
							isLoadingMessages: false,
							isLoadingChatRooms: false,
							isSendingMessage: false,
							error: null,
							hasMoreMessages: false,
							currentPage: 1,
						},
						false,
						"clearAllData"
					);
				},

				// Clear chat cache from IndexedDB and in-memory store (profile UI settings stay in localStorage)
				clearCache: async () => {
					try {
						await indexedDBChatService.clearCache();

						set(
							{
								currentChatRoom: null,
								messages: [],
								chatRooms: [],
								isLoadingMessages: false,
								isLoadingChatRooms: false,
								isSendingMessage: false,
								error: null,
								hasMoreMessages: false,
								currentPage: 1,
								hasArchivedMessages: false,
								isLoadingArchivedMessages: false,
								isLoadingAvailableArchives: false,
								archivedMessagesCache: new Map(),
								availableArchives: [],
								currentArchiveIndex: 0,
								pendingArchiveLoad: false,
								archiveDaysLoadedForRoomId: null,
								archiveDaysInflightRoomId: null,
							},
							false,
							"clearCache"
						);
					} catch (error) {
						console.error("Failed to clear cache:", error);
						throw error;
					}
				},

				loadMoreMessages: async () => {
					const {
						currentChatRoom,
						currentPage,
						hasMoreMessages,
						isLoadingMessages,
						messages,
					} = get();

					// Enhanced validation before loading more messages
					if (
						!currentChatRoom ||
						!hasMoreMessages ||
						isLoadingMessages ||
						messages.length === 0 // Don't load more if no initial messages
					) {
						return;
					}

					try {
						set({ isLoadingMessages: true }, false, "loadMoreMessages");

						// Import chatApi dynamically
						const { chatApi } = await import("@/app-api/chatApi");

						// Load next page of messages
						const nextPage = currentPage + 1;
						const result = await chatApi.getMessages(currentChatRoom.id, nextPage, 50);

						if (result.messages && result.messages.length > 0) {
							const { messages } = get();

							// Remove duplicates by creating a Map of message IDs
							const existingMessageIds = new Set(messages.map(msg => msg.id));
							const newMessages = result.messages.filter(
								msg => !existingMessageIds.has(msg.id)
							);

							// Prepend only new messages to the beginning of the array
							const updatedMessages = trimChatMessagesWindow([
								...newMessages,
								...messages,
							]);

							set(
								{
									messages: updatedMessages,
									currentPage: nextPage,
									hasMoreMessages: result.hasMore,
									isLoadingMessages: false,
								},
								false,
								"loadMoreMessages"
							);

							// Save to IndexedDB
							await indexedDBChatService.saveMessages(
								currentChatRoom.id,
								result.messages
							);
						} else {
							set(
								{
									hasMoreMessages: false,
									isLoadingMessages: false,
								},
								false,
								"loadMoreMessages"
							);
						}
					} catch (error) {
						console.error("Failed to load more messages:", error);
						set(
							{
								isLoadingMessages: false,
								error: "Failed to load more messages",
							},
							false,
							"loadMoreMessages"
						);
					}
				},

				// Archive actions
				setHasArchivedMessages: hasArchived => {
					set({ hasArchivedMessages: hasArchived }, false, "setHasArchivedMessages");
				},

				setLoadingArchivedMessages: loading => {
					set(
						{ isLoadingArchivedMessages: loading },
						false,
						"setLoadingArchivedMessages"
					);
				},

				addArchivedMessages: (year, month, messages) => {
					const { archivedMessagesCache } = get();
					const key = `${year}-${month}`;
					const newCache = new Map(archivedMessagesCache);
					newCache.set(key, {
						messages,
						loadedFromTail: 0,
					});

					set({ archivedMessagesCache: newCache }, false, "addArchivedMessages");
				},

				clearArchivedMessagesCache: () => {
					set({ archivedMessagesCache: new Map() }, false, "clearArchivedMessagesCache");
				},

				// Action to load archived messages (one chunk at a time into the store)
				loadArchivedMessages: async (year, month, day) => {
					const { currentChatRoom } = get();

					if (!currentChatRoom) {
						return;
					}

					const key = archiveDayKey(year, month, day);

					const applyArchiveChunk = async (
						entry: ArchivedDayCacheEntry
					): Promise<boolean> => {
						const { chunk, nextLoadedFromTail } = takeNextArchiveChunk(
							entry.messages,
							entry.loadedFromTail
						);
						if (chunk.length === 0) {
							return false;
						}

						const {
							messages,
							archivedMessagesCache: cache,
						} = get();
						const existingMessageIds = new Set(messages.map(msg => msg.id));
						const newMessages = chunk.filter(
							msg => !existingMessageIds.has(msg.id)
						);

						const newCache = new Map(cache);
						newCache.set(key, {
							messages: entry.messages,
							loadedFromTail: nextLoadedFromTail,
						});

						set(
							{
								...(newMessages.length > 0
									? {
											messages: trimChatMessagesWindow([
												...newMessages,
												...messages,
											]),
										}
									: {}),
								archivedMessagesCache: newCache,
								isLoadingArchivedMessages: false,
							},
							false,
							"loadArchivedMessages"
						);

						if (newMessages.length > 0) {
							await indexedDBChatService.saveMessages(
								currentChatRoom.id,
								newMessages
							);
						}

						return newMessages.length > 0;
					};

					const cachedEntry = get().archivedMessagesCache.get(key);
					if (cachedEntry) {
						if (archiveDayHasRemaining(cachedEntry)) {
							await applyArchiveChunk(cachedEntry);
						}
						return;
					}

					try {
						set(
							{ isLoadingArchivedMessages: true },
							false,
							"loadArchivedMessages"
						);

						const { messagesArchiveApi } = await import(
							"@/app-api/messagesArchiveApi"
						);

						const archiveFile = await messagesArchiveApi.loadArchivedMessages(
							currentChatRoom.id,
							year,
							month,
							day
						);

						if (!archiveFile?.messages.length) {
							set(
								{ isLoadingArchivedMessages: false },
								false,
								"loadArchivedMessages"
							);
							return;
						}

						const dayMessages = sortArchiveDayMessages(archiveFile.messages);
						const entry: ArchivedDayCacheEntry = {
							messages: dayMessages,
							loadedFromTail: 0,
						};

						const newCache = new Map(get().archivedMessagesCache);
						newCache.set(key, entry);
						set(
							{ archivedMessagesCache: newCache },
							false,
							"loadArchivedMessages:cacheDay"
						);

						await applyArchiveChunk(entry);
					} catch (error) {
						console.error("❌ [ARCHIVE] Failed to load archived messages:", error);
						set(
							{
								isLoadingArchivedMessages: false,
								error: "Failed to load archived messages",
							},
							false,
							"loadArchivedMessages"
						);
					}
				},

				// Check if archived messages exist for a specific day
				checkArchivedMessagesExists: async (year, month, day) => {
					const { currentChatRoom } = get();

					if (!currentChatRoom) {
						return false;
					}

					try {
						// Import messagesArchiveApi dynamically
						const { messagesArchiveApi } = await import("@/app-api/messagesArchiveApi");

						return await messagesArchiveApi.checkArchivedMessagesExists(
							currentChatRoom.id,
							year,
							month,
							day
						);
					} catch (error) {
						console.error("Failed to check archive existence:", error);
						return false;
					}
				},

				// Get the next archive month to load
				getNextArchiveMonth: () => {
					const { messages } = get();

					if (messages.length === 0) {
						return null;
					}

					// Find the oldest message
					const oldestMessage = messages[0];
					const oldestDate = new Date(oldestMessage.createdAt);

					// Get the previous month
					const prevMonth = new Date(oldestDate);
					prevMonth.setMonth(prevMonth.getMonth() - 1);

					return {
						year: prevMonth.getFullYear(),
						month: prevMonth.getMonth() + 1,
					};
				},

				// Get list of available archive days for current chat
				getAvailableArchiveDays: async () => {
					const currentChatRoom = get().currentChatRoom;

					if (!currentChatRoom) {
						return [];
					}

					const roomId = currentChatRoom.id;
					const {
						archiveDaysLoadedForRoomId,
						availableArchives,
						archiveDaysInflightRoomId,
						isLoadingAvailableArchives,
					} = get();

					if (archiveDaysLoadedForRoomId === roomId) {
						return availableArchives;
					}

					if (isLoadingAvailableArchives && archiveDaysInflightRoomId === roomId) {
						return new Promise<
							{
								year: number;
								month: number;
								day: number;
								messageCount: number;
								createdAt: string;
							}[]
						>(resolve => {
							const poll = () => {
								const s = get();
								if (
									s.archiveDaysLoadedForRoomId === roomId ||
									(!s.isLoadingAvailableArchives &&
										s.archiveDaysInflightRoomId !== roomId)
								) {
									resolve(
										s.archiveDaysLoadedForRoomId === roomId
											? s.availableArchives
											: []
									);
									return;
								}
								setTimeout(poll, 50);
							};
							poll();
						});
					}

					try {
						set(
							{
								isLoadingAvailableArchives: true,
								archiveDaysInflightRoomId: roomId,
							},
							false,
							"getAvailableArchiveDays"
						);

						// Import messagesArchiveApi dynamically
						const { messagesArchiveApi } = await import("@/app-api/messagesArchiveApi");

						const archives = await messagesArchiveApi.getAvailableArchiveDays(
							currentChatRoom.id
						);

						// Filter archives by user join date to avoid unnecessary requests
						const { getUserJoinDate } = get();
						const userJoinDate = getUserJoinDate();

						let filteredArchives = archives;
						if (userJoinDate) {
							filteredArchives = archives.filter(archive => {
								const archiveDate = new Date(
									archive.year,
									archive.month - 1,
									archive.day
								);
								const isAfterJoin = archiveDate >= userJoinDate;

								if (!isAfterJoin) {
									console.log(
										`🚫 Filtered out archive ${archive.year}-${archive.month}-${archive.day} (before user join date)`
									);
								}

								return isAfterJoin;
							});
						}

						// Save filtered archives to state and clear loading
						set(
							{
								availableArchives: filteredArchives,
								currentArchiveIndex: 0,
								isLoadingAvailableArchives: false,
								archiveDaysLoadedForRoomId: roomId,
								archiveDaysInflightRoomId: null,
							},
							false,
							"getAvailableArchiveDays"
						);

						// Check if user was waiting for archives to load
						const { pendingArchiveLoad } = get();
						if (pendingArchiveLoad) {
							set({ pendingArchiveLoad: false }, false, "getAvailableArchiveDays");
							// Trigger pending archive load
							get().triggerPendingArchiveLoad();
						}

						return filteredArchives;
					} catch (error) {
						console.error("❌ [ARCHIVE] Failed to get available archive days:", error);
						set(
							{
								isLoadingAvailableArchives: false,
								archiveDaysInflightRoomId: null,
							},
							false,
							"getAvailableArchiveDays"
						);
						return [];
					}
				},

				ensureAvailableArchiveDays: async () => get().getAvailableArchiveDays(),

				tryLoadNextArchivePage: async () => {
					await get().ensureAvailableArchiveDays();
					const { availableArchives, currentArchiveIndex, archivedMessagesCache } =
						get();

					if (currentArchiveIndex > 0 && availableArchives.length > 0) {
						const activeDay = availableArchives[currentArchiveIndex - 1];
						const activeKey = archiveDayKey(
							activeDay.year,
							activeDay.month,
							activeDay.day
						);
						const activeEntry = archivedMessagesCache.get(activeKey);
						if (activeEntry && archiveDayHasRemaining(activeEntry)) {
							await get().loadArchivedMessages(
								activeDay.year,
								activeDay.month,
								activeDay.day
							);
							return;
						}
					}

					const nextArchive = get().getNextAvailableArchive();
					if (nextArchive) {
						await get().loadArchivedMessages(
							nextArchive.year,
							nextArchive.month,
							nextArchive.day
						);
					}
				},

				loadInitialArchiveIfPgEmpty: async () => {
					const { messages, hasMoreMessages, currentChatRoom } = get();
					if (!currentChatRoom || hasMoreMessages || messages.length > 0) {
						return;
					}
					await get().tryLoadNextArchivePage();
				},

				// Set available archives
				setAvailableArchives: archives => {
					set(
						{
							availableArchives: archives,
							currentArchiveIndex: 0,
						},
						false,
						"setAvailableArchives"
					);
				},

				// Get user's join date for current chat room
				getUserJoinDate: () => {
					const { currentChatRoom } = get();
					const currentUser = useUserStore.getState().currentUser;

					if (!currentChatRoom || !currentUser) {
						return null;
					}

					const participant = currentChatRoom.participants.find(
						p => p.userId === currentUser.id
					);

					return participant?.joinedAt ? new Date(participant.joinedAt) : null;
				},

				// Get next available archive from the list
				getNextAvailableArchive: () => {
					const { availableArchives, currentArchiveIndex } = get();

					if (currentArchiveIndex >= availableArchives.length) {
						return null; // No more archives
					}

					const nextArchive = availableArchives[currentArchiveIndex];

					// Move to next archive
					set(
						{ currentArchiveIndex: currentArchiveIndex + 1 },
						false,
						"getNextAvailableArchive"
					);

					return nextArchive;
				},

				// Set pending archive load flag
				setPendingArchiveLoad: (pending: boolean) => {
					set({ pendingArchiveLoad: pending }, false, "setPendingArchiveLoad");
				},

				// Trigger pending archive load (when user scrolled before archives loaded)
				triggerPendingArchiveLoad: () => {
					get().tryLoadNextArchivePage().catch(error => {
						console.error("Failed to load pending archive:", error);
					});
				},
			}),
			{
				name: "chat-store", // Name for localStorage persistence
				// Only persist essential data, not loading states or temporary data
				partialize: state => ({
					chatRooms: state.chatRooms,
					// Note: currentChatRoom is NOT persisted - it should reset on page reload
					// Note: archivedMessagesCache is not persisted as Map cannot be serialized
				}),
				onRehydrateStorage: () => state => {
					if (state?.chatRooms?.length) {
						state.chatRooms = sortChatRoomsByLastMessage(state.chatRooms);
					}
				},
			}
		),
		{
			name: "chat-store", // Name for Redux DevTools
		}
	)
);

// Selectors for specific parts of the state - simple selectors without memoization
export const useCurrentChatRoom = () => useChatStore(state => state.currentChatRoom);
export const useMessages = () => useChatStore(state => state.messages);
export const useChatRooms = () => useChatStore(state => state.chatRooms);
export const useIsLoadingMessages = () => useChatStore(state => state.isLoadingMessages);
export const useIsLoadingChatRooms = () => useChatStore(state => state.isLoadingChatRooms);
export const useIsSendingMessage = () => useChatStore(state => state.isSendingMessage);
export const useChatError = () => useChatStore(state => state.error);
export const useHasMoreMessages = () => useChatStore(state => state.hasMoreMessages);

// Archive selectors
export const useHasArchivedMessages = () => useChatStore(state => state.hasArchivedMessages);
export const useIsLoadingArchivedMessages = () =>
	useChatStore(state => state.isLoadingArchivedMessages);
export const useArchivedMessagesCache = () => useChatStore(state => state.archivedMessagesCache);

// Action selectors - simple selector
export const useChatActions = () =>
	useChatStore(state => ({
		setCurrentChatRoom: state.setCurrentChatRoom,
		setChatRooms: state.setChatRooms,
		addChatRoom: state.addChatRoom,
		updateChatRoom: state.updateChatRoom,
		setMessages: state.setMessages,
		applyMessagesMarkedAsRead: state.applyMessagesMarkedAsRead,
		applyBulkMessagesMarkedAsRead: state.applyBulkMessagesMarkedAsRead,
		applyMessageReadReceipt: state.applyMessageReadReceipt,
		markChatRoomsAsReadLocally: state.markChatRoomsAsReadLocally,
		addMessage: state.addMessage,
		updateMessage: state.updateMessage,
		prependMessages: state.prependMessages,
		clearMessages: state.clearMessages,
		setLoadingMessages: state.setLoadingMessages,
		setLoadingChatRooms: state.setLoadingChatRooms,
		setSendingMessage: state.setSendingMessage,
		setError: state.setError,
		setHasMoreMessages: state.setHasMoreMessages,
		setCurrentPage: state.setCurrentPage,
		loadMessagesFromCache: state.loadMessagesFromCache,
		saveMessagesToCache: state.saveMessagesToCache,

		// Archive actions
		setHasArchivedMessages: state.setHasArchivedMessages,
		setLoadingArchivedMessages: state.setLoadingArchivedMessages,
		addArchivedMessages: state.addArchivedMessages,
		clearArchivedMessagesCache: state.clearArchivedMessagesCache,
		loadArchivedMessages: state.loadArchivedMessages,
		checkArchivedMessagesExists: state.checkArchivedMessagesExists,
		getNextArchiveMonth: state.getNextArchiveMonth,
		getAvailableArchiveDays: state.getAvailableArchiveDays,
		setAvailableArchives: state.setAvailableArchives,
		getNextAvailableArchive: state.getNextAvailableArchive,
		setPendingArchiveLoad: state.setPendingArchiveLoad,
		triggerPendingArchiveLoad: state.triggerPendingArchiveLoad,
		ensureAvailableArchiveDays: state.ensureAvailableArchiveDays,
		tryLoadNextArchivePage: state.tryLoadNextArchivePage,
		loadInitialArchiveIfPgEmpty: state.loadInitialArchiveIfPgEmpty,
		loadMoreMessages: state.loadMoreMessages,
		clearAllData: state.clearAllData,
	}));
