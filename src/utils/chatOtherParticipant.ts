import type { UserData } from "@/app-api/api-types";
import type { ChatRoom, User } from "@/app-api/chatApi";

export const OFFER_CHAT_LIST_AVATAR_CLASS = "w-10 h-10";
export const CHAT_HEADER_AVATAR_CLASS = "w-12 h-12";

export function getOtherChatParticipant(
	chatRoom: ChatRoom,
	currentUserId?: string | null
) {
	if (chatRoom.participants.length !== 2) return undefined;
	return chatRoom.participants.find(p => p.user.id !== currentUserId);
}

export function participantUserToAvatarData(user: User): UserData {
	const photo = user.avatar || user.profilePhoto || undefined;
	return {
		firstName: user.firstName,
		lastName: user.lastName,
		avatar: photo,
		role: user.role,
		userColor: user.userColor ?? null,
	};
}
