// Chat API client for communicating with internal Next.js API routes

const API_BASE_URL = "/api";

// Type for fetch options
type RequestOptions = {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
};

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	avatar?: string;
	role?: string;
}

export interface ChatRoom {
	id: string;
	name?: string;
	type: string;
	loadId?: string;
    avatar?: string;
	adminId?: string;
	isArchived: boolean;
	createdAt: string;
	updatedAt: string;
	participants: ChatRoomParticipant[];
	lastMessage?: Message;
	unreadCount?: number;
	isMuted?: boolean;
	isPinned?: boolean;
}

export interface ChatRoomParticipant {
	id: string;
	chatRoomId: string;
	userId: string;
	joinedAt: string;
	user: User;
}

export interface Message {
	id: string;
	chatRoomId: string;
	senderId: string;
	receiverId?: string;
	content: string;
	fileUrl?: string;
	fileName?: string;
	fileSize?: number;
	isRead: boolean;
	createdAt: string;
	sender: User;
	receiver?: User;
}

export interface SendMessageDto {
	chatRoomId: string;
	content: string;
	fileUrl?: string;
	fileName?: string;
	fileSize?: number;
}

export interface CreateChatRoomDto {
	name?: string;
	type: string;
	loadId?: string;
	participantIds: string[];
}

class ChatApiClient {
	private baseUrl: string;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		};

		// Authentication is handled by Next.js API routes using cookies
		// No need to manually add Authorization header

		const response = await fetch(url, {
			...options,
			headers,
			credentials: "include", // Include cookies for authentication
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return data.data || data || [];
	}

	// Chat Rooms
	async getChatRooms(): Promise<ChatRoom[]> {
		const response = await this.request<ChatRoom[]>("/chat-rooms");
		return response || [];
	}

	getChatRoom(chatRoomId: string): Promise<ChatRoom> {
		return this.request<ChatRoom>(`/chat-rooms/${chatRoomId}`);
	}

	createChatRoom(data: CreateChatRoomDto): Promise<ChatRoom> {
		return this.request<ChatRoom>("/chat-rooms/create", {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	// Messages
	async getMessages(
		chatRoomId: string,
		page: number = 1,
		limit: number = 9
	): Promise<{
		messages: Message[];
		hasMore: boolean;
		total: number;
	}> {
		const params = new URLSearchParams({
			page: page.toString(),
			limit: limit.toString(),
		});

		const response = await this.request<{
			messages: Message[];
			pagination: {
				page: number;
				limit: number;
				total: number;
				pages: number;
				hasMore: boolean;
			};
		}>(`/messages/chat-room/${chatRoomId}?${params}`);

		return {
			messages: response.messages || [],
			hasMore: response.pagination?.hasMore || false,
			total: response.pagination?.total || 0,
		};
	}

	async sendMessage(data: SendMessageDto): Promise<Message> {
		const response = await this.request<Message>("/messages", {
			method: "POST",
			body: JSON.stringify(data),
		});
		return response;
	}

	markMessageAsRead(messageId: string): Promise<void> {
		return this.request<void>(`/messages/${messageId}/read`, {
			method: "PATCH",
		});
	}

	markChatRoomAsRead(chatRoomId: string): Promise<void> {
		return this.request<void>(`/chat-rooms/${chatRoomId}/read`, {
			method: "PATCH",
		});
	}

	deleteChatRoom(chatRoomId: string): Promise<{ deleted: boolean; hidden?: boolean; left?: boolean }> {
		return this.request<{ deleted: boolean; hidden?: boolean; left?: boolean }>(`/chat-rooms/${chatRoomId}`, {
			method: "DELETE",
		});
	}

	toggleMuteChatRoom(chatRoomId: string): Promise<{ chatRoomId: string; userId: string; mute: boolean }> {
		return this.request<{ chatRoomId: string; userId: string; mute: boolean }>(`/chat-rooms/${chatRoomId}/mute`, {
			method: "PUT",
		});
	}

	togglePinChatRoom(chatRoomId: string): Promise<{ chatRoomId: string; userId: string; pin: boolean }> {
		return this.request<{ chatRoomId: string; userId: string; pin: boolean }>(`/chat-rooms/${chatRoomId}/pin`, {
			method: "PUT",
		});
	}

	muteChatRooms(chatRoomIds: string[], action: 'mute' | 'unmute'): Promise<{ userId: string; mutedCount: number; chatRoomIds: string[] }> {
		return this.request<{ userId: string; mutedCount: number; chatRoomIds: string[] }>("/chat-rooms/mute", {
			method: "PUT",
			body: JSON.stringify({ chatRoomIds, action }),
		});
	}

	// Users
	getUsers(): Promise<User[]> {
		return this.request<User[]>("/users");
	}

	getUser(userId: string): Promise<User> {
		return this.request<User>(`/users/${userId}`);
	}

	// File Upload
	getPresignedUrl(
		filename: string,
		contentType: string
	): Promise<{
		uploadUrl: string;
		fileUrl: string;
		key: string;
	}> {
		return this.request<{
			uploadUrl: string;
			fileUrl: string;
			key: string;
		}>("/storage/presign", {
			method: "POST",
			body: JSON.stringify({ filename, contentType }),
		});
	}

	// Authentication is now handled by Next.js API routes using cookies
	// No need for manual token management
}

// Create a singleton instance
export const chatApi = new ChatApiClient();

// Export the class for testing
export { ChatApiClient };
