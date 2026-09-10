"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/context/WebSocketContext";

interface UseWebSocketMessagesProps {
	chatRoomId: string;
	onUserTyping?: (data: {
		userId: string;
		chatRoomId: string;
		isTyping: boolean;
		firstName?: string;
		role?: string;
	}) => void;
}

export const useWebSocketMessages = ({
	chatRoomId,
	onUserTyping,
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
	const [isTyping, setIsTyping] = useState<
		Record<string, { isTyping: boolean; firstName?: string; role?: string }>
	>({});
	const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const currentRoomRef = useRef<string | null>(null);
	const onUserTypingRef = useRef(onUserTyping);

	onUserTypingRef.current = onUserTyping;

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

		socket.on("userTyping", handleUserTyping);

		return () => {
			socket.off("userTyping", handleUserTyping);
		};
	}, [socket, chatRoomId]);

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
