"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import { useChatStore } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
import { Message, ChatRoom } from "@/app-api/chatApi";
import { clientAuth } from "@/utils/auth";

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
		console.log("WebSocket URL:", wsUrl);
		setUrlLogged(true);
	}

	const connect = () => {
		// Only connect if we have a current user
		if (!currentUser) {
			console.log("No current user, skipping WebSocket connection");
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
			console.log("No authentication token found, skipping WebSocket connection");
			console.log("Available cookies:", document.cookie);
			console.log("User authenticated:", clientAuth.isAuthenticated());
			return;
		}

		// Validate WebSocket URL
		if (!wsUrl || wsUrl.includes("https/")) {
			console.error("Invalid WebSocket URL:", wsUrl);
			console.log("Environment variables:", {
				NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
				NODE_ENV: process.env.NODE_ENV,
			});
			return;
		}

		// Create new socket connection with authentication (without namespace)
		console.log("Attempting to connect to:", wsUrl);
		console.log("Token length:", token.length);

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
			if (process.env.NODE_ENV === "development") {
				console.log("WebSocket connected");
				console.log("Socket ID:", newSocket.id);
				console.log("Socket connected:", newSocket.connected);
			}
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
			console.log("Server connected event:", data);
		});

		// Handle message sent confirmation
		newSocket.on("messageSent", (data: any) => {
			console.log("Message sent confirmation from server:", data);
			// Update message status in store if needed
		});

		// Handle new message from server
		newSocket.on("newMessage", (data: any) => {
			console.log("New message received from server:", data);
			// Add message to store if it's for the current chat room
			if (data.chatRoomId && data.message) {
				// This will be handled by useWebSocketMessages hook
			}
		});

		// Handle chat room events
		newSocket.on("chatRoomCreated", (data: any) => {
			console.log("Chat room created:", data);
		});

		newSocket.on("chatRoomUpdated", (data: any) => {
			console.log("Chat room updated:", data);
		});

		// Handle user events
		newSocket.on("userJoined", (data: any) => {
			console.log("User joined chat room:", data);
		});

		newSocket.on("userLeft", (data: any) => {
			console.log("User left chat room:", data);
		});

		// Handle room join/leave confirmations
		newSocket.on("joinedChatRoom", (data: any) => {
			console.log("Successfully joined chat room:", data);
			// Update connection status or room state if needed
		});

		newSocket.on("leftChatRoom", (data: any) => {
			console.log("Successfully left chat room:", data);
			// Update connection status or room state if needed
		});

		// Handle typing events
		newSocket.on("userTyping", (data: any) => {
			console.log("User typing:", data);
		});

		// Handle error events
		newSocket.on("error", (data: any) => {
			console.error("WebSocket error from server:", data);
		});

		// Handle any other events for debugging
		newSocket.onAny((eventName: string, ...args: any[]) => {
			if (process.env.NODE_ENV === "development") {
				console.log(`Received event '${eventName}' from server:`, args);
			}
		});

		newSocket.on("disconnect", (reason: string) => {
			if (process.env.NODE_ENV === "development") {
				console.log("WebSocket disconnected:", reason);
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
		newSocket.on("chatRoomCreated", (data: ChatRoomCreatedData) => {
			console.log("Chat room created:", data);
			addChatRoom(data.chatRoom);
		});

		newSocket.on("chatRoomUpdated", (data: ChatRoomUpdatedData) => {
			console.log("Chat room updated:", data);
			updateChatRoom(data.chatRoomId, data.updatedChatRoom);
		});

		newSocket.on("participantsAdded", (data: ParticipantsAddedData) => {
			console.log("Participants added:", data);
			// Handle participants added if needed
		});

		newSocket.on("participantRemoved", (data: ParticipantRemovedData) => {
			console.log("Participant removed:", data);
			// Handle participant removed if needed
		});

		// Notification events
		newSocket.on("notification", (data: NotificationData) => {
			console.log("Notification received:", data);
			// Handle notifications if needed
		});

		newSocket.on("roleBroadcast", (data: RoleBroadcastData) => {
			console.log("Role broadcast received:", data);
			// Handle role broadcasts if needed
		});

		setSocket(newSocket);
	};

	const attemptReconnect = () => {
		if (reconnectAttempts.current >= maxReconnectAttempts) {
			console.log("Max reconnection attempts reached");
			return;
		}

		reconnectAttempts.current++;
		const delay = Math.min(5000 * Math.pow(2, reconnectAttempts.current), 60000); // Start with 5s, max 60s

		console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);

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
				console.log("Joining chat room:", chatRoomId);
				socket.emit("joinChatRoom", { chatRoomId });
				console.log("joinChatRoom event emitted to server");
			} else {
				console.log("Cannot join chat room: socket not connected or not available");
			}
		},
		[socket, isConnected]
	);

	const leaveChatRoom = useCallback(
		(chatRoomId: string) => {
			if (socket && isConnected) {
				console.log("Leaving chat room:", chatRoomId);
				socket.emit("leaveChatRoom", { chatRoomId });
			}
		},
		[socket, isConnected]
	);

	const sendMessage = (data: SendMessageData) => {
		console.log("WebSocket sendMessage called:", { data, isConnected, socket: !!socket });
		if (socket && isConnected) {
			console.log("Emitting sendMessage event to server:", data);

			// Send message data in the format expected by the backend
			const messageData = {
				chatRoomId: data.chatRoomId,
				content: data.content,
				fileUrl: data.fileUrl,
				fileName: data.fileName,
				fileSize: data.fileSize,
			};

			console.log("Sending message data:", messageData);
			socket.emit("sendMessage", messageData);
			console.log("sendMessage event emitted to server");
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
		if (socket && isConnected) {
			socket.emit("messageRead", { messageId, chatRoomId });
		}
	};

	// Get authentication token from the project's auth system
	const getAuthToken = (): string | null => {
		// Use the project's clientAuth utility to get the access token
		const token = clientAuth.getAccessToken();
		console.log("WebSocket auth token check:", {
			hasToken: !!token,
			tokenLength: token?.length || 0,
			isAuthenticated: clientAuth.isAuthenticated(),
		});
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
	};

	return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};
