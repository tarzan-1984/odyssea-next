"use client";

import { useEffect, useCallback } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useChatSync } from "./useChatSync";
import { useWebSocketMessages } from "./useWebSocketMessages";
import { useWebSocketChatRooms } from "./useWebSocketChatRooms";
import { useWebSocketNotifications } from "./useWebSocketNotifications";
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { useOnlineStatus } from "./useOnlineStatus";

/**
 * Enhanced chat sync hook that integrates WebSocket real-time functionality
 * with the existing chat synchronization system
 */
export const useWebSocketChatSync = () => {
	const { isConnected } = useWebSocket();
	const currentUser = useCurrentUser();
	const { onlineStatus, updateUserOnlineStatus, isUserOnline } = useOnlineStatus();

	// Get existing chat sync functionality
	const chatSync = useChatSync();
	const { loadChatRooms } = chatSync;

	// Add specific chat room to cache and store
	const addChatRoomToCache = useCallback(async (chatRoomId: string) => {
		try {
			// Import chatApi to fetch the specific chat room
			const { chatApi } = await import("@/app-api/chatApi");
			const { indexedDBChatService } = await import("@/services/IndexedDBChatService");

			// Fetch the specific chat room from API
			const chatRoom = await chatApi.getChatRoom(chatRoomId);

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

			// Add to Zustand store
			const { addChatRoom } = useChatStore.getState();
			addChatRoom(chatRoom);

			// Add to IndexedDB cache: get current chat rooms, add new one, save all
			const currentChatRooms = await indexedDBChatService.getChatRooms();
			const updatedChatRooms = [...currentChatRooms, chatRoom];
			await indexedDBChatService.saveChatRooms(updatedChatRooms);

			return chatRoom;
		} catch (error) {
			console.error("❌ Failed to add chat room to cache:", error);
			throw error;
		}
	}, []);

	// WebSocket message handling for current chat room
	const webSocketMessages = useWebSocketMessages({
		chatRoomId: chatSync.currentChatRoom?.id || "",
		onNewMessage: message => {
			// Message is automatically added to store by WebSocketContext
			// No need to log here as it creates confusion
		},
		onMessageSent: data => {
			// Message sent confirmation handled by WebSocketContext
		},
		onMessageRead: data => {
			// Message read confirmation
		},
		onUserTyping: data => {
			// User typing
		},
		onUserOnline: data => {
			updateUserOnlineStatus(data.userId, data.isOnline);
		},
		onError: error => {
			console.error("WebSocket message error:", error);
		},
	});

	// WebSocket chat room management
	const webSocketChatRooms = useWebSocketChatRooms({
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
		}) => {

			if (isConnected && chatSync.currentChatRoom) {
				// Use WebSocket for real-time messaging
				webSocketMessages.sendMessage({
					content: messageData.content,
					fileUrl: messageData.fileData?.fileUrl,
					fileName: messageData.fileData?.fileName,
					fileSize: messageData.fileData?.fileSize,
				});
			} else {
				// Fallback to API-based messaging
				await chatSync.sendMessage(messageData);
			}
		},
		[isConnected, chatSync.currentChatRoom, webSocketMessages, chatSync.sendMessage]
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
				// Use WebSocket for real-time chat room creation
				webSocketChatRooms.createChatRoom({
					name: chatRoomData.name,
					type: chatRoomData.type as "DIRECT" | "GROUP" | "LOAD",
					loadId: chatRoomData.loadId,
					participantIds: chatRoomData.participantIds,
				});
			} else {
				// Fallback to API-based chat room creation
				await chatSync.createChatRoom({
					...chatRoomData,
					name: chatRoomData.name || `Chat ${Date.now()}`, // Provide default name if not specified
					type: chatRoomData.type as "DIRECT" | "GROUP", // Ensure correct type
				});
			}
		},
		[isConnected, webSocketChatRooms.createChatRoom, chatSync.createChatRoom]
	);

	// Enhanced mark message as read function that uses WebSocket when available
	const markMessageAsReadWithWebSocket = useCallback(
		async (messageId: string) => {
			if (isConnected && chatSync.currentChatRoom) {
				// Use WebSocket for real-time read status
				webSocketMessages.markAsRead(messageId);
			} else {
				// Fallback to API-based read status
				await chatSync.markMessageAsRead(messageId);
			}
		},
		[isConnected, chatSync.currentChatRoom, webSocketMessages, chatSync.markMessageAsRead]
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
		setCurrentChatRoom: chatSync.setCurrentChatRoom,

		// WebSocket room management
		joinChatRoom: webSocketMessages.joinChatRoom,
		leaveChatRoom: webSocketMessages.leaveChatRoom,

		// WebSocket-specific functionality
		webSocketMessages: {
			sendTyping: webSocketMessages.sendTyping,
			isTyping: webSocketMessages.isTyping,
		},

		webSocketChatRooms: {
			updateChatRoom: webSocketChatRooms.updateChatRoom,
			addParticipants: webSocketChatRooms.addParticipants,
			removeParticipant: webSocketChatRooms.removeParticipant,
			isLoading: webSocketChatRooms.isLoading,
		},

		webSocketNotifications: {
			markNotificationAsRead: webSocketNotifications.markNotificationAsRead,
		},

		// Online status functionality
		isUserOnline,
		onlineStatus,
	};
};
