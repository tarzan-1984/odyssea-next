"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatBoxHeader from "./ChatBoxHeader";
import ChatBoxSendForm from "./ChatBoxSendForm";
import Image from "next/image";
import { Message, ChatRoom } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
// WebSocket functionality is now passed via props
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { renderAvatar } from "@/helpers";
import { UserData } from "@/app-api/api-types";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import MessageReadStatus from "./MessageReadStatus";

interface ChatBoxProps {
    selectedChatRoomId?: string;
    webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
}

export default function ChatBox({ selectedChatRoomId, webSocketChatSync }: ChatBoxProps) {
	const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	// Get current user for message display
	const currentUser = useCurrentUser();

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
    const selectedChatRoom = useChatStore(state => state.chatRooms.find(r => r.id === selectedChatRoomId));
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
								loadArchivedMessages(nextArchive.year, nextArchive.month, nextArchive.day)
							).finally(finalize);
						} else {
							isLoadingMoreRef.current = false;
						}
					}
				}
			}
		}
	}, [hasMoreMessages, loading, loadMoreMessages, isLoadingArchivedMessages, isLoadingAvailableArchives, loadArchivedMessages, getNextAvailableArchive, setPendingArchiveLoad, uniqueMessages.length]);

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

	const getMessageTime = (createdAt: string): string => {
		const messageTime = new Date(createdAt);
		// Format time without seconds: "10:20 AM" instead of "10:20:20 AM"
		return messageTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	};

	const isImageFile = (fileName?: string): boolean => {
		if (!fileName) return false;
		const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
		return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
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
					uniqueMessages.map((message, index) => {
						const isSender = message.senderId === currentUser?.id;

						return (
							<div
								key={`${message.id}-${index}`}
								className={`flex ${isSender ? "justify-end" : "items-start gap-4"}`}
							>
								{!isSender && (
									<div className="relative w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
										{(() => {
											// Create a UserListItem-like object for renderAvatar
											const senderUser: UserData = {
												firstName: message.sender.firstName,
												lastName: message.sender.lastName,
												avatar: message.sender.avatar || (message.sender as any).profilePhoto,
											};
											return renderAvatar(senderUser, "w-10 h-10");
										})()}
										{/* Online status indicator */}
										{isUserOnline && isUserOnline(message.senderId) && (
											<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"></span>
										)}
									</div>
								)}

								<div className={`${isSender ? "text-right" : ""}`}>
									{/* Image preview */}
									{message.fileUrl && isImageFile(message.fileName) && (
										<div className="mb-2 w-full max-w-[270px] overflow-hidden rounded-lg">
											<img
												src={message.fileUrl}
												alt="chat image"
												className="object-cover w-full h-auto max-h-48"
												onError={e => {
													// Hide image if it fails to load
													const target = e.target as HTMLImageElement;
													target.style.display = "none";
												}}
											/>
										</div>
									)}

									{/* File attachment */}
									{message.fileUrl && !isImageFile(message.fileName) && (
										<div className="mb-2 w-full max-w-[270px]">
											<a
												href={message.fileUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
											>
												<svg
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path
														d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
													<polyline
														points="14,2 14,8 20,8"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-gray-900 dark:text-white truncate">
														{message.fileName || "Download file"}
													</p>
													{message.fileSize && (
														<p className="text-xs text-gray-500 dark:text-gray-400">
															{Math.round(message.fileSize / 1024)}KB
														</p>
													)}
												</div>
												<svg
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
												>
													<path
														d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
													<polyline
														points="7,10 12,15 17,10"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
													<line
														x1="12"
														y1="15"
														x2="12"
														y2="3"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
											</a>
										</div>
									)}

									{/* Message content */}
									{message.content && (
										<div
											className={`px-3 py-2 rounded-lg ${
												isSender
													? "bg-brand-500 text-white dark:bg-brand-500"
													: "bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white/90"
											} ${isSender ? "rounded-tr-sm" : "rounded-tl-sm"}`}
										>
											<p className="text-sm">{message.content}</p>
										</div>
									)}

									{/* Timestamp and read status */}
									<div className={`mt-2 flex items-center gap-1 ${isSender ? "justify-end" : ""}`}>
										{isSender && (
											<MessageReadStatus
												isRead={message.isRead}
												className="flex-shrink-0"
											/>
										)}
										<p className="text-gray-500 text-theme-xs dark:text-gray-400">
											{isSender
												? getMessageTime(message.createdAt)
												: `${message.sender.role || 'User'}, ${getMessageTime(message.createdAt)}`}
										</p>
									</div>
								</div>
							</div>
						);
					})
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
								const typingUsers = Object.entries(isTyping).filter(([userId, data]) => data.isTyping);
								if (typingUsers.length === 0) return "";

								// Use firstName from WebSocket data or fallback to participant data
								const typingUserNames = typingUsers.map(([userId, data]) => {
									if (data.firstName) {
										return data.firstName;
									}
									// Fallback to participant data if firstName not available
									const participant = selectedChatRoom?.participants.find(p => p.user.id === userId);
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
			/>
		</div>
	);
}
