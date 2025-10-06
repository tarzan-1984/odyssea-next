"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useChatStore } from "@/stores/chatStore";
import { Message } from "@/app-api/chatApi";

interface UseWebSocketMessagesProps {
	chatRoomId: string;
	onNewMessage?: (message: Message) => void;
	onMessageSent?: (data: { messageId: string; chatRoomId: string }) => void;
	onMessageRead?: (data: { messageId: string; readBy: string }) => void;
	onUserTyping?: (data: { userId: string; chatRoomId: string; isTyping: boolean; firstName?: string }) => void;
	onUserOnline?: (data: { userId: string; chatRoomId: string; isOnline: boolean }) => void;
	onError?: (error: { message: string; details?: string }) => void;
}

export const useWebSocketMessages = ({
	chatRoomId,
	onNewMessage,
	onMessageSent,
	onMessageRead,
	onUserTyping,
	onUserOnline,
	onError,
}: UseWebSocketMessagesProps) => {
	const {
		socket,
		isConnected,
		joinChatRoom,
		leaveChatRoom,
		sendMessage,
		sendTyping,
		markMessageAsRead,
	} = useWebSocket();
	const { addMessage, updateMessage } = useChatStore();
	const [isTyping, setIsTyping] = useState<Record<string, { isTyping: boolean; firstName?: string }>>({});
	const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
	const currentRoomRef = useRef<string | null>(null);

	// Join chat room when component mounts or chatRoomId changes
	useEffect(() => {
		if (isConnected && chatRoomId && currentRoomRef.current !== chatRoomId) {
			console.log("useWebSocketMessages: Joining chat room:", chatRoomId);
			
			// Clear typing state and timeout when switching chat rooms
			setIsTyping({});
			if (typingTimeout) {
				clearTimeout(typingTimeout);
				setTypingTimeout(null);
			}
			
			currentRoomRef.current = chatRoomId;
			joinChatRoom(chatRoomId);
		}
	}, [isConnected, chatRoomId]); // Remove joinChatRoom from dependencies to prevent loops

	// Leave chat room on unmount
	useEffect(() => {
		return () => {
			if (currentRoomRef.current) {
				console.log("useWebSocketMessages: Leaving chat room:", currentRoomRef.current);
				leaveChatRoom(currentRoomRef.current);
				currentRoomRef.current = null;
			}
			
			// Clear typing timeout on unmount
			if (typingTimeout) {
				clearTimeout(typingTimeout);
			}
		};
	}, []); // Remove leaveChatRoom from dependencies to prevent loops

	// Set up event listeners
	useEffect(() => {
		if (!socket) return;

		const handleNewMessage = (data: { chatRoomId: string; message: Message }) => {
			if (data.chatRoomId === chatRoomId) {
				// Add message to store
				addMessage(data.message);
				onNewMessage?.(data.message);
			}
		};

		const handleMessageSent = (data: { messageId: string; chatRoomId: string }) => {
			if (data.chatRoomId === chatRoomId) {
				onMessageSent?.(data);
			}
		};

		const handleMessageRead = (data: { messageId: string; readBy: string }) => {
			// Update message read status in store
			updateMessage(data.messageId, { isRead: true });
			onMessageRead?.(data);
		};

		const handleUserTyping = (data: {
			userId: string;
			chatRoomId: string;
			isTyping: boolean;
			firstName?: string;
		}) => {
			if (data.chatRoomId === chatRoomId) {
				setIsTyping(prev => ({
					...prev,
					[data.userId]: {
						isTyping: data.isTyping,
						firstName: data.firstName,
					},
				}));
				onUserTyping?.(data);
			}
		};

		const handleUserOnline = (data: {
			userId: string;
			chatRoomId: string;
			isOnline: boolean;
		}) => {
			if (data.chatRoomId === chatRoomId) {
				onUserOnline?.(data);
			}
		};

		const handleError = (error: { message: string; details?: string }) => {
			onError?.(error);
		};

		// Register event listeners
		socket.on("newMessage", handleNewMessage);
		socket.on("messageSent", handleMessageSent);
		socket.on("messageRead", handleMessageRead);
		socket.on("userTyping", handleUserTyping);
		socket.on("userOnline", handleUserOnline);
		socket.on("error", handleError);

		// Cleanup listeners
		return () => {
			socket.off("newMessage", handleNewMessage);
			socket.off("messageSent", handleMessageSent);
			socket.off("messageRead", handleMessageRead);
			socket.off("userTyping", handleUserTyping);
			socket.off("userOnline", handleUserOnline);
			socket.off("error", handleError);
		};
	}, [socket, chatRoomId]); // Remove callback functions from dependencies to prevent loops

	// Send message function
	const sendMessageHandler = useCallback(
		(data: { content: string; fileUrl?: string; fileName?: string; fileSize?: number }) => {
			console.log("sendMessageHandler called:", { chatRoomId, data });
			sendMessage({
				chatRoomId,
				...data,
			});
		},
		[sendMessage, chatRoomId]
	);

	// Send typing indicator with debouncing
	const sendTypingHandler = useCallback(
		(isTyping: boolean) => {
			sendTyping(chatRoomId, isTyping);

			// Auto-stop typing indicator after 4 seconds
			if (isTyping) {
				// Clear any existing timeout
				if (typingTimeout) {
					clearTimeout(typingTimeout);
				}

				// Set new timeout to stop typing indicator after 4 seconds
				const timeout = setTimeout(() => {
					sendTyping(chatRoomId, false);
					setTypingTimeout(null);
				}, 4000);

				setTypingTimeout(timeout);
			} else {
				// User stopped typing, clear the timeout
				if (typingTimeout) {
					clearTimeout(typingTimeout);
					setTypingTimeout(null);
				}
			}
		},
		[sendTyping, chatRoomId, typingTimeout]
	);

	// Mark message as read
	const markAsRead = useCallback(
		(messageId: string) => {
			markMessageAsRead(messageId, chatRoomId);
		},
		[markMessageAsRead, chatRoomId]
	);

	// Cleanup typing timeout on unmount
	useEffect(() => {
		return () => {
			if (typingTimeout) {
				clearTimeout(typingTimeout);
			}
		};
	}, [typingTimeout]);

	// Note: joinChatRoom and leaveChatRoom are imported from useWebSocket

	return {
		sendMessage: sendMessageHandler,
		sendTyping: sendTypingHandler,
		markAsRead,
		isTyping,
		joinChatRoom,
		leaveChatRoom,
	};
};
