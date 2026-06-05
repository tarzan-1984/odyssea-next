import type { ChatRoom } from "@/app-api/chatApi";

export function normalizePhoneDigits(value: string): string {
	return value.replace(/\D/g, "");
}

function phoneMatchesQuery(phoneRaw: string, qLower: string, qDigits: string): boolean {
	const phone = phoneRaw.trim();
	if (!phone) return false;
	if (phone.toLowerCase().includes(qLower)) return true;
	return qDigits.length > 0 && normalizePhoneDigits(phone).includes(qDigits);
}

function collectSearchPhones(chatRoom: ChatRoom): string[] {
	const phones: string[] = [];
	for (const participant of chatRoom.participants) {
		const phone = String(participant.user.phone ?? "").trim();
		if (phone) phones.push(phone);
	}
	const lastMessage = chatRoom.lastMessage;
	if (lastMessage?.sender?.phone) {
		phones.push(String(lastMessage.sender.phone));
	}
	if (lastMessage?.receiver?.phone) {
		phones.push(String(lastMessage.receiver.phone));
	}
	return phones;
}

/**
 * Match chat room against sidebar search (display name + optional participant phones).
 */
export function chatRoomMatchesSearchQuery(
	chatRoom: ChatRoom,
	query: string,
	getDisplayName: (room: ChatRoom) => string,
	options?: { includeParticipantPhones?: boolean }
): boolean {
	const q = query.trim();
	if (!q) return true;

	const qLower = q.toLowerCase();
	if (getDisplayName(chatRoom).toLowerCase().includes(qLower)) {
		return true;
	}

	if (options?.includeParticipantPhones === false) {
		return false;
	}

	const qDigits = normalizePhoneDigits(q);
	for (const phone of collectSearchPhones(chatRoom)) {
		if (phoneMatchesQuery(phone, qLower, qDigits)) {
			return true;
		}
	}

	return false;
}
