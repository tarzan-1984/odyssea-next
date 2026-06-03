import type { ChatRoom, ChatRoomParticipant } from "@/app-api/chatApi";
import type { UserData } from "@/app-api/api-types";
import { renderAvatar } from "@/helpers";

function isDispatcherRole(role?: string | null): boolean {
	const r = role?.toUpperCase().trim();
	return r === "DISPATCHER" || r === "DISPATCHER_TL";
}

/** Participant with Dispatcher role (prefers DISPATCHER over DISPATCHER_TL). */
export function findLoadChatDispatcherParticipant(
	chatRoom: ChatRoom
): ChatRoomParticipant | undefined {
	if (!chatRoom.participants?.length) return undefined;
	const dispatchers = chatRoom.participants.filter(p => isDispatcherRole(p.user.role));
	return (
		dispatchers.find(p => p.user.role?.toUpperCase().trim() === "DISPATCHER") ??
		dispatchers[0]
	);
}

export function dispatcherParticipantToAvatarUser(
	participant: ChatRoomParticipant
): UserData {
	return {
		firstName: participant.user.firstName,
		lastName: participant.user.lastName,
		role: participant.user.role,
		userColor: participant.user.userColor ?? null,
	};
}

export function getLoadChatAvatarUserData(chatRoom: ChatRoom): UserData | null {
	const dispatcher = findLoadChatDispatcherParticipant(chatRoom);
	if (!dispatcher) return null;
	return dispatcherParticipantToAvatarUser(dispatcher);
}

/** LOAD chat avatar: dispatcher initials on userColor background (no photo). */
export function renderLoadChatAvatar(chatRoom: ChatRoom, className = "w-12 h-12") {
	const userData = getLoadChatAvatarUserData(chatRoom);
	if (userData) {
		return renderAvatar(userData, className);
	}
	return renderAvatar(null, className);
}
