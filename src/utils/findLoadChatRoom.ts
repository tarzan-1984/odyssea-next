import { chatApi, ChatRoom } from "@/app-api/chatApi";

export function matchesLoadChatId(room: ChatRoom, loadId: string): boolean {
	return room.type === "LOAD" && room.loadId?.trim() === loadId;
}

export function findLoadChatInList(rooms: ChatRoom[], loadId: string): ChatRoom | undefined {
	return rooms.find(room => matchesLoadChatId(room, loadId));
}

/** Active LOAD chats only (excludes archived in main shipments list). */
export function findActiveLoadChatInList(
	rooms: ChatRoom[],
	loadId: string
): ChatRoom | undefined {
	return rooms.find(
		room => matchesLoadChatId(room, loadId) && room.isLoadArchived !== true
	);
}

export async function findArchivedLoadChat(loadId: string): Promise<ChatRoom | null> {
	let page = 1;
	const limit = 50;

	for (let attempt = 0; attempt < 5; attempt++) {
		const { chatRooms, pagination } = await chatApi.getArchivedLoadChatRooms(page, limit);
		const found = findLoadChatInList(chatRooms, loadId);
		if (found) return found;
		if (!pagination.hasMore) break;
		page += 1;
	}

	return null;
}

export async function resolveLoadChatRoom(
	rooms: ChatRoom[],
	loadId: string
): Promise<{ room: ChatRoom; isArchived: boolean } | null> {
	const active = findActiveLoadChatInList(rooms, loadId);
	if (active) return { room: active, isArchived: false };

	const archived = await findArchivedLoadChat(loadId);
	if (archived) return { room: archived, isArchived: true };

	return null;
}
