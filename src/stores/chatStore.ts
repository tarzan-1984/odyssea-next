import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { ChatRoom, Message, User } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

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

	// Action to load messages from IndexedDB
	loadMessagesFromCache: (chatRoomId: string) => Promise<void>;

	// Action to save messages to IndexedDB
	saveMessagesToCache: (chatRoomId: string, messages: Message[]) => Promise<void>;

	// Action to clear all data (for logout)
	clearAllData: () => void;

	// Action to clear cache from IndexedDB
	clearCache: () => Promise<void>;
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

				// Chat room actions
				setCurrentChatRoom: chatRoom => {
					set({ currentChatRoom: chatRoom, error: null }, false, "setCurrentChatRoom");
				},

				setChatRooms: chatRooms => {
					set({ chatRooms, error: null }, false, "setChatRooms");
				},

				addChatRoom: chatRoom => {
					const { chatRooms } = get();
					const existingIndex = chatRooms.findIndex(room => room.id === chatRoom.id);

					if (existingIndex >= 0) {
						// Update existing room
						const updatedRooms = [...chatRooms];
						updatedRooms[existingIndex] = chatRoom;
						set({ chatRooms: updatedRooms }, false, "addChatRoom:update");
					} else {
						// Add new room to the beginning
						set({ chatRooms: [chatRoom, ...chatRooms] }, false, "addChatRoom:add");
					}
				},

		updateChatRoom: (chatRoomId, updates) => {
			const { chatRooms, currentChatRoom } = get();
			
			const updatedRooms = chatRooms.map(room =>
				room.id === chatRoomId ? { ...room, ...updates } : room
			);
			const updatedState: Partial<ChatState> = { chatRooms: updatedRooms };
			if (currentChatRoom?.id === chatRoomId) {
				updatedState.currentChatRoom = { ...currentChatRoom, ...updates } as any;
			}
			set(updatedState as any, false, "updateChatRoom");
			
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
			const { messages } = get();
			// Check if message already exists to avoid duplicates
			const exists = messages.some(msg => msg.id === message.id);
			if (!exists) {
				const newMessages = [...messages, message];
				set({ messages: newMessages }, false, "addMessage");
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
						indexedDBChatService.updateChatRoom(updatedRoom).catch((error: Error) => {
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

				// Clear cache from IndexedDB
				clearCache: async () => {
					try {
						await indexedDBChatService.clearCache();
						console.log("Cache cleared successfully");
					} catch (error) {
						console.error("Failed to clear cache:", error);
					}
				},
			}),
			{
				name: "chat-store", // Name for localStorage persistence
				// Only persist essential data, not loading states or temporary data
				partialize: state => ({
					chatRooms: state.chatRooms,
					currentChatRoom: state.currentChatRoom,
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
		clearAllData: state.clearAllData,
	}));
