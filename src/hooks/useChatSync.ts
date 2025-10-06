import { useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { chatApi, ChatRoom } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import chatRooms from "@/app-api/chatRooms";
import { useCurrentUser } from "@/stores/userStore";

// Hook for managing chat synchronization between Zustand store, IndexedDB, and API
export const useChatSync = () => {
	// Get current user data for message sending
	const currentUser = useCurrentUser();

	const {
		currentChatRoom,
		messages,
		chatRooms,
		isLoadingMessages,
		isLoadingChatRooms,
		isSendingMessage,
		setCurrentChatRoom,
		setChatRooms,
		setMessages,
		addMessage,
		prependMessages,
		setLoadingMessages,
		setLoadingChatRooms,
		setError,
		loadMessagesFromCache,
		saveMessagesToCache,
	} = useChatStore();

	// Load chat rooms from API and sync with cache
	const loadChatRooms = useCallback(async () => {
		try {
			setLoadingChatRooms(true);
			setError(null);

			// Check if we have cached chat rooms first
			const hasCachedRooms = await indexedDBChatService.hasChatRooms();

			if (hasCachedRooms) {
				// Check if cache is fresh (less than 5 minutes old)
				const isCacheFresh = await indexedDBChatService.isCacheFresh("chatRooms", 5);

				if (isCacheFresh) {
					// Load from cache for immediate display only if cache is fresh
					const cachedRooms = await indexedDBChatService.getChatRooms();
					if (cachedRooms.length > 0) {
						setChatRooms(cachedRooms);
						setLoadingChatRooms(false);
						return;
					}
				}

				// If cache is not fresh, load from API and update cache
				try {
					const apiRooms = await chatApi.getChatRooms();
					setChatRooms(apiRooms);
					await indexedDBChatService.saveChatRooms(apiRooms);
					setLoadingChatRooms(false);
					return;
				} catch (apiError) {
					console.warn("API update failed, falling back to cached data:", apiError);
					// Fallback to cached data if API fails
					const cachedRooms = await indexedDBChatService.getChatRooms();
					if (cachedRooms.length > 0) {
						setChatRooms(cachedRooms);
						setLoadingChatRooms(false);
						return;
					}
				}
			}

			// If no cached data, load from API
			try {
				const apiRooms = await chatApi.getChatRooms();
				setChatRooms(apiRooms);
				await indexedDBChatService.saveChatRooms(apiRooms);
			} catch (apiError) {
				console.warn("API unavailable, no cached data available:", apiError);
				setError("Failed to load chat rooms");
			}
		} catch (error) {
			console.error("Failed to load chat rooms:", error);
			setError("Failed to load chat rooms");
		} finally {
			setLoadingChatRooms(false);
		}
	}, [setChatRooms, setLoadingChatRooms, setError]);

	// Initialize chat data on mount
	useEffect(() => {
		// Load initial chat data
		loadChatRooms();
	}, [loadChatRooms]);

	// Load messages for a specific chat room
	const loadMessages = useCallback(
		async (chatRoomId: string, page: number = 1, limit: number = 50) => {
			try {
				setLoadingMessages(true);
				setError(null);

				// Check if we have cached messages first
				const hasCachedMessages = await indexedDBChatService.hasMessages(chatRoomId);

				if (hasCachedMessages) {
					// Load from cache for immediate display
					const cachedMessages = await indexedDBChatService.getMessages(
						chatRoomId,
						limit,
						(page - 1) * limit
					);
					if (cachedMessages.length > 0) {
						setMessages(cachedMessages);
						setLoadingMessages(false);

						// Check if cache is fresh for this specific chat room (less than 5 minutes old for messages)
						const isCacheFresh = await indexedDBChatService.isMessagesCacheFresh(
							chatRoomId,
							5
						);

						// Only update from API if cache is not fresh
						if (!isCacheFresh) {
							try {
								const response = await chatApi.getMessages(chatRoomId, page, limit);
								// Only update if we got different data
								if (
									response.messages.length !== cachedMessages.length ||
									response.messages.some(
										(msg, index) => msg.id !== cachedMessages[index]?.id
									)
								) {
									setMessages(response.messages);
									await indexedDBChatService.saveMessages(
										chatRoomId,
										response.messages
									);
								}
							} catch (apiError) {
								console.warn("Background API update failed:", apiError);
							}
						}

						// Chat room loaded successfully
						return;
					}
				}

				// If no cached data, load from API
				try {
					const response = await chatApi.getMessages(chatRoomId, page, limit);
					setMessages(response.messages);
					await indexedDBChatService.saveMessages(chatRoomId, response.messages);
				} catch (apiError) {
					console.warn("API unavailable, no cached data available:", apiError);
					setError("Failed to load messages");
					setMessages([]);
				}

				// Chat room loaded successfully
			} catch (error) {
				console.error("Failed to load messages:", error);
				setError("Failed to load messages");
			} finally {
				setLoadingMessages(false);
			}
		},
		[setMessages, setLoadingMessages, setError]
	);

	// Load more messages (pagination)
	const loadMoreMessages = useCallback(
		async (chatRoomId: string) => {
			if (!currentChatRoom || isLoadingMessages) return;

			try {
				setLoadingMessages(true);
				const nextPage = Math.floor(messages.length / 50) + 1;
				const response = await chatApi.getMessages(chatRoomId, nextPage, 50);

				if (response.messages.length > 0) {
					// Prepend older messages to the beginning
					prependMessages(response.messages);

					// Save to cache
					await indexedDBChatService.saveMessages(chatRoomId, response.messages);
				}
			} catch (error) {
				console.error("Failed to load more messages:", error);
				setError("Failed to load more messages");
			} finally {
				setLoadingMessages(false);
			}
		},
		[
			currentChatRoom,
			messages.length,
			isLoadingMessages,
			prependMessages,
			setLoadingMessages,
			setError,
		]
	);

	// Send a message
	const sendMessage = useCallback(
		async (messageData: {
			content: string;
			fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number };
		}) => {
			if (!currentChatRoom || !currentUser) return;

			try {
				// Send message via API
				const newMessage = await chatApi.sendMessage({
					chatRoomId: currentChatRoom.id,
					content: messageData.content,
					fileUrl: messageData.fileData?.fileUrl,
					fileName: messageData.fileData?.fileName,
					fileSize: messageData.fileData?.fileSize,
				});

				// Add message to store
				addMessage(newMessage);

				// Save to cache
				await indexedDBChatService.addMessage(newMessage);
			} catch (error) {
				console.error("Failed to send message:", error);
				setError("Failed to send message");
			}
		},
		[currentChatRoom, currentUser, addMessage, setError]
	);

	// Create a new chat room
	const createChatRoom = useCallback(
		async (chatRoomData: {
			name?: string;
			type: string;
			loadId?: string;
			participantIds: string[];
		}) => {
			try {
				// Create chat room via API with WebSocket notifications
				const result = await chatRooms.createChatRoom(chatRoomData);
				
				if (result.success && result.data) {
					// Transform result.data to match ChatRoom interface
					const chatData = result.data; // Store in variable to avoid TS18048 error
					const chatRoom = {
						...chatData,
						isArchived: false,
						updatedAt: chatData.createdAt, // Use createdAt as updatedAt for new chat
						participants: chatData.participants.map((userData: any) => ({
							id: `participant_${userData.id}_${chatData.id}`,
							chatRoomId: chatData.id,
							userId: userData.id,
							joinedAt: chatData.createdAt,
							user: {
								id: userData.id,
								firstName: userData.firstName,
								lastName: userData.lastName,
								avatar: userData.avatar,
								role: userData.role,
							},
						})),
					};
					// Add chat room to local state
					setChatRooms([chatRoom, ...chatRooms]);
					await indexedDBChatService.addChatRoom(chatRoom);
				} else {
					throw new Error(result.error || "Failed to create chat room");
				}
			} catch (error) {
				console.error("Failed to create chat room:", error);
				setError("Failed to create chat room");
			}
		},
		[chatRooms, setChatRooms, setError]
	);

	// Mark message as read
	const markMessageAsRead = useCallback(async (messageId: string) => {
		try {
			// Mark message as read via API
			await chatApi.markMessageAsRead(messageId);
		} catch (error) {
			console.error("Failed to mark message as read:", error);
		}
	}, []);

	// Mark all messages in chat room as read
	const markChatRoomAsRead = useCallback(async (chatRoomId: string) => {
		try {
			await chatApi.markChatRoomAsRead(chatRoomId);
		} catch (error) {
			console.error("Failed to mark chat room as read:", error);
		}
	}, []);

	// Switch to a different chat room
	const switchToChatRoom = useCallback(
		async (chatRoom: ChatRoom) => {
			// Switch to new chat room

			// Set new current chat room
			setCurrentChatRoom(chatRoom);

			// Load messages for the new chat room
			await loadMessages(chatRoom.id);
		},
		[currentChatRoom, setCurrentChatRoom, loadMessages]
	);

	// Clear all data (for logout)
	const clearAllData = useCallback(async () => {
		// Clear all data

		// Clear store
		useChatStore.getState().clearAllData();

		// Clear cache
		await indexedDBChatService.clearCache();
	}, []);

	// Sync data when connection is restored
	useEffect(() => {
		// Chat room is ready
	}, [currentChatRoom]);

	return {
		// State
		currentChatRoom,
		messages,
		chatRooms,
		isLoadingMessages,
		isLoadingChatRooms,
		isSendingMessage,

		// Actions
		loadChatRooms,
		loadMessages,
		loadMoreMessages,
		sendMessage,
		createChatRoom,
		markMessageAsRead,
		markChatRoomAsRead,
		switchToChatRoom,
		clearAllData,

		// Store actions
		setCurrentChatRoom,
	};
};
