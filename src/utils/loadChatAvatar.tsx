import type { ChatRoom, ChatRoomParticipant } from "@/app-api/chatApi";
import type { UserData } from "@/app-api/api-types";
import { renderAvatar } from "@/helpers";

const LOAD_CHAT_FALLBACK_ADMIN_EXTERNAL_ID = "20";

function isDispatcherRole(role?: string | null): boolean {
	const r = role?.toUpperCase().trim();
	return r === "DISPATCHER" || r === "DISPATCHER_TL";
}

function isExpediteManagerRole(role?: string | null): boolean {
	return role?.toUpperCase().trim() === "EXPEDITE_MANAGER";
}

function isVisibleLoadChatParticipant(participant: ChatRoomParticipant): boolean {
	const hidden = (participant as ChatRoomParticipant & { hideParticipant?: boolean })
		.hideParticipant;
	return hidden !== true;
}

function getVisibleParticipants(chatRoom: ChatRoom): ChatRoomParticipant[] {
	return (chatRoom.participants ?? []).filter(isVisibleLoadChatParticipant);
}

function getAllParticipants(chatRoom: ChatRoom): ChatRoomParticipant[] {
	return chatRoom.participants ?? [];
}

function matchesExternalId(externalId: unknown, target: string): boolean {
	return String(externalId ?? "").trim() === target;
}

/** Participant with Dispatcher role (prefers DISPATCHER over DISPATCHER_TL). */
export function findLoadChatDispatcherParticipant(
	chatRoom: ChatRoom
): ChatRoomParticipant | undefined {
	if (!chatRoom.participants?.length) return undefined;

	const visible = getVisibleParticipants(chatRoom);
	const dispatchers = visible.filter(p => isDispatcherRole(p.user.role));
	return (
		dispatchers.find(p => p.user.role?.toUpperCase().trim() === "DISPATCHER") ??
		dispatchers[0]
	);
}

/**
 * LOAD chat avatar participant:
 * dispatcher → EXPEDITE_MANAGER → admin with externalId 20.
 */
export function findLoadChatAvatarParticipant(
	chatRoom: ChatRoom
): ChatRoomParticipant | undefined {
	const dispatcher = findLoadChatDispatcherParticipant(chatRoom);
	if (dispatcher) return dispatcher;

	const visible = getVisibleParticipants(chatRoom);
	const allParticipants = getAllParticipants(chatRoom);

	const expediteManager =
		visible.find(p => isExpediteManagerRole(p.user.role)) ??
		allParticipants.find(p => isExpediteManagerRole(p.user.role));
	if (expediteManager) return expediteManager;

	// Auto-added admins are hidden participants — include them for fallback avatar.
	return allParticipants.find(p =>
		matchesExternalId(p.user.externalId, LOAD_CHAT_FALLBACK_ADMIN_EXTERNAL_ID)
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
	const participant = findLoadChatAvatarParticipant(chatRoom);
	if (!participant) return null;
	return dispatcherParticipantToAvatarUser(participant);
}

/** LOAD chat avatar: dispatcher / expedite manager / fallback admin initials on userColor. */
export function renderLoadChatAvatar(chatRoom: ChatRoom, className = "w-12 h-12") {
	const userData = getLoadChatAvatarUserData(chatRoom);
	if (userData) {
		return renderAvatar(userData, className);
	}
	return renderAvatar(null, className);
}
