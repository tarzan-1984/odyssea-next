import type { ChatRoomParticipant, Message, User } from "@/app-api/chatApi";

export function formatUserFullName(
	user?: Pick<User, "firstName" | "lastName"> | null
): string {
	if (!user) return "";
	return [user.firstName, user.lastName]
		.map(x => (x == null ? "" : String(x).trim()))
		.filter(Boolean)
		.join(" ")
		.trim();
}

export function buildChatUserNameLookup(
	participants: ChatRoomParticipant[],
	messages?: Message[]
): Map<string, string> {
	const map = new Map<string, string>();

	for (const participant of participants) {
		const userId = participant.user?.id || participant.userId;
		const name = formatUserFullName(participant.user);
		if (userId && name) {
			map.set(userId, name);
		}
	}

	if (!messages) {
		return map;
	}

	for (const message of messages) {
		const senderId = message.sender?.id || message.senderId;
		const senderName = formatUserFullName(message.sender);
		if (senderId && senderName && !map.has(senderId)) {
			map.set(senderId, senderName);
		}

		for (const group of message.reactions ?? []) {
			for (const user of group.users ?? []) {
				const name = formatUserFullName(user);
				if (user.id && name && !map.has(user.id)) {
					map.set(user.id, name);
				}
			}
		}
	}

	return map;
}

export function resolveChatUserDisplayName(
	userId: string,
	options: {
		currentUserId?: string | null;
		participants?: ChatRoomParticipant[];
		nameLookup?: Map<string, string>;
	}
): string | null {
	if (userId === options.currentUserId) {
		return "You";
	}

	const fromLookup = options.nameLookup?.get(userId);
	if (fromLookup) {
		return fromLookup;
	}

	const participant = (options.participants ?? []).find(
		p => p.userId === userId || p.user?.id === userId
	);
	const name = formatUserFullName(participant?.user);
	return name || null;
}
