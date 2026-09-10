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
import { logWebSocketError } from "@/utils/websocketError";

/**
 * Enhanced chat sync hook that integrates WebSocket real-time functionality
 * with the existing chat synchronization system
 */
export const useWebSocketChatSync = () => {
	const { isConnected, isDisplayOffline } = useWebSocket();
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
		onUserTyping: () => {},
	});

	// WebSocket chat room management
	const {
		createChatRoom: wsCreateChatRoom,
		updateChatRoom: wsUpdateChatRoom,
		addParticipants: wsAddParticipants,
		removeParticipant: wsRemoveParticipant,
		isLoading: wsChatRoomsLoading,
	} = useWebSocketChatRooms();

	// WebSocket notifications
	const webSocketNotifications = useWebSocketNotifications({
		onNotification: notification => {
			// Handle notifications as needed
		},
		onRoleBroadcast: broadcast => {
			// Handle role broadcasts as needed
		},
		onError: error => {
			logWebSocketError("WebSocket notification error", error);
		},
	});

	// Enhanced send message function that uses WebSocket when available
	const sendMessageWithWebSocket = useCallback(
		async (messageData: {
			content: string;
			clientMessageId?: string;
			fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number };
			attachments?: { fileUrl: string; fileName: string; fileSize?: number }[];
			replyData?: { avatar?: string; time: string; content: string; senderName: string };
		}) => {
			if (isConnected && currentChatRoom) {
				const multi = messageData.attachments && messageData.attachments.length >= 2 ? messageData.attachments : null;
				wsSendMessage({
					content: messageData.content,
					clientMessageId: messageData.clientMessageId,
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
					type: chatRoomData.type as "DIRECT" | "GROUP" | "LOAD" | "BID",
					loadId: chatRoomData.loadId,
					participantIds: chatRoomData.participantIds,
				});
			} else {
				await createChatRoomApi({
					...chatRoomData,
					name: chatRoomData.name || `Chat ${Date.now()}`,
					type: chatRoomData.type as "DIRECT" | "GROUP" | "BID",
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
		isWebSocketConnected: isConnected && !isDisplayOffline,

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
