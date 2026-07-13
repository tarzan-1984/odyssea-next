import type { ChatRoom } from "@/app-api/chatApi";

export function getOfferIdFromChatRoom(chatRoom: ChatRoom): string | null {
	if (chatRoom.offerId) return String(chatRoom.offerId).trim();
	if ((chatRoom.type || "").toUpperCase().trim() !== "OFFER" || !chatRoom.name) return null;
	const match = chatRoom.name.match(/\(id:\s*([^)]+)\)/);
	return match ? match[1].trim() : null;
}

/** Driver externalId for the OFFER chat (the non-current participant). */
export function getOfferDriverUnitId(
	chatRoom: ChatRoom,
	currentUserId?: string | null
): string | null {
	const otherParticipants = chatRoom.participants.filter(
		p => p.user.id !== currentUserId
	);
	const driverParticipant =
		otherParticipants.find(p => (p.user.role || "").toUpperCase().trim() === "DRIVER") ??
		otherParticipants[0];
	const externalId = driverParticipant?.user.externalId?.trim();
	return externalId || null;
}

export function findOfferChatRoom(
	chatRooms: ChatRoom[],
	offerId: string,
	unitId?: string | null,
	currentUserId?: string | null
): ChatRoom | undefined {
	const normalizedOfferId = offerId.trim();
	const normalizedUnitId = unitId?.trim() ?? null;

	return chatRooms.find(room => {
		if ((room.type || "").toUpperCase().trim() !== "OFFER") return false;
		if (getOfferIdFromChatRoom(room) !== normalizedOfferId) return false;
		if (!normalizedUnitId) return true;
		return getOfferDriverUnitId(room, currentUserId) === normalizedUnitId;
	});
}

export function buildOfferChatUrl(offerId: string, unitId?: string | null): string {
	const params = new URLSearchParams();
	params.set("offer", offerId.trim());
	const unit = unitId?.trim();
	if (unit) params.set("unit", unit);
	return `/chat?${params.toString()}`;
}

export function buildLoadChatUrl(loadId: string, roomId?: string | null): string {
	const params = new URLSearchParams();
	params.set("load", loadId.trim());
	const room = roomId?.trim();
	if (room) params.set("room", room);
	return `/chat?${params.toString()}`;
}

export function buildChatUrlForRoom(
	chatRoom: ChatRoom,
	currentUserId?: string | null
): string {
	const type = (chatRoom.type || "").toUpperCase().trim();
	if (type === "LOAD") {
		const loadId = String(chatRoom.loadId ?? "").trim();
		if (loadId) return buildLoadChatUrl(loadId, chatRoom.id);
	}
	if (type === "OFFER") {
		const offerId = getOfferIdFromChatRoom(chatRoom);
		if (offerId) {
			const unitId = getOfferDriverUnitId(chatRoom, currentUserId);
			return buildOfferChatUrl(offerId, unitId);
		}
	}
	return `/chat?room=${encodeURIComponent(chatRoom.id)}`;
}
