import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { ChatRoom, Message, User } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

// Helper function to sort chat rooms by last message date
const sortChatRoomsByLastMessage = (chatRooms: ChatRoom[]): ChatRoom[] => {
	return [...chatRooms].sort((a, b) => {
		const aLastMessageDate = a.lastMessage?.createdAt || a.createdAt;
		const bLastMessageDate = b.lastMessage?.createdAt || b.createdAt;
		return new Date(bLastMessageDate).getTime() - new Date(aLastMessageDate).getTime();
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
	archivedMessagesCache: Map<string, Message[]>; // key: "year-month-day", value: messages
	availableArchives: { year: number; month: number; day: number; messageCount: number; createdAt: string }[];
	currentArchiveIndex: number; // Index of next archive to load
	pendingArchiveLoad: boolean; // User scrolled up while archives were loading

	// Actions for managing chat rooms
	setCurrentChatRoom: (chatRoom: ChatRoom | null) => void;
	setChatRooms: (chatRooms: ChatRoom[]) => void;
	addChatRoom: (chatRoom: ChatRoom) => void;
	updateChatRoom: (chatRoomId: string, updates: Partial<ChatRoom>) => void;
	removeChatRoom: (chatRoomId: string) => void;

	// Actions for managing messages
	setMessages: (messages: Message[]) => void;
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
	getAvailableArchiveDays: () => Promise<{ year: number; month: number; day: number; messageCount: number; createdAt: string }[]>;
	setAvailableArchives: (archives: { year: number; month: number; day: number; messageCount: number; createdAt: string }[]) => void;
	getNextAvailableArchive: () => { year: number; month: number; day: number; messageCount: number; createdAt: string } | null;
  setPendingArchiveLoad: (pending: boolean) => void;
  triggerPendingArchiveLoad: () => void;
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

				// Chat room actions
				setCurrentChatRoom: chatRoom => {
					set({
						currentChatRoom: chatRoom,
						error: null,
						pendingArchiveLoad: false,
						isLoadingAvailableArchives: false,
						availableArchives: [],
						currentArchiveIndex: 0
					}, false, "setCurrentChatRoom");

					// Load available archives when switching to a chat room
					if (chatRoom) {
						// Load archives asynchronously
						get().getAvailableArchiveDays().catch(error => {
							console.error("Failed to load archive days:", error);
						});
					}
				},

		setChatRooms: chatRooms => {
			// Sort chat rooms by last message date when setting
			const sortedRooms = sortChatRoomsByLastMessage(chatRooms);
			set({ chatRooms: sortedRooms, error: null }, false, "setChatRooms");
		},

		addChatRoom: chatRoom => {
			const { chatRooms } = get();
			const existingIndex = chatRooms.findIndex(room => room.id === chatRoom.id);

			if (existingIndex >= 0) {
				// Update existing room
				const updatedRooms = [...chatRooms];
				updatedRooms[existingIndex] = chatRoom;
				// Sort after update
				const sortedRooms = sortChatRoomsByLastMessage(updatedRooms);
				set({ chatRooms: sortedRooms }, false, "addChatRoom:update");
			} else {
				// Add new room and sort
				const newRooms = [chatRoom, ...chatRooms];
				const sortedRooms = sortChatRoomsByLastMessage(newRooms);
				set({ chatRooms: sortedRooms }, false, "addChatRoom:add");
			}
		},

	updateChatRoom: (chatRoomId, updates) => {
		const { chatRooms, currentChatRoom } = get();

		console.log("🔄 updateChatRoom called:", { chatRoomId, updates });

		const updatedRooms = chatRooms.map(room =>
			room.id === chatRoomId ? { ...room, ...updates } : room
		);

		// Sort chat rooms by last message date after update
		const sortedRooms = sortChatRoomsByLastMessage(updatedRooms);

		const updatedState: Partial<ChatState> = { chatRooms: sortedRooms };
		if (currentChatRoom?.id === chatRoomId) {
			updatedState.currentChatRoom = { ...currentChatRoom, ...updates } as any;
		}
		set(updatedState as any, false, "updateChatRoom");

		console.log("✅ Chat room updated in store:", { chatRoomId, updatedRooms: sortedRooms.find(r => r.id === chatRoomId) });

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

				set(updatedState as any, false, "removeChatRoom");

				// Remove from IndexedDB
				indexedDBChatService.deleteChatRoom(chatRoomId).catch(error => {
					console.error("Failed to delete chat room from IndexedDB:", error);
				});
			},

				// Message actions
				setMessages: messages => {
					set({ messages, error: null }, false, "setMessages");
				},

	addMessage: message => {
		const { messages, chatRooms } = get();
		// Check if message already exists to avoid duplicates
		const exists = messages.some(msg => msg.id === message.id);
		if (!exists) {
			const newMessages = [...messages, message];
			
			// Update the lastMessage in the corresponding chat room
			const updatedRooms = chatRooms.map(room => {
				if (room.id === message.chatRoomId) {
					return {
						...room,
						lastMessage: message
					};
				}
				return room;
			});

			// Sort chat rooms by last message date
			const sortedRooms = sortChatRoomsByLastMessage(updatedRooms);

			set({ messages: newMessages, chatRooms: sortedRooms }, false, "addMessage");
			// Note: IndexedDB saving is handled by the caller (WebSocketContext or other services)
		}
	},

		updateMessage: (messageId, updates) => {
			const { messages, chatRooms } = get();
			const message = messages.find(msg => msg.id === messageId);
			const updatedMessages = messages.map(msg =>
				msg.id === messageId ? { ...msg, ...updates } : msg
			);

			// If marking as read, update unreadCount in chat rooms
			if (updates.isRead === true && message && !message.isRead && message.chatRoomId) {
				const updatedRooms = chatRooms.map(room => {
					if (room.id === message.chatRoomId && room.unreadCount && room.unreadCount > 0) {
						const updatedRoom = { ...room, unreadCount: room.unreadCount - 1 };
						// Save updated room to IndexedDB
						indexedDBChatService.updateChatRoom(updatedRoom.id, { unreadCount: updatedRoom.unreadCount }).catch((error: Error) => {
							console.error("Failed to update chat room in IndexedDB:", error);
						});
						return updatedRoom;
					}
					return room;
				});
				set({ messages: updatedMessages, chatRooms: updatedRooms }, false, "updateMessage");
				return;
			}

			set({ messages: updatedMessages }, false, "updateMessage");
		},

				prependMessages: newMessages => {
					const { messages } = get();
					// Filter out messages that already exist to avoid duplicates
					const uniqueNewMessages = newMessages.filter(
						newMsg => !messages.some(existingMsg => existingMsg.id === newMsg.id)
					);
					set(
						{ messages: [...uniqueNewMessages, ...messages] },
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
						const cachedMessages = await indexedDBChatService.getMessages(chatRoomId);
						if (cachedMessages.length > 0) {
							set({ messages: cachedMessages }, false, "loadMessagesFromCache");
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

				// Clear cache from IndexedDB and reset store
				clearCache: async () => {
					try {
						// Clear IndexedDB cache
						await indexedDBChatService.clearCache();

						// Clear Zustand store
						set({
							currentChatRoom: null,
							messages: [],
							chatRooms: [],
							isLoadingMessages: false,
							isLoadingChatRooms: false,
							isSendingMessage: false,
							error: null,
							hasMoreMessages: false,
							currentPage: 1,
						}, false, "clearCache");

						console.log("Cache cleared successfully");
					} catch (error) {
						console.error("Failed to clear cache:", error);
						throw error;
					}
				},

				loadMoreMessages: async () => {
					const { currentChatRoom, currentPage, hasMoreMessages, isLoadingMessages, messages } = get();

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
							const newMessages = result.messages.filter(msg => !existingMessageIds.has(msg.id));

							// Prepend only new messages to the beginning of the array
							const updatedMessages = [...newMessages, ...messages];

							set({
								messages: updatedMessages,
								currentPage: nextPage,
								hasMoreMessages: result.hasMore,
								isLoadingMessages: false,
							}, false, "loadMoreMessages");

							// Save to IndexedDB
							await indexedDBChatService.saveMessages(currentChatRoom.id, result.messages);
						} else {
							set({
								hasMoreMessages: false,
								isLoadingMessages: false,
							}, false, "loadMoreMessages");
						}
					} catch (error) {
						console.error("Failed to load more messages:", error);
						set({
							isLoadingMessages: false,
							error: "Failed to load more messages"
						}, false, "loadMoreMessages");
					}
				},

				// Archive actions
				setHasArchivedMessages: hasArchived => {
					set({ hasArchivedMessages: hasArchived }, false, "setHasArchivedMessages");
				},

				setLoadingArchivedMessages: loading => {
					set({ isLoadingArchivedMessages: loading }, false, "setLoadingArchivedMessages");
				},

				addArchivedMessages: (year, month, messages) => {
					const { archivedMessagesCache } = get();
					const key = `${year}-${month}`;
					const newCache = new Map(archivedMessagesCache);
					newCache.set(key, messages);

					set({ archivedMessagesCache: newCache }, false, "addArchivedMessages");
				},

				clearArchivedMessagesCache: () => {
					set({ archivedMessagesCache: new Map() }, false, "clearArchivedMessagesCache");
				},

				// Action to load archived messages
				loadArchivedMessages: async (year, month, day) => {
					const { currentChatRoom, archivedMessagesCache, messages } = get();

					if (!currentChatRoom) {
						return;
					}

					const key = `${year}-${month}-${day}`;

					// Check if already cached
					if (archivedMessagesCache.has(key)) {
						const cachedMessages = archivedMessagesCache.get(key)!;
						const existingMessageIds = new Set(messages.map(msg => msg.id));
						const newMessages = cachedMessages.filter(msg => !existingMessageIds.has(msg.id));

						if (newMessages.length > 0) {
							set({
								messages: [...newMessages, ...messages],
							}, false, "loadArchivedMessages");
						}
						return;
					}

					try {
						set({ isLoadingArchivedMessages: true }, false, "loadArchivedMessages");

						// Import messagesArchiveApi dynamically
						const { messagesArchiveApi } = await import("@/app-api/messagesArchiveApi");

						const archiveFile = await messagesArchiveApi.loadArchivedMessages(
							currentChatRoom.id,
							year,
							month,
							day
						);

						if (archiveFile && archiveFile.messages.length > 0) {
							const existingMessageIds = new Set(messages.map(msg => msg.id));
							const newMessages = archiveFile.messages.filter(msg => !existingMessageIds.has(msg.id));

							if (newMessages.length > 0) {
								// Add to cache and messages
								const newCache = new Map(archivedMessagesCache);
								newCache.set(key, archiveFile.messages);

								set({
									messages: [...newMessages, ...messages],
									archivedMessagesCache: newCache,
									isLoadingArchivedMessages: false,
								}, false, "loadArchivedMessages");

								// Save to IndexedDB
								await indexedDBChatService.saveMessages(currentChatRoom.id, newMessages);
							} else {
								set({
									isLoadingArchivedMessages: false,
								}, false, "loadArchivedMessages");
							}
						} else {
							set({
								isLoadingArchivedMessages: false,
							}, false, "loadArchivedMessages");
						}
					} catch (error) {
						console.error("❌ [ARCHIVE] Failed to load archived messages:", error);
						set({
							isLoadingArchivedMessages: false,
							error: "Failed to load archived messages"
						}, false, "loadArchivedMessages");
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
						month: prevMonth.getMonth() + 1
					};
				},

				// Get list of available archive days for current chat
				getAvailableArchiveDays: async () => {
					const currentChatRoom = get().currentChatRoom;

					if (!currentChatRoom) {
						return [];
					}

					try {
						// Set loading state
						set({ isLoadingAvailableArchives: true }, false, "getAvailableArchiveDays");

						// Import messagesArchiveApi dynamically
						const { messagesArchiveApi } = await import("@/app-api/messagesArchiveApi");

						const archives = await messagesArchiveApi.getAvailableArchiveDays(currentChatRoom.id);

						console.log("📋 [ARCHIVE] ===== RESPONSE: List of available archives =====");
						console.log(JSON.stringify(archives, null, 2));
						console.log("📊 [ARCHIVE] Total archives found:", archives.length);

						// Save archives to state and clear loading
						set({
							availableArchives: archives,
							currentArchiveIndex: 0,
							isLoadingAvailableArchives: false
						}, false, "getAvailableArchiveDays");

						// Check if user was waiting for archives to load
						const { pendingArchiveLoad } = get();
						if (pendingArchiveLoad) {
							set({ pendingArchiveLoad: false }, false, "getAvailableArchiveDays");
							// Trigger pending archive load
							get().triggerPendingArchiveLoad();
						}

						return archives;
					} catch (error) {
						console.error("❌ [ARCHIVE] Failed to get available archive days:", error);
						set({ isLoadingAvailableArchives: false }, false, "getAvailableArchiveDays");
						return [];
					}
				},

				// Set available archives
				setAvailableArchives: archives => {
					set({
						availableArchives: archives,
						currentArchiveIndex: 0
					}, false, "setAvailableArchives");
				},

				// Get next available archive from the list
				getNextAvailableArchive: () => {
					const { availableArchives, currentArchiveIndex } = get();

					if (currentArchiveIndex >= availableArchives.length) {
						return null; // No more archives
					}

					const nextArchive = availableArchives[currentArchiveIndex];

					// Move to next archive
					set({ currentArchiveIndex: currentArchiveIndex + 1 }, false, "getNextAvailableArchive");

					return nextArchive;
				},

				// Set pending archive load flag
				setPendingArchiveLoad: (pending: boolean) => {
					set({ pendingArchiveLoad: pending }, false, "setPendingArchiveLoad");
				},

				// Trigger pending archive load (when user scrolled before archives loaded)
				triggerPendingArchiveLoad: () => {
					const { availableArchives, loadArchivedMessages, getNextAvailableArchive } = get();

					if (availableArchives.length > 0) {
						const nextArchive = getNextAvailableArchive();
						if (nextArchive) {
							loadArchivedMessages(nextArchive.year, nextArchive.month, nextArchive.day);
						}
					}
				},
			}),
			{
				name: "chat-store", // Name for localStorage persistence
				// Only persist essential data, not loading states or temporary data
				partialize: state => ({
					chatRooms: state.chatRooms,
					currentChatRoom: state.currentChatRoom,
					// Note: archivedMessagesCache is not persisted as Map cannot be serialized
				}),
			}
		),
		{
			name: "chat-store", // Name for Redux DevTools
		}
	)
);

// Selectors for specific parts of the state - простые селекторы без мемоизации
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
export const useIsLoadingArchivedMessages = () => useChatStore(state => state.isLoadingArchivedMessages);
export const useArchivedMessagesCache = () => useChatStore(state => state.archivedMessagesCache);

// Action selectors - простой селектор
export const useChatActions = () =>
	useChatStore(state => ({
		setCurrentChatRoom: state.setCurrentChatRoom,
		setChatRooms: state.setChatRooms,
		addChatRoom: state.addChatRoom,
		updateChatRoom: state.updateChatRoom,
		setMessages: state.setMessages,
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
		loadMoreMessages: state.loadMoreMessages,
		clearAllData: state.clearAllData,
	}));
