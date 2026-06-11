"use client";

import { useEffect, useCallback } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useChatSync } from "./useChatSync";
import { useWebSocketMessages } from "./useWebSocketMessages";
import { useWebSocketChatRooms } from "./useWebSocketChatRooms";
import { useWebSocketNotifications } from "./useWebSocketNotifications";
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import type { ChatRoomParticipant } from "@/app-api/chatApi";

/**
 * Enhanced chat sync hook that integrates WebSocket real-time functionality
 * with the existing chat synchronization system
 */
export const useWebSocketChatSync = () => {
	const { isConnected } = useWebSocket();
	const currentUser = useCurrentUser();
	const { isUserOnline, onlineStatus } = useOnlineStatus();

	// Get existing chat sync functionality
	const chatSync = useChatSync();
	const {
		currentChatRoom,
		sendMessage: sendMessageApi,
		createChatRoom: createChatRoomApi,
		markMessageAsRead: markMessageAsReadApi,
		setCurrentChatRoom,
	} = chatSync;

	// Add specific chat room to cache and store
	const addChatRoomToCache = useCallback(async (chatRoomId: string) => {
		try {
			// Import chatApi to fetch the specific chat room
			const { chatApi } = await import("@/app-api/chatApi");
			const { indexedDBChatService } = await import("@/services/IndexedDBChatService");

			// Fetch the specific chat room from API
			const chatRoom = await chatApi.getChatRoom(chatRoomId);
			const existingRoom = useChatStore
				.getState()
				.chatRooms.find(room => room.id === chatRoomId);

			// Load last message for the chat room
			try {
				const messagesResponse = await chatApi.getMessages(chatRoomId, 1, 1);
				if (messagesResponse.messages.length > 0) {
					const lastMessage = messagesResponse.messages[0];
					chatRoom.lastMessage = lastMessage;
				}
			} catch (messageError) {
				console.warn("⚠️ Failed to load last message:", messageError);
			}

			const normalizedRoom = {
				...chatRoom,
				participants: Array.isArray(chatRoom.participants)
					? chatRoom.participants.map((p: ChatRoomParticipant) => ({
							...p,
							user: {
								...p.user,
								avatar: p.user?.avatar ?? p.user?.profilePhoto ?? "",
							},
						}))
					: [],
				unreadCount: chatRoom.unreadCount ?? existingRoom?.unreadCount ?? 0,
			};

			// Add to Zustand store
			const { addChatRoom } = useChatStore.getState();
			addChatRoom(normalizedRoom);

			// Add to IndexedDB cache: get current chat rooms, add new one, save all
			const currentChatRooms = await indexedDBChatService.getChatRooms();
			const updatedChatRooms = [
				...currentChatRooms.filter(room => room.id !== normalizedRoom.id),
				normalizedRoom,
			];
			await indexedDBChatService.saveChatRooms(updatedChatRooms);

			return normalizedRoom;
		} catch (error) {
			console.error("❌ Failed to add chat room to cache:", error);
			throw error;
		}
	}, []);

	// WebSocket message handling for current chat room
	const {
		sendMessage: wsSendMessage,
		markAsRead: wsMarkAsRead,
		joinChatRoom,
		leaveChatRoom,
		sendTyping,
		isTyping,
	} = useWebSocketMessages({
		chatRoomId: currentChatRoom?.id || "",
		onNewMessage: () => {
			// Message is automatically added to store by WebSocketContext
		},
		onMessageSent: () => {},
		onMessageRead: () => {},
		onUserTyping: () => {},
		onError: error => {
			console.error("WebSocket message error:", error);
		},
	});

	// WebSocket chat room management
	const {
		createChatRoom: wsCreateChatRoom,
		updateChatRoom: wsUpdateChatRoom,
		addParticipants: wsAddParticipants,
		removeParticipant: wsRemoveParticipant,
		isLoading: wsChatRoomsLoading,
	} = useWebSocketChatRooms({
		onChatRoomCreated: chatRoom => {
			// Chat room is automatically added to store by useWebSocketChatRooms
		},
		onChatRoomUpdated: data => {
			// Chat room is automatically updated in store by useWebSocketChatRooms
		},
		onParticipantsAdded: data => {
			// Participants added via WebSocket
		},
		onParticipantRemoved: data => {
			// If current user was removed from the chat, remove it from cache and store
			if (data.removedUserId === currentUser?.id) {
				// Remove from store
				const { removeChatRoom } = useChatStore.getState();
				removeChatRoom(data.chatRoomId);

				// Remove from IndexedDB cache
				import("@/services/IndexedDBChatService").then(({ indexedDBChatService }) => {
					indexedDBChatService.deleteChatRoom(data.chatRoomId);
				});
			}
		},
		onAddedToChatRoom: data => {
			// Add the specific chat room to cache and store
			addChatRoomToCache(data.chatRoomId).catch(error => {
				console.error("❌ Failed to add chat room to cache and store:", error);
			});
		},
		onError: error => {
			console.error("WebSocket chat room error:", error);
		},
	});

	// WebSocket notifications
	const webSocketNotifications = useWebSocketNotifications({
		onNotification: notification => {
			// Handle notifications as needed
		},
		onRoleBroadcast: broadcast => {
			// Handle role broadcasts as needed
		},
		onError: error => {
			console.error("WebSocket notification error:", error);
		},
	});

	// Enhanced send message function that uses WebSocket when available
	const sendMessageWithWebSocket = useCallback(
		async (messageData: {
			content: string;
			fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number };
			attachments?: { fileUrl: string; fileName: string; fileSize?: number }[];
			replyData?: { avatar?: string; time: string; content: string; senderName: string };
		}) => {
			if (isConnected && currentChatRoom) {
				const multi = messageData.attachments && messageData.attachments.length >= 2 ? messageData.attachments : null;
				wsSendMessage({
					content: messageData.content,
					fileUrl: multi ? multi[0].fileUrl : messageData.fileData?.fileUrl,
					fileName: multi ? multi[0].fileName : messageData.fileData?.fileName,
					fileSize: multi ? multi[0].fileSize : messageData.fileData?.fileSize,
					attachments: multi ?? undefined,
					replyData: messageData.replyData,
				});
			} else {
				await sendMessageApi(messageData);
			}
		},
		[isConnected, currentChatRoom, wsSendMessage, sendMessageApi]
	);

	// Enhanced create chat room function that uses WebSocket when available
	const createChatRoomWithWebSocket = useCallback(
		async (chatRoomData: {
			name?: string;
			type: string;
			loadId?: string;
			participantIds: string[];
		}) => {
			if (isConnected) {
				wsCreateChatRoom({
					name: chatRoomData.name,
					type: chatRoomData.type as "DIRECT" | "GROUP" | "LOAD",
					loadId: chatRoomData.loadId,
					participantIds: chatRoomData.participantIds,
				});
			} else {
				await createChatRoomApi({
					...chatRoomData,
					name: chatRoomData.name || `Chat ${Date.now()}`,
					type: chatRoomData.type as "DIRECT" | "GROUP",
				});
			}
		},
		[isConnected, wsCreateChatRoom, createChatRoomApi]
	);

	// Enhanced mark message as read function that uses WebSocket when available
	const markMessageAsReadWithWebSocket = useCallback(
		async (messageId: string) => {
			if (isConnected && currentChatRoom) {
				wsMarkAsRead(messageId);
			} else {
				await markMessageAsReadApi(messageId);
			}
		},
		[isConnected, currentChatRoom, wsMarkAsRead, markMessageAsReadApi]
	);

	// Auto-connect WebSocket when user is available
	useEffect(() => {
		if (currentUser && !isConnected) {
			// User available, WebSocket should connect automatically
		}
	}, [currentUser, isConnected]);

	return {
		// Existing chat sync functionality
		...chatSync,

		// WebSocket status
		isWebSocketConnected: isConnected,

		// Enhanced functions that use WebSocket when available
		sendMessage: sendMessageWithWebSocket,
		createChatRoom: createChatRoomWithWebSocket,
		markMessageAsRead: markMessageAsReadWithWebSocket,

		// Explicitly export setCurrentChatRoom for compatibility
		setCurrentChatRoom,

		// WebSocket room management
		joinChatRoom,
		leaveChatRoom,

		// WebSocket-specific functionality
		webSocketMessages: {
			sendTyping,
			isTyping,
		},

		webSocketChatRooms: {
			updateChatRoom: wsUpdateChatRoom,
			addParticipants: wsAddParticipants,
			removeParticipant: wsRemoveParticipant,
			isLoading: wsChatRoomsLoading,
		},

		webSocketNotifications: {
			markNotificationAsRead: webSocketNotifications.markNotificationAsRead,
		},

		// Online status functionality
		isUserOnline,
		onlineStatus,
	};
};
