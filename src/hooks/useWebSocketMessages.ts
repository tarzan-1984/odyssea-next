"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useChatStore } from "@/stores/chatStore";
import { Message } from "@/app-api/chatApi";
import { isMeaningfulWebSocketError } from "@/utils/websocketError";

interface UseWebSocketMessagesProps {
	chatRoomId: string;
	onNewMessage?: (message: Message) => void;
	onMessageSent?: (data: { messageId: string; chatRoomId: string }) => void;
	onMessageRead?: (data: { messageId: string; readBy: string }) => void;
	onUserTyping?: (data: {
		userId: string;
		chatRoomId: string;
		isTyping: boolean;
		firstName?: string;
		role?: string;
	}) => void;
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
		markChatRoomAsRead,
	} = useWebSocket();
	const addMessage = useChatStore(s => s.addMessage);
	const [isTyping, setIsTyping] = useState<
		Record<string, { isTyping: boolean; firstName?: string; role?: string }>
	>({});
	const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const currentRoomRef = useRef<string | null>(null);
	const onNewMessageRef = useRef(onNewMessage);
	const onMessageSentRef = useRef(onMessageSent);
	const onMessageReadRef = useRef(onMessageRead);
	const onUserTypingRef = useRef(onUserTyping);
	const onUserOnlineRef = useRef(onUserOnline);
	const onErrorRef = useRef(onError);

	onNewMessageRef.current = onNewMessage;
	onMessageSentRef.current = onMessageSent;
	onMessageReadRef.current = onMessageRead;
	onUserTypingRef.current = onUserTyping;
	onUserOnlineRef.current = onUserOnline;
	onErrorRef.current = onError;

	// Join chat room when component mounts or chatRoomId changes.
	// Do not leave on empty room / unmount — connection already joins all rooms,
	// and leave+rejoin on chat↔tracking navigation triggers noisy socket errors.
	useEffect(() => {
		if (isConnected && chatRoomId && currentRoomRef.current !== chatRoomId) {
			setIsTyping({});
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
				typingTimeoutRef.current = null;
			}

			currentRoomRef.current = chatRoomId;
			joinChatRoom(chatRoomId);
			markChatRoomAsRead(chatRoomId);
		}
	}, [isConnected, chatRoomId, joinChatRoom, markChatRoomAsRead]);

	useEffect(() => {
		return () => {
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
		};
	}, []);

	// Set up event listeners
	useEffect(() => {
		if (!socket) return;

		const handleNewMessage = (data: { chatRoomId: string; message: Message }) => {
			if (data.chatRoomId === chatRoomId) {
				addMessage(data.message);
				onNewMessageRef.current?.(data.message);
			}
		};

		const handleMessageSent = (data: { messageId: string; chatRoomId: string }) => {
			if (data.chatRoomId === chatRoomId) {
				onMessageSentRef.current?.(data);
			}
		};

		const handleMessageRead = (data: { messageId: string; readBy: string }) => {
			onMessageReadRef.current?.(data);
		};

		const handleUserTyping = (data: {
			userId: string;
			chatRoomId: string;
			isTyping: boolean;
			firstName?: string;
			role?: string;
		}) => {
			if (data.chatRoomId === chatRoomId) {
				setIsTyping(prev => ({
					...prev,
					[data.userId]: {
						isTyping: data.isTyping,
						firstName: data.firstName,
						role: data.role,
					},
				}));
				onUserTypingRef.current?.(data);
			}
		};

		const handleUserOnline = (data: {
			userId: string;
			chatRoomId: string;
			isOnline: boolean;
		}) => {
			onUserOnlineRef.current?.(data);
		};

		const handleError = (error: { message: string; details?: string }) => {
			if (!isMeaningfulWebSocketError(error)) return;
			onErrorRef.current?.(error);
		};

		socket.on("newMessage", handleNewMessage);
		socket.on("messageSent", handleMessageSent);
		socket.on("messageRead", handleMessageRead);
		socket.on("userTyping", handleUserTyping);
		socket.on("userOnline", handleUserOnline);
		socket.on("chatError", handleError);
		socket.on("error", handleError);

		return () => {
			socket.off("newMessage", handleNewMessage);
			socket.off("messageSent", handleMessageSent);
			socket.off("messageRead", handleMessageRead);
			socket.off("userTyping", handleUserTyping);
			socket.off("userOnline", handleUserOnline);
			socket.off("chatError", handleError);
			socket.off("error", handleError);
		};
	}, [socket, chatRoomId, addMessage]);

	const sendMessageHandler = useCallback(
		(data: {
			content: string;
			clientMessageId?: string;
			fileUrl?: string;
			fileName?: string;
			fileSize?: number;
			attachments?: { fileUrl: string; fileName: string; fileSize?: number }[];
			replyData?: { avatar?: string; time: string; content: string; senderName: string };
		}) => {
			sendMessage({
				chatRoomId,
				...data,
			});
		},
		[sendMessage, chatRoomId]
	);

	const sendTypingHandler = useCallback(
		(isTyping: boolean) => {
			sendTyping(chatRoomId, isTyping);

			if (isTyping) {
				if (typingTimeoutRef.current) {
					clearTimeout(typingTimeoutRef.current);
				}

				typingTimeoutRef.current = setTimeout(() => {
					sendTyping(chatRoomId, false);
					typingTimeoutRef.current = null;
				}, 4000);
			} else {
				if (typingTimeoutRef.current) {
					clearTimeout(typingTimeoutRef.current);
					typingTimeoutRef.current = null;
				}
			}
		},
		[sendTyping, chatRoomId]
	);

	const markAsRead = useCallback(
		(messageId: string) => {
			markMessageAsRead(messageId, chatRoomId);
		},
		[markMessageAsRead, chatRoomId]
	);

	return {
		sendMessage: sendMessageHandler,
		sendTyping: sendTypingHandler,
		markAsRead,
		isTyping,
		joinChatRoom,
		leaveChatRoom,
	};
};
