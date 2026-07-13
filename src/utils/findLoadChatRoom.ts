import { chatApi, ChatRoom } from "@/app-api/chatApi";

export function matchesLoadChatId(room: ChatRoom, loadId: string): boolean {
	return room.type === "LOAD" && room.loadId?.trim() === loadId.trim();
}

export function findLoadChatInList(rooms: ChatRoom[], loadId: string): ChatRoom | undefined {
	return rooms.find(room => matchesLoadChatId(room, loadId));
}

/** Active LOAD chats only (excludes archived in main shipments list). Prefer newest. */
export function findActiveLoadChatInList(
	rooms: ChatRoom[],
	loadId: string
): ChatRoom | undefined {
	const matches = rooms.filter(
		room => matchesLoadChatId(room, loadId) && room.isLoadArchived !== true
	);
	if (matches.length === 0) return undefined;
	return matches.reduce((newest, room) => {
		const newestTs = Date.parse(String(newest.createdAt ?? newest.updatedAt ?? 0));
		const roomTs = Date.parse(String(room.createdAt ?? room.updatedAt ?? 0));
		return roomTs >= newestTs ? room : newest;
	});
}

/** Lookup LOAD chat by TMS load id via API (active or archived). */
export async function findLoadChatByLoadId(loadId: string): Promise<ChatRoom | null> {
	return chatApi.getLoadChatRoomByLoadId(loadId);
}

/** @deprecated Prefer findLoadChatByLoadId — scans paginated archive and may miss deep pages. */
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

	const room = await findLoadChatByLoadId(loadId);
	if (!room) return null;

	return { room, isArchived: room.isLoadArchived === true };
}
