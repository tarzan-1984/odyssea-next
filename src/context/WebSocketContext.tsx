"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import { useChatStore } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
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
	title: string;
	message: string;
	type: string;
	isRead: boolean;
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
			//console.log("Server connected event:", data);
		});

		// Handle message sent confirmation
		newSocket.on("messageSent", (data: any) => {
			// Update message status in store if needed
		});

		// Handle new message from server
		newSocket.on("newMessage", (data: any) => {
			// Add message to store if it's for the current chat room
			if (data.chatRoomId && data.message) {
				
				// Update chat room's lastMessage for ALL chats (not just current one)
				const state = useChatStore.getState();
				const chatRoom = state.chatRooms.find(room => room.id === data.chatRoomId);
				
				if (chatRoom) {
					const isCurrentChat = state.currentChatRoom?.id === data.chatRoomId;
					const isMessageFromCurrentUser = data.message.senderId === currentUser?.id;
					
			// Update lastMessage for all chats
			const updates: any = {
				lastMessage: data.message,
				updatedAt: data.message.createdAt
			};
			
			
			// Increment unreadCount only if:
			// 1. This is NOT the current active chat
			// 2. The message is NOT from the current user
			if (!isCurrentChat && !isMessageFromCurrentUser) {
				updates.unreadCount = (chatRoom.unreadCount || 0) + 1;
			}
			
			state.updateChatRoom(data.chatRoomId, updates);
			
			// Always save message to IndexedDB for persistence
			indexedDBChatService.addMessage(data.message).catch((error: Error) => {
				console.error("Failed to save message to IndexedDB:", error);
			});
			
			// Also add to store if this is the current chat (for immediate display)
			// This ensures messages appear even if useWebSocketMessages hasn't processed yet
			if (isCurrentChat) {
				addMessage(data.message);
				
				// Auto-mark message as read if it's in the current active chat
				// and it's not from the current user (don't mark own messages as read)
				
				if (!isMessageFromCurrentUser) {
					
					// Use the current socket (newSocket) to emit messageRead
					if (newSocket && newSocket.connected) {
					newSocket.emit("messageRead", { messageId: data.message.id, chatRoomId: data.chatRoomId });
				}
			}
		}
	}
			}
		});

		// Handle chat room events
		newSocket.on("chatRoomCreated", (data: any) => {
			//console.log("Chat room created:", data);
		});

		newSocket.on("chatRoomUpdated", (data: any) => {
			//console.log("Chat room updated:", data);
		});

		// Handle chat room deletion
		newSocket.on("chatRoomDeleted", (data: { chatRoomId: string; deletedBy: string }) => {
			const state = useChatStore.getState();
			state.removeChatRoom(data.chatRoomId);
		});

		// Handle chat room hidden for current user
		newSocket.on("chatRoomHidden", (data: { chatRoomId: string }) => {
			const state = useChatStore.getState();
			state.removeChatRoom(data.chatRoomId);
		});

		// Handle chat room restoration
		newSocket.on("chatRoomRestored", async (data: { chatRoomId: string }) => {
			// Reload chat rooms to show the restored chat
			try {
				const response = await fetch("/api/chat-rooms", {
					credentials: "include",
				});
				if (response.ok) {
					const data = await response.json();
					const state = useChatStore.getState();
					state.setChatRooms(data.data || []);
				}
			} catch (error) {
				console.error("Failed to reload chat rooms after restoration:", error);
			}
		});

		// Handle user events
		newSocket.on("userJoined", (data: any) => {
			//console.log("User joined chat room:", data);
		});

		newSocket.on("userLeft", (data: any) => {
			//console.log("User left chat room:", data);
		});

		// Handle room join/leave confirmations
		newSocket.on("joinedChatRoom", (data: any) => {
			//console.log("Successfully joined chat room:", data);
			// Update connection status or room state if needed
		});

		newSocket.on("leftChatRoom", (data: any) => {
			//console.log("Successfully left chat room:", data);
			// Update connection status or room state if needed
		});

		// Handle bulk messages marked as read
		newSocket.on("messagesMarkedAsRead", (data: { chatRoomId: string; messageIds: string[]; userId: string }) => {
			const state = useChatStore.getState();
			
			// Update all messages in the store
			const updatedMessages = state.messages.map(msg =>
				data.messageIds.includes(msg.id) ? { ...msg, isRead: true } : msg
			);
			
			// Calculate how many messages were marked as read
			const readCount = data.messageIds.length;
			
			// Update chat room's unreadCount
			const updatedRooms = state.chatRooms.map(room => {
				if (room.id === data.chatRoomId && room.unreadCount && room.unreadCount > 0) {
					const newUnreadCount = Math.max(0, room.unreadCount - readCount);
					const updatedRoom = { ...room, unreadCount: newUnreadCount };
					
					// Save updated room to IndexedDB
					indexedDBChatService.updateChatRoom(room.id, { unreadCount: newUnreadCount }).catch((error: Error) => {
						console.error("Failed to update chat room in IndexedDB:", error);
					});
					
					
					return updatedRoom;
				}
				return room;
			});
			
		// Update store with new messages and rooms
		state.setMessages(updatedMessages);
		useChatStore.setState({ chatRooms: updatedRooms }, false, "messagesMarkedAsRead");
		});

		// Handle typing events - this will be handled by useWebSocketMessages hook
		// newSocket.on("userTyping", (data: any) => {
		// 	console.log("User typing:", data);
		// });

		// Handle online status events - this will be handled by useWebSocketMessages hook
		// newSocket.on("userOnline", (data: any) => {
		// 	console.log("User online status:", data);
		// });

		// Handle error events
		newSocket.on("error", (data: any) => {
			console.error("WebSocket error from server:", data);
		});

		// Handle any other events for debugging
		newSocket.onAny((eventName: string, ...args: any[]) => {
			if (process.env.NODE_ENV === "development") {
				//console.log(`Received event '${eventName}' from server:`, args);
			}
		});

		newSocket.on("disconnect", (reason: string) => {
			if (process.env.NODE_ENV === "development") {
				//console.log("WebSocket disconnected:", reason);
			}
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
		newSocket.on("chatRoomCreated", (data: any) => {
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
