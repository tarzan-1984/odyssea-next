"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatBoxHeader from "./ChatBoxHeader";
import ChatBoxSendForm from "./ChatBoxSendForm";
import Image from "next/image";
import { Message, ChatRoom, isMessageReadByUser } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
// WebSocket functionality is now passed via props
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { UserData } from "@/app-api/api-types";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import MessageItem from "./MessageItem";

interface ChatBoxProps {
	selectedChatRoomId?: string;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
}

export default function ChatBox({ selectedChatRoomId, webSocketChatSync }: ChatBoxProps) {
	const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
	const [replyingTo, setReplyingTo] = useState<Message['replyData'] | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	// Get current user for message display
	const currentUser = useCurrentUser();

	const handleReplyToMessage = (message: Message) => {
		setReplyingTo({
			avatar: message.sender.avatar,
			time: message.createdAt,
			content: message.content,
			senderName: `${message.sender.firstName} ${message.sender.lastName}`,
		});
	};

	const handleCancelReply = () => {
		setReplyingTo(null);
	};

	// Use WebSocket chat sync for real-time functionality from props
	const {
		messages,
		isLoadingMessages: loading,
		isSendingMessage: sending,
		loadMessages,
		sendMessage,
		webSocketMessages: { sendTyping, isTyping },
		isUserOnline,
	} = webSocketChatSync;

	// Get error, chat room, and pagination state from store
	const error = useChatStore(state => state.error);
	const selectedChatRoom = useChatStore(state =>
		state.chatRooms.find(r => r.id === selectedChatRoomId)
	);
	const hasMoreMessages = useChatStore(state => state.hasMoreMessages);
	const loadMoreMessages = useChatStore(state => state.loadMoreMessages);

	// Archive-related state and actions
	const isLoadingArchivedMessages = useChatStore(state => state.isLoadingArchivedMessages);
	const isLoadingAvailableArchives = useChatStore(state => state.isLoadingAvailableArchives);
	const loadArchivedMessages = useChatStore(state => state.loadArchivedMessages);
	const getNextAvailableArchive = useChatStore(state => state.getNextAvailableArchive);
	const setPendingArchiveLoad = useChatStore(state => state.setPendingArchiveLoad);

	// Deduplicate messages to prevent duplicate keys
	const uniqueMessages = React.useMemo(() => {
		const messageMap = new Map();
		messages.forEach(message => {
			messageMap.set(message.id, message);
		});
		return Array.from(messageMap.values());
	}, [messages]);

	// WebSocket message handling is already provided by useWebSocketChatSync
	// No need to duplicate useWebSocketMessages here

	// Function to scroll to bottom of messages
	const scrollToBottom = (smooth: boolean = true) => {
		isProgrammaticScrollRef.current = true;
		messagesEndRef.current?.scrollIntoView({ behavior: "instant" }); // Always instant scroll

		// Reset the flag after a short delay to allow for scroll completion
		setTimeout(() => {
			isProgrammaticScrollRef.current = false;
		}, 50); // Reduced delay since it's instant
	};

	// Check if user is scrolled up and handle infinite scroll
	const isLoadingMoreRef = useRef(false);
	const hasUserScrolledRef = useRef(false);
	const isProgrammaticScrollRef = useRef(false);

	const handleScroll = useCallback(() => {
		if (messagesContainerRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
			setIsUserScrolledUp(!isAtBottom);

			// Skip tracking if this is a programmatic scroll
			if (isProgrammaticScrollRef.current) {
				return;
			}

			// Track if user has actually scrolled (not just initial position or programmatic scroll)
			if (scrollTop > 10) {
				hasUserScrolledRef.current = true;
			}

			// Check if there's actually scrollable content
			const hasScrollableContent = scrollHeight > clientHeight;

			// Load more messages when user scrolls near the top
			// Only if:
			// 1. There's scrollable content (more messages than fit in container)
			// 2. User scrolled to top (scrollTop < 200px)
			// 3. User has actually scrolled before (not initial position)
			// 4. Not currently loading
			// 5. Not already loading more messages
			if (
				hasScrollableContent &&
				scrollTop < 200 &&
				hasUserScrolledRef.current && // User has actually scrolled
				!loading &&
				!isLoadingMoreRef.current &&
				!isLoadingArchivedMessages &&
				uniqueMessages.length > 0 // Only after initial messages are loaded
			) {
				isLoadingMoreRef.current = true;

				// Stabilize scroll position after we prepend older messages
				const container = messagesContainerRef.current;
				const prevScrollHeight = container.scrollHeight;
				const prevScrollTop = container.scrollTop;

				const finalize = () => {
					// Adjust scroll so that the user's viewport stays anchored
					const newScrollHeight = container.scrollHeight;
					const delta = newScrollHeight - prevScrollHeight;
					isProgrammaticScrollRef.current = true;
					container.scrollTop = prevScrollTop + delta;
					setTimeout(() => {
						isProgrammaticScrollRef.current = false;
						isLoadingMoreRef.current = false;
					}, 50);
				};

				// First try to load from PostgreSQL
				if (hasMoreMessages) {
					Promise.resolve(loadMoreMessages()).finally(finalize);
				} else {
					// PostgreSQL is exhausted, try to load from archive
					if (isLoadingAvailableArchives) {
						// Archives are still loading, set pending flag
						setPendingArchiveLoad(true);
						isLoadingMoreRef.current = false;
					} else {
						const nextArchive = getNextAvailableArchive();
						if (nextArchive) {
							Promise.resolve(
								loadArchivedMessages(
									nextArchive.year,
									nextArchive.month,
									nextArchive.day
								)
							).finally(finalize);
						} else {
							isLoadingMoreRef.current = false;
						}
					}
				}
			}
		}
	}, [
		hasMoreMessages,
		loading,
		loadMoreMessages,
		isLoadingArchivedMessages,
		isLoadingAvailableArchives,
		loadArchivedMessages,
		getNextAvailableArchive,
		setPendingArchiveLoad,
		uniqueMessages.length,
	]);

	// Note: Messages are now marked as read automatically by the backend when joining a chat room
	// The backend sends a 'messagesMarkedAsRead' event which is handled in WebSocketContext

	// Load messages when chat room changes
	const loadMessagesForRoom = useCallback(
		async (chatRoomId: string) => {
			try {
				// Reset pagination state when switching chat rooms
				useChatStore.getState().setCurrentPage(1);
				useChatStore.getState().setHasMoreMessages(true);

				// Reset scroll tracking for new chat
				hasUserScrolledRef.current = false;
				isLoadingMoreRef.current = false;
				isProgrammaticScrollRef.current = false;

				await loadMessages(chatRoomId);
				// Scroll to bottom instantly after messages are loaded
				setTimeout(() => {
					scrollToBottom();
				}, 10);
			} catch (err) {
				console.error("Failed to load messages:", err);
			}
		},
		[loadMessages]
	);

	useEffect(() => {
		if (selectedChatRoomId) {
			loadMessagesForRoom(selectedChatRoomId);
		}
	}, [selectedChatRoomId, loadMessagesForRoom]);

	// Scroll to bottom when messages change (for new messages)
	useEffect(() => {
		if (uniqueMessages.length > 0 && !isUserScrolledUp) {
			scrollToBottom();
		}
	}, [uniqueMessages.length, isUserScrolledUp]);

	const handleSendMessage = async (messageData: {
		content: string;
		fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number };
		replyData?: Message['replyData'];
	}) => {
		if (!selectedChatRoom) return;

		try {
			// Stop typing indicator before sending message
			sendTyping(false);

			// Use WebSocket-enabled send message
			await sendMessage(messageData);

			// Always scroll to the new message when user sends it
			setTimeout(() => {
				scrollToBottom();
			}, 100);
		} catch (err) {
			console.error("Failed to send message:", err);
		}
	};

	// Handle message dropdown actions
	const handleDeleteMessage = async (messageId: string) => {
		try {
			const response = await fetch(`/api/messages/${messageId}`, {
				method: "DELETE",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "Failed to delete message");
			}

			const result = await response.json();
			console.log("Message deleted successfully:", result);

			// Immediately remove message from store and cache for better UX
			const state = useChatStore.getState();
			const updatedMessages = state.messages.filter(msg => msg.id !== messageId);
			state.setMessages(updatedMessages);

			// Update IndexedDB cache immediately
			const { indexedDBChatService } = await import("@/services/IndexedDBChatService");
			indexedDBChatService.deleteMessage(messageId).catch((error: Error) => {
				console.error("Failed to delete message from IndexedDB:", error);
			});

			// Update chat room's last message if the deleted message was the last one
			const chatRoom = state.chatRooms.find(room => room.id === result.chatRoomId);
			if (chatRoom && chatRoom.lastMessage?.id === messageId) {
				// Find the new last message
				const remainingMessages = updatedMessages.filter(msg => msg.chatRoomId === result.chatRoomId);
				const newLastMessage = remainingMessages.length > 0 
					? remainingMessages[remainingMessages.length - 1] 
					: null;

				// Update chat room with new last message
				const updatedChatRooms = state.chatRooms.map(room => 
					room.id === result.chatRoomId 
						? { ...room, lastMessage: newLastMessage || undefined }
						: room
				);
				state.setChatRooms(updatedChatRooms);
			}

			// The WebSocket event will also handle updating the UI (redundant but safe)
		} catch (error) {
			console.error("Failed to delete message:", error);
			// You might want to show a toast notification here
		}
	};

	const handleMarkMessageUnread = async (messageId: string) => {
		try {
			const response = await fetch(`/api/messages/${messageId}/unread`, {
				method: "PUT",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "Failed to mark message as unread");
			}

			const result = await response.json();

			// Get chat room type to determine logic
			const state = useChatStore.getState();
			const chatRoom = state.chatRooms.find(room => room.id === result.chatRoomId);
			const isDirectChat = chatRoom?.type === 'DIRECT';

			// Optimistically update UI and cache
			const updatedMessages = state.messages.map(msg => {
				if (msg.id === messageId) {
					const currentReadBy = msg.readBy || [];
					const updatedReadBy = currentReadBy.filter(id => id !== currentUser?.id);
					
					if (isDirectChat) {
						// For DIRECT chats: set both isRead to false and remove user from readBy
						return { 
							...msg, 
							isRead: false, // Global read status becomes false
							readBy: updatedReadBy
						};
					} else {
						// For GROUP and LOAD chats: only remove user from readBy, keep isRead as true
						return { 
							...msg, 
							readBy: updatedReadBy,
							// Keep isRead as true (global status doesn't change)
						};
					}
				}
				return msg;
			});
			state.setMessages(updatedMessages);

			// Increment unread count for the room
			const updatedRooms = state.chatRooms.map(room =>
				room.id === result.chatRoomId
					? { ...room, unreadCount: (room.unreadCount || 0) + 1 }
					: room
			);
			state.setChatRooms(updatedRooms);

			// Update cache
			const { indexedDBChatService } = await import("@/services/IndexedDBChatService");
			const message = updatedMessages.find(m => m.id === messageId);
			if (message) {
				if (isDirectChat) {
					indexedDBChatService.updateMessage(messageId, { 
						isRead: false,
						readBy: message.readBy
					}).catch((error: Error) => {
						console.error("Failed to update message in IndexedDB:", error);
					});
				} else {
					indexedDBChatService.updateMessage(messageId, { 
						readBy: message.readBy
					}).catch((error: Error) => {
						console.error("Failed to update message in IndexedDB:", error);
					});
				}
			}

			// Update chat room unread count in IndexedDB
			const updatedRoom = updatedRooms.find(room => room.id === result.chatRoomId);
			if (updatedRoom) {
				indexedDBChatService.updateChatRoom(result.chatRoomId, {
					unreadCount: updatedRoom.unreadCount
				}).catch((error: Error) => {
					console.error("Failed to update chat room unread count in IndexedDB:", error);
				});
			}
		} catch (error) {
			console.error("Failed to mark message as unread:", error);
		}
	};

	if (!selectedChatRoom) {
		return (
			<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-3/4">
				<div className="flex items-center justify-center h-full">
					<div className="text-center text-gray-500 dark:text-gray-400">
						<svg
							width="64"
							height="64"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="mx-auto mb-4"
						>
							<path
								d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<p className="text-lg font-medium">Select a chat to start messaging</p>
						<p className="text-sm">Choose a conversation from the list to begin</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-3/4">
			{/* Header */}
			<ChatBoxHeader chatRoom={selectedChatRoom} isUserOnline={isUserOnline} />

			{/* Messages */}
			<div
				ref={messagesContainerRef}
				onScroll={handleScroll}
				className="flex-1 max-h-full p-5 space-y-6 overflow-auto custom-scrollbar xl:space-y-8 xl:p-6"
			>
				{/* Loading indicator for older messages */}
				{(loading || isLoadingArchivedMessages) && uniqueMessages.length > 0 && (
					<div className="flex items-center justify-center py-4">
						<div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
							<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
									fill="none"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							<span className="text-sm">
								{loading && "Loading older messages..."}
								{isLoadingArchivedMessages && "Loading archive..."}
							</span>
						</div>
					</div>
				)}

				{loading && uniqueMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-gray-500">Loading messages...</div>
					</div>
				) : error ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-red-500">{error}</div>
					</div>
				) : uniqueMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-center text-gray-500 dark:text-gray-400">
							<p>No messages yet</p>
							<p className="text-sm">Start the conversation!</p>
						</div>
					</div>
				) : (
					uniqueMessages.map((message, index) => (
						<MessageItem
							key={`${message.id}-${index}`}
							message={message}
							currentUser={currentUser}
							onDelete={handleDeleteMessage}
							onReply={handleReplyToMessage}
							onMarkUnread={handleMarkMessageUnread}
						/>
					))
				)}
				{/* Typing indicator */}
				{Object.entries(isTyping).some(([userId, data]) => data.isTyping) && (
					<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
						<div className="flex space-x-1">
							<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
							<div
								className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style={{ animationDelay: "0.1s" }}
							></div>
							<div
								className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style={{ animationDelay: "0.2s" }}
							></div>
						</div>
						<span className="text-sm">
							{(() => {
								const typingUsers = Object.entries(isTyping).filter(
									([userId, data]) => data.isTyping
								);
								if (typingUsers.length === 0) return "";

								// Use firstName from WebSocket data or fallback to participant data
								const typingUserNames = typingUsers.map(([userId, data]) => {
									if (data.firstName) {
										return data.firstName;
									}
									// Fallback to participant data if firstName not available
									const participant = selectedChatRoom?.participants.find(
										p => p.user.id === userId
									);
									return participant?.user.firstName || "User";
								});

								if (typingUserNames.length === 1) {
									return `${typingUserNames[0]} is typing...`;
								} else if (typingUserNames.length === 2) {
									return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
								} else {
									return `${typingUserNames[0]} and ${typingUserNames.length - 1} others are typing...`;
								}
							})()}
						</span>
					</div>
				)}

				{/* Invisible div to scroll to */}
				<div ref={messagesEndRef} />
			</div>

			{/* Send Form */}
			<ChatBoxSendForm
				onSendMessage={handleSendMessage}
				onTyping={sendTyping}
				isLoading={sending}
				disabled={sending}
				replyingTo={replyingTo || undefined}
				onCancelReply={handleCancelReply}
			/>
		</div>
	);
}
