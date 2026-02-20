"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import { useChatStore } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
import { isMessageReadByUser, chatApi } from "@/app-api/chatApi";
import {
	useNotificationsStore,
	useAddNotification,
	useUpdateUnreadCount,
} from "@/stores/notificationsStore";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Message, ChatRoom } from "@/app-api/chatApi";
import { clientAuth } from "@/utils/auth";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

// WebSocket context interface
interface WebSocketContextType {
	socket: Socket | null;
	isConnected: boolean;
	connect: () => void;
	disconnect: () => void;
	joinChatRoom: (chatRoomId: string) => void;
	leaveChatRoom: (chatRoomId: string) => void;
	sendMessage: (data: SendMessageData) => void;
	sendTyping: (chatRoomId: string, isTyping: boolean) => void;
	markMessageAsRead: (messageId: string, chatRoomId: string) => void;
	markChatRoomAsRead: (chatRoomId: string) => void;
}

// Message sending interface
interface SendMessageData {
	chatRoomId: string;
	content: string;
	fileUrl?: string;
	fileName?: string;
	fileSize?: number;
	replyData?: { avatar?: string; time: string; content: string; senderName: string };
}

// WebSocket event data interfaces
interface NewMessageData {
	chatRoomId: string;
	message: Message;
}

interface MessageSentData {
	messageId: string;
	chatRoomId: string;
}

interface MessageReadData {
	messageId: string;
	readBy: string;
}

interface UserTypingData {
	userId: string;
	chatRoomId: string;
	isTyping: boolean;
	firstName?: string;
}

interface UserOnlineData {
	userId: string;
	chatRoomId: string;
	isOnline: boolean;
}

interface ChatRoomCreatedData {
	chatRoom: ChatRoom;
}

interface ChatRoomUpdatedData {
	chatRoomId: string;
	updatedChatRoom: ChatRoom;
	updatedBy: string;
}

interface ParticipantsAddedData {
	chatRoomId: string;
	newParticipants: any[];
	addedBy: string;
}

interface ParticipantRemovedData {
	chatRoomId: string;
	removedUserId: string;
	removedBy: string;
}

interface NotificationData {
	id: string;
	userId: string;
	title: string;
	message: string;
	type: string;
	avatar?: string;
	isRead: boolean; // Global read status
	readBy?: string[]; // Array of user IDs who read the notification
	createdAt: string;
	chatRoomId?: string;
}

interface RoleBroadcastData {
	role: string;
	message: {
		title: string;
		content: string;
	};
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
	const context = useContext(WebSocketContext);
	if (!context) {
		throw new Error("useWebSocket must be used within WebSocketProvider");
	}
	return context;
};

interface WebSocketProviderProps {
	children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectAttempts = useRef(0);
	const maxReconnectAttempts = 5;

	// Get store actions
	const { addMessage, addChatRoom, updateChatRoom, updateMessage } = useChatStore();
	const currentUser = useUserStore(state => state.currentUser);
	const addNotification = useAddNotification();
	const updateUnreadCount = useUpdateUnreadCount();
	const { playNotificationSound, enableAudio } = useNotificationSound();

	// Enable audio after first user interaction
	useEffect(() => {
		const handleUserInteraction = () => {
			enableAudio();
			// Remove listeners after first interaction
			document.removeEventListener("click", handleUserInteraction);
			document.removeEventListener("keydown", handleUserInteraction);
			document.removeEventListener("touchstart", handleUserInteraction);
		};

		document.addEventListener("click", handleUserInteraction);
		document.addEventListener("keydown", handleUserInteraction);
		document.addEventListener("touchstart", handleUserInteraction);

		return () => {
			document.removeEventListener("click", handleUserInteraction);
			document.removeEventListener("keydown", handleUserInteraction);
			document.removeEventListener("touchstart", handleUserInteraction);
		};
	}, [enableAudio]);

	// WebSocket URL from environment variables
	const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

	// Debug logging for URL (only once on mount)
	const [urlLogged, setUrlLogged] = useState(false);
	if (process.env.NODE_ENV === "development" && !urlLogged) {
		//console.log("WebSocket URL:", wsUrl);
		setUrlLogged(true);
	}

