import type { ChatRoom } from "@/app-api/chatApi";

/**
 * Per-user chat list fields must never be applied from room-wide broadcasts
 * (chatRoomUpdated / shared payloads). Unread lives in chat_room_participants
 * and is pushed only via chatUnreadCountUpdated → user_${id}.
 */
export function stripPerUserChatRoomFields<T extends Partial<ChatRoom>>(
	patch: T
): Omit<T, "unreadCount" | "isMuted" | "isPinned"> {
	const {
		unreadCount: _unreadCount,
		isMuted: _isMuted,
		isPinned: _isPinned,
		...safe
	} = patch;
	return safe;
}
