// Chat API client for communicating with internal Next.js API routes

const API_BASE_URL = "/api";

// Type for fetch options
type RequestOptions = {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	signal?: AbortSignal;
};

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	avatar?: string;
	profilePhoto?: string | null;
	/** Accent color for initials avatar (non-driver); ignored when role is DRIVER. */
	userColor?: string | null;
	role?: string;
	/** TMS / external user id (drivers in LOAD chats). */
	externalId?: string | null;
	/** When present (e.g. LOAD chat drivers), shown under role/time. */
	phone?: string | null;
}

export interface ChatRoom {
	id: string;
	name?: string;
	type: string;
	loadId?: string;
	offerId?: string | null;
	avatar?: string;
	adminId?: string;
	isArchived: boolean;
	/** LOAD chat: load-specific archive flag (cron after deliveryAt + configured hours). */
	isLoadArchived?: boolean;
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

export type ChatMessageAttachment = {
	fileUrl: string;
	fileName: string;
	fileSize?: number;
};

export type MessageReactionUser = Pick<
	User,
	"id" | "firstName" | "lastName" | "avatar" | "userColor" | "role"
>;

export type MessageReactionGroup = {
	emoji: string;
	users: MessageReactionUser[];
	hasCurrentUser: boolean;
};

export interface Message {
	id: string;
	chatRoomId: string;
	senderId: string;
	receiverId?: string;
	content: string;
	fileUrl?: string;
	fileName?: string;
	fileSize?: number;
	/** Legacy DB rows: JSON array. New multi-file messages use "|" in fileUrl/fileName instead. */
	attachments?: ChatMessageAttachment[] | null;
	isRead: boolean; // Global read status (true when any participant reads)
	readBy?: string[]; // Array of user IDs who read the message
	replyData?: {
		avatar?: string;
		time: string;
		content: string;
		senderName: string;
	};
	createdAt: string;
	sender: User;
	receiver?: User;
	reactions?: MessageReactionGroup[];
}

/** Pipe-delimited multiple files in one message (fileUrl and fileName aligned by index). */
export const MESSAGE_MULTI_FILE_SEPARATOR = '|';

/** Normalized list for UI when a message has 2+ attachments; otherwise null (use fileUrl). */
export function getMessageMultiAttachments(message: Message): ChatMessageAttachment[] | null {
	const raw = message.attachments;
	if (Array.isArray(raw) && raw.length >= 2) {
		const out: ChatMessageAttachment[] = [];
		for (const item of raw) {
			if (!item || typeof item !== "object") continue;
			const o = item as Record<string, unknown>;
			const fileUrl = typeof o.fileUrl === "string" ? o.fileUrl : "";
			const fileName = typeof o.fileName === "string" ? o.fileName : "";
			if (!fileUrl || !fileName) continue;
			const fileSize = typeof o.fileSize === "number" ? o.fileSize : undefined;
			out.push({ fileUrl, fileName, fileSize });
		}
		if (out.length >= 2) return out;
	}

	const urlStr = message.fileUrl?.trim();
	const nameStr = message.fileName?.trim();
	if (!urlStr || !nameStr) return null;
	const urls = urlStr.split(MESSAGE_MULTI_FILE_SEPARATOR);
	const names = nameStr.split(MESSAGE_MULTI_FILE_SEPARATOR);
	if (urls.length < 2 || urls.length !== names.length) return null;

	const out: ChatMessageAttachment[] = [];
	for (let i = 0; i < urls.length; i++) {
		const fileUrl = urls[i]?.trim() ?? "";
		const fileName = names[i]?.trim() ?? "";
		if (!fileUrl || !fileName) continue;
		const fileSize = i === 0 && typeof message.fileSize === "number" ? message.fileSize : undefined;
		out.push({ fileUrl, fileName, fileSize });
	}
	return out.length >= 2 ? out : null;
}

export interface SendMessageDto {
	chatRoomId: string;
	content: string;
	fileUrl?: string;
	fileName?: string;
	fileSize?: number;
	attachments?: ChatMessageAttachment[];
	replyData?: {
		avatar?: string;
		time: string;
		content: string;
		senderName: string;
	};
}

// Helper function to check if a message is read by a specific user
export const isMessageReadByUser = (message: Message, userId: string): boolean => {
	return message.readBy?.includes(userId) || false;
};

// Helper function to get read count for a message
export const getMessageReadCount = (message: Message): number => {
	return message.readBy?.length || 0;
};

export interface CreateChatRoomDto {
	name?: string;
	type: string;
	loadId?: string;
	participantIds: string[];
}

export type SyncMessagesBatchRoomRequest = {
	chatRoomId: string;
	lastMessageId?: string | null;
};

export type SyncMessagesBatchRoomResult = {
	chatRoomId: string;
	messages: Message[];
	unreadCount: number;
	lastMessage: Message | null;
	upToDate: boolean;
	hasMore?: boolean;
	skipped?: boolean;
};

export type SyncMessagesBatchResponse = {
	rooms: SyncMessagesBatchRoomResult[];
};

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