	const connect = () => {
		// Only connect if we have a current user
		if (!currentUser) {
			return;
		}

		// Disconnect existing connection if any
		if (socket) {
			socket.disconnect();
		}

		// Get token from localStorage or cookies
		// In this project, authentication is handled by Next.js API routes using cookies
		// We need to get the token from the authentication system
		const token = getAuthToken();

		if (!token) {
			return;
		}

		// Validate WebSocket URL
		if (!wsUrl || wsUrl.includes("https/")) {
			console.error("Invalid WebSocket URL:", wsUrl);
			return;
		}

		// Create new socket connection with authentication (without namespace)

		const newSocket = io(wsUrl, {
			auth: {
				token: token,
			},
			transports: ["websocket", "polling"], // Fallback to polling if websocket fails
			timeout: 20000,
			forceNew: true,
		});

		// Connection event handlers
		newSocket.on("connect", () => {
			setIsConnected(true);
			reconnectAttempts.current = 0;

			// Clear any pending reconnection attempts
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
		});

		// Handle server's connected event (with user data)
		newSocket.on("connected", (data: any) => {
			// Connected successfully
		});

		// Handle user location updates from backend (users table)
		newSocket.on("userLocationUpdate", (payload: any) => {
			console.log("[WebSocket] User location update");
		});

		// Handle message sent confirmation
		newSocket.on("messageSent", (data: any) => {
			// Update message status in store if needed
		});

		// Handle new message from server
		newSocket.on("newMessage", async (data: any) => {
			// Handle case where data comes as array (from onAny handler)
			const messageData = Array.isArray(data) ? data[0] : data;

			// Add message to store if it's for the current chat room
			if (messageData && messageData.chatRoomId && messageData.message) {
				// Update chat room's lastMessage for ALL chats (not just current one)
				const state = useChatStore.getState();
				let chatRoom = state.chatRooms.find(room => room.id === messageData.chatRoomId);

				// If chat room doesn't exist in store, it might have been deleted/hidden
				// Try to restore it by loading from API
				if (!chatRoom) {
					console.log(
						"🔄 [WebSocket] Chat room not found in store, attempting to restore:",
						messageData.chatRoomId
					);
					try {
						const restoredRoom = await chatApi.getChatRoom(messageData.chatRoomId);

						// Normalize participant avatar field (profilePhoto -> avatar)
						const normalized: ChatRoom = {
							...restoredRoom,
							participants: Array.isArray(restoredRoom.participants)
								? restoredRoom.participants.map((p: any) => ({
										...p,
										user: {
											...p.user,
											avatar: p.user?.avatar ?? p.user?.profilePhoto ?? "",
										},
									}))
								: [],
						};

						// Add restored chat room to store
						const { addChatRoom } = useChatStore.getState();
						addChatRoom(normalized);
						chatRoom = normalized;
						console.log("✅ [WebSocket] Chat room restored:", normalized.id);

						// Save restored chat room to IndexedDB
						try {
							const currentChatRooms = await indexedDBChatService.getChatRooms();
							const updatedRooms = [
								...currentChatRooms.filter(r => r.id !== normalized.id),
								normalized,
							];
							await indexedDBChatService.saveChatRooms(updatedRooms);
							console.log("✅ [WebSocket] Chat room saved to IndexedDB");
						} catch (dbError) {
							console.error(
								"❌ [WebSocket] Failed to save restored chat room to IndexedDB:",
								dbError
							);
						}
					} catch (restoreError) {
						console.error("❌ [WebSocket] Failed to restore chat room:", restoreError);
						// Continue with message processing even if restore failed
					}
				}

				// Process message regardless of whether chat room is in store
				// This ensures notifications work even when user is not on chat page
				// If currentChatRoom is null (user not on chat page), treat as not current chat
				const isCurrentChat =
					state.currentChatRoom && state.currentChatRoom.id === messageData.chatRoomId;
				const isMessageFromCurrentUser = messageData.message.senderId === currentUser?.id;

				// Update lastMessage for all chats (only if chat room exists in store)
				if (chatRoom) {
					const updates: any = {
						lastMessage: messageData.message,
						updatedAt: messageData.message.createdAt,
					};

					// Increment unreadCount only if:
					// 1. This is NOT the current active chat
					// 2. The message is NOT from the current user
					if (!isCurrentChat && !isMessageFromCurrentUser) {
						updates.unreadCount = (chatRoom.unreadCount || 0) + 1;
					}

					state.updateChatRoom(messageData.chatRoomId, updates);
				}

				// Play notification sound for ALL participants if:
				// 1. The message is NOT from the current user
				// 2. This is NOT the current active chat (user is not viewing this specific chat)
				// 3. The chat is NOT muted
				// Sound should play on any page, except when user is in the active chat where message arrived
				if (!isMessageFromCurrentUser && !isCurrentChat && !chatRoom?.isMuted) {
					playNotificationSound();
				}

				// Show toast notification for ALL participants if:
				// 1. This is NOT the current active chat (user is not viewing this chat)
				// 2. The message is NOT from the current user
				// 3. The chat is NOT muted
				// This works for both direct and group chats
				if (!isCurrentChat && !isMessageFromCurrentUser && !chatRoom?.isMuted) {
					// Show toast notification
					if (typeof window !== "undefined" && (window as any).addToastNotification) {
						// Create a minimal chat room object for toast if not found in store
						const chatRoomForToast = chatRoom || {
							id: messageData.chatRoomId,
							name: messageData.message.receiver
								? `${messageData.message.receiver.firstName} ${messageData.message.receiver.lastName}`
								: "Chat",
							type: "DIRECT",
							participants: [
								{ user: messageData.message.sender },
								{ user: messageData.message.receiver },
							].filter(p => p.user),
						};
						(window as any).addToastNotification(messageData.message, chatRoomForToast);
					}
				}

				// Always save message to IndexedDB for persistence
				indexedDBChatService.addMessage(messageData.message).catch((error: Error) => {
					console.error("Failed to save message to IndexedDB:", error);
				});

				// Also add to store if this is the current chat (for immediate display)
				// This ensures messages appear even if useWebSocketMessages hasn't processed yet
				if (isCurrentChat) {
					addMessage(messageData.message);

					// Auto-mark message as read if it's in the current active chat
					// and it's not from the current user (don't mark own messages as read)
					if (!isMessageFromCurrentUser) {
						// Mark message as read in store immediately
						const currentReadBy = messageData.message.readBy || [];
						if (!currentReadBy.includes(currentUser.id)) {
							updateMessage(messageData.message.id, {
								isRead: true, // Global read status
								readBy: [...currentReadBy, currentUser.id], // Per-user read status
							});

							// Update message as read in IndexedDB cache immediately
							indexedDBChatService
								.updateMessage(messageData.message.id, {
									isRead: true,
									readBy: [...currentReadBy, currentUser.id],
								})
								.catch((error: Error) => {
									console.error(
										"Failed to update message as read in IndexedDB:",
										error
									);
								});
						}

						// Use the current socket (newSocket) to emit messageRead
						if (newSocket && newSocket.connected) {
							newSocket.emit("messageRead", {
								messageId: messageData.message.id,
								chatRoomId: messageData.chatRoomId,
							});
						}
					}
				}
			}
		});

		// Handle chat room events
		newSocket.on("chatRoomCreated", (data: any) => {
			// Chat room created
		});

		newSocket.on("chatRoomUpdated", (data: any) => {
			// Chat room updated
		});

		// Handle notification events
		newSocket.on("notification", (data: NotificationData) => {
			// Add notification to store
			addNotification(data);
		});

		newSocket.on("unreadCountUpdate", (data: { unreadCount: number }) => {
			// Update unread count in store
			updateUnreadCount(data.unreadCount);
		});

		// Handle chat room deletion
		newSocket.on("chatRoomDeleted", (data: { chatRoomId: string; deletedBy: string }) => {
			const state = useChatStore.getState();
			state.removeChatRoom(data.chatRoomId);

			// Clear currentChatRoom if it was the deleted chat
			if (state.currentChatRoom?.id === data.chatRoomId) {
				state.setCurrentChatRoom(null);
			}
		});

		// Handle message deletion
		newSocket.on(
			"messageDeleted",
			(data: {
				messageId: string;
				chatRoomId: string;
				deletedBy: string;
				deletedByRole: string;
			}) => {
				const state = useChatStore.getState();

				// Remove message from store
				const updatedMessages = state.messages.filter(msg => msg.id !== data.messageId);
				state.setMessages(updatedMessages);

				// Update IndexedDB cache
				indexedDBChatService.deleteMessage(data.messageId).catch((error: Error) => {
					console.error("Failed to delete message from IndexedDB:", error);
				});

				// Update chat room's last message if the deleted message was the last one
				const chatRoom = state.chatRooms.find(room => room.id === data.chatRoomId);
				if (chatRoom && chatRoom.lastMessage?.id === data.messageId) {
					// Find the new last message
					const remainingMessages = updatedMessages.filter(
						msg => msg.chatRoomId === data.chatRoomId
					);
					const newLastMessage =
						remainingMessages.length > 0
							? remainingMessages[remainingMessages.length - 1]
							: null;

					// Update chat room with new last message
					const updatedChatRooms = state.chatRooms.map(room =>
						room.id === data.chatRoomId
							? { ...room, lastMessage: newLastMessage || undefined }
							: room
					);
					state.setChatRooms(updatedChatRooms);
				}
			}
		);

		// Handle messages marked as unread
		newSocket.on(
			"messagesMarkedAsUnread",
			async (data: { chatRoomId: string; messageIds: string[]; userId: string }) => {
				const state = useChatStore.getState();

				// Get chat room type to determine logic
				const chatRoom = state.chatRooms.find(room => room.id === data.chatRoomId);
				const isDirectChat = chatRoom?.type === "DIRECT";

				// Update messages in store
				const updatedMessages = state.messages.map(msg => {
					if (data.messageIds.includes(msg.id)) {
						const currentReadBy = msg.readBy || [];
						const updatedReadBy = currentReadBy.filter(id => id !== data.userId);

						if (isDirectChat) {
							// For DIRECT chats: set both isRead to false and remove user from readBy
							return {
								...msg,
								isRead: false, // Global read status becomes false
								readBy: updatedReadBy,
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

				// Update unread counts on chat room - only for the user who marked as unread
				const updatedRooms = state.chatRooms.map(room => {
					if (room.id !== data.chatRoomId) return room;

					// Only increment unread count for the user who marked the message as unread
					// Other participants should not see increased unread count
					const currentUser = useUserStore.getState().currentUser;
					if (currentUser && currentUser.id === data.userId) {
						const increment = data.messageIds.length;
						const unread = (room.unreadCount || 0) + increment;
						return { ...room, unreadCount: unread };
					}

					return room; // No change for other users
				});
				state.setChatRooms(updatedRooms);

				// Update IndexedDB cache
				const { indexedDBChatService } = await import("@/services/IndexedDBChatService");

				// Update messages in IndexedDB
				data.messageIds.forEach(messageId => {
					const message = updatedMessages.find(msg => msg.id === messageId);
					if (message) {
						if (isDirectChat) {
							indexedDBChatService
								.updateMessage(messageId, {
									isRead: false,
									readBy: message.readBy,
								})
								.catch((error: Error) => {
									console.error("Failed to update message in IndexedDB:", error);
								});
						} else {
							indexedDBChatService
								.updateMessage(messageId, {
									readBy: message.readBy,
								})
								.catch((error: Error) => {
									console.error("Failed to update message in IndexedDB:", error);
								});
						}
					}
				});

				// Update chat room unread count in IndexedDB
				const currentUser = useUserStore.getState().currentUser;
				if (currentUser && currentUser.id === data.userId) {
					const updatedRoom = updatedRooms.find(room => room.id === data.chatRoomId);
					if (updatedRoom) {
						indexedDBChatService
							.updateChatRoom(data.chatRoomId, {
								unreadCount: updatedRoom.unreadCount,
							})
							.catch((error: Error) => {
								console.error(
									"Failed to update chat room unread count in IndexedDB:",
									error
								);
							});
					}
				}
			}
		);

		// Handle chat room hidden for current user
		newSocket.on("chatRoomHidden", (data: { chatRoomId: string }) => {
			const state = useChatStore.getState();
			state.removeChatRoom(data.chatRoomId);

			// Clear currentChatRoom if it was the hidden chat
			if (state.currentChatRoom?.id === data.chatRoomId) {
				state.setCurrentChatRoom(null);
			}
		});

		// Handle chat room restoration
		newSocket.on("chatRoomRestored", async (data: { chatRoomId: string }) => {
			// Reload chat rooms to show the restored chat
			try {
				const response = await fetch("/api/chat-rooms", {
					credentials: "include",
				});
				if (response.ok) {
					const chatRoomsData = await response.json();
					const chatRooms = chatRoomsData.data || [];
					const state = useChatStore.getState();
					state.setChatRooms(chatRooms);

					// Save restored chat rooms to IndexedDB
					try {
						await indexedDBChatService.saveChatRooms(chatRooms);
					} catch (dbError) {
						console.error("Failed to save restored chat rooms to IndexedDB:", dbError);
					}
				}
			} catch (error) {
				console.error("Failed to reload chat rooms after restoration:", error);
			}
		});

		// Handle user events
		newSocket.on("userJoined", (data: any) => {
			// User joined chat room
		});

		newSocket.on("userLeft", (data: any) => {
			// User left chat room
		});

		// Handle room join/leave confirmations
		newSocket.on("joinedChatRoom", (data: any) => {
			// Successfully joined chat room
		});

		newSocket.on("leftChatRoom", (data: any) => {
			// Successfully left chat room
		});

		// Handle bulk messages marked as read
		newSocket.on(
			"messagesMarkedAsRead",
			(data: { chatRoomId: string; messageIds: string[]; userId: string }) => {
				const state = useChatStore.getState();

				// Update all messages in the store
				const updatedMessages = state.messages.map(msg => {
					if (data.messageIds.includes(msg.id)) {
						const currentReadBy = msg.readBy || [];
						const updatedReadBy = currentReadBy.includes(data.userId)
							? currentReadBy
							: [...currentReadBy, data.userId];
						return {
							...msg,
							isRead: true, // Global read status
							readBy: updatedReadBy, // Per-user read status
						};
					}
					return msg;
				});

				// Update all messages as read in IndexedDB cache immediately
				data.messageIds.forEach(messageId => {
					const message = state.messages.find(m => m.id === messageId);
					if (message) {
						const currentReadBy = message.readBy || [];
						const updatedReadBy = currentReadBy.includes(data.userId)
							? currentReadBy
							: [...currentReadBy, data.userId];
						indexedDBChatService
							.updateMessage(messageId, {
								isRead: true,
								readBy: updatedReadBy,
							})
							.catch((error: Error) => {
								console.error(
									"Failed to update message as read in IndexedDB:",
									error
								);
							});
					}
				});

				// Calculate how many messages were marked as read
				const readCount = data.messageIds.length;

				// Update chat room's unreadCount only if the current user read the messages
				// This ensures that unreadCount is only decremented for the user who actually read them
				// For group/load chats, each user has their own unreadCount based on their readBy status
				const updatedRooms = state.chatRooms.map(room => {
					if (
						room.id === data.chatRoomId &&
						data.userId === currentUser?.id &&
						room.unreadCount &&
						room.unreadCount > 0
					) {
						const newUnreadCount = Math.max(0, room.unreadCount - readCount);
						const updatedRoom = { ...room, unreadCount: newUnreadCount };

						// Save updated room to IndexedDB
						indexedDBChatService
							.updateChatRoom(room.id, { unreadCount: newUnreadCount })
							.catch((error: Error) => {
								console.error("Failed to update chat room in IndexedDB:", error);
							});

						return updatedRoom;
					}
					return room;
				});

				// Update store with new messages and rooms
				state.setMessages(updatedMessages);
				useChatStore.setState({ chatRooms: updatedRooms }, false, "messagesMarkedAsRead");
			}
		);

		// Handle typing events - this will be handled by useWebSocketMessages hook
		// newSocket.on("userTyping", (data: any) => {
		// 	// User typing
		// });

		// Handle online status events - this will be handled by useWebSocketMessages hook
		// newSocket.on("userOnline", (data: any) => {
		// 	// User online status
		// });

		// Handle error events
		newSocket.on("error", (data: any) => {
			console.error("WebSocket error from server:", data);
		});

		// Handle any other events for debugging
		newSocket.onAny((eventName: string, ...args: any[]) => {
			if (process.env.NODE_ENV === "development") {
				// Debug mode: log all WebSocket events
			}
		});

		newSocket.on("disconnect", (reason: string) => {
			setIsConnected(false);

			// Re-enable auto-reconnect for stability
			if (reason !== "io client disconnect") {
				attemptReconnect();
			}
		});

		newSocket.on("connect_error", (error: any) => {
			console.error("WebSocket connection error:", error);
			console.error("Error details:", {
				message: error.message,
				description: error.description,
				context: error.context,
				type: error.type,
				stack: error.stack,
			});
			setIsConnected(false);

			// Attempt to reconnect on connection error
			attemptReconnect();
		});

		// Handle authentication errors
		newSocket.on("auth_error", (error: any) => {
			console.error("WebSocket authentication error:", error);
			setIsConnected(false);
			// Optionally redirect to login or show error message
		});

		// Handle general errors
		newSocket.on("error", (error: any) => {
			console.error("WebSocket error:", error);
			if (error.message?.includes("Unauthorized")) {
				// Token might be expired, try to refresh
				handleAuthError();
			}
		});

		// Message events - these are handled by useWebSocketMessages hook
		// No need to duplicate event handlers here

		// Chat room events
		newSocket.on("chatRoomCreated", async (data: any) => {
			// Backend may emit either the chat room object directly or wrapped as { chatRoom }
			const raw: any = data && "chatRoom" in data ? data.chatRoom : data;

			if (raw && raw.id) {
				// Normalize participant avatar field (profilePhoto -> avatar)
				const normalized: ChatRoom = {
					...raw,
					participants: Array.isArray(raw.participants)
						? raw.participants.map((p: any) => ({
								...p,
								user: {
									...p.user,
									avatar: p.user?.avatar ?? p.user?.profilePhoto ?? "",
								},
							}))
						: [],
				};
				addChatRoom(normalized);

				// Save to IndexedDB (use addChatRoom to avoid race when multiple chats created in quick succession)
				try {
					const { indexedDBChatService } = await import(
						"@/services/IndexedDBChatService"
					);
					await indexedDBChatService.addChatRoom(normalized);
				} catch (dbError) {
					console.error("Failed to save new chat room to IndexedDB:", dbError);
				}

				// Automatically join the WebSocket room for the new chat
				// This ensures the user receives real-time messages in this chat
				if (newSocket && newSocket.connected) {
					newSocket.emit("joinChatRoom", { chatRoomId: normalized.id });
				}
			} else {
				console.error("Invalid chatRoomCreated payload", data);
			}
		});

		newSocket.on("chatRoomUpdated", (data: ChatRoomUpdatedData) => {
			updateChatRoom(data.chatRoomId, data.updatedChatRoom);
		});

		newSocket.on("participantsAdded", (data: ParticipantsAddedData) => {
			try {
				const { chatRoomId, newParticipants } = data;
				// Read current room from store
				const state = useChatStore.getState();
				const room = state.chatRooms.find(r => r.id === chatRoomId);

				// Check if current user is among the newly added participants
				const isCurrentUserAdded = (newParticipants || []).some((p: any) => {
					const userId = p.user?.id || p.userId;
					return userId === currentUser?.id;
				});

				// If current user was added to a new chat room, we need to create the chat room
				if (isCurrentUserAdded && !room) {
					// We need to fetch the full chat room data from the server
					// For now, let's emit an event to trigger a chat room refresh
					window.dispatchEvent(
						new CustomEvent("chatRoomAdded", {
							detail: { chatRoomId },
						})
					);
					return;
				}

				// If room doesn't exist and current user wasn't added, ignore
				if (!room) return;

				// Normalize avatar field
				const normalized = (newParticipants || []).map((p: any) => ({
					...p,
					user: {
						...p.user,
						avatar: p.user?.avatar ?? p.user?.profilePhoto ?? "",
					},
				}));

				// Filter out participants that already exist in the room (by userId)
				const existingUserIds = new Set(room.participants.map(p => p.user?.id || p.userId));
				const newUniqueParticipants = normalized.filter(p => {
					const userId = p.user?.id || p.userId;
					return !existingUserIds.has(userId);
				});

				// Adding participants to existing room

				// Only merge if there are actually new participants
				if (newUniqueParticipants.length > 0) {
					const merged = [...room.participants, ...newUniqueParticipants];
					updateChatRoom(chatRoomId, { participants: merged });
				}
			} catch (e) {
				console.error("Failed to handle participantsAdded:", e);
			}
		});

		newSocket.on("participantRemoved", (data: ParticipantRemovedData) => {
			try {
				const { chatRoomId, removedUserId } = data;
				const state = useChatStore.getState();
				const room = state.chatRooms.find(r => r.id === chatRoomId);
				if (!room) return;

				// Check if the removed user is the current user
				if (currentUser?.id === removedUserId) {
					// Remove the entire chat room from the list and cache
					state.removeChatRoom(chatRoomId);

					// If this was the current chat room, clear it
					if (state.currentChatRoom?.id === chatRoomId) {
						state.setCurrentChatRoom(null);
					}
					return;
				}

				// Otherwise, just remove the participant from the room
				// removedUserId is user.id from users table, so compare with p.user?.id
				const filtered = room.participants.filter(
					p => (p.user?.id || p.userId) !== removedUserId
				);
				// Participant removed from existing room
				updateChatRoom(chatRoomId, { participants: filtered });
			} catch (e) {
				console.error("Failed to handle participantRemoved:", e);
			}
		});

		// Handle when current user is removed from a chat room
		newSocket.on("removedFromChatRoom", (data: { chatRoomId: string; removedBy: string }) => {
			try {
				const { chatRoomId } = data;
				const state = useChatStore.getState();

				// Remove the entire chat room from the list and cache
				state.removeChatRoom(chatRoomId);

				// If this was the current chat room, clear it
				if (state.currentChatRoom?.id === chatRoomId) {
					state.setCurrentChatRoom(null);
				}
			} catch (e) {
				console.error("Failed to handle removedFromChatRoom:", e);
			}
		});

		// Notification events
		newSocket.on("notification", (data: NotificationData) => {
			// Handle notifications if needed
		});

		newSocket.on("roleBroadcast", (data: RoleBroadcastData) => {
			// Handle role broadcasts if needed
		});

		setSocket(newSocket);
	};

	const attemptReconnect = () => {
		if (reconnectAttempts.current >= maxReconnectAttempts) {
			return;
		}

		reconnectAttempts.current++;
		const delay = Math.min(5000 * Math.pow(2, reconnectAttempts.current), 60000); // Start with 5s, max 60s

		// Attempting to reconnect

		reconnectTimeoutRef.current = setTimeout(() => {
			connect();
		}, delay);
	};

	const handleAuthError = () => {
		// Implement token refresh logic here
		// For now, we'll just disconnect and let the user re-authenticate
		disconnect();
	};

	const disconnect = () => {
		if (socket) {
			socket.disconnect();
			setSocket(null);
			setIsConnected(false);
		}

		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}

		reconnectAttempts.current = 0;
	};

	const joinChatRoom = useCallback(
		(chatRoomId: string) => {
			if (socket && isConnected) {
				//socket.emit("joinChatRoom", { chatRoomId });
			}
		},
		[socket, isConnected]
	);

	const leaveChatRoom = useCallback(
		(chatRoomId: string) => {
			if (socket && isConnected) {
				socket.emit("leaveChatRoom", { chatRoomId });
			}
		},
		[socket, isConnected]
	);

	const sendMessage = (data: SendMessageData) => {
		if (socket && isConnected) {
			// Send message data in the format expected by the backend
			const messageData = {
				chatRoomId: data.chatRoomId,
				content: data.content,
				fileUrl: data.fileUrl,
				fileName: data.fileName,
				fileSize: data.fileSize,
				replyData: data.replyData,
			};

			socket.emit("sendMessage", messageData);
		} else {
			console.error("Cannot send message: socket not connected or not available");
		}
	};

	const sendTyping = (chatRoomId: string, isTyping: boolean) => {
		if (socket && isConnected) {
			socket.emit("typing", { chatRoomId, isTyping });
		}
	};

	const markMessageAsRead = (messageId: string, chatRoomId: string) => {
		if (socket && isConnected && socket.connected) {
			socket.emit("messageRead", { messageId, chatRoomId });
		}
	};

	const markChatRoomAsRead = (chatRoomId: string) => {
		if (socket && isConnected) {
			socket.emit("markChatRoomAsRead", { chatRoomId });
		}
	};

	// Get authentication token from the project's auth system
	const getAuthToken = (): string | null => {
		// Use the project's clientAuth utility to get the access token
		const token = clientAuth.getAccessToken();
		// WebSocket auth token check
		return token || null;
	};

	// Auto-connect when user is available
	useEffect(() => {
		if (currentUser && !isConnected) {
			connect();
		} else if (!currentUser && isConnected) {
			disconnect();
		}
	}, [currentUser, isConnected]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (socket) {
				socket.disconnect();
			}
		};
	}, [socket]);

	const value: WebSocketContextType = {
		socket,
		isConnected,
		connect,
		disconnect,
		joinChatRoom,
		leaveChatRoom,
		sendMessage,
		sendTyping,
		markMessageAsRead,
		markChatRoomAsRead,
	};

	return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};
