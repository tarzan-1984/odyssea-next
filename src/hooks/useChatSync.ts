import { useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { chatApi, ChatRoom, Message } from "@/app-api/chatApi";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import chatRoomsApi from "@/app-api/chatRooms";
import { useCurrentUser } from "@/stores/userStore";
import {
	filterMessagesForRoom,
	mergeMessageLists,
	shouldForceMessagesApiSync,
} from "@/utils/chatMessagesMerge";

/** Ignore stale loadMessages responses after the user switches chats. */
let loadMessagesGeneration = 0;

/** Merge persisted/API unread with store. If source says 0, trust it (clears ghost badges after read). */
const mergeSourcesUnreadCount = (
	sourceUnread: number | undefined,
	storeUnread: number | undefined
): number => {
	const s = sourceUnread ?? 0;
	const st = storeUnread ?? 0;
	if (s === 0) return 0;
	return Math.max(s, st);
};

export type LoadChatRoomsOptions = { force?: boolean };
export type LoadMessagesOptions = { force?: boolean };

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
		setCurrentPage,
		setHasMoreMessages,
		loadMessagesFromCache,
		saveMessagesToCache,
	} = useChatStore();

	// Helper function to normalize participants data
	const normalizeParticipants = (participants: any[]): any[] => {
		return participants.map((p: any) => ({
			...p,
			user: {
				id: p.user.id,
				firstName: p.user.firstName,
				lastName: p.user.lastName,
				avatar: p.user.profilePhoto ?? p.user.avatar ?? "",
				role: p.user.role ?? "USER",
				userColor: p.user.userColor ?? null,
				externalId: p.user.externalId ?? null,
				phone: p.user.phone ?? null,
			},
		}));
	};

	// Load chat rooms from API and sync with cache
	const loadChatRooms = useCallback(
		async (options?: LoadChatRoomsOptions) => {
			const force = options?.force ?? false;
			// Skip loading on public tracking page
			if (
				typeof window !== "undefined" &&
				window.location.pathname.startsWith("/tracking/")
			) {
				console.log("⏭️ [useChatSync] Skipping chat rooms load on tracking page");
				return;
			}

			try {
				setLoadingChatRooms(true);
				setError(null);

				// Helper: ensure currentChatRoom points to an existing room
				const ensureCurrentRoomValidity = (rooms: ChatRoom[]) => {
					const current = useChatStore.getState().currentChatRoom;
					if (!current || rooms.some(r => r.id === current.id)) {
						return;
					}
					if (
						current.type === "LOAD" &&
						(current.isLoadArchived === true ||
							useChatStore
								.getState()
								.chatRooms.some(
									r => r.id === current.id && r.isLoadArchived === true
								))
					) {
						return;
					}
					setCurrentChatRoom(null);
				};

				// Check if we have cached chat rooms first
				const hasCachedRooms = await indexedDBChatService.hasChatRooms();

				if (hasCachedRooms) {
					// Check if cache is fresh (less than 5 minutes old)
					const isCacheFresh = await indexedDBChatService.isCacheFresh("chatRooms", 5);

					if (!force && isCacheFresh) {
						// Load from cache for immediate display only if cache is fresh
						const cachedRooms = await indexedDBChatService.getChatRooms();
						if (cachedRooms.length > 0) {
							// Merge cached data with current store state to preserve real-time updates
							const currentStoreRooms = useChatStore.getState().chatRooms;
							const mergedCachedRooms = cachedRooms.map(cachedRoom => {
								const storeRoom = currentStoreRooms.find(
									storeRoom => storeRoom.id === cachedRoom.id
								);
								if (storeRoom) {
									const finalUnreadCount = mergeSourcesUnreadCount(
										cachedRoom.unreadCount,
										storeRoom.unreadCount
									);
									return {
										...cachedRoom,
										unreadCount: finalUnreadCount,
										lastMessage:
											storeRoom.lastMessage || cachedRoom.lastMessage,
										updatedAt: storeRoom.updatedAt || cachedRoom.updatedAt,
									};
								}
								return cachedRoom;
							});
							setChatRooms(mergedCachedRooms);
							ensureCurrentRoomValidity(mergedCachedRooms);
							setLoadingChatRooms(false);
							return;
						}
					}

					// If cache is not fresh, load from API and merge with current store state
					try {
						const apiRooms = await chatApi.getChatRooms();
						const normalizedApiRooms = apiRooms.map(room => ({
							...room,
							participants: normalizeParticipants(room.participants || []),
						}));

						// Merge API data with current store state to preserve real-time updates
						const currentStoreRooms = useChatStore.getState().chatRooms;
						const mergedRooms = normalizedApiRooms.map(apiRoom => {
							const storeRoom = currentStoreRooms.find(
								storeRoom => storeRoom.id === apiRoom.id
							);
							if (storeRoom) {
								const finalUnreadCount = mergeSourcesUnreadCount(
									apiRoom.unreadCount,
									storeRoom.unreadCount
								);
								return {
									...apiRoom,
									unreadCount: finalUnreadCount,
									lastMessage: storeRoom.lastMessage || apiRoom.lastMessage,
									updatedAt: storeRoom.updatedAt || apiRoom.updatedAt,
								};
							}
							return apiRoom;
						});

						setChatRooms(mergedRooms);
						ensureCurrentRoomValidity(mergedRooms);
						await indexedDBChatService.saveChatRooms(mergedRooms);
						setLoadingChatRooms(false);
						return;
					} catch (apiError) {
						console.warn("API update failed, falling back to cached data:", apiError);
						// Fallback to cached data if API fails
						const cachedRooms = await indexedDBChatService.getChatRooms();
						if (cachedRooms.length > 0) {
							// Merge cached data with current store state
							const currentStoreRooms = useChatStore.getState().chatRooms;
							const mergedCachedRooms = cachedRooms.map(cachedRoom => {
								const storeRoom = currentStoreRooms.find(
									storeRoom => storeRoom.id === cachedRoom.id
								);
								if (storeRoom) {
									return {
										...cachedRoom,
										unreadCount: mergeSourcesUnreadCount(
											cachedRoom.unreadCount,
											storeRoom.unreadCount
										),
										lastMessage:
											storeRoom.lastMessage || cachedRoom.lastMessage,
										updatedAt: storeRoom.updatedAt || cachedRoom.updatedAt,
									};
								}
								return cachedRoom;
							});
							setChatRooms(mergedCachedRooms);
							ensureCurrentRoomValidity(mergedCachedRooms);
							setLoadingChatRooms(false);
							return;
						}
					}
				}

				// If no cached data, load from API and merge with current store state
				try {
					const apiRooms = await chatApi.getChatRooms();
					const normalizedApiRooms = apiRooms.map(room => ({
						...room,
						participants: normalizeParticipants(room.participants || []),
					}));

					// Merge API data with current store state to preserve real-time updates
					const currentStoreRooms = useChatStore.getState().chatRooms;
					const mergedRooms = normalizedApiRooms.map(apiRoom => {
						const storeRoom = currentStoreRooms.find(
							storeRoom => storeRoom.id === apiRoom.id
						);
						if (storeRoom) {
							const finalUnreadCount = mergeSourcesUnreadCount(
								apiRoom.unreadCount,
								storeRoom.unreadCount
							);
							return {
								...apiRoom,
								unreadCount: finalUnreadCount,
								lastMessage: storeRoom.lastMessage || apiRoom.lastMessage,
								updatedAt: storeRoom.updatedAt || apiRoom.updatedAt,
							};
						}
						return apiRoom;
					});

					setChatRooms(mergedRooms);
					ensureCurrentRoomValidity(mergedRooms);
					await indexedDBChatService.saveChatRooms(mergedRooms);
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
		},
		[setChatRooms, setLoadingChatRooms, setError]
	);

	// Initialize chat data on mount
	useEffect(() => {
		// Load initial chat data
		loadChatRooms();
	}, [loadChatRooms]);

	// Load messages for a specific chat room
	const loadMessages = useCallback(
		async (
			chatRoomId: string,
			page: number = 1,
			limit: number = 50,
			syncOptions?: LoadMessagesOptions
		) => {
			const force = syncOptions?.force ?? false;
			const requestGen = ++loadMessagesGeneration;

			const isStaleRequest = () => {
				if (requestGen !== loadMessagesGeneration) return true;
				const { currentChatRoom } = useChatStore.getState();
				return currentChatRoom?.id != null && currentChatRoom.id !== chatRoomId;
			};

			const getRoomFromStore = () =>
				useChatStore.getState().chatRooms.find(r => r.id === chatRoomId);

			const getStoreMessagesForRoom = () =>
				filterMessagesForRoom(useChatStore.getState().messages, chatRoomId);

			const applyMessagesForRoom = (lists: Message[][]) => {
				if (isStaleRequest()) return;
				// Preserve messages that arrived via WebSocket while this async load was in flight.
				const latestStoreForRoom = getStoreMessagesForRoom();
				const merged = mergeMessageLists(...lists, latestStoreForRoom);
				setMessages(filterMessagesForRoom(merged, chatRoomId));
			};

			try {
				setLoadingMessages(true);
				setError(null);

				const room = getRoomFromStore();
				const storeForRoom = getStoreMessagesForRoom();

				const fetchAndApplyFromApi = async (showStaleCacheFirst: boolean) => {
					const response = await chatApi.getMessages(chatRoomId, page, limit);
					if (isStaleRequest()) return;

					const storeNow = getStoreMessagesForRoom();
					applyMessagesForRoom([response.messages, storeNow]);

					setCurrentPage(page);
					setHasMoreMessages(response.hasMore);
					await indexedDBChatService.saveMessages(chatRoomId, response.messages);
				};

				const hasCachedMessages = await indexedDBChatService.hasMessages(chatRoomId);
				let cachedMessages: Message[] = [];

				if (hasCachedMessages) {
					cachedMessages = await indexedDBChatService.getMessages(
						chatRoomId,
						limit,
						(page - 1) * limit
					);
				}

				if (cachedMessages.length > 0) {
					applyMessagesForRoom([cachedMessages, storeForRoom]);
					setCurrentPage(page);
					setHasMoreMessages(cachedMessages.length >= limit);

					const isCacheFresh = await indexedDBChatService.isMessagesCacheFresh(
						chatRoomId,
						5
					);
					const roomNow = getRoomFromStore();
					const storeNow = getStoreMessagesForRoom();
					const needsApi = shouldForceMessagesApiSync(roomNow, storeNow, {
						force,
						cacheFresh: isCacheFresh,
					});

					if (needsApi) {
						try {
							await fetchAndApplyFromApi(true);
						} catch (apiError) {
							console.warn("Background API update failed:", apiError);
						}
					}

					if (!isStaleRequest()) {
						setLoadingMessages(false);
					}
					return;
				}

				// No usable cache — prefer API; keep in-memory tail if API fails
				if (
					shouldForceMessagesApiSync(room, storeForRoom, {
						force: true,
						cacheFresh: false,
					}) ||
					storeForRoom.length === 0
				) {
					try {
						await fetchAndApplyFromApi(false);
					} catch (apiError) {
						console.warn("API unavailable:", apiError);
						if (!isStaleRequest()) {
							if (storeForRoom.length > 0) {
								applyMessagesForRoom([storeForRoom]);
							} else {
								setError("Failed to load messages");
								setMessages([]);
							}
						}
					}
				} else if (storeForRoom.length > 0) {
					applyMessagesForRoom([storeForRoom]);
					setCurrentPage(page);
					setHasMoreMessages(storeForRoom.length >= limit);
				}
			} catch (error) {
				console.error("Failed to load messages:", error);
				if (!isStaleRequest()) {
					setError("Failed to load messages");
				}
			} finally {
				if (!isStaleRequest()) {
					setLoadingMessages(false);
				}
			}
		},
		[setMessages, setLoadingMessages, setError, setCurrentPage, setHasMoreMessages]
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
			attachments?: { fileUrl: string; fileName: string; fileSize?: number }[];
			replyData?: {
				avatar?: string;
				time: string;
				content: string;
				senderName: string;
			};
		}) => {
			if (!currentChatRoom || !currentUser) return;

			try {
				const attachments = messageData.attachments;
				const multi = attachments && attachments.length >= 2 ? attachments : null;

				// Send message via API
				const newMessage = await chatApi.sendMessage({
					chatRoomId: currentChatRoom.id,
					content: messageData.content,
					replyData: messageData.replyData,
					...(multi
						? {
								attachments: multi,
								fileUrl: multi[0].fileUrl,
								fileName: multi[0].fileName,
								fileSize: multi[0].fileSize,
							}
						: {
								fileUrl: messageData.fileData?.fileUrl,
								fileName: messageData.fileData?.fileName,
								fileSize: messageData.fileData?.fileSize,
							}),
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
			name: string;
			type: "DIRECT" | "GROUP";
			loadId?: string;
			participantIds: string[];
			avatar?: string;
		}): Promise<ChatRoom | undefined> => {
			try {
				// Create chat room via API with WebSocket notifications
				const result = await chatRoomsApi.createChatRoom({
					name: chatRoomData.name,
					type: chatRoomData.type,
					loadId: chatRoomData.loadId ?? "",
					participantIds: chatRoomData.participantIds,
					avatar: chatRoomData.avatar,
				});

				if (result.success && result.data) {
					const chatData = result.data;
					const normalizedRoom = {
						...chatData,
						isArchived: false,
						updatedAt: chatData.createdAt,
						participants: normalizeParticipants(chatData.participants || []),
					} as ChatRoom;

					useChatStore.getState().addChatRoom(normalizedRoom);
					await indexedDBChatService.addChatRoom(normalizedRoom);
					return normalizedRoom;
				} else {
					console.error("useChatSync: API returned error:", result.error);
					throw new Error(result.error || "Failed to create chat room");
				}
			} catch (error) {
				console.error("useChatSync: Failed to create chat room:", error);
				setError("Failed to create chat room");
			}
			return undefined;
		},
		[setError]
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

	// Load a single chat room by ID (useful for newly added chat rooms)
	const loadSingleChatRoom = useCallback(async (chatRoomId: string) => {
		try {
			const chatRoom = await chatApi.getChatRoom(chatRoomId);

			// Normalize participants data
			const normalizedRoom = {
				...chatRoom,
				participants: normalizeParticipants(chatRoom.participants || []),
			};

			// Add to store
			const state = useChatStore.getState();
			const existingRooms = state.chatRooms;
			const roomExists = existingRooms.some(room => room.id === chatRoomId);

			if (!roomExists) {
				state.addChatRoom(normalizedRoom);
				// Save to cache
				await indexedDBChatService.saveChatRooms([...existingRooms, normalizedRoom]);
			}
		} catch (error) {
			console.error("Failed to load single chat room:", error);
		}
	}, []);

	// Listen for chat room added events
	useEffect(() => {
		const handleChatRoomAdded = (event: CustomEvent) => {
			const { chatRoomId } = event.detail;
			if (chatRoomId) {
				loadSingleChatRoom(chatRoomId);
			}
		};

		window.addEventListener("chatRoomAdded", handleChatRoomAdded as EventListener);

		return () => {
			window.removeEventListener("chatRoomAdded", handleChatRoomAdded as EventListener);
		};
	}, [loadSingleChatRoom]);

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