	/** Paginated LOAD chats where is_load_archived (main list excludes these). */
	async getArchivedLoadChatRooms(
		page: number = 1,
		limit: number = 10
	): Promise<{
		chatRooms: ChatRoom[];
		pagination: { page: number; limit: number; hasMore: boolean };
	}> {
		const params = new URLSearchParams({
			page: page.toString(),
			limit: limit.toString(),
		});

		const response = await this.request<{
			chatRooms: ChatRoom[];
			pagination: { page: number; limit: number; hasMore: boolean };
		}>(`/chat-rooms/load-archived?${params}`);

		return {
			chatRooms: Array.isArray(response?.chatRooms) ? response.chatRooms : [],
			pagination: response?.pagination ?? {
				page,
				limit,
				hasMore: false,
			},
		};
	}

	/** LOAD chat by TMS load id (active or archived). Returns null when not found or no access. */
	async getLoadChatRoomByLoadId(loadId: string): Promise<ChatRoom | null> {
		const trimmed = loadId?.trim();
		if (!trimmed) return null;

		try {
			const room = await this.request<ChatRoom>(
				`/chat-rooms/by-load/${encodeURIComponent(trimmed)}`
			);
			return room?.id ? room : null;
		} catch {
			return null;
		}
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
		limit: number = 9,
		options?: { signal?: AbortSignal }
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
		}>(`/messages/chat-room/${chatRoomId}?${params}`, {
			signal: options?.signal,
		});

		return {
			messages: response.messages || [],
			hasMore: response.pagination?.hasMore || false,
			total: response.pagination?.total || 0,
		};
	}

	async syncMessagesBatch(
		rooms: SyncMessagesBatchRoomRequest[]
	): Promise<SyncMessagesBatchResponse> {
		const response = await this.request<SyncMessagesBatchResponse | SyncMessagesBatchResponse[]>(
			"/messages/sync-batch",
			{
				method: "POST",
				body: JSON.stringify({ rooms }),
			}
		);
		if (
			response &&
			typeof response === "object" &&
			!Array.isArray(response) &&
			Array.isArray(response.rooms)
		) {
			return response;
		}
		return { rooms: [] };
	}

	// Get files (messages with fileUrl) from chat room
	async getFiles(
		chatRoomId: string,
		page: number = 1,
		limit: number = 10
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
		}>(`/messages/chat-room/${chatRoomId}/files?${params}`);

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

	setMessageReaction(
		messageId: string,
		emoji: string,
	): Promise<{
		messageId: string;
		chatRoomId: string;
		reactions: MessageReactionGroup[];
	}> {
		return this.request(`/messages/${messageId}/reactions`, {
			method: "POST",
			body: JSON.stringify({ emoji }),
		});
	}

	removeMessageReaction(messageId: string): Promise<{
		messageId: string;
		chatRoomId: string;
		reactions: MessageReactionGroup[];
	}> {
		return this.request(`/messages/${messageId}/reactions`, {
			method: "DELETE",
		});
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

	markAllMessagesAsReadByChatRooms(chatRoomIds: string[]): Promise<{
		success: boolean;
		chatRoomIds: string[];
		messageIds: string[];
		messagesByChatRoom: Record<string, string[]>;
	}> {
		return this.request<{
			success: boolean;
			chatRoomIds: string[];
			messageIds: string[];
			messagesByChatRoom: Record<string, string[]>;
		}>("/messages/read-all", {
			method: "PUT",
			body: JSON.stringify({ chatRoomIds }),
		});
	}

	deleteChatRoom(chatRoomId: string): Promise<{ deleted: boolean; hidden?: boolean; left?: boolean }> {
		return this.request<{ deleted: boolean; hidden?: boolean; left?: boolean }>(`/chat-rooms/${chatRoomId}`, {
			method: "DELETE",
		});
	}

	deleteLoadChat(loadId: string): Promise<{ started: boolean; chatRoomId: string; jobId: string }> {
		return this.request<{ started: boolean; chatRoomId: string; jobId: string }>(`/delete_load_chat`, {
			method: "POST",
			body: JSON.stringify({ load_id: loadId }),
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
