import type { Message } from "@/app-api/chatApi";
import type { ChatRoom } from "@/app-api/chatApi";

export function sortMessagesByCreatedAt(messages: Message[]): Message[] {
	return [...messages].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	);
}

/** Union multiple message lists by id (later sources win on field conflicts). */
export function mergeMessageLists(...sources: Message[][]): Message[] {
	const byId = new Map<string, Message>();

	for (const source of sources) {
		for (const msg of source) {
			if (!msg?.id) continue;
			const prev = byId.get(msg.id);
			byId.set(msg.id, prev ? { ...prev, ...msg } : msg);
		}
	}

	return sortMessagesByCreatedAt(Array.from(byId.values()));
}

export function filterMessagesForRoom(messages: Message[], chatRoomId: string): Message[] {
	return messages.filter(m => m.chatRoomId === chatRoomId);
}

/** True when chat list lastMessage is ahead of the newest message we have locally. */
export function messagesTailLagsBehindRoom(
	room: ChatRoom | undefined,
	localMessages: Message[]
): boolean {
	const lastRoomMsg = room?.lastMessage;
	if (!lastRoomMsg?.id) return false;

	const forRoom = filterMessagesForRoom(localMessages, room?.id ?? "");
	if (forRoom.length === 0) return true;

	const lastLocal = forRoom[forRoom.length - 1];
	if (lastLocal.id !== lastRoomMsg.id) return true;

	return (
		new Date(lastLocal.createdAt).getTime() !==
		new Date(lastRoomMsg.createdAt).getTime()
	);
}

export function shouldForceMessagesApiSync(
	room: ChatRoom | undefined,
	localMessages: Message[],
	options: { force?: boolean; cacheFresh: boolean }
): boolean {
	if (options.force) return true;
	if (!options.cacheFresh) return true;
	if ((room?.unreadCount ?? 0) > 0 && filterMessagesForRoom(localMessages, room?.id ?? "").length === 0) {
		return true;
	}
	return messagesTailLagsBehindRoom(room, localMessages);
}
